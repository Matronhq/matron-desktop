# Matron Desktop

Matron Desktop is the Windows, Linux, and macOS desktop app for [Matron](https://matron.chat) — chat with the Claude Code and Codex agents running on your machines. It packages [Matron Web](https://github.com/Matronhq/matron-web) in a sandboxed Electron shell and talks to your self-hosted [matron-journal](https://github.com/Matronhq/matron-journal) server directly; no Matrix client or homeserver involved.

What the shell adds on top of the web app:

- auto-update (macOS and Windows)
- system tray integration
- multiple profiles
- spellchecking
- safe handling of external links and downloads
- code signing and per-platform packaging

See [ORIGIN.md](ORIGIN.md) for the repository's history and retained upstream notices.

## Getting started

No prebuilt binaries are published yet (no tagged releases) — build from source below. On first launch, sign in with your journal server URL and username.

## Development

Use Node 22.18+ (`.node-version` pins 24.13) and the pnpm version pinned in `package.json`:

```bash
corepack enable
pnpm install
```

For the normal workflow, keep `matron-web` beside this checkout, start matron-journal, then run:

```bash
pnpm start:hot
```

To test a production web bundle, build Matron Web and link its output here:

```bash
cd ../matron-web
pnpm install
pnpm build
cd ../matron-desktop
ln -s ../matron-web/webapp ./webapp
pnpm start
```

`pnpm run fetch` (not `pnpm fetch` — that is a pnpm builtin) can instead download and pack a published Matron Web release, but matron-web has no published releases yet, so the symlink route above is the working one today.

## Configuration

See [docs/config.md](docs/config.md) for all supported keys (`journal_server_url`, `brand`, `privacy_policy_url`, `update_base_url`, `help_url`). By default `journal_server_url` is empty and the app asks at sign-in.

Desktop supports a separate journal origin through a constrained HTTP bridge; it accepts HTTPS and loopback HTTP only. User `config.json` locations are:

- Windows: `%APPDATA%\Matron\config.json`
- Linux: `~/.config/Matron/config.json`
- macOS: `~/Library/Application Support/Matron/config.json`

The nightly variant (product name "Matron Nightly") uses correspondingly named directories. `MATRON_DESKTOP_CONFIG_JSON=/absolute/path/config.json` overrides the location.

## Multiple profiles

Pass `--profile Work` (Linux binary: `matron-desktop`) for an independent profile with its own journal session and IndexedDB data. See also `--profile-dir`, `MATRON_PROFILE_DIR`, `--config`, `--no-update`, `--hidden`, and `--devtools`.

## Tests

`pnpm test` runs the Playwright suite. It needs the main process built (`pnpm build:ts`) and a `webapp.asar` or `./webapp` symlink to exist:

```bash
pnpm build:ts
pnpm lint
pnpm test
```

## Packaging

`pnpm asar-webapp` then `pnpm build` produces host-platform artifacts; see [docs/packaging.md](docs/packaging.md). Variants live in `matron/release` and `matron/nightly` (`VARIANT_PATH`).

## Documentation

- [docs/config.md](docs/config.md) — configuration keys and file locations
- [docs/packaging.md](docs/packaging.md) — building distributable artifacts
- [docs/updates.md](docs/updates.md) — the self-update mechanism and feed layout
- [docs/debugging.md](docs/debugging.md) — debugging the renderer and main processes
- [docs/windows-requirements.md](docs/windows-requirements.md) — Windows native-module build requirements

## Ecosystem

Matron Desktop is one client for [matron-journal](https://github.com/Matronhq/matron-journal), alongside [matron-web](https://github.com/Matronhq/matron-web), [matron-apple](https://github.com/Matronhq/matron-apple), [matron-android](https://github.com/Matronhq/matron-android), and [matron-bridge](https://github.com/Matronhq/matron-bridge). [dev-boxer](https://github.com/Matronhq/dev-boxer) provisions the machines the agents run on; more at [matron.chat](https://matron.chat).

## License

Licensed under AGPL-3.0-only or GPL-3.0-only, at your option. See [LICENSE-AGPL-3.0](LICENSE-AGPL-3.0) and [LICENSE-GPL-3.0](LICENSE-GPL-3.0).
