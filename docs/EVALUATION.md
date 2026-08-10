# MyPerro Evaluation — 9 Aug 2026

Evaluated against the current repository and the public ComNyang feature list.
This is not a memory snapshot.

## Current Verification

- `npm run typecheck`: clean.
- `npm test`: 7 files, 141 tests passing.
- `cargo check --manifest-path src-tauri/Cargo.toml`: clean for app code.
- `npm run build`: last full production frontend build passed.
- macOS `.app` release bundle builds at
  `src-tauri/target/release/bundle/macos/MyPerro.app`.
- All six dog packs validate after generation.

The only expected warning is a future-compat notice from transitive Rust crate
`block v0.1.6`.

## What Improved In This Pass

- Autonomous idle life: blink, tail wag, head tilt, look-up, side-eye, scratch,
  pant, yawn, and sit-side variety while the user is quiet.
- Expanded personality loop: head tilt, side-eye, panting, and repeat tail-wag
  moments before sleep.
- Gentle autonomous wander after quiet time, clamped to the current monitor.
- Tray `Play with puppy` action for an on-demand zoomies burst.
- Reduced-motion idle life uses a calmer smaller script.
- Tray quiet mode now pauses reminders without consuming scheduled messages.
- The renderer tracks the visible frame separately from the engine frame, so
  idle-life drawing and click hit-testing stay aligned.
- Vintage settings frontend with a live dog preview.
- Marking-style customization: classic, mask, patch, and freckles.

## ComNyang Parity

| Feature area | MyPerro status |
|---|---|
| Custom character | Better breadth: six dog breeds plus recolourable fur, markings, marking style, collar |
| Eye follow | Built in renderer |
| Drag / shake | Built and tested |
| Mouse hunt | Built and tested |
| Petting sound | Built with generated square-wave cues |
| Typing / overheat | Built with typing and intense typing states |
| Stretch / water | Built with scheduler and art mapping |
| Scroll reaction | Built, but prop animation is still prototype quality |
| AI agent thinking / done | Built through local `agent-status.json` bridge |
| Pomodoro | Built with tray toggle and pixel clock |
| Message reminder | Built in settings and scheduler |
| Fixed message | Built |
| Name personalization | Built |
| Peek mode | Manual tray/settings peek built; automatic video/fullscreen detection remains |
| Multi-device license | Intentionally omitted because MyPerro is free/open source |

## Remaining Work

1. **Installer polish:** DMG packaging fails in Tauri's Finder/AppleScript DMG
   script. The `.app` bundle succeeds.
2. **Signing and notarization:** Apple Developer ID, Windows signing, and
   notarization are not configured.
3. **Hardware QA:** CPU, memory, click-through, multi-monitor, sleep/wake,
   Windows SmartScreen, and Linux Wayland still need real-machine testing.
4. **Art quality:** the dog art is cute and functional, but still generator art
   plus renderer motion. ComNyang-level mascot polish needs hand-authored
   multi-frame animation.
5. **Automatic peek:** current peek is manual. ComNyang advertises video-aware
   peeking; that needs fullscreen/video detection or OS-specific heuristics.
6. **Pattern painter:** breed, colours, and preset marking styles work; a true
   freehand “match your real pet” painter is not built.

## Ship Readiness

MyPerro is now **beta-shippable as a macOS `.app`** for testers who are willing
to bypass signing warnings. It is **not ready for a polished public paid-style
launch** until installer/signing, real hardware QA, and higher-touch animation
art are done.
