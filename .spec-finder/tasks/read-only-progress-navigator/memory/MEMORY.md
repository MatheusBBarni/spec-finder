# Workflow Memory

## Current State

- The approved task DAG has four tasks for the Read-Only Progress Navigator.
- `task_01` and `task_03` are independent roots; `task_04` is the integration leaf.
- `task_01` is completed and its final report exists.
- `task_02` implementation and final-report verification are complete; its lifecycle status remains owned by the Spec Finder runtime.
- `task_03` implementation and repository verification are complete; its final report and lifecycle status remain owned by the Spec Finder runtime.
- `task_04` implementation, focused tests, responsive/reduced-color frames, real-PTY escape checks, repository verification, and final report are complete; its lifecycle status remains owned by the Spec Finder runtime.

## Shared Decisions

- Use the current-seam projection architecture from ADR-003; do not change the task engine or raw `RunEvent` protocol.
- Keep complete transcript history in memory for one run only; add no persistence or telemetry.
- Treat the TUI as read-only. Cancel `permissions: "prompt"` requests in TUI mode with a clear activity notice; preserve approve-all, deny, and non-UI behavior.
- Use `PRD-G-06` as the accepted task-generation alias for the PRD’s minimum-terminal goal, mapped to TechSpec responsive requirements.

## Shared Learnings

- `src/events.ts` already associates task status, activity, and ACP session updates with task IDs.
- `CockpitStore` retains uncapped per-task transcripts plus separate active/selected, focus, follow, help, run-activity, runtime-option, and task-reason state; task 04 removed the legacy permission and flat-activity view surfaces.
- OpenTUI 0.4.5 provides the focused `ScrollBox`, keyboard routing, resize handling, viewport culling, and test renderer needed by the approved design.
- OpenTUI 0.4.5 frame/input evidence passes at 80×24, 120×40, 200×60, reduced color, and a 70×20 stacked fallback; the renderer also navigates a 300-entry synthetic transcript.
- The repository has no Spec Finder-local `AGENTS.md` or `CLAUDE.md`; existing dirty files are user-owned and must be preserved.

## Open Risks

- Provider-specific ACP updates may require generic transcript labels.
- Complete in-memory transcript history still grows linearly for the life of a run; current store and renderer evidence covers 300 entries without introducing persistence.
- Existing Task 01 and runtime-owned packet changes are dirty and must remain untouched during later tasks.

## Handoffs

- `reports/task_04.md` records a completed verdict with deterministic category/frame evidence, refreshed real-PTY help/`q`/`Ctrl+C` evidence, and the unperformed live third-party provider smoke as a residual validation gap.
- Spec Finder still owns the `task_04.md` lifecycle transition; the report phase did not change task frontmatter.
