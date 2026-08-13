# ADR-002: CLI-First Honest-Terminal Loop Scope

## Status

Accepted

## Date

2026-08-13

## Context

ADR-001 selects a dedicated `loop` command. This record bounds V1: who it serves, when it stops, what evidence the operator gets, what is deferred, and how success is judged.

The verified need is unattended continuity for one packet. Compozy’s skill-level loop treats QA and peer review as part of done. Spec Finder’s shipped `run` treats “all tasks completed with reports” as done. Copying the larger definition would expand V1 past the babysitting gap.

## Decision Drivers

- Serve the solo local operator already using `run`.
- Stop only on a real terminal; keep recoveries inside the loop.
- Preserve fail-fast task semantics; Spec Finder packets are usually a dependency chain.
- Ship the smallest inspectable continuous driver; cockpit meters and a portable skill can trail.
- Judge launch by acceptance scenarios, not telemetry.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | Valid all-complete packets are an explicit successful no-work result, not a failure. | [empty-run-state PRD](../../../tasks_done/empty-run-state/_prd.md), [`src/engine.ts`](../../../../../src/engine.ts) | 2026-08-13 |
| Repository | Report-handoff and checkpoint-blocked recovery already exist and require a later rerun to continue the packet. | [`src/engine.ts`](../../../../../src/engine.ts), [checkpoint PRD](../../../tasks_done/config-driven-task-checkpoints/_prd.md) | 2026-08-13 |
| Repository | Interactive failure review tells the operator to resolve the error and rerun; it does not self-heal. | [visible-task-run-errors PRD](../../../tasks_done/visible-task-run-errors/_prd.md) | 2026-08-13 |
| External | Honest terminals `done`, `no_op`, `blocked`, `failed`, `exhausted`, `stalled` are established Compozy Loop vocabulary. | [LOOPS-DESIGN-SPEC.md](/Users/matheusbbarni/projects/compozy/docs/design/opendesign/_done/loops/LOOPS-DESIGN-SPEC.md) | 2026-08-13 |
| External | `cy-loop-tasks` reserves `blocked` for proven external inputs after every safe alternative fails. | [recovery-loop.md](/Users/matheusbbarni/projects/compozy/.agents/skills/cy-loop-tasks/references/recovery-loop.md) | 2026-08-13 |
| External | CLI convention maps zero to success and non-zero to important failure modes; interruption should resume cleanly on the next run. | [clig.dev](https://clig.dev/) | 2026-08-13 |
| External | GitHub Actions names skipped work and still reports success. | [GitHub Actions job conditions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions) | 2026-08-13 |
| User decision | Solo local operator; honest fail-fast terminals; CLI-first V1; acceptance-first success bar. | PRD clarification | 2026-08-13 |

## Decision

V1 `loop` is a CLI-first continuous driver for one packet:

- Keep iterating through recoveries and remaining eligible work until a named terminal: `done`, `no_op`, `blocked`, `failed`, `exhausted`, `stalled`, or cancelled.
- Fail-fast on the first unrecoverable task failure, like `run`.
- Treat proven external blockers as `blocked`, not as ordinary failure.
- Persist inspectable packet-local loop evidence so a killed process can resume without redoing completed work.
- Offer a no-write dry-run that prints the detected plan.
- Keep `run` and `--multiple` unchanged.
- Judge launch by defined acceptance scenarios, including one unattended recovery path.

Deferred from V1: cockpit iteration meters, portable `sf-loop-tasks` skill, QA/review/ship phases, continue-on-error, multi-packet loop, daemon/control plane, and telemetry.

## Alternatives Considered

### Cockpit-visible from day one

- **User value:** Interactive loop would not feel like a silent black box.
- **Costs/risks:** Cockpit work can delay the first useful continuous command.
- **Why not selected:** The verified gap is unattended continuity. Existing cockpit task detail can remain; dedicated loop meters can trail.

### Full operator surface in one V1

- **User value:** Drive, meters, dry-run, reset, inspect, and a portable skill arrive together.
- **Costs/risks:** Largest release and highest delay risk before the continuity hypothesis is proven.
- **Why not selected:** YAGNI. The smallest credible product is the driver plus inspectable evidence.

### Continue past independent task failures

- **User value:** More work may finish in one invocation.
- **Costs/risks:** Spec Finder packets are usually a dependency DAG, not independent lanes; diagnosis gets noisier.
- **Why not selected:** No evidence of independent-lane demand; fail-fast remains the trusted contract.

## Consequences

### Positive

- Operators get a truthful stop reason instead of generic `ok`/`failed`.
- Resume after process death and recovery of handoffs/checkpoints do not require a babysitter.
- `run` users are unaffected.
- Later cockpit or skill work can read the same packet-local evidence.

### Negative and trade-offs

- An interactive loop may initially reuse `run`-grade cockpit detail without loop-specific meters.
- Fail-fast still requires operator intervention after a real task failure.
- Acceptance scenarios prove correctness more strongly than real-world time saved.

### Risks and mitigations

- **`no_op` is mistaken for failure.** — Keep successful already-complete language consistent with the empty-run-state contract.
- **`blocked` and `failed` collapse in operator language.** — Use distinct copy: external/policy stop vs unrecoverable task failure.
- **Caps create surprise stops.** — Name `exhausted` and `stalled` with readable reasons and the next operator action.
- **Interactive loop feels silent.** — `--no-ui` must print iteration/outcome; promote cockpit meters if operators cannot tell what the loop is doing.

## Reversibility

High. Caps, evidence files, and terminal names can be extended. Fail-fast can later grow an explicit continue-on-error flag if independent-lane evidence appears. Cockpit meters and a skill can consume the same ledger.

## Follow-ups

- Define terminal-to-exit mapping, dry-run mutation rule, and resume contract in the TechSpec.
- Add acceptance scenarios for every named terminal plus resume-after-kill.
- Revisit cockpit meters if interactive operators cannot identify iteration and current action.
- Revisit a 30-day unattended diary only if acceptance passes but operators still report babysitting.

## References

- [GitHub issue #13](https://github.com/MatheusBBarni/spec-finder/issues/13)
- [ADR-001: Dedicated Loop Command as Continuous Packet Driver](adr-001-dedicated-loop-command.md)
