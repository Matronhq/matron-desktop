/*
Copyright 2021-2024 New Vector Ltd.
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { type BrowserWindow } from "electron";

// global type extensions need to use var for whatever reason
/* eslint-disable no-var */
declare global {
    type IConfigOptions = Record<string, any>;

    var mainWindow: BrowserWindow | null;
    var appQuitting: boolean;
    var matronConfig: IConfigOptions;
    var trayConfig: {
        // eslint-disable-next-line camelcase
        icon_path: string;
        brand: string;
    };
}
/* eslint-enable no-var */
