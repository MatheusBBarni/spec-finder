# Task Memory: task_03

## Objective Snapshot

- Build the safe shared Git checkpoint service.

## Important Decisions

- Keep the checkpoint implementation isolated to `src/checkpoints.ts`; task_04 and task_05 own runtime and CLI integration.
- Use a default-off service factory with an injectable argument-array Git runner for temporary-repository and negative-command tests.
- Treat the task file as the active metadata seed path, derive the complete candidate set from the temporal status delta, and require stored blocked retry paths to match the current status set before staging.

## Learnings

- `parsePorcelainStatus` and `parseCachedDiff` preserve NUL-delimited unusual/rename paths and mark unmerged or ambiguous statuses unsafe; the service uses `status --porcelain=v1 -z -uall` so untracked directories do not collapse into non-stageable directory paths.
- Candidate staging restoration first inspects the cached name-status set and restores only candidate paths that are actually indexed; passing untracked candidate paths directly to `git restore --staged` can leave tracked candidates staged after a partial `git add` failure.
- The focused suite passed 10 tests and 69 expectations, including partial-`git add` restoration and a real Git pre-commit hook refusal/retry; `bun run verify` passed 142 tests and 767 expectations plus typecheck and build.
- Platform evidence: Git 2.50.1 (Apple Git-155); the native hook fixture returned a bounded blocked message and candidate staging was restored before retry.

## Files / Surfaces

- `src/checkpoints.ts`
- `tests/checkpoints.test.ts`

## Errors / Corrections

- Repository-root validation initially compared symlinked `/var` and `/private/var` spellings; resolving both Git and caller roots fixed temporary-repository execution.
- Relative Git root output and relative task inputs are resolved against the canonical repository root before validation, while absolute paths retain their normal behavior.
- Git collapsed untracked directories into `path/` entries; adding `-uall` to the status inspection preserved explicit file candidates. A fixture report with trailing spaces also correctly exercised the cached-diff check and was changed to whitespace-clean evidence text.
- A partial `git add` failure initially skipped restoration because staging was marked only after a successful add; mark the candidate plan as staged before invocation and query cached paths before restoring.

## Ready for Next Run

- Task 04 can call `createCheckpointService({ enabled: config.auto_commit })`, invoke `begin` before task status mutation, and call `complete`/`retry` with a fresh or stale `TaskFile`; the service reloads the task metadata and never owns lifecycle status.
- Final-report handoff is current: focused verification is 10 tests/69 expectations and `bun run verify` is 142 tests/767 expectations with typecheck and build; the task remains runtime-owned with `status: in_progress` and `handoff.phase: report`.
