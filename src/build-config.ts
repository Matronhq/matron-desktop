/*
Copyright 2025 New Vector Ltd.
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { type JsonObject, loadJsonFile } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface BuildConfig {
    appId: string;
    protocol: string;
}

export function readBuildConfig(): BuildConfig {
    const packageJson = loadJsonFile(path.join(__dirname, "..", "package.json")) as JsonObject;
    return {
        appId: (packageJson["electron_appId"] as string) || "chat.matron.desktop",
        protocol: (packageJson["electron_protocol"] as string) || "chat.matron.desktop",
    };
}
