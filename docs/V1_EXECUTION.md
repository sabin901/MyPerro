# Pawi 1.0 execution plan

## Version ladder

| Milestone | Purpose | Exit condition |
|---|---|---|
| 0.9.0-rc.13 | Reliability and observability | scheduler failures visible, soak/budgets green, all packages launch in CI |
| 0.9.0-rc.14 | Character acceptance | all nine characters pass automated report and human motion/sound matrix |
| 0.9.0-rc.15 | Trusted distribution | Windows signed; both Macs signed, notarized and stapled |
| 1.0.0-rc.1 | Release rehearsal | clean install, update, retention and rollback evidence complete |
| 1.0.0 | Stable | seven-day no-P0/P1 soak and every stable gate green |

Milestones may be combined when all of their exit conditions are genuinely met;
version labels must never be used as substitutes for evidence.

## Repository-owned commands

```bash
npm ci
npm run release:check
npm run character:acceptance
npm run qa:evidence -- template 1.0.0
npm run update:verify -- latest.json 1.0.0
```

CI builds and boots Windows, Linux, Apple Silicon and Intel packages. It also
checks architecture, code signature structure, checksums, SBOM and updater
artifacts. Runtime diagnostics include only state names, frame names, scheduler
counters and platform health—never text, titles, URLs, keycodes or file names.

## Human/external gates

The publisher must supply a trusted Windows signing certificate, Apple
Developer ID membership/certificate and Apple notarization credentials. A
tester must install the actual downloaded package on each physical/clean target,
exercise the checklist in `release/qa/README.md`, and sign their evidence.
Automation deliberately cannot mark these checks as passed.

## Final release procedure

1. Resolve every P0/P1 and triage P2 issues against `docs/V1_SCOPE.md`.
2. Set `1.0.0` in `package.json`, `src-tauri/tauri.conf.json` and Cargo metadata.
3. Create and complete `release/qa/v1.0.0.json`; validate it with
   `npm run qa:evidence -- validate 1.0.0`.
4. Run `npm run release:check` and the stable gate with the certificate flags:
   `npm run release:readiness -- --stable --tag v1.0.0`.
5. Tag only that exact reviewed commit. Keep the GitHub release draft until all
   four installers and updater targets are inspected.
6. Publish, verify the website links and `latest.json`, then test an update from
   the prior signed release before announcing 1.0.
7. Monitor issues for seven days. If startup or settings migration regresses,
   restore the prior manifest and ship a patch; never replace a tagged binary.
