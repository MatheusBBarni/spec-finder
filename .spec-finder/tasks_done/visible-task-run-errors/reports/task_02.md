# Task 02 Final Report: Preserve Complete Task Failure Details

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: unavailable; evidence came from the immediately preceding ACP implementation session

## Changes

- [`src/ui/store.ts`](../../../../src/ui/store.ts) — Stores the raw trimmed surfaced activity message as exact detail only after a task enters `failed`, while retaining the formatted compact reason/transcript path. The existing qualified selector and lifecycle clearing remain in use; checkpoint-delivery reasons remain available to the retained delivery review.
- [`tests/store.test.ts`](../../../../tests/store.test.ts) — Adds exact multiline fidelity, immutable snapshot, missing-detail, blocked-activity, completed/resumed/new-run, packet-reset, and duplicate batch-task-ID fixtures.
- [`memory/MEMORY.md`](../memory/MEMORY.md) — Records the durable exact-detail and qualified-key handoff for downstream cockpit work.
- [`memory/task_02.md`](../memory/task_02.md) — Records implementation decisions, corrections, terminal evidence, and report-phase handoff.
- [`task_02.md`](../task_02.md) — Runtime-owned checkpoint and report-phase metadata is present; status remains `in_progress`.

`src/batch.ts` and `src/events.ts` were not changed. The report itself is this
runtime-owned report artifact.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Retain each failed task's complete trimmed surfaced activity separately from its compact reason. | Satisfied | `CockpitStore.consumeTaskActivity` stores `message.trim()` separately from the bounded display formatter. The focused fixture asserts the complete multiline/raw detail and the concise first-line reason in `tests/store.test.ts`. |
| 2. Key, clear, and select detail through the existing batch-qualified identity. | Satisfied | The existing `taskKey`/`selectTaskFailureDetail` path uses the same packet-qualified keys as transcripts and reasons. Fixtures cover duplicate task IDs in two packets, repeated packet start, completed/resumed tasks, and new-run resets. |
| 3. Make missing activity explicit without synthetic diagnostics. | Satisfied | A failed status with no activity leaves the selector and state record empty; the negative fixture asserts `undefined` and the existing consumer can render its explicit absence notice. No stack, raw ACP payload, or new event field was introduced. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test tests/store.test.ts` | PASS | 24 tests passed, 0 failed; 163 assertions. |
| `rtk bun run verify` | PASS | TypeScript check passed; 316 tests passed, 0 failed, 1,874 assertions across 29 files; Bun build passed and bundled 28 modules to `dist/cli.js` (0.34 MB). |
| `rtk git diff --check` | PASS | No whitespace errors reported in the final scoped diff. |

## Risks and Follow-ups

- No separate numerical coverage command was run; changed logic is covered by the focused behavioral fixtures, but the 80% target is not independently measured.
- PTY/manual terminal evidence and live-provider evidence are intentionally not claimed; those belong to downstream task 05 and the packet release gate.
- Exact surfaced messages remain ephemeral and may include ordinary provider/workspace context by design; no persistence, export, telemetry, stack, or raw ACP payload was added.
- Downstream task 04 should consume `selectTaskFailureDetail`, preserve the explicit missing-detail state, and retain the existing checkpoint-delivery review behavior.

## Final Verdict

Completed. Task 02 now preserves complete trimmed failed-task activity independently
from compact live reasons, qualifies and resets details with the existing store
identity, and leaves missing activity explicit. The focused store suite, full
repository verification, build, and whitespace check all passed to terminal
exit. Task status remains runtime-owned and unchanged; packet PTY/manual release
evidence remains deferred to task 05.
