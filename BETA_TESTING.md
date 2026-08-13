# Pawi public beta

Pawi `v0.9.0-rc.11` is the current public beta for Windows, Apple-silicon Mac,
Intel Mac, and 64-bit Linux. Share the official website—not an installer copied
from one computer—so every tester receives the right platform build and the
published checksums:

**Website:** <https://sabin901.github.io/Pawi/>

## Before testing

- Remove any pre-Pawi beta build before installing Pawi. The product name and
  application identity changed during beta development, so a clean install
  avoids duplicate startup entries and stale shortcuts.
- On Mac, choose Apple silicon for an M-series processor or Intel for an Intel
  processor. The two disk images are different.
- Pawi is not yet Apple-notarized or Windows code-signed. The website and release
  notes explain the temporary beta installation steps. Never download a build
  from anywhere except the official Pawi repository.
- Keep the default private settings unless a test specifically needs global
  typing, scrolling, or cursor reactions. Pawi never receives typed text.

## A useful 10-minute test

1. Launch Pawi and confirm only the companion appears over the real desktop.
2. Move left and right. The companion should face its direction of travel.
3. Press `F`, `W`, `P`, and `R` to test food, water, play, and one-minute rest.
4. Press `S`, change the companion and size, close Settings, and confirm both
   choices persist after relaunching.
5. Leave the companion alone long enough to request attention, then pet or feed
   it. The temporary message and sound should stop after care.
6. Check roaming, edge peek, rolling, typing reactions, transparent click-through,
   mute, reduced motion, and the tray menu.

## Send feedback

- **Opinion or review:** <https://github.com/sabin901/Pawi/discussions/14>
- **Idea or new companion:** <https://github.com/sabin901/Pawi/discussions/categories/ideas>
- **Problem report:** <https://github.com/sabin901/Pawi/issues/new/choose>
- **Mac-specific report:** <https://github.com/sabin901/Pawi/issues/new?template=macos_report.yml>

Include the Pawi version, operating system, CPU type, selected companion, exact
steps, expected behavior, and actual behavior. Screenshots or a short screen
recording help, but testers should remove private information before uploading.

This beta is for feedback before `1.0`; it is not a claim that signing,
notarization, or every hardware-specific behavior is complete.
