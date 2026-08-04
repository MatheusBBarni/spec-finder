# Read-Only Progress Navigator

## Overview

Improve the Spec Finder cockpit into a read-only progress navigator that helps new users understand run state quickly while giving experienced users direct access to each task's ACP output.

The V1 experience keeps users informed without turning the cockpit into a task-management or agent-control surface.

## Problem

The current cockpit shows tasks beside one flat ACP activity stream. Users can see which task is active, but they cannot select another task to inspect its output, and the visual hierarchy does not make overall progress immediately obvious.

The current permission modal also makes the cockpit interactive in a way that conflicts with the intended observation-only boundary.

## Target Users

- New Spec Finder users who need to understand the current run without reading external documentation.
- Experienced users who monitor several sequential tasks and need to inspect task-specific ACP output quickly.

## Core Features

| Priority | Feature | User value |
|---|---|---|
| Must | Run summary with overall state and active-task emphasis | Answers "what is happening?" at a glance |
| Must | Persistent task navigator with status indicators | Makes progress and task order easy to scan |
| Must | Select any task to view its ACP output | Lets users inspect current or completed work |
| Must | Scroll selected-task output | Supports reviewing long agent/tool activity |
| Must | Read-only interaction model | Prevents accidental workflow or permission actions |
| Strong | Contextual footer and `?` help surface | Teaches essential navigation without external docs |
| Strong | Responsive, semantic visual hierarchy | Keeps the view usable across terminal sizes and color capabilities |

## KPIs

| KPI | Baseline | Target | Measurement window |
|---|---:|---:|---|
| Time for a new user to identify active task and overall run state | Not measured | <=5 seconds | First-use evaluation |
| Keystrokes to switch from task list to a task's output | Not supported | <=2 keystrokes | Interaction test |
| Correct task-output selection | Not supported | 100% of tested selections show the matching task output | Automated frame/interaction tests |
| Long-output navigation | Not tested | Line, page, start, and end scrolling work for every selected task | Automated interaction tests |
| Minimum-size usability | Not tested | Usable at 80x24, with tested behavior at 120x40 and 200x60 | Renderer frame tests |
| Control-plane leakage | Permission modal currently exists | Zero workflow mutation or permission controls rendered by the cockpit | Regression tests |

## Feature Assessment

| Criterion | Score | Rationale |
|---|---|---|
| Impact | Must do | Directly addresses the stated discoverability and scanability problem |
| Reach | Strong | Applies to every interactive task run |
| Frequency | Must do | Users monitor progress throughout every run |
| Differentiation | Maybe | Workflow-specific clarity is valuable but not a novel TUI category |
| Defensibility | Maybe | The value comes from Spec Finder's task/ACP model |
| Feasibility | Strong | Existing task IDs and OpenTUI layout/scrolling primitives support the scope |

## Research Findings

### Codebase evidence

- [App.tsx](/Users/matheusbbarni/projects/spec-finder/src/ui/App.tsx:42) currently renders a fixed header, task list, and one global activity pane.
- [store.ts](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts:19) stores one flat activity list and execution-oriented `activeTaskId`, but no selected task or per-task output view.
- [events.ts](/Users/matheusbbarni/projects/spec-finder/src/events.ts:5) already associates task status, activity, and session updates with task IDs.
- [cockpit.test.tsx](/Users/matheusbbarni/projects/spec-finder/tests/cockpit.test.tsx:9) only covers basic frame rendering, not navigation or scrolling.
- The current run engine can remain the source of execution truth; the cockpit needs a clearer viewing projection.

### Sourced facts

OpenTUI provides flexible component layout, focus-routed keyboard input, resize events, and a focused `ScrollBox` with line/page/Home/End scrolling and sticky-tail behavior. ([renderer](https://opentui.com/docs/core-concepts/renderer/), [keyboard](https://opentui.com/docs/core-concepts/keyboard/), [ScrollBox](https://opentui.com/docs/components/scrollbox/))

Comparable TUIs use persistent panels, explicit scrolling, contextual help, and read-only modes as established interaction patterns. ([lazygit keybindings](https://github.com/jesseduffield/lazygit/blob/master/docs/keybindings/Keybindings_en.md), [K9s commands](https://k9scli.io/topics/commands/))

These precedents inform interaction expectations but do not establish market demand for this feature.

### Inference

A read-only master-detail layout is the smallest coherent change that improves both discoverability and information hierarchy without expanding Spec Finder's execution model.

## Council Insights

- Pragmatic engineering: preserve the task engine and event protocol; improve the cockpit projection.
- Architecture: keep execution state and view-selection state separate so inspecting history cannot affect the run.
- Product: make active task and overall state visually dominant; expose only the navigation needed to inspect progress.
- Security and safety: remove permission decisions and workflow mutations from the cockpit.
- Devil's advocate: task output may become large or noisy, so V1 needs bounded retention and clear selected-task identity.
- Synthesis: prioritize immediate orientation, task selection, and output scrolling; defer advanced observability features.

## Out of Scope (V1)

- Approving or denying permissions inside the TUI
- Editing prompts, retrying tasks, reordering tasks, or changing task status
- Search, filtering, timeline grouping, or event-type tabs
- Persisted panel layouts, user themes, or configurable keymaps
- New ACP transports or changes to task execution semantics
- Advanced run analytics such as cost, token usage, or duration dashboards

## Architecture Decision Records

- [ADR-001: Read-Only Progress Cockpit](adrs/adr-001-read-only-progress-cockpit.md) - Establishes the observation-only master-detail V1 boundary.

## Open Questions

- What bounded output-retention limit is appropriate for long-running tasks?
- What should happen below the minimum usable terminal size?
- Should the summary show only task counts, or also provider identity and run outcome?
- Which navigation keys should be primary, with arrows as the universal fallback?
