# Task-Report Outcomes Product Requirements Document

## Overview

Issue #6 will make the ACP cockpit’s final-report experience concise, trustworthy, and actionable for interactive Spec Finder operators.

The MVP applies only after a task’s implementation phase succeeds and the final-report phase begins. It replaces raw report-session metadata with clear progress, a validated completed or failed outcome, and a safe report reference only when one is available. It preserves the existing implementation-failure and no-UI experiences.

## Research Evidence

| Kind | Finding | Source | Date | Product consequence |
|---|---|---|---|---|
| Repository | A report turn begins only after successful implementation; a validated report is required before task completion. | [`src/engine.ts`](../../../src/engine.ts) | 2026-08-08 | Scope the new experience to report turns after successful implementation. |
| Repository | Current session-info metadata falls through to generic transcript serialization. | [`src/ui/transcript.ts`](../../../src/ui/transcript.ts) | 2026-08-08 | Prevent raw report metadata from becoming completion content. |
| Repository | The cockpit already presents task activity, errors, and outcomes; no-UI output ignores ACP session updates. | [`src/ui/store.ts`](../../../src/ui/store.ts), [`src/commands.ts`](../../../src/commands.ts) | 2026-08-08 | Keep MVP cockpit-only and preserve no-UI behavior. |
| External | ACP session-info is optional agent metadata, not a task-result message. | [ACP Session Info Update](https://agentclientprotocol.com/rfds/session-info-update) | 2026-08-08 | Treat provider metadata as untrusted presentation input, never as outcome authority. |
| External | CLI guidance favors brief successful output and high-signal, human-readable errors. | [CLI Guidelines](https://clig.dev/) | 2026-08-08 | Use concise, actionable completion and failure copy. |
| External | Comparable coding-agent workflows let users monitor progress and inspect completion results. | [GitHub Copilot agents](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents) | 2026-08-08 | Preserve visible progress and a clear terminal outcome. |
| Inference | Text-labelled status benefits reduced-color terminal use; WCAG status-message guidance supports clear, programmatically distinguishable state changes, though it is web-focused. | [W3C status-message guidance](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p10-status-feedback/) | 2026-08-08 | Do not rely on color or symbols alone to convey report state. |

## Goals

| ID | Goal | Measurable outcome |
|---|---|---|
| G-01 | Make report completion immediately understandable | Every covered report scenario presents concise progress and a terminal outcome. |
| G-02 | Prevent internal metadata from obscuring or leaking through the completion view | No recognized report scenario displays raw report prompts, metadata, or absolute paths. |
| G-03 | Make report failures recoverable | Every covered report failure presents a concise reason; a safe report reference appears only when validated. |
| G-04 | Preserve established workflow boundaries | Implementation failures and no-UI behavior remain unchanged. |

## User Stories

| ID | Persona | Story | Acceptance signal |
|---|---|---|---|
| US-01 | Cockpit operator | As an operator watching a completed implementation, I want to see that the final report is running and then know whether the task completed, so I can continue monitoring confidently. | A concise lifecycle message is followed by a clearly labelled outcome. |
| US-02 | Cockpit operator | As an operator whose report phase fails, I want a concise reason, so I know what requires attention without reading protocol metadata. | A failure outcome states a useful reason and never claims completion. |
| US-03 | Cockpit operator | As an operator with a safely available report, I want a relative reference to it, so I can inspect the artifact without exposing workspace details. | A safe reference is shown only when available; otherwise the outcome remains clear without one. |
| US-04 | Maintainer | As a maintainer, I want unrelated ACP updates to remain diagnosable, so the focused report fix does not hide legitimate unknown activity. | Unrelated unknown updates retain a bounded, readable fallback. |
| US-05 | Existing user | As a user whose implementation fails before reporting, I want the familiar task-failure behavior, so the new report view does not change a different workflow. | Implementation failure uses the current task-failure path. |

## Core Features

### F-01: Concise report lifecycle

- **User value:** Operators can understand that final reporting has started and recognize its terminal result at a glance.
- **Mapped goals/stories:** G-01, G-04; US-01, US-05.
- **MUST:** Show one concise report-running activity for a report phase after successful implementation.
- **MUST:** Show a clearly labelled completed outcome only after Spec Finder accepts the report.
- **MUST:** Show a clearly labelled failed outcome when the report phase cannot finish.
- **Acceptance conditions:** Raw report-session metadata never displaces the report activity or terminal outcome.

### F-02: Trustworthy outcome and recovery message

- **User value:** Operators can distinguish completion from failure and understand the immediate recovery context.
- **Mapped goals/stories:** G-01, G-03; US-01, US-02.
- **MUST:** Derive report completion and failure from Spec Finder’s validated lifecycle, not provider titles, extensions, stop text alone, or report prose.
- **MUST:** Present report failure reasons in concise plain language.
- **SHOULD:** Keep the most important outcome and recovery information visually prominent in the completion view.
- **Acceptance conditions:** A provider-supplied metadata value cannot cause a false completed, failed, or blocked outcome.

### F-03: Safe report reference

- **User value:** Operators can inspect a report directly when a safe reference exists.
- **Mapped goals/stories:** G-03; US-03.
- **MUST:** Show only a validated workspace-relative report reference.
- **MUST:** Omit the reference when validation is unavailable or unsafe.
- **MUST NOT:** Show an absolute workspace path, report prompt, or generic “reference unavailable” message.
- **Acceptance conditions:** A safe reference is actionable; an unavailable reference does not make the outcome ambiguous.

### F-04: Compatible unknown-update handling

- **User value:** Maintainers retain diagnostic context without raw payload noise or disclosure.
- **Mapped goals/stories:** G-02, G-04; US-04.
- **MUST:** Preserve a readable, bounded, control-safe fallback for unrelated unknown ACP updates.
- **MUST:** Treat report-phase session metadata as lifecycle metadata rather than transcript content.
- **Acceptance conditions:** Report metadata is suppressed or normalized; unrelated unknown activity remains visibly distinguishable.

### F-05: Readable status semantics

- **User value:** Operators can understand report state across terminal appearances and interaction modes.
- **Mapped goals/stories:** G-01, G-03; US-01, US-02.
- **MUST:** Pair report status symbols or color with text labels.
- **MUST:** Keep completion and failure messages concise and unambiguous.
- **Acceptance conditions:** An operator can distinguish report running, completed, and failed states without relying only on color.

## User Experience

A successful implementation reaches final reporting and the selected cockpit transcript shows a short report-running message. Provider metadata is not shown as report content. When reporting completes, the operator sees an explicit completed outcome and, when safe, a relative report reference.

If final reporting fails, the operator sees an explicit failed outcome with a concise reason. If no safe report reference exists, the outcome remains complete without an artifact shortcut. If implementation fails before reporting begins, the existing task-failure experience remains unchanged.

The experience is read-only: it introduces no retry, permission, workflow-mutation, or control surface. Labels communicate state independently of color, and fallback content remains bounded and safe to display.

## High-Level Constraints

- The MVP is limited to the interactive cockpit; no-UI output remains unchanged.
- It applies only to final-report phases after successful implementation.
- Provider session metadata and report prose are never outcome authority.
- Workspace details, raw prompts, and unsafe paths must not appear in the completion view.
- Unsafe or unavailable report references are omitted.
- Release requires the complete automated acceptance suite; no preview flag or live-provider prerequisite is required.

## Non-Goals

- **A general lifecycle-metadata framework for all ACP phases** — reconsider only when multiple independently verified phases need typed presentation.
- **A unified implementation-failure and report-failure workflow** — reconsider if operator research shows the current implementation-failure experience is insufficient.
- **Report-level `blocked` state inferred from report prose** — reconsider only when Spec Finder owns an authoritative blocked result.
- **ACP protocol changes, provider configuration changes, or new no-UI behavior** — outside the cockpit-only product boundary.
- **Persistent transcript history, telemetry, or broader cockpit redesign** — unrelated to the observed completion-view problem.

## Phased Rollout Plan

### MVP

- Deliver F-01 through F-05 to all cockpit users.
- Entry criteria: approved PRD and technical specification.
- Exit criteria: the complete automated acceptance suite verifies concise report lifecycle, outcome authority, safe-reference behavior, metadata absence, readable fallback, and preserved existing boundaries.

### Later phases

- Observe live-provider behavior after release; promote it to a release gate only if evidence shows meaningful provider-specific variance.
- Consider a broader lifecycle model only if another ACP phase has a verified, distinct presentation need.
- Consider report-level blocked outcomes only with an engine-owned status contract.
- Consider unified implementation/report failure presentation only with evidence that current implementation-failure feedback is inadequate.

## Success Metrics

| ID | Metric | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| M-01 | Raw report-metadata exposure in recognized scenarios | Unknown | 0 exposures | Controlled cockpit acceptance scenarios | Every release candidate |
| M-02 | Clear report lifecycle coverage | Unknown | 100% of recognized report scenarios show concise activity and terminal outcome | Controlled cockpit acceptance scenarios | Every release candidate |
| M-03 | Outcome authority correctness | Unknown | 100% of completion/failure scenarios match the validated Spec Finder lifecycle | Lifecycle acceptance scenarios | Every release candidate |
| M-04 | Safe report-reference behavior | Unknown | 100% valid references are relative; 100% unsafe/unavailable references are omitted | Safe-reference acceptance scenarios | Every release candidate |
| M-05 | Status readability | Unknown | 100% of status scenarios retain text-labelled running, completed, or failed meaning | Terminal presentation acceptance scenarios | Every release candidate |

## Risks and Mitigations

| Risk | Evidence | Likelihood/impact | Mitigation | Owner/decision trigger |
|---|---|---|---|---|
| Provider metadata reveals internal prompt or path content | Current generic fallback serializes unhandled metadata | Medium / High | Never use report metadata as transcript content or outcome authority | Product scope; reconsider only if a safe new metadata use case is verified |
| Automated scenarios miss live-provider variation | No live-provider release prerequisite selected | Medium / Medium | Preserve safe fallback and observe post-release behavior | Product owner; promote live validation only with recurring variance |
| Operator lacks a direct report shortcut | Unsafe references are intentionally omitted | Medium / Low | Keep terminal outcome and recovery reason clear | Product owner; reconsider if operators cannot recover without it |
| Users expect a report after implementation failure | Report phase currently follows successful implementation only | Low / Medium | Retain and clearly label existing task-failure feedback | Product owner; reconsider with operator evidence |
| Status meaning is lost in reduced-color terminals | Terminal appearance varies | Low / Medium | Pair visual treatment with explicit text labels | Product owner; block release if labels are ambiguous |

## Architecture Decision Records

- [ADR-001: Phase-Aware Report Outcomes](adrs/adr-001-phase-aware-report-outcomes.md) — engine-authoritative report phase, safe references, and deferred blocked semantics.
- [ADR-002: Verified Report Completion Rollout](adrs/adr-002-verified-report-completion-rollout.md) — product scope, fallback, and direct automated-gate rollout.

## Research Limitations

- There is no quantitative user-demand, pricing, or willingness-to-pay evidence for this narrow cockpit refinement.
- Accessibility sources are web-focused; applying their status-feedback principles to the terminal is an informed product inference.
- The issue screenshot is not retained in the repository; the issue narrative and controlled reproduction establish the current leak path.
- Live provider behavior is intentionally post-release learning rather than an MVP release requirement.

## Open Questions

- What exact user-facing copy best conveys report running and a safe report reference?
- Which post-release observation would justify making live-provider validation a release gate?
- What future engine-owned outcome, if any, should represent report-level blocking?
