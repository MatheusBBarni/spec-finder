---
status: pending
title: Add optional engine loop feedback prefix
type: backend
complexity: low
dependencies: []
---

# Task 03: Add optional engine loop feedback prefix

## Overview

Add an optional `loopFeedback` field on existing `RunOptions` so a later loop pass can prepend a bounded previous-failure summary to implementation and report prompts. `run` and batch must omit the field so their prompt text stays identical to today.

## Source Artifacts

- PRD: `.spec-finder/tasks/loop-packet-driver/_prd.md`
- TechSpec: `.spec-finder/tasks/loop-packet-driver/_techspec.md`

<critical>
- Read `.spec-finder/tasks/loop-packet-driver/_prd.md`, `.spec-finder/tasks/loop-packet-driver/_techspec.md`, packet ADR-003, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as its canonical execution position; it has no dependencies and is parallelizable with task_01 and task_02.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_03.md` before editing and update memory before finishing.
- Implement only the additive prompt prefix. Do not change phase retry counts, handoff persistence, or `RunResult`.
- Reference TechSpec sections Core Interfaces and Integration Points instead of inventing a second prompt contract.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST add optional `loopFeedback?: string` on `RunOptions` without changing required fields (F-02 SHOULD, ADR-003).
2. MUST prepend that string to implementation and report prompts only when it is a non-empty string (F-02 SHOULD).
3. MUST leave current prompt text unchanged when the field is omitted or empty so `run` and batch stay default-identical (G-02, C-06, M-05).
4. SHOULD bound or sanitize the prefix using the 4096-character / control-character rule in `.spec-finder/tasks/loop-packet-driver/_techspec.md` Security and Privacy if the engine is the last writer of prompt text.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| F-02 SHOULD | Carry previous-failure summary into the next attempt | Prompt contains prefix only when set |
| G-02, US-06, C-06, M-05 | `run` prompts unchanged by default | Omitted-field snapshot matches current wording |
| ADR-003 | Additive engine contract only | No `RunResult` or retry-policy edits |
| TechSpec: Core Interfaces | Optional field on `RunOptions` | Type check + engine tests |

## Subtasks

- [ ] 03.1 Add the optional field to `RunOptions` with no required-call-site changes.
- [ ] 03.2 Prepend non-empty feedback to implementation and report prompt builders.
- [ ] 03.3 Keep omitted/empty feedback on the current prompt text.
- [ ] 03.4 Add focused engine tests for omitted versus present prefix.

## Implementation Details

Follow `.spec-finder/tasks/loop-packet-driver/_techspec.md` Core Interfaces. Existing continuation text for phase attempt 2/2 stays. Do not read `loop/state.json` from the engine. Do not set the field from `runCommand` in this task.

### Relevant Files

- `src/engine.ts` — existing `RunOptions` and prompt builders.

### Dependent Files

- `tests/engine.test.ts` — add omitted/present prompt cases; keep existing retry/handoff tests green.
- `src/loop.ts` — later coordinator sets the field on pass two.
- `src/commands.ts` / `src/batch.ts` — must continue omitting the field.

### Related ADRs

- [ADR-003: Isolated Loop Stack Above Unchanged `runTaskPacket`](adrs/adr-003-isolated-loop-stack.md) — only additive `loopFeedback`.

## Deliverables

- Additive `RunOptions.loopFeedback` with prompt prefix behavior.
- Focused engine tests proving omitted default and present prefix.
- Updated `memory/MEMORY.md` and `memory/task_03.md` when warranted.
- `reports/task_03.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given `RunOptions` without `loopFeedback`, when an implementation prompt is built, then the text matches the current no-feedback contract (includes `sf-execute-task` and excludes a loop-feedback heading).
- [ ] Given `loopFeedback` set to a known summary string, when implementation and report prompts are built, then both start with or contain that exact bounded summary and still include the existing task path instructions.
- [ ] Given `loopFeedback` is `""`, when prompts are built, then behavior matches the omitted case.

### Integration Tests

- [ ] Existing engine handoff/retry fixtures still pass with the field omitted.

### Platform or Manual Evidence

- [ ] Not applicable.

### Verification Commands

- `bun test tests/engine.test.ts`
- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable.
- No unrelated file or approved behavior changes.
- Memory is current and the final report records exact evidence and unresolved risks.
