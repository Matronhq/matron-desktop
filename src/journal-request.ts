/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { ipcMain } from "electron";

interface JournalRequest {
    serverUrl: string;
    path: string;
    method: "GET" | "POST";
    token?: string;
    body?: string;
}

function targetUrl(serverUrl: string, path: string): URL {
    const base = new URL(serverUrl);
    const isLoopback = base.hostname === "localhost" || base.hostname === "127.0.0.1" || base.hostname === "[::1]";
    if (base.protocol !== "https:" && !(base.protocol === "http:" && isLoopback)) {
        throw new Error("Journal requests require HTTPS (except for a loopback development server)");
    }
    if (base.username || base.password || base.search || base.hash) throw new Error("Invalid journal server URL");

    const relative = new URL(path, "https://matron.invalid");
    const basePath = base.pathname.replace(/\/+$/, "");
    base.pathname = `${basePath}/${relative.pathname.replace(/^\/+/, "")}`;
    base.search = relative.search;
    if (basePath && base.pathname !== basePath && !base.pathname.startsWith(`${basePath}/`)) {
        throw new Error("Journal request escaped the configured server path");
    }
    return base;
}

ipcMain.handle("journalRequest", async (_event, request: JournalRequest) => {
    if (!request || (request.method !== "GET" && request.method !== "POST")) {
        throw new Error("Invalid journal request");
    }
    if (typeof request.serverUrl !== "string" || typeof request.path !== "string") {
        throw new Error("Invalid journal request target");
    }
    if (request.token !== undefined && typeof request.token !== "string") throw new Error("Invalid journal token");
    if (request.body !== undefined && typeof request.body !== "string") throw new Error("Invalid journal body");

    const response = await fetch(targetUrl(request.serverUrl, request.path), {
        method: request.method,
        headers: {
            ...(request.token ? { Authorization: `Bearer ${request.token}` } : {}),
            ...(request.body ? { "Content-Type": "application/json" } : {}),
        },
        body: request.body,
    });
    return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.arrayBuffer(),
    };
});
