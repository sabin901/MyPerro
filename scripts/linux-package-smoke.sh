#!/usr/bin/env bash
set -euo pipefail

appimage="$(find src-tauri/target/release/bundle/appimage -maxdepth 1 -type f -name '*.AppImage' -print -quit)"
if [[ -z "$appimage" ]]; then
  echo "No AppImage package found." >&2
  exit 1
fi

ready="${TMPDIR:-/tmp}/pawi-startup-ready"
log_file="$(mktemp -t pawi-linux-package-smoke.XXXXXX.log)"
pid=""
cleanup() {
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -f "$ready" "$log_file"
}
trap cleanup EXIT

rm -f "$ready"
dbus-run-session -- xvfb-run -a env PAWI_CI_SMOKE=1 "$appimage" --appimage-extract-and-run >"$log_file" 2>&1 &
pid=$!
for _ in {1..60}; do
  if [[ -f "$ready" ]]; then
    echo "Packaged Pawi reached frontend ready state on Linux."
    exit 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "Packaged Pawi exited before startup completed." >&2
    cat "$log_file" >&2
    exit 1
  fi
  sleep .5
done
echo "Packaged Pawi stayed alive but did not reach frontend ready state." >&2
cat "$log_file" >&2
exit 1
