# ADR-002: Verified Report Completion Rollout

## Status

Accepted

## Date

2026-08-08

## Context

The approved idea identifies a cockpit-only completion-view problem: report-session metadata can obscure the final outcome and disclose internal prompt paths. Current repository research corrected one product assumption: a final-report turn happens only after successful implementation; implementation failures retain their existing task-failure path.

The PRD needs an explicit customer-visible scope, safe fallback behavior, and release standard. The operator needs a reliable result from the report phase without turning every task failure into a new report workflow or exposing an unsafe artifact reference.

## Decision Drivers

- Issue #6 requires concise report activity, outcome, and recovery detail without raw report metadata.
- The primary user is the interactive cockpit operator; no-UI output does not consume ACP session updates.
- Completion must remain tied to Spec Finder's validated lifecycle rather than provider-generated metadata.
- A reference that cannot be safely rendered is less valuable than a trustworthy concise outcome.
- The selected scope should be independently verifiable before broad release.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | The report turn follows only a successful implementation stop; report validation precedes completion. | [`src/engine.ts`](../../../../src/engine.ts) | 2026-08-08 |
| Repository | No-UI output ignores ACP session updates, so the problem is specific to the interactive cockpit. | [`src/commands.ts`](../../../../src/commands.ts) | 2026-08-08 |
| External | ACP session-info is optional metadata, not a task-result message. | [ACP Session Info Update](https://agentclientprotocol.com/rfds/session-info-update) | 2026-08-08 |
| External | CLI guidance favors brief success output and human-readable, high-signal errors. | [Command Line Interface Guidelines](https://clig.dev/) | 2026-08-08 |
| User decision | Selected the verified report completion view, omission of unsafe references, and direct release after full automated acceptance. | PRD clarification and approach decisions | 2026-08-08 |

## Decision

Adopt the verified report completion view as the PRD's MVP:

- Apply the new experience only to final-report turns after successful implementation; retain the existing implementation-failure path.
- Make the report phase and final validated task outcome concise and clear for cockpit operators.
- Omit a report reference when it cannot be safely validated; do not replace it with an absolute path or a potentially misleading availability message.
- Release directly to cockpit users once the complete automated acceptance suite for the defined behavior passes. Do not add an opt-in preview or a live-provider release prerequisite.

## Alternatives Considered

### Minimal metadata redaction

- **User value:** Removes the most visible raw metadata with the smallest product change.
- **Costs/risks:** Leaves the completion view less actionable and does not establish a dedicated report lifecycle outcome.
- **Why not selected:** It does not fully satisfy the verified user need to identify report state and next action quickly.

### Uniform lifecycle outcomes

- **User value:** Gives implementation failures and report failures the same dedicated recovery presentation.
- **Costs/risks:** Expands current failure behavior and scope beyond the report-phase problem.
- **Why not selected:** Current evidence and issue #6 target the final-report path after successful implementation.

### Staged or live-provider-gated release

- **User value:** May expose provider variation before broad availability.
- **Costs/risks:** Delays a focused correction and adds preview/configuration or operational-release burden.
- **Why not selected:** Full automated acceptance is the selected proportionate release standard; no evidence requires a staged rollout.

## Consequences

### Positive

- Operators receive a clear, compact report completion signal without unsafe fallback disclosure.
- The PRD preserves today's implementation-failure expectation and no-UI boundary.
- The rollout has one objective, repeatable readiness gate.

### Negative and trade-offs

- An unavailable report reference produces no artifact shortcut.
- Live provider variation remains a post-release observation rather than a prerequisite.
- Broader unified failure experience is deferred.

### Risks and mitigations

- **Automated fixtures miss a provider-specific behavior** — preserve generic unknown fallback and review live-provider evidence if it appears after release.
- **Operator expects a report after implementation failure** — keep existing task-failure feedback explicit; reassess only with evidence of recurring confusion.
- **Unsafe reference could leak a path** — omit it unless validated by the product boundary.

## Reversibility

The customer-visible policy can be revised by expanding the outcome view to implementation failures, adding a staged rollout, or changing the safe-reference rule. No persistent user data or migration is involved.

## Follow-ups

- Define the PRD goals, stories, acceptance conditions, and metrics for the selected MVP.
- Treat live-provider observations as post-release learning, not a release gate.
- Reconsider implementation-failure unification only if operator research shows the existing failure path is insufficient.

## References

- [Approved idea](../_idea.md)
- [ADR-001: Phase-Aware Report Outcomes](adr-001-phase-aware-report-outcomes.md)
- [GitHub issue #6](https://github.com/MatheusBBarni/spec-finder/issues/6)
