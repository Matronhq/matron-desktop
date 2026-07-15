/*
Copyright 2018-2025 New Vector Ltd.
Copyright 2026 Matron Contributors.
Copyright 2017-2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

// Squirrel on windows starts the app with various flags as hooks to tell us when we've been installed/uninstalled etc.
import "./squirrelhooks.js";
import { app, BrowserWindow, Menu, autoUpdater, dialog, type Input, type Event, protocol } from "electron";
import path, { dirname } from "node:path";
import windowStateKeeper from "electron-window-state";
import { promises as afs } from "node:fs";
import { URL, fileURLToPath } from "node:url";
import minimist from "minimist";

import "./ipc.js";
import "./journal-request.js";
import "./badge.js";
import * as tray from "./tray.js";
import Store from "./store.js";
import { buildMenuTemplate } from "./menu.js";
import webContentsHandler from "./webcontents-handler.js";
import * as updater from "./updater.js";
import DeepLinkHandler from "./deep-link.js";
import { _t } from "./language-helper.js";
import { setupMacosTitleBar } from "./macos-titlebar.js";
import { type Json, loadJsonFile } from "./utils.js";
import { readBuildConfig } from "./build-config.js";
import { APP_HOST, APP_SCHEME, APP_URL } from "./app-url.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const argv = minimist(process.argv, {
    alias: { help: "h" },
});

if (argv["help"]) {
    console.log("Options:");
    console.log("  --profile-dir {path}: Path to where to store the profile.");
    console.log(
        `  --profile {name}:     Name of alternate profile to use, allows for running multiple accounts.\n` +
            `                         Ignored if --profile-dir is specified.\n` +
            `                         The MATRON_PROFILE_DIR environment variable may be used to change the default profile path.\n` +
            `                         It is overridden by --profile-dir, but can be combined with --profile.`,
    );
    console.log("  --devtools:           Install and use react-devtools and react-perf.");
    console.log(
        `  --config:             Path to the config.json file. May also be specified via the MATRON_DESKTOP_CONFIG_JSON environment variable.\n` +
            `                         Otherwise use the default user location '${app.getPath("userData")}'`,
    );
    console.log("  --no-update:          Disable automatic updating.");
    console.log("  --hidden:             Start the application hidden in the system tray.");
    console.log("  --help:               Displays this help message.");
    console.log("And more such as --proxy, see:" + "https://electronjs.org/docs/api/command-line-switches");
    app.exit();
}

const LocalConfigLocation = process.env.MATRON_DESKTOP_CONFIG_JSON ?? argv["config"];
const LocalConfigFilename = "config.json";
const DevWebappUrl = process.env.MATRON_DESKTOP_WEBAPP_URL;

const buildConfig = readBuildConfig();
new DeepLinkHandler(buildConfig.protocol);

let userDataPath: string;

if (argv["profile-dir"]) {
    userDataPath = argv["profile-dir"];
} else {
    userDataPath = process.env.MATRON_PROFILE_DIR ?? app.getPath("userData");
    if (argv["profile"]) {
        userDataPath += "-" + argv["profile"];
    }
}
app.setPath("userData", userDataPath);

async function tryPaths(name: string, root: string, rawPaths: string[]): Promise<string> {
    // Make everything relative to root
    const paths = rawPaths.map((p) => path.join(root, p));

    for (const p of paths) {
        try {
            await afs.stat(p);
            return p + "/";
        } catch {}
    }
    console.log(`Couldn't find ${name} files in any of: `);
    for (const p of paths) {
        console.log("\t" + path.resolve(p));
    }
    throw new Error(`Failed to find ${name} files`);
}

let asarPathPromise: Promise<string> | undefined;
// Get the webapp resource file path, memoizes result
function getAsarPath(): Promise<string> {
    if (!asarPathPromise) {
        asarPathPromise = tryPaths("webapp", __dirname, [
            // If run from the source checkout, this will be in the directory above
            "../webapp.asar",
            // but if run from a packaged application, electron-main.js will be in
            // a different asar file, so it will be two levels above
            "../../webapp.asar",
            // also try without the 'asar' suffix to allow symlinking in a directory
            "../webapp",
            // from a packaged application
            "../../webapp",
        ]);
    }

    return asarPathPromise;
}

function loadLocalConfigFile(): Json {
    if (LocalConfigLocation) {
        console.log("Loading local config: " + LocalConfigLocation);
        return loadJsonFile(LocalConfigLocation);
    } else {
        const configDir = app.getPath("userData");
        console.log(`Loading local config: ${path.join(configDir, LocalConfigFilename)}`);
        return loadJsonFile(configDir, LocalConfigFilename);
    }
}

let loadConfigPromise: Promise<void> | undefined;
// Loads the config from asar, and applies a config.json from userData atop if one exists
// Writes config to `global.matronConfig`. Idempotent, returns the same promise on subsequent calls.
function loadConfig(): Promise<void> {
    if (loadConfigPromise) return loadConfigPromise;

    async function actuallyLoadConfig(): Promise<void> {
        if (DevWebappUrl) {
            console.log(`Loading remote dev webapp: ${DevWebappUrl}`);
            global.matronConfig = {};
        } else {
            const asarPath = await getAsarPath();

            try {
                console.log(`Loading app config: ${path.join(asarPath, LocalConfigFilename)}`);
                global.matronConfig = loadJsonFile(asarPath, LocalConfigFilename);
            } catch {
                // it would be nice to check the error code here and bail if the config
                // is unparsable, but we get MODULE_NOT_FOUND in the case of a missing
                // file or invalid json, so node is just very unhelpful.
                // Continue with the defaults (ie. an empty config)
                global.matronConfig = {};
            }
        }

        try {
            // Load local config and use it to override values from the one baked with the build
            const localConfig = loadLocalConfigFile();

            global.matronConfig = Object.assign(global.matronConfig, localConfig);
        } catch (e) {
            if (e instanceof SyntaxError) {
                await app.whenReady();
                void dialog.showMessageBox({
                    type: "error",
                    title: `Your ${global.matronConfig.brand || "Matron"} is misconfigured`,
                    message:
                        `Your custom ${global.matronConfig.brand || "Matron"} configuration contains invalid JSON. ` +
                        `Please correct the problem and reopen ${global.matronConfig.brand || "Matron"}.`,
                    detail: e.message || "",
                });
            }

            // Could not load local config, this is expected in most cases.
        }
    }
    loadConfigPromise = actuallyLoadConfig();
    return loadConfigPromise;
}

// Set up globals for Tray
async function setupGlobals(): Promise<void> {
    await loadConfig();

    // Figure out the tray icon path & brand name
    const iconFile = `icon.${process.platform === "win32" ? "ico" : "png"}`;
    const resourceRoot = DevWebappUrl ? path.join(__dirname, "..") : path.dirname(await getAsarPath());
    global.trayConfig = {
        icon_path: path.join(resourceRoot, "build", iconFile),
        brand: global.matronConfig.brand || "Matron",
    };
}

global.appQuitting = false;

const exitShortcuts: Array<(input: Input, platform: string) => boolean> = [
    (input, platform): boolean => platform !== "darwin" && input.alt && input.key.toUpperCase() === "F4",
    (input, platform): boolean => platform !== "darwin" && input.control && input.key.toUpperCase() === "Q",
    (input, platform): boolean =>
        platform === "darwin" && input.meta && !input.control && input.key.toUpperCase() === "Q",
];

void loadConfig();

// handle uncaught errors otherwise it displays
// stack traces in popup dialogs, which is terrible (which
// it will do any time the auto update poke fails, and there's
// no other way to catch this error).
// Assuming we generally run from the console when developing,
// this is far preferable.
process.on("uncaughtException", function (error: Error): void {
    console.log("Unhandled exception", error);
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    console.log("Other instance detected: exiting");
    app.exit();
}

// Register the scheme the app is served from as 'standard'
// which allows things like relative URLs and IndexedDB to
// work.
// Also mark it as secure (ie. accessing resources from this
// protocol and HTTPS won't trigger mixed content warnings).
protocol.registerSchemesAsPrivileged([
    {
        scheme: APP_SCHEME,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
        },
    },
]);

// Turn the sandbox on for *all* windows we might generate. Doing this means we don't
// have to specify a `sandbox: true` to each BrowserWindow.
//
// This also fixes an issue with window.open where if we only specified the sandbox
// on the main window we'd run into cryptic "ipc_renderer be broke" errors. Turns out
// it's trying to jump the sandbox and make some calls into electron, which it can't
// do when half of it is sandboxed. By turning on the sandbox for everything, the new
// window (no matter how temporary it may be) is also sandboxed, allowing for a clean
// transition into the user's browser.
app.enableSandbox();

const store = Store.initialize(); // must be called before any async actions

// Disable hardware acceleration if the setting has been set.
if (store.get("disableHardwareAcceleration")) {
    console.log("Disabling hardware acceleration.");
    app.disableHardwareAcceleration();
}

app.on("ready", async () => {
    console.debug("Reached Electron ready state");

    let asarPath: string | undefined;

    try {
        if (!DevWebappUrl) {
            asarPath = await getAsarPath();
        }
        await setupGlobals();
    } catch (e) {
        console.log("App setup failed: exiting", e);
        process.exit(1);
        // process.exit doesn't cause node to stop running code immediately,
        // so return (we could let the exception propagate but then we end up
        // with node printing all sorts of stuff about unhandled exceptions
        // when we want the actual error to be as obvious as possible).
        return;
    }

    if (argv["devtools"]) {
        try {
            const { installExtension, REACT_DEVELOPER_TOOLS } = await import("electron-devtools-installer");
            installExtension(REACT_DEVELOPER_TOOLS)
                .then((ext) => console.log(`Added Extension: ${ext.name}`))
                .catch((err: unknown) => console.log("An error occurred: ", err));
        } catch (e) {
            console.log(e);
        }
    }

    if (asarPath) {
        const localAsarPath = asarPath;
        protocol.registerFileProtocol(APP_SCHEME, (request, callback) => {
            if (request.method !== "GET") {
                callback({ error: -322 }); // METHOD_NOT_SUPPORTED from chromium/src/net/base/net_error_list.h
                return null;
            }

            const parsedUrl = new URL(request.url);
            if (parsedUrl.protocol !== `${APP_SCHEME}:`) {
                callback({ error: -302 }); // UNKNOWN_URL_SCHEME
                return;
            }
            if (parsedUrl.host !== APP_HOST) {
                callback({ error: -105 }); // NAME_NOT_RESOLVED
                return;
            }

            const target = parsedUrl.pathname.split("/");

            // path starts with a '/'
            if (target[0] !== "") {
                callback({ error: -6 }); // FILE_NOT_FOUND
                return;
            }

            if (target[target.length - 1] == "") {
                target[target.length - 1] = "index.html";
            }

            // Normalise the base dir and the target path separately, then make sure
            // the target path isn't trying to back out beyond its root
            const baseDir = path.normalize(localAsarPath);

            const relTarget = path.normalize(path.join(...target.slice(1)));
            if (relTarget.startsWith("..")) {
                callback({ error: -6 }); // FILE_NOT_FOUND
                return;
            }
            const absTarget = path.join(baseDir, relTarget);

            callback({
                path: absTarget,
            });
        });
    }

    // Minimist parses `--no-`-prefixed arguments as booleans with value `false` rather than verbatim.
    if (argv["update"] === false) {
        console.log("Auto update disabled via command line flag");
    } else if (global.matronConfig["update_base_url"]) {
        void updater.start(global.matronConfig["update_base_url"]);
    } else {
        console.log("No update_base_url is defined: auto update is disabled");
    }

    tray.initApplicationMenu();
    Menu.setApplicationMenu(buildMenuTemplate());

    // Load the previous window state with fallback to defaults
    const mainWindowState = windowStateKeeper({
        defaultWidth: 1024,
        defaultHeight: 768,
    });

    console.debug("Opening main window");
    const preloadScript = path.normalize(`${__dirname}/preload.cjs`);
    global.mainWindow = new BrowserWindow({
        // https://www.electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
        backgroundColor: "#fff",

        titleBarStyle: process.platform === "darwin" ? "hidden" : "default",
        trafficLightPosition: { x: 9, y: 8 },

        icon: global.trayConfig.icon_path,
        show: false,
        autoHideMenuBar: store.get("autoHideMenuBar"),

        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        webPreferences: {
            preload: preloadScript,
            nodeIntegration: false,
            //sandbox: true, // We enable sandboxing from app.enableSandbox() above
            contextIsolation: true,
            webgl: true,
        },
    });

    global.mainWindow.setContentProtection(store.get("enableContentProtection"));

    void global.mainWindow.loadURL(DevWebappUrl ?? APP_URL);

    if (process.platform === "darwin") {
        setupMacosTitleBar(global.mainWindow);
    }

    // Handle spellchecker
    // For some reason spellCheckerEnabled isn't persisted, so we have to use the store here
    global.mainWindow.webContents.session.setSpellCheckerEnabled(store.get("spellCheckerEnabled", true));

    // Create trayIcon icon
    if (store.get("minimizeToTray")) tray.create(global.trayConfig);

    global.mainWindow.once("ready-to-show", () => {
        if (!global.mainWindow) return;
        mainWindowState.manage(global.mainWindow);

        if (!argv["hidden"]) {
            global.mainWindow.show();
        } else {
            // hide here explicitly because window manage above sometimes shows it
            global.mainWindow.hide();
        }
    });

    global.mainWindow.webContents.on("before-input-event", (event: Event, input: Input): void => {
        const exitShortcutPressed =
            input.type === "keyDown" && exitShortcuts.some((shortcutFn) => shortcutFn(input, process.platform));

        // We only care about the exit shortcuts here
        if (!exitShortcutPressed || !global.mainWindow) return;

        // Prevent the default behaviour
        event.preventDefault();

        // Let's ask the user if they really want to exit the app
        const shouldWarnBeforeExit = store.get("warnBeforeExit", true);
        if (shouldWarnBeforeExit) {
            const shouldCancelCloseRequest =
                dialog.showMessageBoxSync(global.mainWindow, {
                    type: "question",
                    buttons: [
                        _t("action|cancel"),
                        _t("action|close_brand", {
                            brand: global.matronConfig.brand || "Matron",
                        }),
                    ],
                    message: _t("confirm_quit"),
                    defaultId: 1,
                    cancelId: 0,
                }) === 0;
            if (shouldCancelCloseRequest) return;
        }

        // Exit the app
        app.exit();
    });

    global.mainWindow.on("closed", () => {
        global.mainWindow = null;
    });
    global.mainWindow.on("close", async (e) => {
        // If we are not quitting and have a tray icon then minimize to tray
        if (!global.appQuitting && (tray.hasTray() || process.platform === "darwin")) {
            // On Mac, closing the window just hides it
            // (this is generally how single-window Mac apps
            // behave, eg. Mail.app)
            e.preventDefault();

            if (global.mainWindow?.isFullScreen()) {
                global.mainWindow.once("leave-full-screen", () => global.mainWindow?.hide());

                global.mainWindow.setFullScreen(false);
            } else {
                global.mainWindow?.hide();
            }

            return false;
        }
    });

    if (process.platform === "win32") {
        // Handle forward/backward mouse buttons in Windows
        global.mainWindow.on("app-command", (e, cmd) => {
            if (cmd === "browser-backward" && global.mainWindow?.webContents.canGoBack()) {
                global.mainWindow.webContents.goBack();
            } else if (cmd === "browser-forward" && global.mainWindow?.webContents.canGoForward()) {
                global.mainWindow.webContents.goForward();
            }
        });
    }

    webContentsHandler(global.mainWindow.webContents);
});

app.on("window-all-closed", () => {
    app.quit();
});

app.on("activate", () => {
    global.mainWindow?.show();
});

function beforeQuit(): void {
    global.appQuitting = true;
}

app.on("before-quit", beforeQuit);
autoUpdater.on("before-quit-for-update", beforeQuit);

app.on("second-instance", (ev, commandLine, workingDirectory) => {
    // If other instance launched with --hidden then skip showing window
    if (commandLine.includes("--hidden")) return;

    // Someone tried to run a second instance, we should focus our window.
    if (global.mainWindow) {
        if (!global.mainWindow.isVisible()) global.mainWindow.show();
        if (global.mainWindow.isMinimized()) global.mainWindow.restore();
        global.mainWindow.focus();
    }
});

// This is required to make notification handlers work
// on Windows 8.1/10/11 (and is a noop on other platforms);
// It must also match the ID found in 'electron-builder'
// in order to get the title and icon to show up correctly.
// Ref: https://stackoverflow.com/a/77314604/3525780
app.setAppUserModelId(buildConfig.appId);
