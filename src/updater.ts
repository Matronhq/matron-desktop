/*
Copyright 2016-2024 New Vector Ltd.
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { app, autoUpdater, dialog } from "electron";
import fs from "node:fs/promises";
import os from "node:os";

import { getSquirrelExecutable } from "./squirrelhooks.js";

const UPDATE_POLL_INTERVAL_MS = 60 * 60 * 1000;
const INITIAL_UPDATE_DELAY_MS = 30 * 1000;

interface DownloadedUpdate {
    releaseName: string;
}

let latestUpdate: DownloadedUpdate | undefined;

async function safeCheckForUpdate(): Promise<void> {
    if (process.platform === "darwin") {
        try {
            const response = await fetch(autoUpdater.getFeedURL());
            const { currentRelease } = (await response.json()) as { currentRelease: string };
            if (currentRelease === app.getVersion() || currentRelease === latestUpdate?.releaseName) return;
        } catch (error) {
            console.error("Could not check the macOS update feed", error);
            return;
        }
    }
    autoUpdater.checkForUpdates();
}

async function pollForUpdates(): Promise<void> {
    if (latestUpdate) return;
    try {
        await safeCheckForUpdate();
    } catch (error) {
        console.error("Could not check for updates", error);
    }
}

async function available(): Promise<boolean> {
    if (process.platform === "linux") return false;
    if (process.platform === "win32") {
        try {
            await fs.access(getSquirrelExecutable());
        } catch {
            return false;
        }
    }
    if (process.platform === "darwin" && Number.parseInt(os.release().split(".")[0], 10) < 21) {
        console.warn("Automatic updates require macOS 12 or newer");
        return false;
    }
    return true;
}

export async function start(updateBaseUrl: string): Promise<void> {
    if (!(await available())) return;
    const base = updateBaseUrl.endsWith("/") ? updateBaseUrl : `${updateBaseUrl}/`;
    try {
        if (process.platform === "darwin") {
            autoUpdater.setFeedURL({ url: `${base}macos/releases.json`, serverType: "json" });
        } else if (process.platform === "win32") {
            autoUpdater.setFeedURL({ url: `${base}win32/${process.arch}/` });
        }
        setTimeout(() => void pollForUpdates(), INITIAL_UPDATE_DELAY_MS);
        setInterval(() => void pollForUpdates(), UPDATE_POLL_INTERVAL_MS);
    } catch (error) {
        console.error("Could not enable update checking", error);
    }
}

autoUpdater.on("error", (error) => console.error("Automatic update failed", error));
autoUpdater.on("update-downloaded", async (_event, _notes, releaseName) => {
    latestUpdate = { releaseName };
    const { response } = await dialog.showMessageBox({
        type: "info",
        title: "Matron update ready",
        message: `Matron ${releaseName} has been downloaded.`,
        detail: "Restart Matron to install it now.",
        buttons: ["Later", "Restart"],
        defaultId: 1,
        cancelId: 0,
    });
    if (response === 1) {
        global.appQuitting = true;
        autoUpdater.quitAndInstall();
    }
});
