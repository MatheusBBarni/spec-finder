# Task Memory: task_01

## Objective Snapshot

- Establish the command-owned cockpit session and callback-only keyboard lifecycle.

## Important Decisions

- The command will later own session waiting and teardown; App requests cancellation or dismissal only.

## Learnings

- Existing App keyboard handlers directly destroy the renderer and must be covered by component tests when changed.
- The current cockpit implementation has no UI-owned renderer teardown: settled failure Esc/Q/Ctrl+C call `onDismiss`, active Q/Ctrl+C call `onCancel`, and the session controller centralizes idempotent close/dismissal resolution.
- Fresh focused cockpit evidence passed: 34 tests, including all dismissal keys, active cancellation without renderer destruction, and session close/dismissal idempotence. The repository `rtk bun run verify` gate also passed (314 tests and build).

## Files / Surfaces

- `src/ui/cockpit.tsx`, `src/ui/App.tsx`, and `tests/cockpit.test.tsx`.

## Errors / Corrections

- None recorded.

## Ready for Next Run

- Session contract and keyboard ownership are verified; downstream command lifecycle work may consume `CockpitSession` without changing runtime event types. No task-owned source edit was necessary after the fresh verification because the contract is already present in the current baseline.
- Final-report handoff is factual and complete: use the fresh focused and repository verification results above; do not claim PTY or manual terminal evidence, which belongs to task 05.
