# Task Memory: task_01

## Objective Snapshot

- Create and test the pure task-scoped ACP transcript normalization layer.

## Important Decisions

- Keep raw `SessionUpdate` and `RunEvent` contracts unchanged.
- Merge message chunks by ACP message identity and tool updates by tool-call identity while preserving first chronological position.
- Preserve unknown update types with readable fallback labels and retain complete content.

## Learnings

## Files / Surfaces

- `src/ui/transcript.ts` — new pure projection helper.
- `tests/transcript.test.ts` — new focused fixtures.
- `src/ui/store.ts` and `tests/store.test.ts` consume the helper after this task.

## Errors / Corrections

## Ready for Next Run

- Export the smallest helper surface needed by `CockpitStore`; do not move execution or ACP transport logic into this task.
