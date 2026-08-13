# ADR-001: Dedicated Loop Command as Continuous Packet Driver

## Status

Accepted

## Date

2026-08-13

## Context

`spec-finder run <slug>` is a single-pass packet executor. It walks pending tasks in dependency order, retries each phase once, recovers report-only handoffs and pending checkpoint delivery, then stops. Operators still restart after each remaining stall.

Issue #13 asks for a first-class `spec-finder loop <task_slug>` that closes that babysitting gap without turning Spec Finder into a CompozyOS daemon or a second source of truth.

The product decision is whether continuity belongs in a new command, inside `run`, or as a thin auto-rerun wrapper.

## Decision Drivers

- Close the babysitting gap for one packet without changing the shipped single-pass `run` contract.
- Serve the same solo local operator who already uses the cockpit or `--no-ui`.
- Keep packet files as truth; do not add a daemon, Loop DSL, or second ledger.
- Preserve fail-fast task semantics already trusted by `run` and `--multiple`.
- Make the choice reversible.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | `runTaskPacket` executes one dependency-safe pass, one phase retry, report/checkpoint recovery, then exits. | [`src/engine.ts`](../../../../../src/engine.ts) | 2026-08-13 |
| Repository | `--multiple` is serial, fail-fast, one attempt per packet, no resume or durable history. | [`src/batch.ts`](../../../../../src/batch.ts), [ordered-multiple-task-run PRD](../../../tasks_done/ordered-multiple-task-run/_prd.md) | 2026-08-13 |
| Repository | README and CLI expose `run`, `exec`, `checkpoint`, `setup`; there is no loop command. | [`README.md`](../../../../../README.md), [`src/cli.tsx`](../../../../../src/cli.tsx) | 2026-08-13 |
| Repository | One workspace run-lock owner at a time. | [`src/run-lock.ts`](../../../../../src/run-lock.ts) | 2026-08-13 |
| External | CompozyOS Loops are daemon-owned objects with honest terminals and failed-only re-attempt. | [Compozy README](https://github.com/compozy/compozy/blob/main/README.md), [LOOPS-DESIGN-SPEC.md](/Users/matheusbbarni/projects/compozy/docs/design/opendesign/_done/loops/LOOPS-DESIGN-SPEC.md) | 2026-08-13 |
| External | Compozy’s portable `cy-loop-tasks` skill is filesystem-true detect → act → memory → continue, without a daemon. | [cy-loop-tasks SKILL](/Users/matheusbbarni/projects/compozy/.agents/skills/cy-loop-tasks/SKILL.md) | 2026-08-13 |
| User decision | Primary need is drive-until-done for one packet; `run` stays a single pass; selected Approach A. | PRD clarification and approach selection | 2026-08-13 |

## Decision

Add a dedicated `spec-finder loop <task_slug>` command. `run` remains a single pass. `loop` is the continuous driver that detects remaining work, prefers recovery and failed-only resume, records inspectable packet-local evidence, and stops on a named terminal.

V1 does not introduce a daemon, YAML Loop catalog, SQLite run history, multi-packet loop, or generic node-graph language.

## Alternatives Considered

### Fold continuity into `run`

- **User value:** One familiar verb keeps going until a terminal.
- **Costs/risks:** Changes the stable single-pass contract that docs, batch, and operators already rely on; `--multiple` inherits ambiguity.
- **Why not selected:** Prior approved PRDs treat `run` as one pass with manual rerun. Reversibility would require a compatibility flag, which is itself a second mode.

### Thin auto-rerun wrapper

- **User value:** Smallest new surface; `loop` just reinvokes unchanged `run`.
- **Costs/risks:** Restart theater without structured recovery distinction, inspectable loop evidence, or honest `blocked` vs `stalled` vs `exhausted`.
- **Why not selected:** It does not close the verified babysitting gap; operators already rerun `run` themselves.

## Consequences

### Positive

- Operators can leave one packet unattended through recoveries without learning a new `run` meaning.
- Existing single-pass and batch contracts stay valid.
- The feature can be documented, discovered, and removed independently.

### Negative and trade-offs

- Operators must learn a second command.
- Two packet-execution verbs can be confused if help and README do not contrast them.
- Interactive `loop` may look thinner than `run` until cockpit meters trail.

### Risks and mitigations

- **Operators keep using `run` and miss the continuous path.** — Document `loop` vs `run` in help and README without changing default `run` behavior.
- **`loop` accidentally dual-owns lifecycle with `run` or a skill.** — Share the workspace run-lock and keep one lifecycle owner per invocation.
- **Scope creeps into Compozy Loop OS.** — Keep V1 a fixed packet driver, not an authorable graph.

## Reversibility

High. Leave `run` unchanged and stop advertising `loop`. Packet-local loop evidence can remain as historical files or be ignored by later commands.

## Follow-ups

- Record V1 scope, terminals, and rollout in ADR-002.
- Define exact CLI grammar, evidence layout, and exit mapping in the TechSpec.
- Revisit cockpit meters, a portable skill, QA/review, and continue-on-error only with new evidence.

## References

- [GitHub issue #13](https://github.com/MatheusBBarni/spec-finder/issues/13)
- [ADR-002: CLI-First Honest-Terminal Loop Scope](adr-002-cli-first-honest-terminal-loop-scope.md)
