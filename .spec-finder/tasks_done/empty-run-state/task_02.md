---
status: completed
title: Render Persistent No-Work Cockpit State
type: frontend
complexity: high
dependencies:
  - task_01
---

# Task 02: Render Persistent No-Work Cockpit State

## Overview

Project the typed engine outcome into the singular cockpit state and render a
durable, text-first no-work summary showing the all-complete reason and task
counts. Expose an idempotent cockpit exit wait while preserving App ownership of
the existing Q/Ctrl+C read-only behavior for the final command integration.

## Source Artifacts

- PRD: `.spec-finder/tasks/empty-run-state/_prd.md`
- TechSpec: `.spec-finder/tasks/empty-run-state/_techspec.md`

<critical>
- Read `.spec-finder/tasks/empty-run-state/_prd.md`, `.spec-finder/tasks/empty-run-state/_techspec.md`, and ADRs `adr-001-empty-run-state.md`, `adr-002-default-informative-no-work.md`, and `adr-003-typed-no-work-lifecycle.md`, repository instructions, current Git state, and completed dependency `task_01` before editing.
- Treat `task_01` as a required lower-numbered dependency; consume its optional typed result/event fields rather than parsing a completion message or creating a second reason model.
- Use `sf-memory`; read `.spec-finder/tasks/empty-run-state/memory/MEMORY.md` and `.spec-finder/tasks/empty-run-state/memory/task_02.md` before editing and update both with factual learnings before finishing.
- Implement only singular cockpit projection, presentation, and exit-handle scope. Preserve the current batch projection, navigation, transcript behavior, and user-owned work; do not wire command waiting or alter batch presentation here.
- Reference TechSpec sections `Command and Cockpit Lifecycle`, `Data Models and Lifecycle`, `Failure and Recovery Behavior`, and `Testing and Evidence` instead of duplicating their architecture.
- Run focused tests and the exact repository verification gate to terminal exit. Do not change lifecycle status or write `reports/task_02.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST preserve typed `no_work`/`all_tasks_complete` terminal metadata in singular `finished` state while legacy terminal events keep the current generic summary behavior (G-01, F-02).
2. MUST render a persistent, distinct, text-readable no-work summary with all-complete reason, task counts, and existing Q/Ctrl+C guidance (G-03, US-01, US-02, M-04).
3. MUST provide an idempotent cockpit exit signal that App triggers from its existing Q/Ctrl+C paths before renderer teardown (US-02, C-03).
4. SHOULD add no acknowledgement, repair, retry, permission, telemetry, or other control surface (F-04, C-04).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-01, US-01, F-02 | Project and explain typed no-work state | Store test and rendered no-work frame |
| G-03, US-02, C-03, M-04 | Retain an observable summary until existing exit | Q/Ctrl+C frame and callback assertions |
| F-04, C-04 | Preserve read-only, no-telemetry boundary | Frame excludes new controls; scoped diff review |
| TechSpec: Command and Cockpit Lifecycle | Supply an idempotent exit wait | Handle/API and keyboard tests |
| TechSpec: Security and Privacy | Display only existing local task data | Text/count frame assertions |

## Subtasks

- [ ] 02.1 Extend singular terminal state to retain optional no-work outcome/reason without disturbing batch event projection.
- [ ] 02.2 Render the all-complete no-work summary with textual title, count, reason, and existing keyboard exit affordance.
- [ ] 02.3 Expose a one-shot cockpit exit wait and connect App's existing Q/Ctrl+C handling to its idempotent signal.
- [ ] 02.4 Add store and OpenTUI rendered-frame regression coverage, including reduced-color readability and both exit keys.

## Implementation Details

The generic success/failure summary remains the fallback whenever terminal
metadata is absent. The no-work state needs no new route or control: App keeps
ownership of keyboard input, signals the cockpit's callback once, calls its
existing cancellation behavior, and destroys the renderer. The later command
task alone decides whether to await that handle. Keep batch state gates intact
so nested singular lifecycle events cannot reset the active batch projection.

### Relevant Files

- `src/ui/store.ts` — retain optional terminal metadata for singular runs while preserving batch gates.
- `src/ui/App.tsx` — render a distinct persistent no-work summary and signal existing exit paths.
- `src/ui/cockpit.tsx` — return idempotent `close` and `waitForExit` lifecycle handle.
- `tests/store.test.ts` — assert singular terminal projection and generic fallback behavior.
- `tests/cockpit.test.tsx` — assert rendered content, keyboard behavior, and reduced-color accessibility.

### Dependent Files

- `src/commands.ts` — task_03 awaits the cockpit handle only for a typed no-work result.
- `src/events.ts` — task_01 terminal event supplies the optional fields.
- `src/batch.ts` and batch portions of `src/ui/store.ts` — must retain packet summary/projection behavior.

### Related ADRs

- [ADR-001: Empty-run state](adrs/adr-001-empty-run-state.md) — persistent informational outcome.
- [ADR-002: Default informative no-work](adrs/adr-002-default-informative-no-work.md) — no added controls or configuration.
- [ADR-003: Typed no-work outcome and command-owned exit lifecycle](adrs/adr-003-typed-no-work-lifecycle.md) — App keyboard ownership and one-shot wait.

## Deliverables

- Singular cockpit no-work state, readable summary, and idempotent exit handle.
- Store and rendered-frame tests covering state, accessibility, and keyboard behavior.
- Updated `.spec-finder/tasks/empty-run-state/memory/MEMORY.md` and `memory/task_02.md` with factual durable context.
- `reports/task_02.md` produced by Spec Finder's report phase.

## Tests

### Unit Tests

- [ ] Given a singular typed `run_finished` no-work event, store `finished` preserves `outcome`, `reason`, `ok`, and message; given no metadata, preserve generic behavior.
- [ ] Given a batch projection is active, nested singular terminal events continue to leave batch state intact.

### Integration Tests

- [ ] Given all-complete task state, an OpenTUI frame shows a distinct no-work title, all-complete reason, completion count, and Q/Ctrl+C guidance without relying on color.
- [ ] Given either Q or Ctrl+C while the no-work summary is visible, App invokes the exit/cancel flow once and renderer cleanup remains safe.
- [ ] Given reduced-color renderer capabilities, the no-work meaning and exit guidance remain readable and no new workflow controls appear.

### Platform or Manual Evidence

- [ ] Not applicable beyond rendered OpenTUI frames; the test renderer covers the terminal interaction boundary.

### Verification Commands

- `rtk bun test tests/store.test.ts tests/cockpit.test.tsx`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- No-work is visibly distinct and remains accessible until existing Q/Ctrl+C exit.
- The store/App never infer the outcome from free-text completion wording.
- Batch projection, read-only navigation, and generic summary behavior remain intact.
- Focused tests and the repository gate pass to terminal exit with no unrelated changes.
- Memory is current and `reports/task_02.md` is ready for the report phase.
