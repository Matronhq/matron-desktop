/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import type { BrowserWindow } from "electron";

// Matron Web class names; matron-web pins them in test/unit-tests/journal/desktop-hooks-test.ts.
// The sidebar header is listed under its current and its earlier name, so a Desktop build works
// with web builds from either side of that rename.
const TITLE_BAR_CSS = `
    .mj_ConversationListHeader,
    .mj_RoomListHeader,
    .mj_ChatHeader,
    .mj_Login {
        -webkit-app-region: drag;
        -webkit-user-select: none;
    }

    .mj_ConversationListHeader > *,
    .mj_RoomListHeader > *,
    .mj_ChatHeader > *,
    .mj_Login .mj_Login_column {
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
