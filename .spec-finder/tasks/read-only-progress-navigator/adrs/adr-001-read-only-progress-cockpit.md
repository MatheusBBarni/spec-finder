# ADR-001: Read-Only Progress Cockpit

## Status

Accepted

## Date

2026-08-04

## Context

Spec Finder's current cockpit shows a task list and one flat ACP activity stream. The active task is marked, but users cannot select another task to inspect its output, and the stream does not preserve a clear task-specific viewing model. The current interface also presents permission decisions inside the cockpit, even though the intended product boundary is observation rather than task or agent control.

The V1 audience includes both new users who need immediate orientation and experienced users who need a quick progress check. The success target is that a new user can identify the active task and overall run state within five seconds.

## Decision

V1 will be a read-only progress cockpit with a persistent master-detail layout:

- a run summary makes overall state and the active task prominent;
- a task navigator lets users move between tasks;
- a detail pane shows ACP output for the selected task;
- the selected task's output supports line, page, start, and end scrolling;
- the interface shows a short, contextual navigation footer and an on-demand help view;
- permission selection and other task or agent actions stay outside the TUI;
- execution state and view-selection state remain separate so browsing historical output cannot affect the run.

The TUI may retain the terminal's normal quit or interrupt escape hatch, but it will not expose workflow mutations as cockpit actions.

## Alternatives Considered

### Minimal progress viewer

Keep a compact task list and a single output pane with simple task switching. This lowers implementation cost but provides weaker spatial context and less discoverability for new users.

### Observability cockpit

Add filtering, search, event-type tabs, timeline grouping, persisted view preferences, and richer responsive modes. This offers more power but expands beyond the stated progress-view boundary and increases V1 complexity.

### Retain the permission modal

Keeping in-TUI permission decisions would preserve the existing behavior, but it violates the observation-only boundary and makes the cockpit a second control plane.

## Consequences

### Positive

- Users can answer “what is running?” and “what did this task produce?” without leaving the cockpit.
- New-user guidance is visible in the interface instead of depending on external documentation.
- Existing task IDs on runtime events provide a stable basis for per-task output projection.
- The execution engine can remain unchanged while the view model becomes task-aware.

### Negative

- The cockpit store must retain or project output by task instead of one flat activity list.
- The UI needs explicit selection and focus state in addition to execution state.
- The current permission presentation must be removed or made non-interactive for this surface.
- Responsive behavior and scrolling add new frame and interaction tests.

### Risks and Mitigations

- **Output growth:** retain a bounded per-task history and keep the newest tail visible when the user is already at the tail.
- **State confusion:** name and test `activeTaskId` and `selectedTaskId` as separate concepts.
- **Small terminals:** define a minimum usable layout and collapse or stack panels below the breakpoint.
- **Discoverability regression:** keep contextual footer hints visible and provide a `?` help surface.
- **Terminal variance:** use semantic colors, status symbols, and layout hierarchy so color is not the only signal.

## References

- [Spec Finder cockpit implementation](/Users/matheusbbarni/projects/spec-finder/src/ui/App.tsx)
- [Spec Finder cockpit store](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts)
- [Spec Finder runtime events](/Users/matheusbbarni/projects/spec-finder/src/events.ts)
- [OpenTUI renderer documentation](https://opentui.com/docs/core-concepts/renderer/)
- [OpenTUI keyboard documentation](https://opentui.com/docs/core-concepts/keyboard/)
- [OpenTUI ScrollBox documentation](https://opentui.com/docs/components/scrollbox/)
