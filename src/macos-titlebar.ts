/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import type { BrowserWindow } from "electron";

const TITLE_BAR_CSS = `
    .mj_RoomListHeader,
    .mx_RoomHeader,
    .mx_AuthPage {
        -webkit-app-region: drag;
        -webkit-user-select: none;
    }

    .mj_RoomListHeader > *,
    .mx_RoomHeader > *,
    .mx_AuthPage .mx_AuthPage_modalContent {
        -webkit-app-region: no-drag;
    }
`;

export function setupMacosTitleBar(window: BrowserWindow): void {
    if (process.platform !== "darwin") return;

    let cssKey: string | undefined;
    const apply = async (): Promise<void> => {
        cssKey = await window.webContents.insertCSS(TITLE_BAR_CSS);
    };

    window.on("enter-full-screen", () => {
        if (cssKey) void window.webContents.removeInsertedCSS(cssKey);
    });
    window.on("leave-full-screen", () => void apply());
    window.webContents.on("did-finish-load", () => {
        if (!window.isFullScreen()) void apply();
    });
}
