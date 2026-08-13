# Continuous Packet Loop Driver Product Requirements Document

## Overview

Solo local Spec Finder operators still babysit a packet: they start `run`, wait for a recoverable stall, diagnose, and restart. `run` already does one dependency-safe pass, one phase retry, and report/checkpoint resume, then stops. This MVP adds `spec-finder loop <task_slug>` as a dedicated continuous driver for **one packet**. It keeps iterating through recoveries and remaining eligible work until a named terminal, leaves inspectable packet-local evidence, supports dry-run and resume after process death, and leaves `run` unchanged.

The selected approach is a **CLI-first dedicated loop command**. Cockpit iteration meters, a portable loop skill, QA/review/ship, continue-on-error, and multi-packet loop are out of V1.

## Research Evidence

| Kind | Finding | Source | Date | Product consequence |
|---|---|---|---|---|
| Repository | `run` is a single pass with one phase retry, report-handoff resume, checkpoint recovery, and fail-fast stop. | [`src/engine.ts`](../../../src/engine.ts), [`README.md`](../../../README.md) | 2026-08-13 | Continuity is a new command, not a silent `run` change. |
| Repository | Valid all-complete packets already have an explicit successful no-work result. | [empty-run-state PRD](../../tasks_done/empty-run-state/_prd.md) | 2026-08-13 | Loop `no_op` must stay a successful “nothing to do,” not a failure. |
| Repository | `--multiple` is serial, fail-fast, no resume or durable history. | [`src/batch.ts`](../../../src/batch.ts), [ordered-multiple-task-run PRD](../../tasks_done/ordered-multiple-task-run/_prd.md) | 2026-08-13 | Multi-packet loop is a later product, not V1. |
| Repository | Report-handoff and checkpoint-blocked delivery already exist and require a later rerun to continue the packet. | [`src/engine.ts`](../../../src/engine.ts), [checkpoint PRD](../../tasks_done/config-driven-task-checkpoints/_prd.md) | 2026-08-13 | Loop value is continuing through those recoveries without a babysitter. |
| Repository | Interactive failure review tells the operator to resolve and rerun. | [visible-task-run-errors PRD](../../tasks_done/visible-task-run-errors/_prd.md) | 2026-08-13 | Loop must not pretend it repaired an unrecoverable task failure. |
| Repository | One workspace run-lock owner at a time; no loop command exists. | [`src/run-lock.ts`](../../../src/run-lock.ts), [`src/cli.tsx`](../../../src/cli.tsx) | 2026-08-13 | Loop shares exclusivity with `run`; it does not add a second owner. |
| External | CompozyOS Loops are daemon-owned objects with honest terminals and failed-only re-attempt. v0.3 is beta. | [Compozy README](https://github.com/compozy/compozy/blob/main/README.md), [LOOPS-DESIGN-SPEC.md](/Users/matheusbbarni/projects/compozy/docs/design/opendesign/_done/loops/LOOPS-DESIGN-SPEC.md) | 2026-08-13 | Steal terminals and failed-only ideas, not the Loop OS. |
| External | `cy-loop-tasks` is filesystem-true detect → act → continue; `blocked` is only a proven external input. | [cy-loop-tasks SKILL](/Users/matheusbbarni/projects/compozy/.agents/skills/cy-loop-tasks/SKILL.md), [recovery-loop.md](/Users/matheusbbarni/projects/compozy/.agents/skills/cy-loop-tasks/references/recovery-loop.md) | 2026-08-13 | V1 follows this portable loop practice, not QA/review-as-done. |
| External | CLI convention: zero on success, mapped non-zero modes, resume-friendly interruption. | [clig.dev](https://clig.dev/) | 2026-08-13 | Named terminals and exit mapping are operator-facing, not implementation trivia. |
| External | GitHub Actions names skipped work and still reports success. | [GitHub Actions job conditions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions) | 2026-08-13 | `no_op` should read as successful nothing-to-do. |
| External | Claude Code and Codex resume conversations, not packet contracts. | [Claude Code programmatic usage](https://code.claude.com/docs/en/headless), [Codex CLI](https://developers.openai.com/codex/cli) | 2026-08-13 | Packet-local loop evidence is the Spec Finder differentiator. |
| Inference | The pain is restart labor after recoverable stalls, not missing a DAG editor. | Research synthesis | 2026-08-13 | V1 is a driver, not an authoring surface. |
| User decision | Drive-until-done for one packet; solo local operator; honest fail-fast terminals; CLI-first; acceptance-first success; Approach A. | PRD clarification and approach selection | 2026-08-13 | These bound MVP. |

## Goals

| ID | Goal | Measurable outcome |
|---|---|---|
| G-01 | Close the babysitting gap for one packet | An operator can start `loop` once and reach a named terminal without restarting after recoveries. |
| G-02 | Keep `run` trustworthy | Existing single-slug and `--multiple` behavior remains unchanged. |
| G-03 | Make stop reasons honest | Every loop invocation ends as `done`, `no_op`, `blocked`, `failed`, `exhausted`, `stalled`, or cancelled, with readable reason. |
| G-04 | Make continuity inspectable and resumable | Packet-local evidence survives process death; completed work is not redone. |
| G-05 | Keep adoption opt-in and local | `loop` is discoverable in help/README and requires no daemon, telemetry, or config migration. |

## User Stories

| ID | Persona | Story | Acceptance signal |
|---|---|---|---|
| US-01 | Solo local operator | As an operator, I want one command that keeps driving a packet until it is finished or truly stopped, so I do not restart after each recoverable stall. | One `loop` invocation reaches a named terminal through recoveries. |
| US-02 | Solo local operator | As an operator, I want completed tasks left alone on resume, so a killed process does not redo finished work. | After process death, the next `loop` continues remaining work only. |
| US-03 | Solo local operator | As an operator, I want report-only and checkpoint recoveries to happen inside the loop, so I do not babysit those seams. | Handoff/checkpoint recovery proceeds without a manual mid-packet restart. |
| US-04 | Solo local operator | As an operator, I want a named stop when nothing remains, something is externally blocked, a task truly failed, a cap hit, or I cancelled, so I know what to do next. | The terminal name and reason are visible in `--no-ui` and any interactive close. |
| US-05 | Solo local operator | As an operator, I want a dry-run that shows the plan and writes nothing, so I can inspect before committing time. | Dry-run prints pending/recovery actions and leaves packet files unchanged. |
| US-06 | Existing `run` user | As an existing user, I want `run` and `--multiple` to keep their current meaning. | Existing single-pass and batch acceptance remain valid. |
| US-07 | Returning operator | As an operator inspecting a stopped loop, I want packet-local evidence of iterations and the last outcome, so I can understand what happened after the process is gone. | Evidence in the packet names the terminal, last action, and remaining work. |

## Core Features

### F-01: Dedicated continuous packet command

- **User value:** Gives the operator a second, explicit “keep going” verb without changing `run`.
- **Mapped goals/stories:** G-01, G-02, G-05; US-01, US-06
- **MUST:** Accept `spec-finder loop <task_slug>` with the same runtime flags `run` already documents (`--no-ui`, `--provider`, `--model`, `--reasoning`, `--speed`).
- **MUST:** Drive exactly one packet per invocation.
- **MUST:** Share the existing workspace run-lock so `loop` and `run` cannot both own the workspace.
- **SHOULD:** Accept loop-only planning flags for iteration cap, no-progress window, dry-run, and explicit state reset.
- **Acceptance conditions:**
  - A valid slug starts one continuous packet driver.
  - Invalid invocation fails before work, with usage that distinguishes `loop` from `run`.
  - A second workspace owner is refused with the existing lock language.

### F-02: Detect, recover, then execute remaining work

- **User value:** The loop does the next right thing instead of blindly restarting the packet.
- **Mapped goals/stories:** G-01, G-04; US-01, US-02, US-03
- **MUST:** Derive the next action from packet files plus loop evidence every iteration (no operator-owned “current phase” to keep in sync).
- **MUST:** Prefer pending report-only handoff and checkpoint delivery recovery before starting new implementation.
- **MUST:** Execute only incomplete, failed, or otherwise eligible remaining work; never re-execute a completed task unless the operator explicitly opts in.
- **MUST:** Fail-fast on the first unrecoverable task failure, like `run`.
- **SHOULD:** Carry a readable previous-failure summary into the next attempt of the same remaining work.
- **Acceptance conditions:**
  - Completed tasks stay completed across iterations and after process death.
  - A blocked report handoff is retried as report-only.
  - A pending checkpoint delivery is retried without re-implementation.
  - An unrecoverable implementation failure stops the loop as `failed`.

### F-03: Honest named terminals

- **User value:** The operator can tell done from idle, blocked, failed, budget-stopped, stuck, and cancelled.
- **Mapped goals/stories:** G-03; US-04
- **MUST:** End every invocation with exactly one of: `done`, `no_op`, `blocked`, `failed`, `exhausted`, `stalled`, cancelled.
- **MUST:** Use this meaning:
  - `done` — packet definition of done met (every task completed with its required report; no pending checkpoint delivery; no open blocked handoff).
  - `no_op` — nothing pending at start; successful already-complete / nothing-to-do.
  - `blocked` — proven external or policy stop (missing credentials, denied permission that needs a human policy change, destructive approval, unavailable infra, missing product decision with no safe default).
  - `failed` — unrecoverable task failure under fail-fast policy.
  - `exhausted` — iteration cap reached before done.
  - `stalled` — consecutive iterations made no progress in completed/failed/blocked sets.
  - cancelled — operator or ACP abort.
- **MUST:** Print the terminal name and a readable reason in `--no-ui`.
- **SHOULD:** Use successful language for `done` and `no_op`, and distinct non-success language for the others.
- **Acceptance conditions:**
  - `no_op` is not presented as failure.
  - `blocked` is not presented as ordinary task failure.
  - `exhausted` and `stalled` name the cap or unchanged-progress reason.

### F-04: Inspectable packet-local evidence and resume

- **User value:** Continuity survives process death and remains reviewable after the command exits.
- **Mapped goals/stories:** G-04; US-02, US-07
- **MUST:** Persist loop evidence inside the packet directory, separate from `_prd.md` / task files / `memory/` / `reports/`.
- **MUST:** Resume from that evidence after process death without redoing completed work.
- **MUST:** Keep the runtime as the only writer of the loop ledger.
- **SHOULD:** Keep a bounded, append-only iteration history the operator can read.
- **Acceptance conditions:**
  - Killing `loop` mid-packet and starting `loop` again continues remaining work.
  - Invalid or hand-edited ledger is refused with an actionable error rather than silently ignored.
  - Dry-run does not create or change this evidence.

### F-05: Dry-run plan

- **User value:** The operator can see what the loop would do before spending a session.
- **Mapped goals/stories:** G-05; US-05
- **MUST:** Validate the packet, compute the next actions, and print pending tasks plus recovery actions.
- **MUST:** Mutate nothing: no task status, report, memory, checkpoint, or loop-evidence writes.
- **SHOULD:** Name the likely terminal if no work remains (`no_op` or `done` already satisfied).
- **Acceptance conditions:** Packet files and loop evidence are byte-identical before and after dry-run.

### F-06: Caps, no-progress, and operator abort

- **User value:** A runaway or stuck loop stops itself honestly.
- **Mapped goals/stories:** G-03; US-04
- **MUST:** Honor an iteration cap and a consecutive no-progress window.
- **MUST:** Treat operator/ACP cancel as cancelled, not as `failed`.
- **SHOULD:** Allow the operator to override cap and no-progress window for one invocation.
- **Acceptance conditions:**
  - Hitting the cap yields `exhausted` with the cap named.
  - Unchanged progress across the window yields `stalled` with that reason.
  - Cancel does not claim the packet failed.

### F-07: Compatible `run` and discoverable docs

- **User value:** Existing habits stay valid; the new verb is findable.
- **Mapped goals/stories:** G-02, G-05; US-06
- **MUST:** Leave `spec-finder run` and `run --multiple` behavior unchanged.
- **MUST:** Document `loop` vs `run` in CLI help and README.
- **SHOULD:** State that QA/review/ship, multi-packet loop, and cockpit meters are later.
- **Acceptance conditions:** Existing `run`/batch acceptance remains valid; help/README mention `loop`.

## User Experience

1. The operator discovers `spec-finder loop <slug>` in help or README, contrasted with `run`.
2. Optional dry-run shows the detected plan and writes nothing.
3. The operator starts `loop` in the cockpit or `--no-ui`, with the same runtime flags they already use for `run`.
4. The driver bootstraps or resumes packet-local evidence, then iterates: recover handoff/checkpoint if needed, else execute the next eligible task, else stop.
5. `--no-ui` prints enough to identify the current action and, at the end, the named terminal and reason.
6. Interactive V1 may reuse the existing task cockpit. Dedicated iteration/cap meters are later; the command must not feel like an unexplained hang in `--no-ui`.
7. On `done` or `no_op`, the operator sees successful completion language.
8. On `blocked`, `failed`, `exhausted`, `stalled`, or cancelled, the operator sees the distinct stop, the reason, and that later automatic continuation did not occur past that terminal.
9. After process death, the operator reruns the same `loop` command; completed work stays done.

Expected states:

- **Empty / all complete at start:** `no_op`, success, no provider work required.
- **Loading / detecting:** Show that the packet is being planned; do not imply implementation has started if only detect/recover is happening.
- **Recovering:** Say that a report handoff or checkpoint delivery is being resumed.
- **Executing:** Identify the current task using existing run-grade activity.
- **Success:** `done` or `no_op` with counts or already-complete detail.
- **Failure / block / cap:** Distinct terminal name, reason, and remaining work if any.
- **Cancellation:** Cancellation language, not failure language.
- **Accessibility:** Text labels, not color alone; keyboard-readable `--no-ui` outcome.
- **Reversibility:** No remote publish, no daemon left running, no silent rewrite of completed tasks.

## High-Level Constraints

- Local-first and daemon-free; packet files remain the product source of truth.
- One packet per V1 invocation; no `--multiple` loop.
- One workspace run-lock owner; `loop` and `run` cannot share a live workspace.
- Fail-fast on unrecoverable task failure; no continue-on-error in V1.
- No telemetry, usage analytics, or required new config keys.
- Checkpoints remain local Git only when `auto_commit` is already enabled; loop does not invent remote ship.
- Permissions stay user-owned policy; permission denials that need a human policy change are `blocked`, not infinite retries.
- Exact ledger schema, event shapes, and module layout belong in the TechSpec.

## Non-Goals

- **Changing `run` into a continuous driver** — would break the shipped single-pass contract; reconsider only if operators refuse a second command after launch.
- **QA, peer review, or ship-as-done** — Compozy skill-level “done” is larger than the verified babysitting gap; promote only with a separate product decision.
- **Cockpit iteration/cap meters** — useful, not required to close the first gap; promote if operators cannot tell what an interactive loop is doing.
- **Portable `sf-loop-tasks` skill** — runtime owns V1 lifecycle; a skill can mirror later if manual/agent-driven loop demand appears.
- **Continue-on-error / independent lanes** — packets are usually a dependency chain; requires an explicit later flag.
- **Multi-packet `loop --multiple`** — needs its own stop/budget policy.
- **Daemon, HTTP/UDS/MCP control plane, YAML Loop catalog, visual DAG editor** — conflicts with Spec Finder’s local-first boundary.
- **Automatic PR open/merge or remote publish** — outside the local packet contract.
- **Telemetry or a required measurement file** — success is acceptance-first.

## Phased Rollout Plan

### MVP

Include:

- `spec-finder loop <task_slug>` for one packet.
- Detect → recover → execute remaining work → named terminal.
- Packet-local inspectable evidence and resume after process death.
- Dry-run with no writes.
- Iteration cap and no-progress window.
- `--no-ui` terminal name and reason; interactive default may reuse existing cockpit.
- Unchanged `run` / `--multiple`.
- Help and README contrast of `loop` vs `run`.

Entry criteria:

- Approved PRD and ADRs.
- Acceptance scenarios exist for every named terminal, dry-run, resume-after-kill, fail-fast, and lock conflict.

Exit criteria:

- All acceptance conditions pass.
- One operator can leave a packet unattended through a report-handoff or checkpoint recovery without a mid-packet restart.
- Existing `run`/batch acceptance remains valid.

### Later phases

- **Cockpit meters:** Promote if interactive operators cannot identify iteration, current action, or terminal.
- **Portable loop skill:** Promote if operators need a manual/agent-driven loop that must not dual-own an active runtime loop.
- **QA/review phases:** Promote only after evidence that task-complete is not a sufficient definition of done.
- **Continue-on-error:** Promote only with evidence of independent tasks and an explicit flag.
- **Multi-packet loop:** Promote only after single-packet loop is trusted and a stop/budget policy is decided.
- **30-day unattended diary:** Optional later success review; not a V1 launch gate.

## Success Metrics

| ID | Metric | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| M-01 | Named-terminal coverage | No loop command | 100% of defined scenarios end with the specified terminal and reason | Acceptance scenarios | Every release candidate |
| M-02 | Recovery without babysitting | Manual `run` restart required | 100% of defined handoff/checkpoint recovery scenarios continue inside one `loop` invocation | Acceptance scenarios | Every release candidate |
| M-03 | Resume after process death | No loop ledger | 100% of defined kill/resume scenarios skip completed work | Acceptance scenarios | Every release candidate |
| M-04 | Dry-run non-mutation | n/a | 100% of dry-run scenarios leave packet files unchanged | Acceptance scenarios | Every release candidate |
| M-05 | `run` compatibility | Current `run`/batch behavior | 100% of existing single-slug and `--multiple` acceptance remain valid | Regression verification | Every release candidate |
| M-06 | Lock exclusivity | Current run-lock | 100% of concurrent `run`/`loop` attempts refuse the second owner | Acceptance scenarios | Every release candidate |

## Risks and Mitigations

| Risk | Evidence | Likelihood/impact | Mitigation | Owner/decision trigger |
|---|---|---|---|---|
| Operators never discover `loop` | New opt-in verb | Medium / Medium | Help + README contrast; do not change `run` | Release owner |
| `no_op` or `stalled` is read as failure | New vocabulary | Medium / High | Successful language for `no_op`; distinct copy for caps vs task failure | Product copy review |
| Interactive loop feels like a black box | CLI-first V1 | Medium / Medium | Require `--no-ui` progress; promote cockpit meters if operators cannot identify current action | Product review after first interactive use |
| Fail-fast is mistaken for a weak loop | Issue #13 noted continue-on-error as an open choice | Medium / Medium | Document that recoveries continue and only unrecoverable failure stops | PRD/README |
| Loop dual-owns lifecycle with `run` or a skill | Existing skill/runtime hard gate | High / High | Share run-lock; one owner per invocation | TechSpec + release gate |
| Caps surprise operators | No usage baseline for iteration counts | Medium / Medium | Readable `exhausted`/`stalled` reasons; invocation overrides | Product review |
| Scope creeps into Compozy Loop OS | Issue #13 researched daemon Loops | Medium / High | Enforce stated non-goals | Product owner |

## Architecture Decision Records

- [ADR-001: Dedicated Loop Command as Continuous Packet Driver](adrs/adr-001-dedicated-loop-command.md) — new `loop` verb; `run` stays single-pass.
- [ADR-002: CLI-First Honest-Terminal Loop Scope](adrs/adr-002-cli-first-honest-terminal-loop-scope.md) — V1 boundary, terminals, evidence, rollout, and success bar.

## Research Limitations

- No Spec Finder usage data on how often operators rerun a packet after a recoverable stall.
- External research used first-party local Compozy sources plus fetched public docs on 2026-08-13; live web-search MCP was unavailable.
- No pricing or adoption evidence exists for this command.
- Compozy v0.3 is beta; its Loop OS is a comparator, not a requirement.
- Exact ledger filename, CLI flag names, and exit-code numbers are deliberately left to the TechSpec.
- Cockpit-meter need is inferred from “don’t be a black box,” not from a usability study.

## Open Questions

- What exact `--no-ui` wording best distinguishes `done`, `no_op`, `blocked`, `failed`, `exhausted`, `stalled`, and cancelled?
- What default iteration cap and no-progress window feel safe before operators learn to override them?
- When, if ever, should an explicit reset of loop evidence be allowed on a packet that already has a terminal?
- Which later evidence should promote cockpit meters: one confused interactive session, or repeated reports?
