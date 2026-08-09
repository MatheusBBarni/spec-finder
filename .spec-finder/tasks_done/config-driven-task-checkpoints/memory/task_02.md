# Task Memory: task_02

## Objective Snapshot

- Add optional checkpoint delivery metadata and retry ordering.

## Important Decisions

- Kept `checkpoint` optional and strict inside task frontmatter: active/blocked records require a Git object ID, SHA-256 baseline digest, and unique safe relative paths; blocked records require a bounded non-empty error.
- Kept delivery metadata independent from lifecycle status. Only completed tasks with `checkpoint.state: blocked` re-enter normal execution order; absent or non-blocked completed tasks stay skipped.
- Refactored task metadata/status writes through one serializer that preserves the parsed frontmatter values and the exact task body instead of trimming body whitespace.

## Learnings

- `checkpointRecordSchema` accepts SHA-1 and SHA-256 Git object-ID lengths, while path validation rejects absolute, drive-qualified, traversal, separator-ambiguous, and NUL-containing paths.
- Existing task files without checkpoint metadata continue to parse unchanged, and packet ordering still follows numeric dependency order.
- Report-phase rerun on 2026-08-08 confirmed `rtk bun test tests/tasks.test.ts` at 8 tests/34 expectations and `rtk bun run verify` at 118 tests/626 expectations with the Bun build succeeding; `rtk git diff --check` reported no whitespace errors.

## Files / Surfaces

- `src/tasks.ts`
- `tests/tasks.test.ts`
- `skills/sf-create-tasks/references/task-context-schema.md`

## Errors / Corrections

- The first ordering assertion used a pending task as the "absent completed" case; the fixture was corrected to use `status: completed`, and focused tests then passed.
- An initial repository-gate attempt observed a transient type-check failure in unrelated dirty cockpit/store edits; a fresh terminal rerun reached exit 0 with the complete suite and build green.

## Ready for Next Run

- Task 03 can consume the exported `CheckpointRecord` type and `updateTaskCheckpoint`/`clearTaskCheckpoint` helpers without adding a packet-level ledger.
- Fresh evidence: `rtk bun test tests/tasks.test.ts` passed 8 tests/34 expectations; `rtk bun run verify` passed 118 tests/626 expectations and the Bun build.
