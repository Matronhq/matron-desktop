#!/usr/bin/env bash
# Build a signed + notarized universal macOS release of Matron Desktop.
# Usage: ./scripts/release-mac.sh
#
# Reads notarization/signing credentials from an env file (default
# ~/.apple/matron-release.env, override with MATRON_RELEASE_ENV). The env file
# (or environment) must provide APPLE_API_KEY, APPLE_API_KEY_ID,
# APPLE_API_ISSUER, APPLE_TEAM_ID and MACOS_SIGN_IDENTITY.
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="${MATRON_RELEASE_ENV:-$HOME/.apple/matron-release.env}"
if [ ! -r "$ENV_FILE" ]; then
  echo "ERROR: release env file not found at $ENV_FILE." >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

# --- Preflight ---------------------------------------------------------------
fail=0
[ -r "${APPLE_API_KEY:-}" ] || { echo "ERROR: APPLE_API_KEY not readable: ${APPLE_API_KEY:-unset}"; fail=1; }
[ -n "${APPLE_API_KEY_ID:-}" ] || { echo "ERROR: APPLE_API_KEY_ID unset"; fail=1; }
[ -n "${APPLE_API_ISSUER:-}" ] || { echo "ERROR: APPLE_API_ISSUER unset"; fail=1; }
[ -n "${APPLE_TEAM_ID:-}" ] || { echo "ERROR: APPLE_TEAM_ID unset"; fail=1; }
if [ -n "${MACOS_SIGN_IDENTITY:-}" ]; then
  security find-identity -v -p codesigning | grep -qF "$MACOS_SIGN_IDENTITY" \
    || { echo "ERROR: signing identity not found in keychain: $MACOS_SIGN_IDENTITY"; fail=1; }
else
  echo "ERROR: MACOS_SIGN_IDENTITY unset — set it to your signing identity, e.g. 'Developer ID Application: <Your Company> (<TEAMID>)'"; fail=1
fi
npx asar list webapp.asar | grep -q '^/config.json' \
  || { echo "ERROR: webapp.asar is missing /config.json"; fail=1; }
# Guard against shipping a STALE asar that still carries matrix.org/Element
# defaults (checking the file merely exists is not enough — an old asar can
# keep prior default_server_*/scalar/room-directory settings in a signed build).
# NB: `asar extract-file` writes into the current directory and prints nothing
# to stdout, so read the file via the asar API rather than redirecting the CLI.
_asar_tmp="$(mktemp -d)"
if node -e 'process.stdout.write(require("@electron/asar").extractFile("webapp.asar", "config.json"))' \
    > "$_asar_tmp/config.json" 2>/dev/null; then
  if grep -qE "default_server|matrix-client\.matrix\.org|scalar|vector\.im|gitter" "$_asar_tmp/config.json"; then
    echo "ERROR: webapp.asar config.json still contains matrix.org/Element defaults — repack it (pnpm run asar-webapp) before releasing"; fail=1
  fi
else
  echo "ERROR: could not read config.json out of webapp.asar"; fail=1
fi
rm -rf "$_asar_tmp"
[ "$fail" -eq 0 ] || { echo "Preflight failed."; exit 1; }
echo "Preflight OK."

# --- Build -------------------------------------------------------------------
pnpm install

VERSION=$(node -p "require('./package.json').version")
pnpm run build:ts
# Build the universal (Intel + Apple Silicon) artifact AND a smaller arm64-only
# one in a single electron-builder run. Each .app is signed + notarized.
pnpm exec electron-builder --universal --arm64

# --- Notarize + staple each dmg ---------------------------------------------
# electron-builder notarizes/staples the .app but NOT the dmg container. Staple
# each dmg too so the downloaded disk image validates offline.
for DMG in "dist/Matron-${VERSION}-universal.dmg" "dist/Matron-${VERSION}-arm64.dmg"; do
  if [ ! -f "$DMG" ]; then
    # Both artifacts are advertised on the release; a missing one is a build
    # failure, not a warning — do not let a partial build report success.
    echo "ERROR: expected dmg not produced by the build: $DMG" >&2
    exit 1
  fi
  echo "Notarizing dmg: $DMG"
  xcrun notarytool submit "$DMG" \
    --key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER" --wait
  xcrun stapler staple "$DMG"
  xcrun stapler validate "$DMG"
done

echo "Done. Artifacts in dist/:"
ls -1 "dist/Matron-${VERSION}-universal.dmg" "dist/Matron-${VERSION}-universal-mac.zip" \
      "dist/Matron-${VERSION}-arm64.dmg" "dist/Matron-${VERSION}-arm64-mac.zip" \
      dist/latest-mac.yml 2>/dev/null || true
