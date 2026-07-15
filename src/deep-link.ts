/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { app } from "electron";

export default class DeepLinkHandler {
    public constructor(private readonly protocol: string) {
        const arguments_ = process.argv.slice(1).filter((argument) => argument !== "--hidden");
        if (app.isPackaged) {
            app.setAsDefaultProtocolClient(protocol, process.execPath, arguments_);
        } else if (process.platform === "win32") {
            app.setAsDefaultProtocolClient(protocol, process.execPath, [app.getAppPath(), ...arguments_]);
        }

        if (process.platform === "darwin") {
            app.on("open-url", (event, url) => {
                event.preventDefault();
                this.open(url);
            });
        } else {
            app.on("second-instance", (_event, commandLine) => {
                const url = commandLine.find((argument) => argument.startsWith(`${protocol}:`));
                if (url) this.open(url);
            });
        }
    }

    private open(url: string): void {
        if (!url.startsWith(`${this.protocol}:`)) return;
        if (!global.mainWindow) return;
        if (!global.mainWindow.isVisible()) global.mainWindow.show();
        if (global.mainWindow.isMinimized()) global.mainWindow.restore();
        global.mainWindow.focus();
    }
}
