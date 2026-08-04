# Workflow Memory

## Current State

- The approved task DAG has four pending tasks for the Read-Only Progress Navigator.
- `task_01` and `task_03` are independent roots; `task_04` is the integration leaf.
- No implementation task has started and no reports exist yet.

## Shared Decisions

- Use the current-seam projection architecture from ADR-003; do not change the task engine or raw `RunEvent` protocol.
- Keep complete transcript history in memory for one run only; add no persistence or telemetry.
- Treat the TUI as read-only. Cancel `permissions: "prompt"` requests in TUI mode with a clear activity notice; preserve approve-all, deny, and non-UI behavior.
- Use `PRD-G-06` as the accepted task-generation alias for the PRD’s minimum-terminal goal, mapped to TechSpec responsive requirements.

## Shared Learnings

- `src/events.ts` already associates task status, activity, and ACP session updates with task IDs.
- The current store has a single global activity list capped at 250 entries and a permission modal state; these are the main UI-state seams to replace.
- OpenTUI 0.4.5 provides the focused `ScrollBox`, keyboard routing, resize handling, viewport culling, and test renderer needed by the approved design.
- The repository has no Spec Finder-local `AGENTS.md` or `CLAUDE.md`; existing dirty files are user-owned and must be preserved.

## Open Risks

- Provider-specific ACP updates may require generic transcript labels.
- Complete in-memory history needs synthetic high-volume validation.
- OpenTUI frame/focus behavior must be verified against the installed 0.4.5 version.
- The existing README and several unrelated source/test files are already dirty; edits must remain narrow.

## Handoffs

- Start with `task_01` or `task_03`.
- `task_02` depends on the transcript helper contract from `task_01`.
- `task_04` must remove the legacy permission UI/state only after the store and ACP behavior are ready.
