# Privacy

MyPerro's whole reason to exist is to be a friendly presence that you trust
enough to leave running all day. That trust depends on one promise:

> MyPerro watches *how much* you move and type, never *what* you type.

## What is observed

To react to you, the app watches global mouse and keyboard activity. It turns
every raw event into an anonymous count or measurement **at the point of
capture**, before it crosses into the rest of the app:

- Mouse: position and speed.
- Keyboard: a count of key presses and their timing. **Never which keys.**
- Scroll: how far, which direction.

You can read this for yourself in `src-tauri/src/input.rs`. The keyboard case is
a deliberate wildcard match — we increment a counter and discard the key. There
is no code path anywhere that can reconstruct what you typed, because the
information never leaves that function.

## What is NEVER observed

- The contents of anything you type.
- Which application is in front, or any window title.
- Your clipboard.
- Screenshots.
- URLs, file names, or file paths.

## What leaves your computer

Nothing, unless you explicitly check for an update. There is:

- no analytics,
- no telemetry,
- no account,
- no cloud sync,
- no network connection at rest.

## What is stored

One settings file, in your OS config directory, in plain readable JSON. You can
open it, edit it, or delete it. That's the entire footprint.

## Permissions

On macOS, the app asks for Accessibility / Input Monitoring permission so it can
see global mouse and keyboard activity. If you decline, MyPerro still runs — the
dog simply stops reacting to input. We explain this before asking, and you can
revoke it any time in System Settings.

If any of the above ever stops being true, it's a bug, and a serious one.
Please report it.
