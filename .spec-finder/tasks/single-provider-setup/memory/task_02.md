# Task Memory: task_02

## Objective Snapshot

- Integrate singular setup resolution, accessible picker behavior, and failure-safe installation.

## Important Decisions

- Wait for task_01's v3 config and setup-profile interfaces; do not duplicate them.
- Resolve one `SetupRequest` with provider/model/speed/scope and input origins; preserve saved speed on provider changes while resetting changed-provider model to that profile's catalogue default.
- Treat v1/v2 setup as scope-unknown: interactive scope starts unselected and non-interactive setup requires `--local` or `--global`.
- Keep `--copy` as a no-op compatibility flag and reject `--symlink`, repeated singular flags, and arbitrary destination inputs.
- Install only the profile-derived `.agents/skills` or `.claude/skills` root through a lock/stage/backup/ordered-commit/reverse-rollback transaction; legacy `.cursor/skills` is status-only.

## Learnings

- The selected-root lock is a sibling `.spec-finder-setup.lock`; stage and backup directories are UUID-named siblings and are retained when rollback or cleanup cannot complete.
- Recovery errors report only paths still present when possible, while normal rollback removes private artifacts and restores the prior config/managed entries.
- Interactive single-select ignores Space, restores raw mode after Enter/cancel, and exposes a required-unselected scope state for migrated configs.

## Files / Surfaces

- `src/commands.ts`, `src/ui/setup-picker.ts`, `src/setup.ts`, `tests/commands.test.ts`, and `tests/setup.test.ts`.
- `src/commands.ts` now owns singular parser/default resolution and requested-value summary; batch/runtime command branches remain unchanged.
- `src/setup.ts` owns provider-derived roots, traversal preflight, lock, staging, managed-entry backups, rollback, cleanup, and legacy preservation reporting.

## Errors / Corrections

- The old setup tests encoded multi-target and symlink behavior; they were replaced with singular resolver/picker, destination, legacy, traversal, lock, and failure-injection coverage while preserving batch tests.

## Ready for Next Run

- Focused gate `rtk bun test tests/commands.test.ts tests/setup.test.ts` passed with 30 tests and 162 assertions.
- Repository gate `rtk bun run verify` passed: TypeScript check, 296 Bun tests with 0 failures, and Bun build emitted `dist/cli.js`.
- Final report phase reconciled the fresh focused and repository-gate evidence; lifecycle status remains runtime-owned and the report is the remaining deliverable.
- Leave task status and `reports/task_02.md` to Spec Finder lifecycle ownership.
