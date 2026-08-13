# Pawi on macOS

Pawi publishes native builds for both Apple silicon and Intel Macs. The app
features are shared; only the processor architecture differs.

## Choose the correct download

Open **Apple menu → About This Mac** and read the processor or chip:

- **Apple M1, M2, M3, M4, M5, or newer:** download the `aarch64.dmg`.
- **Intel Core processor:** download the `x64.dmg`.

Do not use the Apple-silicon DMG on an Intel Mac. It cannot boot there. The
website deliberately avoids guessing a Mac's architecture because Safari does
not expose a trustworthy distinction.

## Install

1. Open the correct DMG.
2. Drag Pawi into **Applications**.
3. Eject the disk image.
4. Open Pawi from Applications, not from inside the mounted DMG.

The current public release is ad-hoc signed while Developer ID credentials are
being prepared. It is not yet Apple-notarized. macOS may require you to open
**System Settings → Privacy & Security** and choose **Open Anyway**. The final
stable release must be Developer ID signed and notarized before it is described
as Apple verified.

## Enable private reactions

Pawi needs Accessibility permission only for cursor, click, scroll, and
key-count reactions outside its own window. It never receives typed text.

1. In Pawi Settings, enable **Private typing and pointer reactions**.
2. Approve the macOS prompt, or use **Open Mac Accessibility** in Settings.
3. In **System Settings → Privacy & Security → Accessibility**, enable Pawi.
4. Return to Pawi Settings. The status reconnects automatically; a restart
   is no longer required.

If Pawi appears more than once in the Accessibility list, remove the older
entries, keep the copy in Applications, and enable that copy. Replacing an
ad-hoc signed build can cause macOS to treat it as a new application; stable
Developer ID signing is the permanent fix.

## If behavior is still wrong

Open **Settings → App → Download diagnostics**, then submit the dedicated
[macOS behavior report](https://github.com/sabin901/Pawi/issues/new?template=macos_report.yml).
The report contains app version, operating system, architecture, and permission
health. It contains no keycodes, typed content, usernames, or application
activity.
