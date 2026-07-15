/*
Copyright 2026 Matron Contributors.
Copyright 2024 New Vector Ltd.
Copyright 2018, 2019, 2021 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { contextBridge, ipcRenderer } from "electron";

ipcRenderer.send("initialise");

contextBridge.exposeInMainWorld("electron", {
    send(channel: string, ...args: unknown[]): void {
        if (channel !== "setBadgeCount") throw new Error(`Unknown IPC channel: ${channel}`);
        ipcRenderer.send(channel, ...args);
    },

    async initialise(): Promise<{ config: IConfigOptions }> {
        return { config: await ipcRenderer.invoke("getConfig") };
    },

    async journalRequest(request: {
        serverUrl: string;
        path: string;
        method: "GET" | "POST";
        token?: string;
        body?: string;
    }): Promise<{ status: number; headers: Record<string, string>; body: ArrayBuffer }> {
        return ipcRenderer.invoke("journalRequest", request);
    },
});
