# Keep Task-Run Errors Visible in the ACP Cockpit — Product Requirements Document

## Overview

Interactive Spec Finder task runs currently discard their final failure view before an operator can inspect it. The MVP is a default-on failure review: on a failed interactive run, retain the cockpit until dismissal and show the failed task, complete surfaced error, final outcome, and one generic recovery hint.

The target user is the operator watching an active ACP task run. This is a quick reliability improvement, not a diagnostics platform, retry system, or persistent history feature.

## Research Evidence

| Kind | Finding | Source | Date | Product consequence |
|---|---|---|---|---|
| Repository | The command creates the interactive cockpit and unconditionally closes it after a run; non-UI mode prints activity, status, and final outcome. | [`src/commands.ts`](../../../src/commands.ts) | 2026-08-08 | Failed interactive runs need an explicit review state; non-UI behavior remains immediate. |
| Repository | The engine emits a failed task status, surfaced failure message, and final outcome. | [`src/engine.ts`](../../../src/engine.ts) | 2026-08-08 | The MVP can preserve existing diagnostic facts without inventing new ones. |
| Repository | The cockpit already summarizes failures, but compact text can truncate the error. | [`src/ui/store.ts`](../../../src/ui/store.ts), [`src/ui/App.tsx`](../../../src/ui/App.tsx) | 2026-08-08 | The final review must make the complete surfaced error readable. |
| Repository | Current coverage renders failure summaries but does not prove the command keeps them visible before terminal cleanup. | [`tests/cockpit.test.tsx`](../../../tests/cockpit.test.tsx) | 2026-08-08 | Default release requires stronger terminal-path evidence. |
| External | Failed CI runs retain diagnostics for inspection and recovery. | [GitHub Actions](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs), [GitLab CI](https://docs.gitlab.com/ci/jobs/job_logs/) | Accessed 2026-08-08 | An explicit failure-review state meets established operator expectations. |
| External | A terminal UI needs deliberate cleanup to restore its terminal state. | [OpenTUI lifecycle](https://opentui.com/docs/core-concepts/lifecycle/) | Accessed 2026-08-08 | The post-failure review must have a clear dismissal and cleanup outcome. |
| User decision | Use a generic recovery hint, enable the feature by default in the next release, and require automated coverage plus a manual terminal smoke check. | PRD clarification | 2026-08-08 | Keep MVP focused and make the release gate explicit. |

## Goals

| ID | Goal | Measurable outcome |
|---|---|---|
| G-01 | Preserve actionable failed-run diagnostics | Every controlled interactive failure remains readable until explicit dismissal. |
| G-02 | Make immediate recovery clear | Every failure final state identifies the task, error, outcome, and generic next step. |
| G-03 | Preserve existing normal workflows | Successful, cancelled, and non-UI runs complete without a new waiting state. |
| G-04 | Release safely by default | All required terminal-path checks and one manual smoke check pass before release. |

## User Stories

| ID | Persona | Story | Acceptance signal |
|---|---|---|---|
| US-01 | Active-run operator | As an operator, I want a failed cockpit to remain visible until I dismiss it, so that I can inspect the failure before my terminal returns. | The final failed screen remains present until an explicit dismissal action. |
| US-02 | Active-run operator | As an operator, I want the failed task, complete surfaced error, and final outcome together, so that I can understand what stopped. | All three are readable in the final failure view. |
| US-03 | Active-run operator | As an operator, I want one concise recovery hint, so that I know the immediate next action without interpreting raw output. | The final view says to resolve the listed error and rerun the task packet. |
| US-04 | Non-UI operator | As an operator using `--no-ui`, I want failure output and a non-zero result without waiting for terminal interaction. | The command retains its current console-oriented failure completion. |
| US-05 | Returning operator | As an operator whose run succeeds or is cancelled, I want the familiar completion behavior, so that a failure fix does not slow normal work. | Successful and cancellation paths do not show a new retained review state. |

## Core Features

### F-01: Failure-only review state

- **User value:** Gives an operator time to read the failed final state.
- **Mapped goals/stories:** G-01, G-03; US-01, US-05.
- **MUST:** Retain the interactive cockpit after a failed terminal run until `Esc`, `q`, or Ctrl+C dismisses it.
- **SHOULD:** Clearly label the state as failed rather than using success-oriented completion language.
- **Acceptance conditions:** A failed run remains visible until dismissal; successful and cancelled runs retain their current immediate-completion behavior.

### F-02: Complete final diagnostic record

- **User value:** Makes the cause of failure readable at the exact moment it matters.
- **Mapped goals/stories:** G-01, G-02; US-02.
- **MUST:** Show the failed task ID, complete surfaced error, and final run outcome/counts in the retained failure view.
- **SHOULD:** Keep the task and outcome easy to scan before the full error detail.
- **Acceptance conditions:** Short and multiline surfaced errors are readable before dismissal; the view does not rely on color alone.

### F-03: Generic recovery hint

- **User value:** Provides a truthful next step for every failure.
- **Mapped goals/stories:** G-02; US-03.
- **MUST:** Present one generic hint: resolve the listed error, then rerun the task packet.
- **SHOULD:** Keep the wording consistent across failure types.
- **Acceptance conditions:** Every retained failure view includes the hint; it does not imply that the product can repair, retry, or diagnose the failure automatically.

### F-04: Outcome-aware interaction and compatibility

- **User value:** Keeps terminal behavior predictable in every completion path.
- **Mapped goals/stories:** G-03, G-04; US-01, US-04, US-05.
- **MUST:** Treat terminal exit actions as dismissal after a failed final state, while preserving active-run cancellation behavior and non-UI completion.
- **SHOULD:** Make available dismissal actions visible in the final view.
- **Acceptance conditions:** A non-interactive command never waits for dismissal; terminal cleanup occurs after dismissal or normal completion; the original failure result remains non-zero.

## User Experience

During an active run, the existing cockpit experience remains unchanged. When the run fails, the operator enters a clear final failure review instead of returning immediately to the terminal.

The review leads with an unambiguous failure label and the failed task identity, then shows outcome counts, the complete surfaced error, and the generic recovery hint. Long or multiline error content must remain readable through an appropriate terminal-native reading flow rather than silently clipping it.

`Esc`, `q`, and Ctrl+C dismiss a settled failed review. Before the run settles, existing cancellation behavior remains available. Non-UI execution continues to print its failure information and exits non-zero without requiring input.

No new empty or loading surface is introduced. Accessibility expectations are keyboard-complete, do not use color as the only failure signal, use readable labels for failure and dismissal, and preserve a meaningful compact-terminal presentation.

## High-Level Constraints

- Enable the behavior by default for all interactive task runs in the next release once the MVP release gate is satisfied.
- Preserve the user-visible behavior of successful, cancelled, and `--no-ui` runs.
- Present the exact surfaced failure message, but do not add stack traces, raw ACP payloads, durable storage, exports, or telemetry.
- Do not introduce retry, remediation, permission, task-editing, or other workflow controls.
- Keep the task-run outcome authoritative; the feature improves observation and recovery guidance only.

## Non-Goals

- **Category-specific recovery guidance** — reconsider only if evidence shows the generic hint prevents timely recovery.
- **Automatic retry or remediation** — requires a separate control-plane and safety decision.
- **Persistent failure history, export, or analytics** — requires explicit retention and privacy requirements.
- **Retained successful-run screens** — successful exits are intentionally unchanged.
- **Fixing provider, model, or report failures themselves** — this feature makes them visible, not resolved.

## Phased Rollout Plan

### MVP

- Default-on interactive failure review.
- Failed task, complete surfaced error, final outcome, and generic recovery hint.
- Explicit dismissal after a failed terminal state.
- Entry criterion: approved PRD and downstream design.
- Exit criterion: all success-metric assertions pass and one manual terminal smoke check confirms readable review and restored terminal behavior.

### Later phases

- Category-aware recovery guidance only after qualitative evidence shows the generic hint is inadequate.
- Persistent history, export, and analytics only after a separate retention/privacy decision.
- Retry or remediation only after a separate workflow-control safety decision.

## Success Metrics

| ID | Metric | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| M-01 | Interactive failed-run visibility | Unknown | 100% of controlled failure scenarios remain visible until dismissal | Automated terminal-path evidence | Release gate and every verification run |
| M-02 | Final diagnostic fidelity | Unknown | 100% of short and multiline fixtures show task, error, and outcome before dismissal | Rendered final-state evidence | Release gate and every verification run |
| M-03 | Completion-path compatibility | Unknown | 100% of controlled success, failure, cancellation, and non-interactive paths follow their specified completion behavior | Automated command evidence plus manual terminal smoke check | Release gate |
| M-04 | Recovery-hint coverage | Unknown | 100% of retained failure views show the same generic rerun guidance | Final-state evidence | Release gate and every verification run |

## Risks and Mitigations

| Risk | Evidence | Likelihood/impact | Mitigation | Owner/decision trigger |
|---|---|---|---|---|
| A retained failure view surprises operators | Current failures exit immediately | Medium / Medium | Use explicit failure and dismissal labels; leave successful runs unchanged | Product; revisit if operator feedback identifies confusion |
| Error detail exposes more context than a compact summary | The exact surfaced error can include provider or workspace context | Medium / Medium | No persistence; exclude stacks and raw ACP payloads | Product; block release if review shows unbounded or misleading content |
| A default-on review delays non-interactive work | Current `--no-ui` is console-oriented | Low / High | Never wait for dismissal outside interactive failure review | Release owner; block release on any non-interactive wait |
| Generic hint is not enough for a recurring class of failure | No direct recovery-usability evidence exists | Medium / Low | Collect qualitative feedback; consider category guidance only with evidence | Product; later-phase decision |
| Terminal cleanup regressions affect trust | Terminal UI cleanup is explicit | Low / High | Require automated terminal-path evidence and manual smoke confirmation | Release owner; do not enable by default without both |

## Architecture Decision Records

- [ADR-001: Failure-Only Cockpit Diagnostics](adrs/adr-001-failure-only-cockpit-diagnostics.md) — establishes the retained failure-review boundary.
- [ADR-002: Default-On Failure Review With Generic Recovery Guidance](adrs/adr-002-default-on-failure-review.md) — selects the product approach, rollout, hint, and release bar.

## Research Limitations

- No direct Spec Finder adoption, failure-frequency, or recovery-usability data exists; all metric baselines are unknown.
- Comparable CI documentation establishes diagnostic conventions, not demand for this exact terminal workflow.
- No live provider failure was run during PRD discovery.
- The generic recovery hint is evidence-informed but has not yet been evaluated with operators.

## Open Questions

- Whether future operator feedback justifies category-aware guidance.
- Whether the generic hint needs localization or terminology changes after initial release.
- Which qualitative feedback channel should inform a later recovery-guidance decision.
