# Stable release acceptance evidence

Pawi's stable release gate requires real clean-machine observations. For a
stable version such as `1.0.0`, create `release/qa/v1.0.0.json` with this shape:

```json
{
  "windows": { "status": "pass", "tester": "name", "date": "YYYY-MM-DD", "notes": "Windows 11, mixed DPI" },
  "macArm": { "status": "pass", "tester": "name", "date": "YYYY-MM-DD", "notes": "Apple Silicon model and macOS version" },
  "macIntel": { "status": "pass", "tester": "name", "date": "YYYY-MM-DD", "notes": "Intel model and macOS version" },
  "linuxGnome": { "status": "pass", "tester": "name", "date": "YYYY-MM-DD", "notes": "distribution, X11/XWayland" },
  "linuxKde": { "status": "pass", "tester": "name", "date": "YYYY-MM-DD", "notes": "distribution, X11/XWayland" },
  "upgrade": { "status": "pass", "tester": "name", "date": "YYYY-MM-DD", "notes": "source and destination versions" },
  "rollback": { "status": "pass", "tester": "name", "date": "YYYY-MM-DD", "notes": "rollback version and retained settings" }
}
```

Do not mark a result as pass from CI compilation alone. Verify transparency,
click-through, tray controls, sound, input permission recovery, mixed scaling,
sleep/wake, one-minute rest, and install/update/uninstall behavior.

For every companion, also verify idle, walk left, walk right, run, roll, pet,
feed, water, play/dance, rest/wake, play-request voice, reduced motion and scale
at the smallest and largest setting. Confirm movement faces the destination and
front-facing poses are never mirrored. Test sound once muted and once enabled.

Create a non-overwriting pending template with
`npm run qa:evidence -- template 1.0.0`. After real testing, validate the
completed file with `npm run qa:evidence -- validate 1.0.0`.
