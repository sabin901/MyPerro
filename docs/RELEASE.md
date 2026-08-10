# Production release runbook

## Release gate

1. Run `npm ci` and `npm run release:check`.
2. Confirm `npm audit --audit-level=high` and `cargo audit` are clean or have
   a reviewed, documented upstream exception.
3. Build installers in CI on Windows, Apple Silicon macOS, Intel macOS and
   Ubuntu 22.04.
4. Install, launch, upgrade and uninstall in clean virtual machines.
5. Verify the pet, Settings preview, tray, notifications, login launch,
   single-instance behavior, sleep/resume and multi-monitor position restore.
6. Publish SHA-256 checksums, an SBOM, release notes and signed artifacts.

## Windows

Provide the CI certificate secrets, build NSIS, verify Authenticode, then test
SmartScreen behavior from a browser download on a clean Windows 11 VM.

## macOS

CI uses separate `macos-15` (Apple Silicon) and `macos-15-intel` jobs. Provide a
Developer ID Application certificate and notarization credentials, staple the
ticket to the DMG, then verify with Gatekeeper on a separate Mac.

## Linux

Build on Ubuntu 22.04 or the oldest supported baseline. Test AppImage and Debian
packages on GNOME and KDE under X11 and XWayland. Native Wayland global input
monitoring is a documented degraded mode.

The reproducible Debian 12 builder is available at
`scripts/Dockerfile.linux-build`:

```bash
docker build -f scripts/Dockerfile.linux-build -t myperro-linux-builder .
docker volume create myperro-linux-target
docker run --rm -v "$PWD:/app" \
  -v myperro-linux-target:/app/src-tauri/target myperro-linux-builder \
  bash -c 'npm ci && npm run release -- --bundles deb,appimage'
```

Use `bash -c` so the Rust toolchain path inherited from the image is retained.
The named target volume also prevents Windows build outputs in a bind-mounted
workspace from contaminating the Linux Cargo target directory.
For a headless startup smoke test, mount the build output and run the native
binary under `dbus-run-session -- xvfb-run`; a process that remains alive until
the chosen timeout has completed startup successfully.

## Updater

Generate and securely store a Tauri updater signing key. Add the public key and
HTTPS endpoint to `tauri.conf.json` only when the production endpoint exists.
Keep the private key exclusively in CI secrets. Test stable and rollback
channels before enabling automatic checks in a public build.

## Rollback

Keep the prior signed installers and updater manifest available. If crash-free
startup, asset loading or settings migration regresses, restore the prior
manifest immediately and publish a corrective patch release.
