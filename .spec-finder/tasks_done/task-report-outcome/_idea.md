# Task-Report Outcomes

## Overview

Issue #6 will make final-report completion readable in the ACP cockpit. The primary user is an operator monitoring an interactive Spec Finder run. V1 adds a small engine-owned report-phase signal, suppresses raw report-session metadata, and presents concise, validated outcomes and recovery details.

This is a focused quick win, not a broader lifecycle-platform investment.

## Problem

Every executed task enters a separate final-report ACP turn. A provider can expose that internal report instruction as `session_info_update` metadata; the current transcript fallback serializes it as JSON, including absolute workspace paths, immediately before the useful result. Operators must scan noisy protocol content to find whether the task completed or why it failed.

### Evidence

| Kind | Finding | Source | Date | Confidence |
|---|---|---|---|---|
| Repository | The engine starts a report turn, validates its output file, then emits completion; failure emits task failure plus a reason. | [`src/engine.ts`](../../../src/engine.ts) | 2026-08-08 | High |
| Repository | Unhandled session updates are rendered through a generic JSON fallback. | [`src/ui/transcript.ts`](../../../src/ui/transcript.ts) | 2026-08-08 | High |
| Repository | The cockpit already supports task-local activity, error, outcome, and unknown entries. | [`src/ui/store.ts`](../../../src/ui/store.ts) | 2026-08-08 | High |
| External | ACP defines `session_info_update` as optional session metadata, not task-result data. | [ACP Session Info Update](https://agentclientprotocol.com/rfds/session-info-update) | 2026-08-08 | High |
| External | Clear, timely status feedback helps users understand outcomes and next actions. | [Nielsen Norman Group](https://media.nngroup.com/media/articles/attachments/Heuristic_1_compressed.pdf) | 2026-08-08 | Medium |

## Target Users

| Persona | Context | Need | Current workaround |
|---|---|---|---|
| Spec Finder operator | Monitoring a task in the ACP cockpit | Identify report progress, outcome, and recovery action quickly | Read through raw session metadata to locate the short outcome line |
| Maintainer | Diagnosing a report-turn failure | Preserve a concise reason without exposing provider-controlled prompt metadata | Inspect transcript noise, then manually locate reports or logs |

## Core Features

| ID | Priority | Feature | Observable user value | Evidence |
|---|---|---|---|---|
| F-01 | Critical | Engine-owned implementation/report phase context | Report-only handling is reliable rather than inferred from titles | Separate report turn in engine |
| F-02 | Critical | Suppress or normalize report-phase `session_info_update` metadata | No raw report instructions or absolute paths dominate the transcript | Issue #6; transcript fallback |
| F-03 | Critical | Concise report-running activity and engine-authoritative completed/failed outcome | Operator can identify the lifecycle state immediately | Existing activity/outcome seams |
| F-04 | High | Validated workspace-relative report reference when available | Operator has a safe next action without path leakage | ADR-001 |
| F-05 | High | Preserve a bounded, control-safe fallback for genuinely unknown updates | Diagnostics remain available without treating all metadata as transcript content | Existing fallback contract |
| F-06 | High | Transcript, engine, and cockpit-frame regression coverage | Completion, failure, path-safety, and fallback behavior are objectively verified | Existing test seams |

## KPIs

| ID | KPI | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| KPI-01 | Report metadata leakage | Unknown | 0 raw report-phase title, prompt, or absolute-path payloads in recognized fixtures | Transcript and cockpit-frame assertions | Every verification run |
| KPI-02 | Report lifecycle clarity | Unknown | 100% of recognized report turns show one concise activity and a terminal outcome | Engine/store/transcript tests | Every verification run |
| KPI-03 | Outcome authority | Unknown | 100% of completion/failure fixtures match engine-owned validated status | Engine and cockpit tests | Every verification run |
| KPI-04 | Safe report references | Unknown | 100% of valid references are workspace-relative; 100% invalid/unavailable references are omitted | Path-validation tests | Every verification run |
| KPI-05 | Fallback compatibility | Unknown | 100% of unrelated unknown-update fixtures retain a safe generic fallback | Transcript regression tests | Every verification run |

## Feature Assessment

| Criterion | Score | Evidence-backed rationale |
|---|---|---|
| Impact | Strong | Removes a direct completion-view failure in every report turn. |
| Reach | Maybe | Applies to interactive cockpit users, not all no-UI consumers. |
| Frequency | Strong | Every executed task runs a final-report phase. |
| Differentiation | Maybe | Clear, trustworthy terminal lifecycle feedback is expected quality rather than a unique market moat. |
| Defensibility | Maybe | The engine-owned lifecycle seam is project-specific, but readily reproducible elsewhere. |
| Feasibility | Strong | Existing engine, transcript, store, and cockpit seams isolate the change. |

## Independent Critique

### Consensus

The pragmatic engineering, architecture, security/privacy, and product advisors agree that ACP session metadata must never determine task outcomes or expose raw report prompts. Completion and failure remain engine-authoritative; unknown ACP variants retain a safe fallback.

### Unresolved Tensions

| Tension | Position A | Position B | Decision consequence |
|---|---|---|---|
| Report-phase identification | Add a small engine-owned phase signal | Avoid new cross-layer context | Select the minimal phase signal because metadata otherwise cannot be safely distinguished from implementation-turn updates. |
| Report `blocked` semantics | Add a typed runtime state | Infer it from report prose | Defer it; report text must not override current engine completion semantics. |
| Safety scope | Raw suppression only | Add bounded, control-safe rendering and validated relative paths | Include narrow safety boundaries and adversarial tests; defer generalized sanitization infrastructure. |

### Position Evolution and Dissent

The product advisor initially preferred essence-first suppression, then partially conceded that a minimal phase signal is justified to stop known report-prompt leakage. The architecture and pragmatic advisors held that the engine already owns reliable turn context, making a two-value phase boundary proportionate. The security advisor held firm that provider titles, metadata, and report prose remain untrusted display input.

### Recommended Direction

Use the selected hybrid narrow V1: phase-aware report presentation, engine-authoritative outcome, safe relative report reference when available, and no inferred report-level `blocked` result.

## Opportunity Decision

| Direction | Outcome | Effort | Principal risk | Decision |
|---|---|---|---|---|
| Hybrid narrow V1 | Compact, trustworthy report lifecycle view | Small cross-layer seam plus focused tests | Incorrect phase attribution | Selected |
| Essence-first suppression | Removes some noise with current task outcome | Small | Cannot reliably isolate report metadata or offer safe actionability | Rejected |
| Full lifecycle framework | Typed metadata/outcomes across every ACP phase | Large | Scope expansion beyond issue #6 | Rejected |

The user selected the hybrid narrow V1 based on the verified prompt/path leak, existing report lifecycle, and council critique.

## Out of Scope (V1)

- **General ACP lifecycle metadata framework** — reconsider only if multiple phases need typed presentation contracts.
- **Provider metadata or report-prose verdict parsing** — unsafe and conflicts with engine-owned status.
- **Explicit report-level `blocked` outcome** — reconsider only when the engine has a typed authoritative state.
- **ACP protocol/schema changes** — the client-side phase seam is sufficient.
- **Persistent transcript history, telemetry, or broader cockpit redesign** — unrelated to the completion-view problem.

## Architecture Decision Records

- [ADR-001: Phase-Aware Report Outcomes](adrs/adr-001-phase-aware-report-outcomes.md) — selected scope, authority, safety, and deferrals.

## Research Limitations

- No quantitative user-demand, pricing, or adoption evidence exists for this narrow cockpit refinement.
- The supplied screenshot is not stored in the repository; the issue description and controlled reproduction establish the leak path.
- Exact phase-carrier and path-validation mechanics remain TechSpec decisions.

## Open Questions

- What exact internal phase carrier best preserves existing event compatibility?
- What concise copy should represent report-running activity and valid report references?
- If report-level blocking becomes necessary later, what engine-owned result contract should represent it?
