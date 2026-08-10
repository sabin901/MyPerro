#!/usr/bin/env bash
# One-time setup. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf "\033[36m▸\033[0m %s\n" "$1"; }
warn() { printf "\033[33m!\033[0m %s\n" "$1"; }

say "Checking placeholder art…"
if [ ! -f art/placeholder/shiba_placeholder.png ]; then
  warn "art/placeholder/shiba_placeholder.png is missing."
  warn "Copy shiba_placeholder.png and shiba_placeholder.json from the Cowork"
  warn "outputs folder into art/placeholder/ and re-run this script."
  exit 1
fi
say "Placeholder art present."

say "Installing npm dependencies…"
npm install --no-fund --no-audit

say "Running the test suite…"
npm test

# Icons are only needed for the native build, not the browser demo, so a
# missing icon set shouldn't stop someone seeing the dog move.
if [ ! -f src-tauri/icons/icon.icns ] && [ ! -f src-tauri/icons/icon.ico ]; then
  warn "No app icons yet — 'npm start' (the native app) will fail until you run:"
  warn "    npm run tauri icon path/to/any-square-image.png"
  warn "The browser demo ('npm run demo') works without them."
fi

cat <<'EOF'

  Setup complete.

    npm run demo    → see the dog behave in a browser. No Rust needed.
    npm test        → run the behaviour and coordinate test suites.
    npm start       → the real native app (needs Rust + app icons).

EOF
