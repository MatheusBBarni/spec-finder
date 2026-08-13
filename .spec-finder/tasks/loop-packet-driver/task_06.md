---
status: pending
title: Publish loop vs run help and README
type: docs
complexity: medium
dependencies:
  - task_05
---

# Task 06: Publish loop vs run help and README

## Overview

Document `spec-finder loop` beside `run` so operators can discover the continuous driver, read the named terminals and exit codes, and see what V1 deliberately omits. Help and README must stay in lockstep the way existing CLI tests already enforce for other commands.

## Source Artifacts

- PRD: `.spec-finder/tasks/loop-packet-driver/_prd.md`
- TechSpec: `.spec-finder/tasks/loop-packet-driver/_techspec.md`

<critical>
- Read `.spec-finder/tasks/loop-packet-driver/_prd.md`, `.spec-finder/tasks/loop-packet-driver/_techspec.md`, packet ADRs 001 and 002, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as its canonical execution position; `task_05` must already be completed.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_06.md` before editing and update memory before finishing.
- Change only documentation and the help/README lockstep tests. Do not change loop policy, exits, or engine behavior.
- Reference TechSpec sections External Interfaces and Compatibility, Migration, and Rollback plus PRD Non-Goals for deferred work.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST document `spec-finder loop <task_slug>` in CLI help and README, contrasted with single-pass `run` (G-05, F-07, US-06).
2. MUST name terminals `done`, `no_op`, `blocked`, `failed`, `exhausted`, `stalled`, and cancelled, plus exits `0`, `1`, `2`, and `130` (F-03, ADR-004).
3. MUST document `--dry-run`, `--reset-state`, `--max-iterations`, `--no-progress-window`, and the shared runtime flags (F-01, F-05, F-06).
4. SHOULD state that cockpit meters, portable loop skill, QA/review/ship, continue-on-error, and multi-packet loop are later (F-07, Non-Goals).
5. MUST keep existing `run` / `--multiple` / `exec` help contracts intact (M-05).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-05, F-07 | Discoverable opt-in command | Help and README contain `spec-finder loop` |
| US-04, ADR-004 | Honest terminals and exits | Both texts name the seven terminals and four exits |
| US-05, F-05 | Dry-run writes nothing | Help/README say dry-run mutates nothing |
| C-05 | No telemetry or required config keys | Docs do not invent a `loop` config object |
| M-05 | Existing command docs remain valid | Existing `tests/cli.test.ts` cases still pass |
| TechSpec: External Interfaces | Grammar and prefixes | Lockstep assertions |

## Subtasks

- [ ] 06.1 Add loop usage and a short loop-versus-run section to `src/cli.tsx` help.
- [ ] 06.2 Add the matching README section, including recovery and resume language.
- [ ] 06.3 Extend `tests/cli.test.ts` so help and README stay aligned.
- [ ] 06.4 Confirm existing setup/batch/exec help assertions still pass.

## Implementation Details

Follow `.spec-finder/tasks/loop-packet-driver/_techspec.md` External Interfaces. Do not document a daemon, YAML Loop DSL, or required `.spec-finder/config.json` loop key. Default caps 50 and 3 may be stated because ADR-004 selected them.

### Relevant Files

- `src/cli.tsx` — existing `HELP` string.
- `README.md` — existing CLI / Run tasks sections.
- `tests/cli.test.ts` — existing help/README lockstep.

### Dependent Files

- `src/commands.ts` — already wired in task_05; do not change exits here.

### Related ADRs

- [ADR-001: Dedicated Loop Command as Continuous Packet Driver](adrs/adr-001-dedicated-loop-command.md) — second verb, frozen `run`.
- [ADR-002: CLI-First Honest-Terminal Loop Scope](adrs/adr-002-cli-first-honest-terminal-loop-scope.md) — deferred cockpit/skill.
- [ADR-004: Packet-Local Ledger, File Detect, Exec-Like Exits](adrs/adr-004-loop-ledger-detect-and-exits.md) — exit matrix to publish.

## Deliverables

- Help and README contrast of `loop` vs `run`.
- Lockstep CLI tests for the new contract.
- Updated `memory/MEMORY.md` and `memory/task_06.md` when warranted.
- `reports/task_06.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given `main(["help"])`, when captured, then output contains `spec-finder loop <task_slug>`, `--dry-run`, `--reset-state`, `--max-iterations`, `--no-progress-window`, and the seven terminal names.
- [ ] Given README and help, when compared, then both contain `loop` vs `run`, exits `0`/`1`/`2`/`130`, and a statement that dry-run writes nothing.
- [ ] Given help and README, when scanned, then they do not advertise `loop --multiple` or a required `loop` config key.

### Integration Tests

- [ ] Existing help tests for setup, batch, exec, and checkpoint still pass.

### Platform or Manual Evidence

- [ ] Not applicable.

### Verification Commands

- `bun test tests/cli.test.ts`
- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable.
- No unrelated file or approved behavior changes.
- Memory is current and the final report records exact evidence and unresolved risks.
