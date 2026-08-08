# ADR-002: Compact Fail-Safe Sequence Product Scope

## Status

Accepted

## Date

2026-08-05

## Context

The approved idea establishes an ordered, fail-fast multi-packet run for a solo local operator. The PRD still needs a product boundary for how sequence progress, stopped runs, already-completed packets, recovery guidance, and rollout are presented.

The selected product approach is a compact fail-safe sequence. It keeps the active packet's detailed cockpit view, retains a compact outcome for every declared packet, explains failure or cancellation and later `not_started` packets, and leaves retry execution and full historical transcript browsing to later phases.

## Decision Drivers

- Remove repeated manual commands without turning V1 into a scheduler or history browser.
- Preserve the primary solo operator's active-packet context.
- Make stopped sequences understandable without inventing automatic retry behavior.
- Keep already-completed packets transparent without expanding the outcome model unnecessarily.
- Support both cockpit and `--no-ui` users while preserving single-slug behavior.
- Release the opt-in command to local CLI users without a migration requirement.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | Existing cockpit supports active task detail and transcript inspection but has a singular run projection. | `src/ui/store.ts`, `src/ui/App.tsx` | 2026-08-05 |
| Repository | Existing CLI supports `--no-ui` output and single-slug execution; no multi-packet product surface exists. | `src/commands.ts`, `README.md` | 2026-08-05 |
| External | Comparable task tools expose multi-task invocation and explicit execution-control choices. | [Task CLI reference](https://taskfile.dev/docs/reference/cli), [Nx running tasks](https://nx.dev/docs/getting-started/tutorials/running-tasks) | 2026-08-05 |
| External | Comparable CLI workflow tooling exposes human-readable summaries, structured output, and non-zero failure status. | [GitHub CLI `gh run view`](https://cli.github.com/manual/gh_run_view), [GitHub CLI formatting](https://cli.github.com/manual/gh_help_formatting) | 2026-08-05 |
| User decision | The user selected compact per-packet summaries, manual recovery guidance, already-complete-as-succeeded detail, opt-in release, and a combined correctness/usability launch bar. | PRD clarification turns | 2026-08-05 |
| Inference | A compact summary is the smallest product surface that satisfies the verified workflow while preserving reversibility. | Research synthesis | 2026-08-05 |

## Decision

V1 will provide a compact fail-safe sequence experience:

- The operator supplies an ordered list of packet slugs.
- The product preflights the sequence, runs packets serially, and stops at the first failure or cancellation.
- The cockpit follows the active packet's detailed task/transcript view while retaining a compact outcome for each declared packet.
- A stopped sequence identifies the stopping packet, its failure or cancellation, every later `not_started` packet, and a concise instruction to rerun manually after resolution.
- A packet with all tasks already completed is reported as `succeeded` with an informational already-complete detail.
- The command is opt-in and available to local CLI users in the next release; existing single-slug behavior remains unchanged.

Full prior-packet transcript browsing, generated rerun commands, retries, continue-on-error, parallelism, and durable history are deferred.

## Alternatives Considered

### History-rich operator review

- **User value:** Stronger diagnosis through selectable prior transcripts and copyable rerun guidance.
- **Costs/risks:** Expands cockpit navigation and output retention before demand for multi-packet history is established.
- **Why not selected:** The verified problem is repeated invocation, not lack of historical transcript access; the existing cockpit already provides active task detail.

### Automation-first batch contract

- **User value:** Stronger script integration through stable status output and aggregate exit behavior.
- **Costs/risks:** Under-serves the primary interactive operator and could shift product attention toward an unverified secondary persona.
- **Why not selected:** Structured output and exit semantics remain part of V1, but they are not the primary product experience.

## Consequences

### Positive

- Operators can understand sequence progress and stopping points without leaving the current cockpit.
- Recovery guidance remains actionable without adding automatic retry policy.
- Already-complete packets remain transparent without introducing a separate skipped state.
- The opt-in rollout preserves compatibility and makes the feature easy to evaluate.

### Negative and trade-offs

- Compact summaries may not provide enough historical detail for complex diagnosis.
- Manual recovery still requires a new operator command after the underlying issue is resolved.
- The product does not optimize for parallel throughput or automation-first workflows.

### Risks and mitigations

- **Summary is too terse.** — Measure stopping-packet identification in the first-release usability check; promote history-rich review only if the target is missed.
- **Users interpret manual guidance as automatic retry.** — Use explicit copy that no retry was performed and later packets were not started.
- **Already-complete semantics surprise users.** — Include an informational detail in both cockpit and non-UI output.
- **Opt-in command remains undiscovered.** — Document the command in the CLI help and README without changing the single-run path.

## Reversibility

High. The compact summary can be extended with transcript browsing or copyable rerun guidance later. The sequence execution and aggregate result contract remain reusable across all approaches.

## Follow-ups

- Define concise summary language for success, failure, cancellation, not-started, and already-complete outcomes.
- Define the first-release usability check and evaluator task.
- Add CLI help and README examples for the opt-in command.
- Reassess history-rich review and automation-first enhancements after launch evidence.

## References

- [Ordered Multi-Packet Run idea packet](../_idea.md)
- [ADR-001: Ordered Multi-Packet Run Coordinator](adr-001-ordered-multiple-task-run.md)
