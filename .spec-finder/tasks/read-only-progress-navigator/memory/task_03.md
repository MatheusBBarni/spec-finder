# Task Memory: task_03

## Objective Snapshot

- Enforce the approved fail-closed permission behavior for TUI ACP turns without changing non-TUI policy behavior.

## Important Decisions

- TUI `permissions: "prompt"` returns ACP cancellation and emits a task-scoped read-only notice.
- `approve-all`, `deny`, and `--no-ui` behavior remain unchanged.
- README edits must preserve unrelated existing dirty changes.

## Learnings

## Files / Surfaces

- `src/acp-client.ts` — permission resolution branch.
- `tests/acp-client.test.ts` and `tests/fixtures/mock-agent.ts` — ACP request fixtures.
- `README.md` — narrow user-facing cockpit/configuration wording.

## Errors / Corrections

## Ready for Next Run

- Verify that the cancellation notice is emitted before the existing engine failure outcome and that no `permission_requested` event reaches the TUI store.
