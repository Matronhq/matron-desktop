# Matron Desktop

Matron Desktop packages [Matron Web](https://github.com/Matronhq/matron-web) in a sandboxed Electron application for macOS, Windows, and Linux. The renderer and its narrow main-process request bridge speak [matron-journal](https://github.com/Matronhq/matron-journal) directly; Matrix is not part of the application.

The current shell provides packaging, signing, updating, profiles, tray integration, spellchecking, and safe handling of links and downloads. See [ORIGIN.md](ORIGIN.md) for the repository's history and retained upstream notices.

## Development

Use Node 22.18+ and the pnpm version pinned in `package.json`:

```bash
corepack enable
pnpm install
```

For the normal workflow, keep `matron-web` beside this checkout, start matron-journal, then run:

```bash
pnpm start:hot
```

To test a production web bundle:

```bash
cd ../matron-web
pnpm install
pnpm build
cd ../matron-desktop
ln -s ../matron-web/webapp ./webapp
pnpm start
```

Release builds may instead fetch and pack a published Matron Web bundle with `pnpm fetch`.

## Configuration

The release variants live in `matron/release` and `matron/nightly`. A user configuration may contain:

```json
{
    "journal_server_url": "https://chat.example.com",
    "brand": "Matron"
}
```

Desktop supports a separate journal origin through a constrained HTTP bridge; it accepts HTTPS and loopback HTTP only. User `config.json` locations are:

- Windows: `%APPDATA%\Matron\config.json`
- Linux: `~/.config/Matron/config.json`
- macOS: `~/Library/Application Support/Matron/config.json`

`MATRON_DESKTOP_CONFIG_JSON=/absolute/path/config.json` overrides that location.

## Multiple profiles

`matron-desktop --profile Work` creates an independent profile with its own journal session and IndexedDB data.

## Verification

```bash
pnpm lint
pnpm test
pnpm build:ts
```

## License

Licensed under AGPL-3.0-only or GPL-3.0-only, at your option. See [LICENSE-AGPL-3.0](LICENSE-AGPL-3.0) and [LICENSE-GPL-3.0](LICENSE-GPL-3.0).
