/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import ElectronStore from "electron-store";
import { app, type Session } from "electron";

interface StoreData {
    warnBeforeExit: boolean;
    minimizeToTray: boolean;
    spellCheckerEnabled: boolean;
    autoHideMenuBar: boolean;
    disableHardwareAcceleration: boolean;
    enableContentProtection: boolean;
}

export async function clearDataAndRelaunch(electronSession: Session): Promise<void> {
    Store.instance?.clear();
    electronSession.flushStorageData();
    await electronSession.clearStorageData();
    app.relaunch();
    app.exit();
}

class Store extends ElectronStore<StoreData> {
    private static internalInstance?: Store;

    public static get instance(): Store | undefined {
        return Store.internalInstance;
    }

    public static initialize(): Store {
        if (Store.internalInstance) throw new Error("Store already initialized");
        Store.internalInstance = new Store();
        return Store.internalInstance;
    }

    private constructor() {
        super({
            name: "electron-config",
            clearInvalidConfig: false,
            schema: {
                warnBeforeExit: { type: "boolean", default: true },
                minimizeToTray: { type: "boolean", default: true },
                spellCheckerEnabled: { type: "boolean", default: true },
                autoHideMenuBar: { type: "boolean", default: true },
                disableHardwareAcceleration: { type: "boolean", default: false },
                enableContentProtection: { type: "boolean", default: false },
            },
        });
    }
}

export default Store;
