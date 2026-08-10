# ADR-002: Default-On Failure Review With Generic Recovery Guidance

## Status

Accepted

## Date

2026-08-08

## Context

The approved idea selected a failure-only final cockpit state, but the PRD still needed decisions about the product approach, rollout, recovery guidance, and release evidence. The active-run operator needs a truthful, immediate next step without a second diagnostic or workflow-control product.

The existing cockpit already displays a failure summary and supports keyboard exit actions, while non-UI mode prints task activity and final run outcome. The user selected a generic recovery hint, default-on rollout in the next release, and automated terminal-path coverage plus one manual terminal smoke check as the release bar.

## Decision Drivers

- Resolve the failure-visibility gap for every interactive operator without an opt-in delay.
- Keep recovery guidance correct for all surfaced errors.
- Preserve current successful-run and non-UI workflows.
- Make default enablement contingent on observable terminal behavior.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | The command currently closes the interactive cockpit in `finally`, while non-UI mode writes activity, status, and final outcomes to the terminal. | [`src/commands.ts`](../../../../src/commands.ts) | 2026-08-08 |
| Repository | The existing summary presents failed task identifiers and reasons, and existing keyboard messaging distinguishes terminal exit actions. | [`src/ui/App.tsx`](../../../../src/ui/App.tsx) | 2026-08-08 |
| Repository | Existing tests render failed summaries but do not prove command/PTY persistence before renderer cleanup. | [`tests/cockpit.test.tsx`](../../../../tests/cockpit.test.tsx), [`tests/commands.test.ts`](../../../../tests/commands.test.ts) | 2026-08-08 |
| External | Comparable CI products retain failed-run logs for diagnosis rather than discarding them with run completion. | [GitHub Actions workflow logs](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs), [GitLab CI job logs](https://docs.gitlab.com/ci/jobs/job_logs/) | Accessed 2026-08-08 |
| User decision | Select default-on failure review, one generic rerun hint, and automated terminal-path coverage plus one manual smoke check before release. | PRD clarification and approach selection | 2026-08-08 |

## Decision

Ship the failure-review experience enabled by default for all interactive Spec Finder task runs in the next release once its release evidence is met.

The MVP includes the complete surfaced error, failed task identity, final outcome, and exactly one generic recovery hint: resolve the listed error, then rerun the task packet. It does not add category-specific guidance, retries, persistence, or changes to successful or non-UI flows.

Default rollout requires automated evidence for failed, successful, cancellation, non-UI, and cleanup paths plus one manual terminal smoke check confirming readable failure review and terminal restoration.

## Alternatives Considered

### Visibility-only hold

- **User value:** Preserves the existing failure summary longer with the smallest product change.
- **Costs/risks:** The present summary does not guarantee that the complete surfaced error is readable before dismissal.
- **Why not selected:** It falls short of the approved operator outcome.

### Default-on category-aware recovery

- **User value:** Could offer more tailored next steps for known failure types.
- **Costs/risks:** Incorrect categorization or stale guidance can send an operator in the wrong direction, and guidance maintenance expands the MVP.
- **Why not selected:** A generic rerun hint is correct for every failure and is sufficient for the verified problem.

## Consequences

### Positive

- Every interactive operator receives the same immediate failure-review capability.
- Recovery copy remains truthful and easy to understand.
- The MVP has a clear default-release gate without adding a beta, opt-in policy, or telemetry program.

### Negative and trade-offs

- Users cannot opt out of the failed-run review in the first release.
- The generic hint gives up faster category-specific remediation.
- The release requires a manual terminal check in addition to automated evidence.

### Risks and mitigations

- **Default-on exit behavior surprises an operator** — make the failed final state and dismissal keys clear; successful runs remain unchanged.
- **Generic guidance is too weak for recurring cases** — collect qualitative operator feedback and consider category guidance only with evidence.
- **Terminal cleanup regresses** — block the default release on required automated and manual evidence.

## Reversibility

The behavior can be returned to immediate failed-run exit without migrating task data, configuration, or history. Category-specific guidance can be added later without invalidating the generic copy.

## Follow-ups

- Define the user-visible MVP acceptance conditions and metrics in the PRD.
- Reconsider category-aware recovery only after evidence that the generic hint prevents timely recovery.

## References

- [ADR-001: Failure-Only Cockpit Diagnostics](adr-001-failure-only-cockpit-diagnostics.md)
- [Approved idea](../_idea.md)
- [Issue #5](https://github.com/MatheusBBarni/spec-finder/issues/5)
