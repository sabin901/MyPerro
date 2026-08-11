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

Acquire a trusted code-signing certificate and export it as a password-protected
PFX. Add `WINDOWS_CERTIFICATE` (base64 PFX) and
`WINDOWS_CERTIFICATE_PASSWORD` to GitHub Actions secrets. CI imports it, signs
the NSIS installer with SHA-256 and a trusted timestamp, and fails unless
`Get-AuthenticodeSignature` reports `Valid`. Then test SmartScreen behavior from
a browser download on a clean Windows 11 VM.

## macOS

CI uses separate `macos-15` (Apple Silicon) and `macos-15-intel` jobs. Provide a
Developer ID Application certificate and notarization credentials, staple the
ticket to the DMG, then verify with Gatekeeper on a separate Mac.

Required GitHub secrets are `APPLE_CERTIFICATE` (base64 `.p12`),
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`,
`APPLE_PASSWORD` (an app-specific password), and `APPLE_TEAM_ID`. Apple requires
Developer ID signing and notarization for a normal direct-download experience;
ad-hoc signing is useful for CI boot tests but does not establish publisher trust.

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

The Tauri v2 updater is configured for Windows, macOS and Linux and points to
`https://github.com/sabin901/MyPerro/releases/latest/download/latest.json`.
Every update bundle is signed with a permanent updater key and is rejected by
the installed app if the signature is invalid. This updater signature is
separate from Apple Developer ID and Windows Authenticode.

The initial key was generated locally at `$env:USERPROFILE\.tauri\myperro.key`.
Back it up offline before release, never commit it, and add it to GitHub without
printing it:

```powershell
$updaterKey = Join-Path $env:USERPROFILE '.tauri\myperro.key'
$updaterPassword = Join-Path $env:USERPROFILE '.tauri\myperro.key.password'
Get-Content -Raw -LiteralPath $updaterKey | gh secret set TAURI_SIGNING_PRIVATE_KEY --repo sabin901/MyPerro
Get-Content -Raw -LiteralPath $updaterPassword | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo sabin901/MyPerro
```

Tag builds create signed updater bundles for Windows x64, Linux x64, macOS
Apple Silicon and macOS Intel, then generate `latest.json` beside the public
installers. Pull-request builds deliberately disable updater artifact creation
because GitHub does not expose release secrets to untrusted PR code.
Automatic background checks run for every published signed version, including
release candidates, 15 seconds after startup and every six hours thereafter.
Developer and local builds stay off the public update channel. Discovery only
shows a local message and optional native notification; installation still
requires the user to open Settings and confirm the verified update.

Before the first stable release, install the previous signed build on one clean
machine per platform, publish the new draft, make the release public, use
Settings → Check for updates, and verify download, signature validation,
installation, restart, settings retention and rollback behavior.

Official references: [Tauri updater](https://v2.tauri.app/plugin/updater/),
[Tauri Windows signing](https://v2.tauri.app/distribute/sign/windows/),
[Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/), and
[Apple notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

## Rollback

Keep the prior signed installers and updater manifest available. If crash-free
startup, asset loading or settings migration regresses, restore the prior
manifest immediately and publish a corrective patch release.
