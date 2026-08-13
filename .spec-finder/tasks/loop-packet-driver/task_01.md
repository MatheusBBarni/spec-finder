---
status: pending
title: Implement packet-local loop ledger
type: backend
complexity: medium
dependencies: []
---

# Task 01: Implement packet-local loop ledger

## Overview

Create the runtime-owned `loop/state.json` contract: strict schema, load/init/reset, and same-directory temp-plus-rename writes. This is the inspectable resume ledger later detect and coordinator tasks consume, and it must refuse hand-edited or partial files without mutating task, report, or memory artifacts.

## Source Artifacts

- PRD: `.spec-finder/tasks/loop-packet-driver/_prd.md`
- TechSpec: `.spec-finder/tasks/loop-packet-driver/_techspec.md`

<critical>
- Read `.spec-finder/tasks/loop-packet-driver/_prd.md`, `.spec-finder/tasks/loop-packet-driver/_techspec.md`, packet ADRs 003 and 004, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as its canonical execution position; it has no dependencies.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_01.md` before editing and update memory before finishing.
- Implement only the ledger module and its tests. Do not implement detect, coordinator iteration, CLI, or engine prompt changes.
- Reference TechSpec sections Data Models and Lifecycle, Security and Privacy, and Compatibility, Migration, and Rollback instead of duplicating schema prose.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST persist loop evidence only under the target packet directory's `loop/state.json` with a version-1 Zod-strict schema and refuse unknown keys or invalid terminals (F-04, C-01).
2. MUST write via a same-directory temp file plus `rename`, and MUST fail closed on unreadable or invalid JSON with an actionable error (F-04, M-03).
3. MUST implement bootstrap init and `--reset-state` rewrite of a fresh ledger without changing task files, reports, or memory (F-01 SHOULD reset, ADR-004).
4. SHOULD write optional `loop/iterations/NNN.md` summaries only when a later writer asks; this task exposes the path helper and does not treat markdown as authority (US-07).
5. MUST NOT create `loop/` during a dry-run helper path or any function documented as non-mutating (F-05, M-04).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| F-04, G-04, US-07 | Runtime-owned packet-local ledger | Schema + load/write tests |
| C-01 | Filesystem truth, no daemon | Writes stay under the packet `loop/` directory |
| M-03 | Resume depends on a durable file | Atomic write and load-after-kill fixture |
| M-04, F-05 | Dry-run must not create evidence | Non-mutating helper does not mkdir/write |
| ADR-004 | Reset rewrites bootstrap only | Reset test leaves task files untouched |
| TechSpec: Data Models and Lifecycle | Version-1 fields and ownership | Zod `.strict()` unit tests |

## Subtasks

- [ ] 01.1 Define the version-1 ledger types and Zod-strict parser with actionable issues.
- [ ] 01.2 Implement init, load, and always-allowed reset that rewrite only `loop/state.json`.
- [ ] 01.3 Implement same-directory temp-plus-rename writes and refuse partial or unknown-key files.
- [ ] 01.4 Expose iteration-summary path helpers without treating leftover markdown as the ledger.
- [ ] 01.5 Add focused ledger tests for init, reject, reset, atomic replace, and non-mutation.

## Implementation Details

Follow `.spec-finder/tasks/loop-packet-driver/_techspec.md` Data Models and Lifecycle and ADR-004. Reuse existing Zod `.strict()` style from `src/config.ts` and `src/tasks.ts`. Do not add config keys. Do not write task frontmatter. Archive classification already ignores extra packet directories; do not change the archive skill.

### Relevant Files

- `src/loop-state.ts` — create; schema, load/init/reset, atomic write, path helpers.
- `tests/loop-state.test.ts` — create; ledger contract tests.

### Dependent Files

- `src/loop.ts` — later detect and coordinator import these types.
- `src/commands.ts` — later reset flag calls the reset helper.
- `src/paths.ts` — existing `specPath` / `TASKS_DIR` helpers to reuse, not replace.

### Related ADRs

- [ADR-003: Isolated Loop Stack Above Unchanged `runTaskPacket`](adrs/adr-003-isolated-loop-stack.md) — ledger lives in `src/loop-state.ts`, not the CLI.
- [ADR-004: Packet-Local Ledger, File Detect, Exec-Like Exits](adrs/adr-004-loop-ledger-detect-and-exits.md) — path, schema, atomic write, always-reset.

## Deliverables

- `src/loop-state.ts` with validated load/init/reset/write.
- `tests/loop-state.test.ts` covering the cases below.
- Updated `memory/MEMORY.md` and `memory/task_01.md` when warranted.
- `reports/task_01.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given a valid packet directory and no `loop/` tree, when init runs, then `loop/state.json` exists with `version: 1`, `iteration: 0`, `terminal: null`, and the fixed V1 goal/definition-of-done strings.
- [ ] Given a file with an unknown key or invalid `terminal`, when load runs, then it throws an actionable error naming the path and issue and does not rewrite the file.
- [ ] Given an existing terminal ledger, when reset runs, then the new file is a bootstrap ledger and sibling `task_*.md` bytes are unchanged.
- [ ] Given a successful write, when the process is simulated to crash after temp create but before rename is observed, then the next load either reads the previous valid file or fails closed; it never parses a truncated JSON object as success.
- [ ] Given the documented non-mutating helper, when invoked, then no `loop/` directory is created.

### Integration Tests

- [ ] Not applicable for this task: no command, engine, or ACP boundary yet.

### Platform or Manual Evidence

- [ ] Not applicable: rename durability matches the existing setup write pattern; no new OS supervisor.

### Verification Commands

- `bun test tests/loop-state.test.ts`
- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable.
- No unrelated file or approved behavior changes.
- Memory is current and the final report records exact evidence and unresolved risks.
