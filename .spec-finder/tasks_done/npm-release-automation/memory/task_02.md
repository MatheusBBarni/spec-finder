# Task Memory: task_02

## Objective Snapshot

- Added a local `release:check` command that parses actual npm dry-run pack output and applies the task 01 candidate and packed-path contracts.

## Important Decisions

- Kept the production process seam restricted to the exact `npm pack --dry-run --json` command; tests inject the process result and assert no publish/Git/GitHub command is reachable.
- Accepted npm lifecycle progress before the JSON report and normalize npm's `package.json` path through `validatePackedPaths`.
- Set npm's local cache and offline configuration for the real runner so a managed workstation's user-owned cache is not required and no registry probe is introduced.

## Learnings

- The actual npm pack report contains one object with `name`, `version`, and `files[].path`; prepack verification output may precede the JSON document on stdout.
- The successful local run reported 35 packed paths and produced no workspace tarball.

## Files / Surfaces

- `scripts/release/check.ts` — parser, injected pack runner, task 01 delegation, actionable CLI errors, and safe success output.
- `tests/release-check.test.ts` — valid prefixed JSON, malformed output, nonzero process, rejected path, and exact-command tests.
- `package.json` — additive `release:check` script; existing `verify` and `prepack` strings preserved.

## Errors / Corrections

- A direct exploratory `npm pack --dry-run --json` hit the workstation's root-owned default npm cache; the production runner now points npm at a temporary offline cache, and the real `bun run release:check` passes.

## Ready for Next Run

- Focused test, `bun run release:check`, `bun run check`, and `bun run verify` all passed to terminal exit; no lifecycle status or final report was changed.
- Final focused evidence: `bun test tests/release-check.test.ts` passed 8 tests and 17 expectations; `bun run release:check` passed with 35 packed paths; `bun run verify` passed 256 tests and 1,334 expectations; `git diff --check` passed.
- The final-report phase is using this fresh terminal handoff; no verification rerun is required before recording the evidence report.
