#!/usr/bin/env -S npx tsx

/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import minimist from "minimist";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

interface Options {
    webDir: string;
    webUrl: string;
    config: string;
    profile: string;
    devtools: boolean;
}

function readOptions(): Options {
    const argv = minimist(process.argv.slice(2), {
        boolean: ["devtools"],
        string: ["web-dir", "web-url", "config", "profile"],
        default: {
            "web-dir": "../matron-web",
            "web-url": "http://localhost:8080",
            config: "matron/release/config.json",
            profile: "hot-dev",
            devtools: false,
        },
    });

    return {
        webDir: path.resolve(desktopRoot, argv["web-dir"]),
        webUrl: new URL(argv["web-url"]).href,
        config: path.resolve(desktopRoot, argv.config),
        profile: argv.profile,
        devtools: argv.devtools,
    };
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function spawnCommand(
    command: string,
    args: string[],
    options: { cwd: string; env?: NodeJS.ProcessEnv; detached?: boolean },
): ChildProcess {
    return spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: "inherit",
        detached: options.detached,
    });
}

function stopProcess(child: ChildProcess | undefined, detached = false): void {
    if (!child?.pid || child.killed) return;

    try {
        if (process.platform === "win32" || !detached) {
            child.kill();
        } else {
            process.kill(-child.pid, "SIGTERM");
        }
    } catch {
        // Process may already have exited.
    }
}

function runCommand(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd, stdio: "inherit" });
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
            }
        });
    });
}

async function isServerReady(webUrl: string): Promise<boolean> {
    try {
        const response = await fetch(webUrl);
        return response.ok;
    } catch {
        return false;
    }
}

async function waitForServer(webUrl: string, webProcess?: ChildProcess): Promise<void> {
    const startedAt = Date.now();
    const timeoutMs = 90_000;

    while (Date.now() - startedAt < timeoutMs) {
        if (await isServerReady(webUrl)) return;

        if (webProcess && webProcess.exitCode !== null) {
            throw new Error(`Matron Web dev server exited before ${webUrl} became ready`);
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Timed out waiting for Matron Web dev server at ${webUrl}`);
}

async function ensureWebConfig(options: Options): Promise<void> {
    const webConfigPath = path.join(options.webDir, "config.json");
    if (await fileExists(webConfigPath)) return;

    console.log(`Creating ${webConfigPath} from ${options.config}`);
    await fs.copyFile(options.config, webConfigPath);
}

async function main(): Promise<void> {
    const options = readOptions();
    const webPackageJson = path.join(options.webDir, "package.json");
    if (!(await fileExists(webPackageJson))) {
        throw new Error(`Could not find Matron Web at ${options.webDir}. Pass --web-dir to use a different checkout.`);
    }

    await ensureWebConfig(options);

    console.log("Building desktop main process...");
    await runCommand(pnpmCommand, ["run", "build:ts"], desktopRoot);

    let webProcess: ChildProcess | undefined;
    if (await isServerReady(options.webUrl)) {
        console.log(`Using existing Matron Web dev server at ${options.webUrl}`);
    } else {
        console.log(`Starting Matron Web dev server in ${options.webDir}`);
        webProcess = spawnCommand(pnpmCommand, ["start"], {
            cwd: options.webDir,
            env: process.env,
            detached: process.platform !== "win32",
        });
        await waitForServer(options.webUrl, webProcess);
    }

    const electronArgs = ["exec", "electron", ".", "--profile", options.profile, "--no-update"];
    if (options.devtools) {
        electronArgs.push("--devtools");
    }

    const electronEnv = {
        ...process.env,
        MATRON_DESKTOP_WEBAPP_URL: options.webUrl,
        MATRON_DESKTOP_CONFIG_JSON: options.config,
    };

    console.log(`Launching Matron Desktop against ${options.webUrl}`);
    const electronProcess = spawnCommand(pnpmCommand, electronArgs, { cwd: desktopRoot, env: electronEnv });

    const cleanup = (): void => {
        stopProcess(electronProcess);
        stopProcess(webProcess, process.platform !== "win32");
    };
    const shutdown = (): void => {
        cleanup();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    process.on("exit", cleanup);

    await new Promise<void>((resolve, reject) => {
        electronProcess.on("error", reject);
        electronProcess.on("exit", (code) => {
            cleanup();
            if (code === 0 || code === null) {
                resolve();
            } else {
                reject(new Error(`Electron exited with code ${code}`));
            }
        });
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
