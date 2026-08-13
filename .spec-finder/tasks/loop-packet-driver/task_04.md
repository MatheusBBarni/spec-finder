---
status: pending
title: Implement loop coordinator with injected engine
type: backend
complexity: high
dependencies:
  - task_01
  - task_02
  - task_03
---

# Task 04: Implement loop coordinator with injected engine

## Overview

Implement `runLoop` so one invocation detect-iterates remaining work through injected `runTaskPacket`, writes ledger evidence, and stops on a named terminal. Dry-run must print the plan and leave the packet byte-identical. This is the first task that actually closes the babysitting gap.

## Source Artifacts

- PRD: `.spec-finder/tasks/loop-packet-driver/_prd.md`
- TechSpec: `.spec-finder/tasks/loop-packet-driver/_techspec.md`

<critical>
- Read `.spec-finder/tasks/loop-packet-driver/_prd.md`, `.spec-finder/tasks/loop-packet-driver/_techspec.md`, packet ADRs 003 and 004, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as its canonical execution position; task_01, task_02, and task_03 must already be completed.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_04.md` before editing and update memory before finishing.
- Implement the coordinator only. Do not add CLI dispatch, help text, or cockpit meters.
- Reference TechSpec sections Data and Control Flow, Failure and Recovery Behavior, and Observability instead of inventing a second iteration protocol.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST iterate detect → one `runTaskPacket` pass → reload/classify → ledger write until a named terminal (G-01, F-02, US-01).
2. MUST inject the packet runner for tests and default to existing `runTaskPacket` (ADR-003).
3. MUST continue after recoverable handoff or checkpoint residue and MUST stop without another pass after any `failed` task (US-03, C-04, M-02).
4. MUST honor iteration cap and no-progress window as `exhausted` and `stalled` (F-06, M-01).
5. MUST treat abort as `cancelled`, not `failed` (F-06).
6. MUST pass `loopFeedback` only on a subsequent pass that has prior route-cause text; the first pass omits it (F-02 SHOULD, task_03).
7. MUST implement dry-run that validates, prints pending/recovery actions, and mutates nothing including absence of `loop/` (F-05, M-04, US-05).
8. SHOULD emit existing `activity` messages with the stable `loop:` prefixes from `.spec-finder/tasks/loop-packet-driver/_techspec.md` Observability; MUST NOT add a new `RunEvent` variant that forces `src/ui/store.ts` edits (ADR-003 emit note, CLI-first V1).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-01, US-01 | Unattended recoveries in one invocation | Injected runner continue fixture |
| US-02, M-03 | Resume without redoing completed work | Ledger + detect after simulated mid-loop state |
| US-03, M-02 | Handoff/checkpoint stay inside the loop | Two-pass injected recovery |
| US-05, F-05, M-04 | Dry-run non-mutation | Filesystem snapshot |
| F-06, M-01 | Caps and cancel | Cap, stall, abort fixtures |
| F-03 | Named `LoopResult.terminal` | Result object on every stop |
| TechSpec: Core Interfaces | `LoopRunOptions` / `LoopResult` | Type check + coordinator tests |

## Subtasks

- [ ] 04.1 Add `runLoop` options/result types and the detect → pass → classify loop.
- [ ] 04.2 Wire injected runner, first-pass-omitted feedback, and recoverable continue.
- [ ] 04.3 Stop on failed, blocked, exhausted, stalled, done, no_op, and cancelled.
- [ ] 04.4 Implement dry-run print/plan with zero writes.
- [ ] 04.5 Write iteration summaries as leftover evidence only; ledger JSON remains authority.
- [ ] 04.6 Add injected-runner integration tests for the matrix above.

## Implementation Details

Follow `.spec-finder/tasks/loop-packet-driver/_techspec.md` Data and Control Flow. The coordinator reloads the packet after each pass and calls detect; it does not classify from `RunResult.blocked`. It never writes task frontmatter. Progress fingerprint updates belong here using task_01/task_02 helpers.

Do not acquire the run-lock here; that is task_05. Do not parse argv here.

### Relevant Files

- `src/loop.ts` — expand; `runLoop` coordinator.
- `src/loop-state.ts` — write/reset helpers from task_01.
- `src/engine.ts` — default runner and `loopFeedback` from task_03.
- `tests/loop.test.ts` — expand; coordinator fixtures.

### Dependent Files

- `src/commands.ts` — later `loopCommand` calls `runLoop`.
- `src/events.ts` — reuse `activity`; do not add `loop_finished` in this task.
- `src/ui/store.ts` — must remain unedited.

### Related ADRs

- [ADR-003: Isolated Loop Stack Above Unchanged `runTaskPacket`](adrs/adr-003-isolated-loop-stack.md) — wrap engine, inject runner.
- [ADR-004: Packet-Local Ledger, File Detect, Exec-Like Exits](adrs/adr-004-loop-ledger-detect-and-exits.md) — classification after each pass.

## Deliverables

- `runLoop` with injected runner, dry-run, caps, cancel, and ledger updates.
- Focused coordinator tests covering every named terminal path that does not require CLI.
- Updated `memory/MEMORY.md` and `memory/task_04.md` when warranted.
- `reports/task_04.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given detect says `no_op` before any pass, when `runLoop` runs, then it returns `no_op` and does not call the runner.

### Integration Tests

- [ ] Given a packet with a report-only handoff, when the injected runner clears that handoff on pass one and leaves remaining pending work, then `runLoop` calls the runner again and does not require a new process.
- [ ] Given a packet with pending checkpoint delivery, when the injected runner completes delivery, then the loop continues or reaches `done` without re-invoking implementation for that task.
- [ ] Given the injected runner leaves a task `failed`, when `runLoop` classifies, then it returns `failed` and the runner call count is 1.
- [ ] Given `maxIterations: 1` and remaining work after that pass is still recoverable, when `runLoop` finishes, then the terminal is `exhausted` and the reason names the cap.
- [ ] Given two consecutive passes with an unchanged completed/failed/blocked identity set and `noProgressWindow: 2`, when `runLoop` finishes, then the terminal is `stalled`.
- [ ] Given the abort signal is fired before or during a pass, when `runLoop` settles, then the terminal is `cancelled`.
- [ ] Given a second pass is required, when inspecting runner options, then only the second call has non-empty `loopFeedback`.
- [ ] Given `--dry-run` equivalent `dryRun: true` on a pending packet, when `runLoop` returns, then the runner was not called and a recursive snapshot of the packet directory matches the pre-call snapshot.

### Platform or Manual Evidence

- [ ] Not applicable: kill/resume of a real process is proven later at the command layer; this task simulates mid-loop ledger plus packet files.

### Verification Commands

- `bun test tests/loop.test.ts tests/loop-state.test.ts tests/engine.test.ts`
- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable.
- No unrelated file or approved behavior changes.
- Memory is current and the final report records exact evidence and unresolved risks.
