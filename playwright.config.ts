/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { defineConfig } from "@playwright/test";

export default defineConfig({
    use: {
        viewport: { width: 1280, height: 720 },
        video: "retain-on-failure",
        trace: "on-first-retry",
    },
    testDir: "playwright/e2e",
    outputDir: "playwright/test-results",
    workers: 1,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [["github"], ["line"]] : [["html", { outputFolder: "playwright/html-report" }]],
    timeout: 30_000,
});
