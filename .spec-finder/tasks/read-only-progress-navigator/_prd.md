# Read-Only Progress Navigator Product Requirements Document

## Overview

Improve the Spec Finder run cockpit into a read-only progress surface for new and experienced users.

The experience will use:

- a header showing task slug, provider, model, reasoning, speed, task counts, and run phase/outcome;
- a two-column main area;
- a task column showing every task and its status;
- a live ACP transcript column showing the selected task's complete chronological output.

The cockpit will clarify ACP output without becoming a task-management or agent-control surface.

## Goals

1. Help a new user identify the active task and overall run state within five seconds.
2. Make task progress scannable through persistent status and active-task emphasis.
3. Let users inspect complete ACP history for any task while the run continues.
4. Make full ACP output understandable through readable labels, grouping, coalesced streaming text, and prominent status/outcome states.
5. Keep the cockpit read-only apart from navigation, scrolling, and the terminal escape hatch.
6. Preserve usability at the minimum supported terminal size.

## User Stories

- As a new user, I can identify the task slug, runtime identity, active task, and run phase from the first screen.
- As an operator, I can scan all tasks and immediately see which task is running, completed, failed, or blocked.
- As an operator, I can move between tasks and inspect the selected task's complete ACP history.
- As an observer, I can follow the active task's live transcript without manually refreshing.
- As a reviewer, I can scroll from the newest output back to the beginning of a task.
- As a user, I can distinguish messages, thoughts, plans, tool calls, errors, and final outcomes.
- As a user, I see a plain-language failure reason immediately when a task fails or becomes blocked.
- As a safety-conscious user, I cannot approve permissions or mutate workflow state from the cockpit.

## Core Features

| Priority | Feature | Requirement |
|---|---|---|
| Must | Runtime header | Show task slug, provider, model, reasoning, speed, task counts, and plain-language phase/outcome |
| Must | Task progress column | List every task with status symbols, labels, and a clear running-task indicator |
| Must | ACP transcript column | Show the selected task's complete chronological history |
| Must | Active-task follow | Select and follow the running task automatically as execution advances |
| Must | Readable ACP presentation | Label and visually distinguish messages, thoughts, plans, tool calls, tool updates, errors, and outcomes |
| Must | Streaming clarity | Coalesce fragmented streaming text into readable entries without hiding content |
| Must | Full-history navigation | Support moving through the entire selected task history |
| Must | Failure emphasis | Highlight failed/blocked tasks and show a plain-language reason in the summary and selected transcript |
| Must | Read-only boundary | Do not expose permission approval, retries, task editing, reordering, or status mutation |
| Strong | Contextual navigation help | Keep essential navigation visible and provide complete help on demand |
| Strong | Responsive hierarchy | Preserve header, task status, and transcript clarity as the terminal narrows |

## User Experience

The header establishes context before the user reads the body. The left side identifies the Spec Finder run and task slug; the right side exposes effective provider settings and the current phase or outcome.

The main area is divided into two stable columns:

- Tasks: a compact progress list with status symbols, task IDs, titles, and a clear active marker.
- Live transcript: the selected task's chronological ACP output, with readable event labels and visible distinctions between streaming, completed, failed, and blocked states.

When the run advances, the selected task follows the active task automatically. Users can still inspect another task and scroll its history; the interface must not confuse "currently running" with "currently selected."

The task column supports keyboard navigation. The transcript column supports line, page, start, and end scrolling. Exact key assignments remain a TechSpec decision, but the interface must document them in the footer and help view.

Narrow terminals may stack or collapse secondary content, but must preserve the task identity, active status, and current transcript context.

## High-Level Constraints

- The cockpit is read-only.
- Full task history remains available during the run.
- ACP output must retain its meaningful event categories and chronological order.
- Runtime identity must be truthful to the effective configuration.
- Failure and blocked states must be understandable without decoding raw ACP terminology.
- The feature must not change task execution order, provider behavior, permission policy, or report requirements.
- Transcript content must remain in-session; this feature does not introduce cross-run transcript persistence or telemetry.
- Visual hierarchy and symbols must communicate status without relying on color alone.
- The design must degrade gracefully on small, light, dark, and reduced-color terminals.

## Non-Goals

- Permission approval or denial inside the cockpit
- Prompt editing, task retry, task reordering, or task status mutation
- ACP command execution from the transcript
- Search, filtering, event-type tabs, or cross-task analytics
- Cross-run transcript history
- Configurable themes, layouts, or keymaps
- Cost, token, duration, or provider-performance dashboards
- Changes to ACP transport or task-engine semantics

## Phased Rollout Plan

### MVP

- Runtime header with agreed identity and run-state fields
- Two-column task and transcript layout
- Per-task status and active-task emphasis
- Complete task-specific ACP history
- Readable event presentation and streaming coalescing
- Automatic active-task following
- Full transcript scrolling
- Failure/blocked emphasis with plain-language reasons
- Read-only navigation and contextual help
- Minimum-size and terminal-variance acceptance coverage

### Later Phases

- Transcript search and filtering
- Optional event-type views
- Copy/export of selected transcript content
- Cross-run history and comparison
- User-configurable layouts, themes, and keybindings
- Richer execution analytics

## Success Metrics

| Metric | Target |
|---|---|
| New-user orientation | At least 4 of 5 first-time evaluators identify the active task and run phase within 5 seconds |
| Task inspection | A user reaches another task's transcript in no more than two navigation actions |
| Selection correctness | 100% of tested task selections show the matching transcript |
| History access | Users can reach both the start and live tail of every tested task transcript |
| Failure recognition | Failed/blocked task and reason are visible in the first rendered state after the failure event |
| Read-only integrity | No workflow mutation or permission action is exposed by the cockpit |
| Minimum-size usability | Required identity, task status, and transcript context remain understandable at 80x24 |

## Risks and Mitigations

- Full history can become visually noisy. Use semantic event labels, grouping, and coalesced streaming entries.
- Automatic following can interrupt manual review. Keep active and selected task state distinct and follow automatically only while viewing the active task.
- Runtime metadata can crowd the header. Prioritize slug, phase/outcome, and active-task context before secondary fields at narrow widths.
- Provider output may contain cryptic failure text. Show a concise user-facing reason while retaining detailed context in the transcript.
- ACP output may contain sensitive content. Keep the feature in-session and avoid introducing telemetry or durable transcript storage.
- Terminal differences can weaken status signaling. Pair semantic colors with symbols, labels, and layout.

## Research Basis

- [Current Spec Finder cockpit](/Users/matheusbbarni/projects/spec-finder/src/ui/App.tsx)
- [Current cockpit state model](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts)
- [Task-scoped runtime events](/Users/matheusbbarni/projects/spec-finder/src/events.ts)
- [Kitten transcript projection](/Users/matheusbbarni/projects/kitten/packages/tui/src/core/transcriptProjection.ts)
- [Kitten message presentation](/Users/matheusbbarni/projects/kitten/packages/tui/src/ui/MessageView.tsx)
- [GitHub CLI run watch](https://cli.github.com/manual/gh_run_watch)
- [Lazygit keybindings](https://github.com/jesseduffield/lazygit/blob/master/docs/keybindings/Keybindings_en.md)
- [K9s commands and read-only mode](https://k9scli.io/topics/commands/)
- [OpenCode TUI configuration](https://opencode.ai/docs/tui/)

## Architecture Decision Records

- [ADR-001: Read-Only Progress Cockpit](adrs/adr-001-read-only-progress-cockpit.md) - Establishes the observation-only master-detail boundary.
- [ADR-002: Guided Live Transcript Product Shape](adrs/adr-002-guided-live-transcript.md) - Establishes the header and two-column transcript experience.

## Open Questions

- Which secondary header fields should collapse first on narrow terminals?
- How should unsupported or provider-specific ACP event types be labeled?
- What exact wording should summarize failures and blocked dependencies?
- Should users be able to copy transcript text in a later phase?
- Which navigation bindings best balance universal arrows with expert shortcuts?
