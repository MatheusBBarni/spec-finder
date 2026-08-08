# ADR-002: Ship no-work feedback as a default informative success

## Status

Accepted

## Date

2026-08-08

## Context

The approved no-work outcome needs a product approach that works for both the interactive cockpit and `--no-ui` users. The primary user is an individual operator who needs confidence that a completed packet has no remaining work. The packet must remain read-only and the quick-win scope must not grow into a configurable diagnostics product.

The user selected a default informative approach: make eligible no-work feedback available immediately, treat it as successful command completion, and offer no new acknowledgement or workflow controls.

## Decision Drivers

- Resolve the reported ambiguity for every eligible operator, not an opt-in subset.
- Preserve the product meaning of no remaining work as an expected outcome, not a failure.
- Keep the cockpit informational and read-only.
- Avoid configuration and automation-contract expansion unsupported by current evidence.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| User decision | Roll out the eligible no-work state by default. | PRD clarification | 2026-08-08 |
| User decision | A valid no-work run succeeds; scripts use its reported reason rather than a nonzero exit result. | PRD clarification | 2026-08-08 |
| User decision | The cockpit remains information-only with its existing read-only navigation and exit behavior. | PRD clarification | 2026-08-08 |
| Repository | The cockpit is already read-only and treats `q`/Ctrl+C as its terminal exits. | `src/ui/App.tsx:70-109`, `src/ui/App.tsx:477-480` | 2026-08-08 |
| External | GitHub displays a skipped-job message while treating the skipped job as successful. | https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions | accessed 2026-08-08 |
| External | GitLab represents `skipped` as a recognized job status caused by conditions or dependencies. | https://docs.gitlab.com/ci/jobs/ | accessed 2026-08-08 |

## Decision

For every valid run covered by ADR-001, the informative no-work state ships as the default experience. The cockpit shows the reason and packet/task counts in its normal read-only layout and stays available for existing navigation and `q`/Ctrl+C exit. It adds no acknowledgement, retry, or workflow-control action.

The equivalent `--no-ui` run reports the no-work reason and returns successful completion. V1 provides no configuration setting, preview flag, distinct nonzero no-work result, or dedicated automation-mode output.

## Alternatives Considered

### Opt-in preview setting

- **User value:** Operators could choose when to adopt the changed presentation.
- **Costs/risks:** Leaves the confusing default in place and adds an unsupported configuration policy.
- **Why not selected:** The user chose a direct corrective rollout for a current misleading behavior.

### Automation-distinguishable no-work mode

- **User value:** Scripts could branch on a separate no-work result.
- **Costs/risks:** Broadens V1's output contract and can make a valid run appear failed to existing callers.
- **Why not selected:** The selected product behavior is successful completion with a truthful explanatory result.

### Guided acknowledgement experience

- **User value:** New operators would receive a prominent next-step prompt.
- **Costs/risks:** Adds controls and copy beyond the verified need, conflicting with the read-only cockpit model.
- **Why not selected:** The user selected an information-only experience.

## Consequences

### Positive

- Every eligible operator receives an immediate, understandable result.
- Existing automation continues to see success for a valid no-work run.
- The cockpit remains focused on observation rather than workflow control.

### Negative and trade-offs

- Scripts needing a special branch must inspect reported output rather than exit status alone.
- There is no preview or feature toggle for operators who prefer the old behavior.
- New users receive no additional next-step coaching.

### Risks and mitigations

- Operators may overlook how to exit the persistent state — retain the existing visible `q`/Ctrl+C affordance and verify it in acceptance review.
- Automation demand for machine-distinguishable no-work may emerge — reconsider only with user feedback or a concrete integration requirement.
- A generic message may be mistaken for task failure — ensure the user-facing result explicitly communicates that no work remains and the command succeeded.

## Reversibility

The default presentation can later gain a documented option or a separate automation result without changing the underlying product meaning of a valid no-work run. Evidence of integration breakage or repeated operator demand would trigger that reconsideration.

## Follow-ups

- Define product acceptance conditions for default rollout, successful completion, and information-only interaction in the PRD.
- Defer output format details and internal representation to the TechSpec.
- Capture post-release feedback before considering a dedicated automation signal or guided next-step surface.

## References

- [Approved idea](../_idea.md)
- [ADR-001: Show a persistent, explicit no-work outcome](adr-001-empty-run-state.md)
- [GitHub Actions job conditions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions)
- [GitLab CI/CD jobs](https://docs.gitlab.com/ci/jobs/)
