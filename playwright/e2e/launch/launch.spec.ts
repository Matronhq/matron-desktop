/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "../../matron-desktop-test.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

declare global {
    interface Window {
        electron: Record<string, unknown>;
    }
}

test("launches the Matron journal client through its isolated app origin", async ({ page }) => {
    await expect(page.locator("#matron")).toBeVisible();
    await expect(page).toHaveURL("matron://app/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Journal server")).toHaveValue("");
    await expect(page.evaluate(() => Object.keys(window.electron).sort())).resolves.toEqual([
        "initialise",
        "journalRequest",
        "send",
    ]);
});

test.describe("custom configuration", () => {
    test.use({
        extraEnv: {
            MATRON_DESKTOP_CONFIG_JSON: resolve(__dirname, "../../fixtures/custom-config.json"),
        },
    });

    test("loads a journal URL from the desktop config", async ({ page }) => {
        await expect(page.getByLabel("Journal server")).toHaveValue("https://journal.example");
    });
});
