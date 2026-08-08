---
status: pending
title: Define Batch Contracts and Strict Input Parsing
type: backend
complexity: medium
dependencies: []
---

# Task 01: Define Batch Contracts and Strict Input Parsing

## Overview

Define the batch mode's validated input, outcome, and aggregate result contracts and implement the exclusive `--multiple <comma-separated-list>` parser. This establishes a deterministic boundary for later coordinator and command work while preserving the existing single-slug argument behavior.

## Source Artifacts

- PRD: `.spec-finder/tasks/ordered-multiple-task-run/_prd.md`
- TechSpec: `.spec-finder/tasks/ordered-multiple-task-run/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ordered-multiple-task-run/_prd.md`, `.spec-finder/tasks/ordered-multiple-task-run/_techspec.md`, all three packet ADRs, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as canonical execution position; it has no dependencies, and later tasks must depend on this contract rather than inventing alternate batch shapes.
- Use `sf-memory`; read `.spec-finder/tasks/ordered-multiple-task-run/memory/MEMORY.md` and `.spec-finder/tasks/ordered-multiple-task-run/memory/task_01.md` before editing and update them before finishing.
- Implement only parser and contract scope. Preserve unrelated dirty work, including existing UI changes, and do not absorb coordinator, store, command, or documentation work.
- Reference the TechSpec sections `Core Interfaces`, `External Interfaces`, and `Compatibility, Migration, and Rollback` instead of duplicating architecture prose.
- Run focused tests and the repository verification gate to terminal exit. Do not mark task status complete or write `reports/task_01.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST accept exactly one `--multiple` option followed by a non-empty comma-separated slug list and preserve declared order (F-01, G-01, US-01).
2. MUST reject positional slugs, repeated `--multiple`, empty entries, duplicate entries, malformed slugs, and option-like values without silently falling back to the single-run path (F-01, C-01, M-06).
3. MUST expose typed batch outcomes/results that later tasks can consume without changing the existing single-run event/result contract (G-04, US-06).
4. SHOULD keep existing provider/model/reasoning/speed and `--no-ui` values available for the later command integration rather than treating them as packet slugs (F-06).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-01, US-01, F-01 | Parse a declared ordered list | Parser unit matrix |
| G-04, US-06, C-01 | Keep batch opt-in and single-run compatible | Exclusive mode result and regression case |
| M-06 | Invalid sequences are rejected before execution | Parser returns structured error before runner exists |
| TechSpec: Core Interfaces / External Interfaces | Establish shared result and grammar types | TypeScript check and focused tests |

## Subtasks

- [ ] 01.1 Define the batch mode, packet outcome, packet summary, and aggregate result types in the new coordinator module.
- [ ] 01.2 Implement strict argument parsing with explicit errors for malformed, duplicate, empty, positional, and repeated batch inputs.
- [ ] 01.3 Preserve runtime option tokens for the command layer and ensure the parser cannot confuse their values with a positional slug.
- [ ] 01.4 Add focused parser/contract tests covering valid order and every rejected grammar shape.

## Implementation Details

Use the approved TechSpec's `BatchResult`, `PacketSummary`, `BatchRunOptions`, and `PacketRunner` concepts as the source of truth. The parser is a pure boundary and must not load packets, write memory, launch ACP, or mutate task files. Existing slug validation in `src/tasks.ts` remains authoritative; do not create a second slug grammar.

### Relevant Files

- `src/batch.ts` — create; batch parser and shared contract types.
- `src/tasks.ts` — existing slug validation to reuse or call, not replace.
- `src/commands.ts` — current unsafe first-non-flag slug extraction that the new parser must supersede only on the batch branch.
- `tests/batch.test.ts` — create; parser and type-level behavior tests.

### Dependent Files

- `src/events.ts` — later task adds additive lifecycle events consuming these contracts.
- `src/ui/store.ts` — later task consumes packet summaries and outcomes.
- `src/commands.ts` — later task routes parsed batch mode while preserving single mode.

### Related ADRs

- [ADR-001: Ordered Multi-Packet Run Coordinator](adrs/adr-001-ordered-multiple-task-run.md) — strict ordered entry and opt-in boundary.
- [ADR-003: Coordinator Batch Envelope and Active Projection](adrs/adr-003-coordinator-batch-envelope-active-projection.md) — selected contract ownership and compatibility rules.

## Deliverables

- Typed batch parser/result contract in `src/batch.ts`.
- Focused parser tests in `tests/batch.test.ts`.
- Updated `.spec-finder/tasks/ordered-multiple-task-run/memory/MEMORY.md` and `memory/task_01.md` with factual decisions/learnings.
- `reports/task_01.md` produced by the later report phase.

## Tests

### Unit Tests

- [ ] Given `--multiple alpha,beta`, return the ordered slugs `alpha`, `beta` and batch mode.
- [ ] Given `--multiple alpha,,beta`, duplicate slugs, invalid slugs, or an unknown option-shaped value, return a clear parse error and no partial list.
- [ ] Given a positional slug plus `--multiple`, or two `--multiple` options, reject the invocation.
- [ ] Given existing runtime flags in any supported order, preserve their tokens for command-level handling.

### Integration Tests

- [ ] Confirm the parser contract can be imported by the future coordinator without changing the existing `runTaskPacket` types.

### Platform or Manual Evidence

- [ ] Not applicable beyond Bun unit tests; this task has no renderer or provider process.

### Verification Commands

- `rtk bun test ./tests/batch.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Every parser requirement is covered by named tests.
- Batch grammar is strict and cannot route invalid input to the legacy single-run path.
- Focused tests, TypeScript, and the repository gate pass to terminal exit.
- No unrelated files or existing single-run behavior are changed.
- Memory is current and `reports/task_01.md` is ready for the report phase.
