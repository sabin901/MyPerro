#!/usr/bin/env bash
set -euo pipefail

bundle_root="src-tauri/target/release/bundle"
dmg="$(find "$bundle_root/dmg" -maxdepth 1 -type f -name '*.dmg' -print -quit)"
if [[ -z "$dmg" ]]; then
  echo "No DMG found under $bundle_root/dmg" >&2
  exit 1
fi

mount_point="$(mktemp -d)"
log_file="$(mktemp -t myperro-package-smoke).log"
ready_file="${TMPDIR:-/tmp}/myperro-startup-ready"
pid=""

cleanup() {
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  hdiutil detach "$mount_point" -quiet 2>/dev/null || true
  rm -f "$ready_file" "$log_file"
  rmdir "$mount_point" 2>/dev/null || true
}
trap cleanup EXIT

hdiutil attach "$dmg" -nobrowse -readonly -mountpoint "$mount_point" -quiet
app="$mount_point/MyPerro.app"
binary="$app/Contents/MacOS/myperro"

test -x "$binary"
echo "Runner architecture: $(uname -m)"
file "$binary"
if [[ "$(uname -m)" == "arm64" ]]; then
  file "$binary" | grep -q 'arm64'
else
  file "$binary" | grep -q 'x86_64'
fi

codesign --verify --deep --strict --verbose=2 "$app"
codesign --display --verbose=4 "$app" 2>&1 | sed -n '1,30p'
otool -l "$binary" | awk '/LC_BUILD_VERSION/{show=1} show{print} /sdk/{if(show){exit}}'

rm -f "$ready_file"
MYPERRO_CI_SMOKE=1 "$binary" >"$log_file" 2>&1 &
pid=$!

for _ in {1..40}; do
  if [[ -f "$ready_file" ]]; then
    echo "Packaged MyPerro reached frontend ready state."
    exit 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "Packaged MyPerro exited before startup completed." >&2
    cat "$log_file" >&2
    exit 1
  fi
  sleep 0.5
done

echo "Packaged MyPerro stayed alive but did not reach frontend ready state." >&2
cat "$log_file" >&2
exit 1
