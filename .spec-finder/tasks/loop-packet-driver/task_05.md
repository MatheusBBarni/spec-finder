---
status: pending
title: Wire loop command, lock, and exit mapping
type: backend
complexity: high
dependencies:
  - task_04
---

# Task 05: Wire loop command, lock, and exit mapping

## Overview

Expose `spec-finder loop <task_slug>` with the approved flag grammar, the same workspace run-lock as `run`, an emit wrapper that suppresses later `run_started` store resets, and exec-like exits `0` / `1` / `2` / `130`. `run` and `--multiple` parsing and behavior stay unchanged.

## Source Artifacts

- PRD: `.spec-finder/tasks/loop-packet-driver/_prd.md`
- TechSpec: `.spec-finder/tasks/loop-packet-driver/_techspec.md`

<critical>
- Read `.spec-finder/tasks/loop-packet-driver/_prd.md`, `.spec-finder/tasks/loop-packet-driver/_techspec.md`, packet ADRs 001–004, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as its canonical execution position; `task_04` must already be completed.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_05.md` before editing and update memory before finishing.
- Implement command routing, parsing, lock, emit wrap, and exits. Do not rewrite README beyond what the command/help string in `src/cli.tsx` must say for dispatch to compile; full README lockstep is task_06.
- Reference TechSpec sections External Interfaces, Integration Points, and Failure and Recovery Behavior.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST accept exactly one positional slug plus documented runtime and loop flags, using last-value-wins for repeats (F-01).
2. MUST reject `--multiple`, extra positionals, unknown options, missing values, option-like values, and non-positive cap integers with exit `2` before mutating work (F-01, C-02).
3. MUST acquire the existing workspace run-lock so `loop` and `run` cannot both own the workspace, using the current refuse wording (C-03, M-06).
4. MUST map `done`/`no_op` → `0`; `blocked`/`failed`/`exhausted`/`stalled` → `1`; invalid invocation/packet/ledger → `2`; cancelled → `130` (ADR-004, US-04).
5. MUST wrap emit so only the first engine `run_started` seeds the cockpit store (ADR-003 risk mitigation).
6. MUST print `--no-ui` lines with the stable prefixes `loop: iteration`, `loop: terminal`, and dry-run `loop: dry-run` / `loop: would-write nothing` (F-03, Observability).
7. MUST leave `runCommand` grammar and exits unchanged (G-02, US-06, M-05).
8. SHOULD support `--reset-state` by calling the task_01 reset helper after packet validation and before detect (ADR-004).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| F-01, C-02 | New verb, one packet, strict flags | Parser tests |
| C-03, M-06 | Shared run-lock | Concurrent refuse both directions |
| US-04, ADR-004 | Honest exits and `--no-ui` terminal line | Command output + exit-code tests |
| G-02, US-06, M-05 | Frozen `run` | Existing `runCommand` tests still pass |
| ADR-003 | Emit wrapper | Second `run_started` does not reset store in a command-level fixture |
| TechSpec: External Interfaces | Grammar and prefixes | `tests/loop-args.test.ts` + command tests |

## Subtasks

- [ ] 05.1 Implement `parseLoopArgs` with the rejection matrix and last-value-wins.
- [ ] 05.2 Add `loopCommand` that locks, loads config/overrides, optionally resets, and calls `runLoop`.
- [ ] 05.3 Map `LoopResult` and named parse/ledger errors to `0`/`1`/`2`/`130`.
- [ ] 05.4 Wrap emit to suppress subsequent `run_started` events.
- [ ] 05.5 Dispatch `loop` from `src/cli.tsx` and add a usage line sufficient for the unknown-command path to mention the verb.
- [ ] 05.6 Add parser and command tests including lock exclusivity.

## Implementation Details

Follow `.spec-finder/tasks/loop-packet-driver/_techspec.md` External Interfaces and Integration Points. Reuse `createCommandLifecycle`, `applyRunOverrides`, and `acquireRunLock` already used by `run`. Invalid loop parse should not fall through to `run`. Do not add config keys. Full help/README contrast is task_06; this task only needs dispatch and enough usage text for parse errors.

### Relevant Files

- `src/commands.ts` — add `loopCommand` and parser.
- `src/cli.tsx` — dispatch `loop`.
- `tests/loop-args.test.ts` — create; grammar matrix.
- `tests/commands.test.ts` — add loop command/lock/exit cases.

### Dependent Files

- `src/loop.ts` — `runLoop` from task_04.
- `src/run-lock.ts` — unchanged acquire API.
- `tests/run-lock.test.ts` — existing lock behavior; add cross-command case here or in commands tests.
- `README.md` / `tests/cli.test.ts` — task_06 lockstep.

### Related ADRs

- [ADR-001: Dedicated Loop Command as Continuous Packet Driver](adrs/adr-001-dedicated-loop-command.md) — new verb, frozen `run`.
- [ADR-003: Isolated Loop Stack Above Unchanged `runTaskPacket`](adrs/adr-003-isolated-loop-stack.md) — command owns lock/lifecycle, not detect.
- [ADR-004: Packet-Local Ledger, File Detect, Exec-Like Exits](adrs/adr-004-loop-ledger-detect-and-exits.md) — exit matrix and reset.

## Deliverables

- Working `spec-finder loop` dispatch with lock, parser, emit wrap, and exits.
- Focused parser and command tests.
- Updated `memory/MEMORY.md` and `memory/task_05.md` when warranted.
- `reports/task_05.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given `["my-feature", "--dry-run", "--max-iterations", "4"]`, when parse runs, then slug and flags are accepted.
- [ ] Given a repeated `--provider`, when parse runs, then the last value wins.
- [ ] Given `--multiple`, an extra positional, an unknown flag, a missing flag value, or `--max-iterations 0`, when parse or command runs, then exit is `2` and no ledger is written.

### Integration Tests

- [ ] Given an injected `runLoop` that returns `done` or `no_op`, when `loopCommand` runs with `--no-ui`, then exit is `0` and output contains `loop: terminal`.
- [ ] Given injected terminals `blocked`, `failed`, `exhausted`, and `stalled`, when `loopCommand` runs, then exit is `1`.
- [ ] Given injected `cancelled`, when `loopCommand` runs, then exit is `130`.
- [ ] Given an invalid ledger without `--reset-state`, when `loopCommand` runs, then exit is `2`.
- [ ] Given an active `run` lock, when `loop` starts, then it is refused with the existing active-run wording; the reverse also refuses.
- [ ] Given two synthetic `run_started` events from the runner, when the command listener is the cockpit store, then the store slug/tasks come from the first event only.
- [ ] Given `runCommand(["slug", "--no-ui"])`, when executed after these changes, then existing single-run tests still pass.

### Platform or Manual Evidence

- [ ] Not applicable: no new PTY/cockpit meters.

### Verification Commands

- `bun test tests/loop-args.test.ts tests/commands.test.ts tests/loop.test.ts tests/run-lock.test.ts`
- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable.
- No unrelated file or approved behavior changes.
- Memory is current and the final report records exact evidence and unresolved risks.
