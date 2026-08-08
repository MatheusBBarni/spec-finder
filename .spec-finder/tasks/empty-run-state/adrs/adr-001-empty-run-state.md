# ADR-001: Show a persistent, explicit no-work outcome

## Status

Accepted

## Date

2026-08-08

## Context

When every task in a valid Spec Finder packet is already terminal, the execution planner produces no executable tasks. The engine reports this as `0 tasks completed`, and the command immediately destroys the cockpit. The individual operator cannot distinguish a successful no-work run from a failed or unstarted UI.

Issue #1 requires a normal-cockpit message with packet/task counts, manual `q`/Ctrl+C exit, truthful `--no-ui` output, no ACP provider launch, and focused tests. The user selected the quick-win direction rather than a general preflight diagnostics system.

## Decision Drivers

- Make a valid zero-executable run understandable to the local operator.
- Do not launch a provider when there is no executable task.
- Keep normal run behavior and the read-only interaction model intact.
- Avoid coupling UI lifecycle behavior to a human-readable status string.
- Keep V1 bounded to valid current zero-work outcomes.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | `executionOrder` excludes completed, done, and finished tasks; a packet with no task files remains an invalid input. | `src/tasks.ts:59-68`, `src/tasks.ts:111-126` | 2026-08-08 |
| Repository | The engine emits `0 tasks completed` after an empty execution loop, without entering either `runAcpTurn` call site. | `src/engine.ts:29-108` | 2026-08-08 |
| Repository | The command unconditionally closes the cockpit after `runTaskPacket`; `--no-ui` prints the free-text completion message. | `src/commands.ts:186-214` | 2026-08-08 |
| Repository | The current event/store/UI seams carry completion state, and cockpit tests already cover manual `q` and Ctrl+C exits. | `src/events.ts:5-12`, `src/ui/store.ts:81-128`, `src/ui/App.tsx:70-109`, `tests/cockpit.test.tsx:423-455` | 2026-08-08 |
| External | CLI guidance recommends explaining a resulting state to the user. | https://clig.dev/ | accessed 2026-08-08 |
| External | GitHub Actions documents skip explanations; GitLab exposes `skipped` as a named job status. | https://docs.github.com/en/actions/how-tos/troubleshoot-workflows; https://docs.gitlab.com/ci/jobs/ | accessed 2026-08-08 |
| User decision | Select the original/refined quick-win direction for valid zero-executable packets. | Idea-factory direction decision | 2026-08-08 |

## Decision

For every **valid** packet whose current execution plan contains zero executable tasks, Spec Finder will expose a bounded explicit no-work outcome. It will include packet/task counts and a truthful reason; when all loaded tasks are terminal, the user-facing reason will say that all tasks are already complete.

The cockpit will remain visible for this outcome until the operator exits with `q` or Ctrl+C. `--no-ui` will report the same condition truthfully. No ACP provider session will begin. The outcome signal must be explicit and backward-compatible, rather than inferred from the text `0 tasks completed`.

Packets rejected while loading or validating remain errors. V1 does not define a generalized preflight diagnostics taxonomy.

## Alternatives Considered

### Text-only all-complete special case

- **Benefits:** Smallest apparent code change.
- **Costs/risks:** Couples retention and CLI semantics to display text; does not represent every valid zero-executable plan clearly.
- **Why not selected:** The council found an explicit bounded outcome necessary for reliable command/UI behavior, while an additive signal stays small.

### General preflight diagnostics platform

- **Benefits:** Could standardize invalid, cancelled, filtered, and no-work explanations.
- **Costs/risks:** Expands beyond the reported operator confusion and the selected quick-win ambition.
- **Why not selected:** The user chose a focused V1; invalid packets are already errors and other causes are not evidenced in the current planner.

## Consequences

### Positive

- Operators can distinguish a completed packet from an unstarted or broken cockpit.
- The engine can prove no provider session was launched for a no-work run.
- The UI and terminal output share one truthful outcome instead of relying on ambiguous success text.

### Negative and trade-offs

- The event/result boundary gains a small optional outcome or reason field.
- The empty-run cockpit requires deliberate exit rather than automatic cleanup.

### Risks and mitigations

- Lifecycle regression for ordinary runs — branch only on the explicit no-work outcome and test normal completion separately.
- Misleading reason — derive the all-complete wording only from loaded task states; use a bounded generic no-executable reason otherwise.
- Provider accidentally starts — add a focused no-work test that proves no ACP invocation.

## Reversibility

The signal is additive and isolated to run completion. It can be removed or broadened later without changing task files or provider state; a future ADR can replace it with a larger diagnostics taxonomy if real causes justify that investment.

## Follow-ups

- Define the exact event/result representation in the TechSpec.
- Add engine, command, store, and OpenTUI frame/input coverage for all-terminal packets.
- Keep invalid empty packets as explicit errors unless a future approved packet changes that policy.

## References

- [Issue #1](https://github.com/MatheusBBarni/spec-finder/issues/1)
- [CLI Guidelines](https://clig.dev/)
- [GitHub Actions troubleshooting](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows)
- [GitLab CI/CD jobs](https://docs.gitlab.com/ci/jobs/)
