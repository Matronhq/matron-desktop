/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { _electron as electron, expect as baseExpect, test as base, type ElectronApplication } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path, { dirname } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";

class CapturedOutput extends PassThrough {
    private readonly chunks: Buffer[] = [];

    public constructor() {
        super();
        this.on("data", (chunk: Buffer) => this.chunks.push(chunk));
    }

    public get data(): Buffer {
        return Buffer.concat(this.chunks);
    }
}

interface Fixtures {
    app: ElectronApplication;
    tmpDir: string;
    extraEnv: Record<string, string>;
    extraArgs: string[];
    stdout: CapturedOutput;
    stderr: CapturedOutput;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export const test = base.extend<Fixtures>({
    extraEnv: {},
    extraArgs: [],
    stdout: async ({}, use) => use(new CapturedOutput()),
    stderr: async ({}, use) => use(new CapturedOutput()),
    tmpDir: async ({}, use) => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), "matron-desktop-tests-"));
        await use(directory);
        await fs.rm(directory, { recursive: true, force: true });
    },
    app: async ({ tmpDir, extraEnv, extraArgs, stdout, stderr }, use) => {
        const executablePath = process.env.MATRON_DESKTOP_EXECUTABLE;
        const args = ["--profile-dir", tmpDir, "--no-update", ...extraArgs];
        if (!executablePath) args.unshift(path.join(__dirname, "..", "lib", "electron-main.js"));

        const application = await electron.launch({
            env: { ...process.env, ...extraEnv },
            executablePath,
            args,
        });
        application.process().stdout.pipe(stdout).pipe(process.stdout);
        application.process().stderr.pipe(stderr).pipe(process.stderr);
        await application.firstWindow();
        await use(application);
    },
    page: async ({ app }, use) => {
        await use(await app.firstWindow());
        await app.close().catch((error) => console.error(error));
    },
});

export const expect = baseExpect;
