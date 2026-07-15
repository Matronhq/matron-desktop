# Packaging

A packaged build needs a `webapp.asar`. Build Matron Web, copy or link its `webapp/` directory here, then run `pnpm asar-webapp`.

`pnpm build` produces the host platform's Electron artifacts. The `build:32`, `build:64`, and `build:universal` scripts select explicit architectures. Official macOS release builds use `scripts/release-mac.sh`, which validates the embedded configuration, signs the application, notarizes each disk image, and checks every expected artifact.

Variant metadata and runtime configuration live in `matron/release` and `matron/nightly`. Signing credentials are supplied through the environment and are not stored in this repository.
