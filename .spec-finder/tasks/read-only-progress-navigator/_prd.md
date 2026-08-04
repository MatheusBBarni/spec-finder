# Read-Only Progress Navigator with Integrated Task Timer — Product Requirements Document

## Overview

The Spec Finder cockpit will remain a read-only progress surface for new and experienced operators. This update adds an integrated neutral timer to the existing navigator MVP.

The selected approach is:

- every task row shows an elapsed value;
- pending and blocked tasks show `—`;
- observed running tasks show live `MM:SS`;
- observed completed or failed tasks retain their final `MM:SS`;
- active or terminal tasks without a local timing baseline show `unavailable`;
- help explains that elapsed time is an observation, not an automatic stall verdict.

The MVP remains limited to in-session progress awareness. It does not add alerts, thresholds, persistence, analytics, estimates, or workflow controls.

## Research Evidence

| Kind | Finding | Source | Date | Product consequence |
|---|---|---|---|---|
| Repository | The cockpit already provides a header, task list, task-specific ACP transcript, task selection, scrolling, active-task following, and a live spinner. | [`src/ui/App.tsx`](/Users/matheusbbarni/projects/spec-finder/src/ui/App.tsx) | 2026-08-04 | Extend the existing navigator rather than create a new surface. |
| Repository | The UI store owns task and transcript presentation state but has no elapsed timing state. | [`src/ui/store.ts`](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts) | 2026-08-04 | The product needs a new in-session timer projection. |
| Repository | Runtime status events identify tasks but contain no timestamps. | [`src/events.ts`](/Users/matheusbbarni/projects/spec-finder/src/events.ts) | 2026-08-04 | Late attachment cannot invent a trustworthy duration; `unavailable` is required. |
| Repository | The engine emits `in_progress` before the ACP turn and terminal status after completion or failure. | [`src/engine.ts`](/Users/matheusbbarni/projects/spec-finder/src/engine.ts) | 2026-08-04 | These are the observable product start and freeze boundaries. |
| Repository | Existing tests cover navigation, transcript rendering, responsive behavior, and read-only controls, but not timer behavior. | [`tests/cockpit.test.tsx`](/Users/matheusbbarni/projects/spec-finder/tests/cockpit.test.tsx), [`tests/store.test.ts`](/Users/matheusbbarni/projects/spec-finder/tests/store.test.ts) | 2026-08-04 | Timer correctness and layout need new acceptance coverage. |
| Approved decision | The timer is an ephemeral per-task signal, not a duration dashboard. | [ADR-004](adrs/adr-004-ephemeral-task-duration.md) | 2026-08-04 | Preserve the read-only, in-session boundary. |
| User decision | The timer is included in the existing navigator MVP. | [ADR-005](adrs/adr-005-integrated-neutral-task-timer.md) | 2026-08-04 | Supersede the outdated duration-dashboard wording without expanding scope. |
| User decision | Narrow layouts preserve task identity, status, timer, and transcript context before secondary runtime metadata. | PRD clarification | 2026-08-04 | Timer remains visible when space is constrained. |
| User decision | Help explains that elapsed time is not an automatic stall verdict. | PRD clarification | 2026-08-04 | Reduce false interpretation of long-running ACP work. |
| External | GitHub CLI provides a live run-watching interaction and exposes `startedAt`/`updatedAt` metadata for completed runs. | [`gh run watch`](https://cli.github.com/manual/gh_run_watch), [`gh run view`](https://cli.github.com/manual/gh_run_view) | 2026-08-04 | Supports elapsed-progress context as a familiar operator need. |
| External | OpenTUI supports live rendering for animation-driven updates. | [OpenTUI renderer](https://opentui.com/docs/core-concepts/renderer/) | 2026-08-04 | The existing live spinner lifecycle can support a changing timer. |
| External | Lazygit uses persistent panels, compact status, keyboard navigation, and contextual help. | [Lazygit guide](https://lazygit.dev/docs/guide/) | 2026-08-04 | Confirms the surrounding navigator interaction pattern. |
| Inference | A compact, neutral timer is the smallest product change that improves stall awareness without introducing a second control plane. | Evidence synthesis | 2026-08-04 | Select the integrated neutral timer approach. |

## Goals

| ID | Goal | Measurable outcome |
|---|---|---|
| G-01 | Improve run orientation | At least 4 of 5 first-time evaluators identify the active task and run phase within 5 seconds. |
| G-02 | Make task progress scannable | Every task has a visible status, identity, and active-state distinction. |
| G-03 | Make ACP work inspectable | Users can select any task and reach both the beginning and live tail of its transcript. |
| G-04 | Make ACP output understandable | Messages, thoughts, plans, tools, errors, outcomes, and unknown events have readable labels. |
| G-05 | Preserve observation-only behavior | The cockpit exposes navigation, scrolling, help, and terminal cancellation only. |
| G-06 | Improve duration awareness | Users can see observed elapsed execution time for every applicable task row without receiving an automatic stall judgment. |
| G-07 | Preserve compact-terminal usability | Task identity, status, timer, and selected transcript context remain understandable at the supported minimum size. |

## User Stories

| ID | Persona | Story | Acceptance signal |
|---|---|---|---|
| US-01 | New operator | As a new user, I want to identify the run, active task, and phase immediately so that I know what is happening. | Header and active row are identifiable within 5 seconds. |
| US-02 | Operator | As an operator, I want to scan every task and its status so that I can understand overall progress. | All task rows remain reachable and status is communicated by symbol and text. |
| US-03 | Operator | As an operator, I want to select any task so that I can inspect its ACP output. | Selected task identity matches the displayed transcript. |
| US-04 | Observer | As an observer, I want the view to follow the active task by default so that live progress remains visible. | Active-task changes update the selected view while follow mode is enabled. |
| US-05 | Reviewer | As a reviewer, I want to scroll a task transcript from start to tail so that I can inspect its complete history. | Line, page, start, and end navigation work for every selected task. |
| US-06 | User | As a user, I want ACP event categories labeled clearly so that raw provider output is understandable. | Event categories have readable labels and distinct visual treatment. |
| US-07 | User | As a user, I want failure and blocked reasons summarized plainly so that I can understand what happened. | The reason is visible in the task summary and selected transcript. |
| US-08 | Safety-conscious operator | As a safety-conscious user, I want the cockpit to be view-only so that I cannot approve permissions or mutate workflow state accidentally. | No approval, retry, edit, reorder, or status-mutation control is rendered. |
| US-09 | Operator | As an operator, I want to see how long each observed task has been executing so that I can notice a possibly long-running task. | Running rows update in `MM:SS`; pending and blocked rows show `—`. |
| US-10 | Reviewer | As a reviewer, I want a completed or failed task to retain its observed final duration so that I can understand the run after completion. | Final `MM:SS` remains visible for the current run. |
| US-11 | Compact-terminal user | As a user in a narrow terminal, I want task identity, status, timer, and transcript context preserved so that the cockpit remains useful. | Secondary runtime metadata collapses before these fields. |
| US-12 | New operator | As a new operator, I want help to explain the timer so that I do not mistake elapsed time for an automatic stall verdict. | Help contains a concise neutral-timer explanation. |

## Core Features

### F-01: Runtime header

- **User value:** Establishes run context before the user reads the body.
- **Mapped goals/stories:** G-01, G-07, US-01, US-11.
- **MUST:** Show task slug, phase or outcome, active task, task counts, provider, model, reasoning, and speed when space allows.
- **SHOULD:** Distinguish applied, default, requested, and unsupported runtime values truthfully.
- **Acceptance conditions:** The first rendered state identifies the run and phase; narrow layouts collapse secondary metadata before task identity and timer.

### F-02: Task progress column

- **User value:** Makes task order and progress immediately scannable.
- **Mapped goals/stories:** G-02, G-06, US-02, US-09, US-10.
- **MUST:** List every task with task identity, title, status text, status symbol, selected marker, and active-task distinction.
- **SHOULD:** Keep timer values visually aligned or consistently positioned.
- **Acceptance conditions:** Pending, running, completed, failed, and blocked rows are distinguishable without color alone.

### F-03: Task-specific ACP transcript

- **User value:** Lets users inspect current or completed work without leaving the cockpit.
- **Mapped goals/stories:** G-03, G-04, US-03, US-05, US-06.
- **MUST:** Show the selected task's complete chronological ACP history.
- **SHOULD:** Keep the selected task identity prominent in the transcript title.
- **Acceptance conditions:** Selecting a task never shows another task's transcript; history remains available while the run continues.

### F-04: Active-task following

- **User value:** Keeps the live task visible during normal monitoring.
- **Mapped goals/stories:** G-02, G-03, US-04.
- **MUST:** Follow the active task automatically until the user manually inspects another task.
- **SHOULD:** Make the difference between active and selected task visible.
- **Acceptance conditions:** Manual inspection does not change execution or force the view back to the active task.

### F-05: Readable ACP presentation

- **User value:** Makes provider output understandable without requiring ACP expertise.
- **Mapped goals/stories:** G-04, US-06, US-07.
- **MUST:** Label messages, thoughts, plans, tool calls, tool updates, activity, errors, outcomes, and unknown events.
- **SHOULD:** Use semantic symbols and colors together.
- **Acceptance conditions:** Each supported event category has a readable label and unknown events remain visible rather than disappearing.

### F-06: Streaming clarity

- **User value:** Prevents fragmented ACP chunks from becoming unreadable noise.
- **Mapped goals/stories:** G-03, G-04, US-05, US-06.
- **MUST:** Coalesce related streaming content while preserving chronological order and meaningful updates.
- **SHOULD:** Distinguish streaming entries from completed entries.
- **Acceptance conditions:** A multi-chunk message appears as one understandable entry without hiding content.

### F-07: Full-history navigation

- **User value:** Supports reviewing long output from beginning to live tail.
- **Mapped goals/stories:** G-03, US-05.
- **MUST:** Support line, page, start, and end navigation for the selected transcript.
- **SHOULD:** Keep the live tail visible when the user has not manually scrolled away.
- **Acceptance conditions:** Users can reach the first and latest entries of every tested task transcript.

### F-08: Failure and blocked emphasis

- **User value:** Makes failure consequences understandable without decoding raw status values.
- **Mapped goals/stories:** G-01, G-04, US-07.
- **MUST:** Show failed and blocked status, a plain-language reason, and detailed context in the transcript.
- **SHOULD:** Show dependency-specific wording for blocked tasks.
- **Acceptance conditions:** The reason appears in the first rendered state after the failure or blocked event.

### F-09: Read-only interaction boundary

- **User value:** Prevents accidental workflow or permission changes.
- **Mapped goals/stories:** G-05, US-08.
- **MUST:** Permit navigation, scrolling, help, and the terminal cancellation escape hatch only.
- **SHOULD:** Keep the read-only boundary visible in help.
- **Acceptance conditions:** No permission approval, retry, prompt editing, task reordering, or status mutation is exposed.

### F-10: Contextual help and responsive hierarchy

- **User value:** Makes navigation discoverable and preserves meaning on small terminals.
- **Mapped goals/stories:** G-01, G-05, G-07, US-01, US-08, US-11, US-12.
- **MUST:** Keep essential navigation visible in the footer and provide on-demand help.
- **SHOULD:** Preserve task identity, status, timer, and selected transcript context before provider/model/reasoning/speed metadata.
- **Acceptance conditions:** Help documents task navigation, pane switching, transcript scrolling, terminal cancellation, read-only behavior, and the neutral meaning of elapsed time.

### F-11: Integrated neutral task timer

- **User value:** Gives operators direct duration awareness without classifying tasks as stalled.
- **Mapped goals/stories:** G-06, G-07, US-09, US-10, US-11, US-12.
- **MUST:** Show `—` for pending and blocked tasks.
- **MUST:** Show live `MM:SS` for a running task observed from its first `in_progress` transition.
- **MUST:** Freeze and retain the first observed terminal duration for completed and failed tasks.
- **MUST:** Show `unavailable` when an active or terminal task has no trustworthy local timing baseline.
- **MUST:** Use total minutes and seconds; do not roll over at one hour.
- **MUST:** Keep the value in the current cockpit session only.
- **SHOULD:** Keep the timer visible in compact layouts before secondary metadata.
- **Acceptance conditions:** Controlled-clock tests cover start, live updates, terminal freeze, duplicates, stale events, placeholders, and unavailable states; no timer action causes workflow mutation or alerting.

## User Experience

### Primary journey

1. The user launches the cockpit and sees the run header, task list, and selected transcript.
2. The active task is visually marked and follows automatically.
3. The active row shows its observed elapsed duration in `MM:SS`.
4. The user sees `—` for tasks that have not run or are blocked.
5. The user can select another task and inspect its complete ACP history without changing execution.
6. The user can scroll to the beginning, return to the live tail, or switch back to the active task.
7. When a task completes or fails, its final observed duration remains visible.
8. The help view explains that elapsed time is a neutral observation, not a stall determination.
9. The user quits or cancels through the existing terminal escape hatch.

### Empty and loading states

- Before the packet is available, show a clear initializing/preparing state.
- If no task is selected, show an explicit empty transcript state.
- Pending rows retain `—` rather than an animated or misleading value.

### Success state

- Completed tasks show a success symbol, completed label, and frozen duration when observed.
- The final run outcome is visible in the header while task histories remain inspectable.

### Failure and blocked states

- Failed tasks show a failure symbol, plain-language reason, and frozen duration when observed.
- Blocked tasks show a blocked symbol, dependency reason when available, and `—`.
- The timer does not label a task stalled or overdue.

### Recovery and cancellation

- Manual selection, scrolling, and resizing do not alter task execution.
- Returning to the active task restores normal follow behavior.
- `q` and `Ctrl+C` remain the only terminal escape hatches.
- A late-attached cockpit shows `unavailable` rather than inventing elapsed time.

### Accessibility and terminal variance

- Status meaning must not depend on color alone.
- Symbols, text labels, and timer values must remain legible in light, dark, and reduced-color terminals.
- The supported minimum is 80×24; narrower or shorter terminals may use a compact fallback notice.

## High-Level Constraints

- The cockpit remains read-only apart from navigation, scrolling, help, and terminal cancellation.
- No new approval, retry, edit, reorder, or status-mutation workflow is introduced.
- Timer values are ephemeral and are not persisted, exported, copied, logged, telemetered, or inserted into transcripts/reports.
- The timer is observed elapsed execution time, not an SLA, estimate, cost, ranking, or automatic stall verdict.
- The display format is fixed to `MM:SS` for MVP.
- The product must preserve task execution order, provider behavior, permission policy, report requirements, and `--no-ui` behavior.
- ACP history remains chronological and task-specific during the current run.
- Runtime identity must remain truthful to effective configuration.
- The design must remain understandable at 80×24, 120×40, 200×60, and reduced-color terminal modes.

## Non-Goals

- **Automatic stalled classification or thresholds** — elapsed time is a neutral cue; reconsider only with task-duration evidence.
- **Alerts, notifications, or watchdog behavior** — these would add policy and false-positive handling.
- **Task cancellation, retry, editing, reordering, or status mutation** — the cockpit remains observation-only.
- **Persisted duration history or cross-run analytics** — reconsider only with privacy, retention, and analytics requirements.
- **Cost, token, billing, SLA, estimate, ranking, or average-duration views** — the timer must not imply performance predictability.
- **Transcript search, filtering, event tabs, copying, or export** — these remain later observability capabilities.
- **Configurable timer formats, thresholds, themes, layouts, or keymaps** — MVP uses one documented presentation.
- **Changes to ACP transports, task schemas, runtime event schemas, or non-TUI execution** — the feature remains a cockpit presentation capability.

## Phased Rollout Plan

### MVP

Included:

- Existing runtime header and run summary.
- Existing two-column task/transcript navigator.
- Existing task selection, active-task following, scrolling, readable ACP presentation, failure emphasis, help, and read-only boundary.
- Integrated neutral timer on every task row.
- `MM:SS`, `—`, frozen terminal value, and `unavailable` behavior.
- Compact-layout priority for task identity, status, timer, and transcript context.
- Help explanation that elapsed time is not an automatic stall verdict.
- Acceptance coverage for timer transitions, terminal states, responsive layouts, reduced-color semantics, and read-only integrity.

Entry criteria:

- Approved PRD, TechSpec, and implementation tasks.
- Existing navigator behavior remains regression-free.
- Timer semantics are represented in product acceptance conditions.

Exit criteria:

- All MVP success metrics meet their stated targets.
- No timer state leaks into persistence, reports, transcripts, telemetry, or workflow controls.
- The timer remains readable at the supported terminal sizes.

### Later phases

- **Liveness warnings** — require observed evidence that neutral elapsed time is insufficient and a clear threshold/notification policy.
- **Duration history and comparison** — require a separate privacy, retention, and analytics decision.
- **Transcript search/filtering/export** — require demonstrated review friction in long histories.
- **Configurable layouts and timer formats** — require repeated user demand across terminal sizes.
- **Cross-run performance analytics** — require a business case beyond in-session monitoring.

## Success Metrics

| ID | Metric | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| M-01 | New-user orientation | Unknown | At least 4 of 5 first-time evaluators identify active task and run phase within 5 seconds | Controlled first-use evaluation | Before release and first usability review |
| M-02 | Task inspection speed | Unsupported by prior cockpit | User reaches another task transcript in no more than two navigation actions | Interaction test | Every release candidate |
| M-03 | Transcript selection correctness | Not measured | 100% of tested selections show the matching task transcript | Automated frame/interaction tests | Every verification run |
| M-04 | History access | Not measured | Users reach start and live tail of every tested task transcript | Automated navigation tests | Every verification run |
| M-05 | Failure recognition | Not measured | Failed/blocked task and reason appear in the first rendered state after the event | Frame assertions | Every verification run |
| M-06 | Read-only integrity | Zero timer controls today | 100% of tested timer/cockpit interactions remain observational; no workflow mutation or permission action occurs | Regression tests and event audit | Every verification run |
| M-07 | Timer transition correctness | Not measured | 100% correct for start, live update, terminal freeze, duplicate, stale, placeholder, and unavailable cases | Controlled-clock store tests | Every verification run |
| M-08 | Final duration retention | Not measured | 100% of observed completed/failed tasks retain their final duration for the current run | Store and frame assertions | Every verification run |
| M-09 | Compact timer readability | Not measured | No clipped or ambiguous task identity, status, timer, or transcript context at 80×24, 120×40, 200×60, and reduced-color sizes | Renderer frames and manual snapshots | Before release |
| M-10 | Timer interpretation | Unknown | At least 4 of 5 evaluators understand that elapsed time is not an automatic stall verdict | Help comprehension test | First usability review |

## Risks and Mitigations

| Risk | Evidence | Likelihood/impact | Mitigation | Owner/decision trigger |
|---|---|---|---|---|
| Users interpret a long duration as proof of a stall | No evidence supports universal task thresholds; ACP work can legitimately be quiet | Medium / High | Neutral wording, explanatory help, no warning labels | Product; revisit only with observed misinterpretation |
| Timer crowds out task identity or transcript context | Task rows already contain IDs, titles, status, and selection state | Medium / High | Preserve identity/status/timer/context before secondary metadata; test compact layouts | Product/UX; trigger redesign if M-09 fails |
| Automatic follow disrupts manual review | Existing navigator separates active and selected task concepts | Medium / Medium | Keep active and selected state distinct; stop follow during manual inspection | Product; trigger if M-02 or qualitative review regresses |
| ACP output remains noisy despite labels | Full task history is intentionally retained | Medium / Medium | Coalesce streaming content and retain clear event labels | Product/UX; trigger if M-04 or review feedback fails |
| Failure reasons remain cryptic | Provider errors can contain raw transport terminology | Medium / High | Show concise plain-language reason while retaining detail in transcript | Product; trigger if M-05 fails |
| Late attachment creates confusing `unavailable` values | Runtime events contain no timestamps | Medium / Medium | Document `unavailable` as “not observed by this cockpit process” in help or detail copy | Product; trigger if M-10 fails |
| Users expect historical timing analytics | Timer is visible on completed rows | Low / Medium | Explicitly exclude persistence, averages, rankings, and dashboards | Product; require separate evidence before expansion |
| Terminal variance weakens meaning | OpenTUI supports multiple sizes and color capabilities | Medium / Medium | Use symbols and labels in addition to color; verify supported sizes | Product/UX; trigger if M-09 fails |

## Architecture Decision Records

- [ADR-001: Read-Only Progress Cockpit](adrs/adr-001-read-only-progress-cockpit.md) — Establishes the observation-only master-detail boundary.
- [ADR-002: Guided Live Transcript Product Shape](adrs/adr-002-guided-live-transcript.md) — Establishes the header and two-column transcript experience.
- [ADR-003: Current-Seam Transcript Projection](adrs/adr-003-current-seam-transcript-projection.md) — Preserves execution semantics while improving the viewing projection.
- [ADR-004: Ephemeral Task Duration Signal](adrs/adr-004-ephemeral-task-duration.md) — Defines timer states, final-value retention, and non-persistence.
- [ADR-005: Integrated Neutral Task Timer Product Scope](adrs/adr-005-integrated-neutral-task-timer.md) — Includes the timer in the navigator MVP and sets compact-layout/help priorities.

## Research Limitations

- No direct market-demand or willingness-to-pay evidence was found for this narrow TUI timer; external sources establish interaction precedent and feasibility only.
- There is no baseline usability study for identifying long-running tasks or interpreting `unavailable`.
- The current event protocol has no timestamps, so a late-attached or restarted cockpit cannot reconstruct a trustworthy prior duration.
- Existing downstream TechSpec/task artifacts describe the earlier navigator scope and will require a later approved update to trace timer requirements.
- External documentation was refreshed on 2026-08-04 and should be rechecked if the installed OpenTUI version changes.

## Open Questions

- What exact compact wording should accompany `unavailable` if the full word cannot fit at the supported minimum width?
- Should the timer help note appear only in `?` help or also in the normal footer when the first task starts?
- What baseline usability result should determine whether the neutral timer is sufficient before considering liveness warnings?
