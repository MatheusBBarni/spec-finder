# Task 01 Final Report: Define Batch Contracts and Strict Input Parsing

## Outcome

- Task: `task_01` — Define Batch Contracts and Strict Input Parsing.
- Outcome: Implemented the typed batch contract boundary and strict opt-in `--multiple` parser, with focused parser and contract coverage. Coordinator, command routing, store, UI, and documentation integration remain in later packet tasks by design.
- Verdict: completed
- Date: 2026-08-08
- Provider/session: unavailable; report produced from the local worktree and fresh terminal verification.

## Changes

- `src/batch.ts` — Added `PacketOutcome`, `PacketSummary`, `BatchResult`, `BatchRunOptions`, `PacketRunner`, parser error types, and `parseMultipleArgs` (with compatibility aliases). The parser preserves batch order, passes through supported runtime option tokens, and returns explicit `single`, `batch`, or `error` modes.
- `src/tasks.ts` — Exported the existing task-slug grammar as `isValidTaskSlug` and reused it from task parsing, avoiding a second slug validator.
- `tests/batch.test.ts` — Added 14 focused tests for ordered input, runtime-token preservation, legacy single-mode passthrough, every required rejected grammar shape, and typed contract compatibility.
- `.spec-finder/tasks/ordered-multiple-task-run/memory/MEMORY.md` — Retained the packet-wide handoff that the new parser/contracts are the downstream source of truth.
- `.spec-finder/tasks/ordered-multiple-task-run/memory/task_01.md` — Recorded the parser decisions and corrected the final verification facts after the fresh rerun.

The current worktree also contains unrelated pre-existing changes in `.spec-finder/config.json`, `src/ui/transcript.ts`, `tests/cockpit.test.tsx`, and `tests/transcript.test.ts`; they were preserved and are not attributed to this task. The task frontmatter remains owned by Spec Finder and was not changed during this report phase.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Accept exactly one `--multiple` followed by a non-empty comma-separated slug list, preserving declared order. | Satisfied | `parseMultipleArgs` consumes one `--multiple`, validates each entry through `isValidTaskSlug`, and returns the original order. The focused test `accepts one ordered comma-separated list` passed. |
| 2. Reject positional slugs, repeated `--multiple`, empty entries, duplicates, malformed slugs, and option-like values without falling back to single-run mode. | Satisfied | The parser returns `mode: "error"` for empty, duplicate, malformed, option-like, missing-value, positional, repeated-option, unknown-option, and missing-runtime-value cases. The focused rejection matrix passed all 10 cases. |
| 3. Expose typed batch outcomes/results without changing the existing single-run event/result contract. | Satisfied | `src/batch.ts` exports the approved batch types and aliases the existing engine option/result types; `BatchRunOptions` uses additive `RunEvent` callbacks. The focused contract test compiled and passed. |
| 4. Preserve provider/model/reasoning/speed and `--no-ui` values for later command integration. | Satisfied | The parser preserves supported runtime option/value tokens in their declared order. The focused test `preserves runtime option tokens in their declared order` passed. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test ./tests/batch.test.ts` | PASS (exit 0) | Bun 1.3.13; 14 tests passed, 0 failed, 46 expectations, 1 file. |
| `rtk bun run check` | PASS (exit 0) | `tsc --noEmit` completed successfully. |
| `rtk bun run verify` | PASS (exit 0) | Check passed; 77 tests passed, 0 failed across 14 files, 369 expectations; build bundled 17 modules into `dist/cli.js` (97.72 KB). |

No renderer, provider-process, native, or other platform-specific evidence was required for this parser/contracts-only task.

## Risks and Follow-ups

- The parser intentionally does not load packet definitions or perform full-sequence preflight; packet existence/definition validation belongs to the downstream coordinator task.
- Command routing and integration of `runtimeArgs` remain for later tasks and must preserve the unchanged single-slug branch.
- Filesystem changes after future coordinator preflight, cancellation normalization, and batch UI/terminal projection remain packet-level follow-ups described by the TechSpec and ADRs.
- No task-scoped verification blocker remains. Unrelated dirty worktree changes were not broadened or modified.

## Final Verdict

Completed: task_01’s typed batch contracts, strict exclusive parser, shared slug-validation reuse, and focused tests are implemented and pass the focused and repository verification gates. The task frontmatter status was left for Spec Finder to manage, and later coordinator/command/UI work remains intentionally outside this task’s scope.
