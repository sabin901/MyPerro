# Privacy

MyPerro's whole reason to exist is to be a friendly presence that you trust
enough to leave running all day. That trust depends on one promise:

> MyPerro watches *how much* you move and type, never *what* you type.

## What is observed

If you enable input reactions during onboarding or in Settings, the app watches
global mouse and keyboard activity. It turns
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

MyPerro has two narrowly scoped network features:

- Update checks contact the official GitHub release feed. Installing an update
  always remains your choice.
- Optional active-install counting is **off by default**. If you turn it on,
  the app sends one heartbeat at most every 24 hours containing a random
  installation ID, app version, operating system, and CPU architecture.

The heartbeat never includes activity counts, key presses, pet or owner names,
settings, application names, files, URLs, or any content from your computer.
The counting service immediately converts the random ID to a keyed hash before
storing it. Turning the option off requests deletion of that server record and
deletes the local ID after the request succeeds; if the service is temporarily
unavailable, MyPerro keeps only that random ID and retries the deletion later.

The service database retains a record for no more than 400 days after its last
heartbeat. Its protected report shows aggregate totals for active opted-in
installations, platforms, and versions. Like every Internet service, the hosting
provider receives connection metadata such as an IP address while routing a
request; MyPerro's Worker and database do not log or store it. There is no
account, advertising, cloud sync, crash telemetry, or behavioral analytics.

## What is stored

- A plain JSON settings file in your OS config directory.
- Companion wellbeing state in the local WebView store.
- Window position and size through Tauri's window-state plugin.
- Small rotating diagnostic logs in the standard OS application-log directory.
- An OS login item only when you enable “Start when I log in.”
- When anonymous counting is enabled (or a deletion is waiting to retry), its
  random installation ID and last successful heartbeat time.

Diagnostic logs contain lifecycle errors and compatibility state, never
keycodes, typed text, application names, window titles, or browsing activity.
The Settings → App diagnostic download is user initiated and privacy safe.

## Permissions

On macOS, the app asks for Accessibility / Input Monitoring permission only
after the first-run privacy explanation and opt-in so it can
see global mouse and keyboard activity. If you decline, MyPerro still runs — the
dog simply stops reacting to input. We explain this before asking, and you can
revoke it any time in System Settings.

If any of the above ever stops being true, it's a bug, and a serious one.
Please report it.
