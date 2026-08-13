# Contributing to Pawi

Thanks for wanting to help the puppy along. This is a small, friendly project.

## Getting set up

```bash
git clone <your fork>
cd Pawi
npm run setup     # installs deps, runs tests, checks placeholder art
npm run demo      # see the dog behave in a browser — no Rust needed
npm test          # run the full suite
```

The behaviour engine, scheduler, coordinate maths, settings and pack validator
are all **pure TypeScript with no DOM or native dependency**, which is why the
demo and the tests can run without building the native app. If you're changing
logic, you can develop entirely in the browser and the test runner.

## What we look for in a change

- **Tests.** Every logic change needs a test. We don't chase 100% coverage, but
  the core modules (`engine`, `scheduler`, `coords`, `settings`, `pack`) should
  stay fully covered. If you fix a bug, add the test that would have caught it.
- **Plain code.** Prefer readable over clever. The comments explain *why*, not
  *what*. If a reviewer has to ask "what does this do", it needs rewriting, not
  a comment.
- **No new runtime dependencies** without discussion. The whole pitch is a small,
  fast app.
- **Privacy is non-negotiable.** Keyboard input is counted, never recorded. Any
  change touching `src-tauri/src/input.rs` gets extra scrutiny.

## Submitting a dog pack

You don't need to touch the app's code to add a breed. A pack is a folder with
an atlas PNG, a `manifest.json`, and a licence. See `docs/pack-format.md` for
the format, and run the validator before you submit:

```bash
npm run validate-pack path/to/your/pack
```

The validator will list exactly what's wrong if anything is. Packs must:
- declare a licence,
- include every required animation,
- be original work with a clear licence and disclose any generative tools used,
- use a transparent atlas.

## Reporting bugs

Open an issue with your OS, your Pawi version, and — if it's a behaviour
bug — what the dog did versus what you expected. A short screen recording helps
enormously.

## Code of conduct

Be kind. We're here to make a cute dog, not to be right on the internet.
