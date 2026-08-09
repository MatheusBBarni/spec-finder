# Task Memory: task_05

## Objective Snapshot

Render compact batch outcomes and active-packet detail in the OpenTUI cockpit.

## Important Decisions

- Preserve read-only navigation and text-first status semantics.
- Preserve unrelated existing `App.tsx`, `cockpit.tsx`, and cockpit test changes in the dirty worktree.
- Render batch summaries from the task-03 store projection only: keep one active packet's task/transcript view and show prior packets as compact symbol-plus-text rows.
- Split stopped-sequence recovery into bounded lines so compact frames retain the stopping packet, later `not_started` packets, `no automatic retry`, and manual rerun guidance.

## Learnings

- Existing cockpit tests rely on fixed frames, keyboard actions, compact dimensions, and reduced-color behavior.
- Batch packet rows show `succeeded`, `failed`, `cancelled`, `not_started`, and `already complete` text alongside distinct symbols; the active `not_started` summary is presented as `running` while its packet is in progress.
- A failed batch preserves the existing manual inspection mode after `Esc`; the active failed packet transcript remains visible and no prior packet transcript is introduced.

## Files / Surfaces

- `src/ui/App.tsx`
- `tests/cockpit.test.tsx`

## Errors / Corrections

- The first recovery copy was clipped before `rerun manually` at normal/compact widths; the UI now emits separate stopping, later-packet, and recovery lines and fixed-frame tests assert the complete guidance.
- After a stopping packet fails, the existing store correctly switches the selected transcript to `INSPECTING HISTORY`; the cockpit test records that behavior instead of assuming a following-active state.

## Ready for Next Run

- Fresh final-report verification on 2026-08-08 passed: `rtk bun test ./tests/cockpit.test.tsx ./tests/store.test.ts` exited 0 with 31 tests and 254 expectations; `rtk bun run check` exited 0; `rtk bun run verify` exited 0 with 100 tests and 491 expectations and an 18-module Bun build; `rtk git diff --check` exited 0.
- The deterministic three-packet cockpit fixtures cover active success/projection, failed stop, cancellation stop, compact layout, and reduced-color text semantics. A human 4/5 evaluator count for M-03 remains release evidence rather than an invented result.
