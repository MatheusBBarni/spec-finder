# Task Memory: task_02

## Objective Snapshot

- Preserve exact failed-task activity messages separately from compact task reasons.

## Important Decisions

- Exact detail is ephemeral store state and uses existing packet-qualified task keys.
- Capture uses `message.trim()` as the canonical detail source; compact task
  reasons and transcript lines remain separately formatted for live display.
- Task activity populates exact detail only after `task_status: failed`.
  Checkpoint-delivery blockers retain their existing surfaced reason for the
  final review, while blocked-task activity does not become task failure detail.

## Learnings

- Newline-split transcript entries cannot be the canonical full surfaced message.
- A failed status without a following task activity leaves the selector
  `undefined`; consumers must show an explicit missing-detail state.
- Batch detail remains qualified (`slug/task_id`), so duplicate task IDs retain
  independent multiline messages and packet-start/reset paths cannot leak stale
  detail into the active packet.

## Files / Surfaces

- `src/ui/store.ts` and `tests/store.test.ts`.

## Errors / Corrections

- The integrated baseline formatted failure activity before storing it, which
  truncated/redacted the exact projection. The store now keeps raw trimmed
  detail while preserving the existing formatted transcript/reason path.
- Removing checkpoint detail entirely broke the existing retained delivery
  review; the checkpoint source remains supported without broadening task
  activity capture.

## Ready for Next Run

- Store projection and tests are complete for this task. Focused evidence:
  `rtk bun test tests/store.test.ts` — 24 passed, 0 failed; repository gate:
  `rtk bun run verify` — 316 passed, 0 failed, build passed. No PTY/manual
  evidence is claimed; that belongs to task 05.
- Final-report handoff is ready; this phase writes only `reports/task_02.md`.
  Runtime-owned task status remains `in_progress` until Spec Finder transitions
  it.
