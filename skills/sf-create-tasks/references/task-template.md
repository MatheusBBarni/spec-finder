---
status: pending
title: [Imperative task title]
type: [frontend, backend, docs, test, infra, refactor, chore, bugfix, or repository-defined type]
complexity: [low, medium, high, or critical]
dependencies: []
---

# Task NN: [Imperative task title]

## Overview

[In 2-3 sentences, state the independently testable outcome, why it matters, and its place in the approved design.]

<critical>
- Read the PRD, TechSpec, relevant ADRs, repository instructions, and current Git state before editing.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_NN.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb follow-up scope.
- Reference TechSpec sections for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST [specific observable technical contract mapped to PRD/TechSpec ID].
2. SHOULD [bounded secondary contract and condition].
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|

## Subtasks

- [ ] NN.1 [Outcome to accomplish, not code mechanics]
- [ ] NN.2 [Outcome]
- [ ] NN.3 [Verification outcome]

Use 3-7 subtasks.

## Implementation Details

Reference the approved TechSpec sections, integration points, and constraints. Do not paste its code or diagrams.

### Relevant Files

- `path/to/file` — [verified role; say `create` when absent]

### Dependent Files

- `path/to/consumer-or-test` — [why this task affects it]

### Related ADRs

- [ADR-NNN: Title](adrs/adr-NNN.md) — [constraint on this task]

## Deliverables

- [Concrete implementation outcome]
- Required automated and platform evidence
- Updated `memory/MEMORY.md` and `memory/task_NN.md` when warranted
- `reports/task_NN.md` final evidence report

## Tests

### Unit Tests

- [ ] Given [specific input/state], when [action], then [expected result/error].

### Integration Tests

- [ ] At [named boundary], verify [specific interaction and expected behavior].

### Platform or Manual Evidence

- [ ] [Evidence unit tests cannot prove, or `Not applicable` with reason].

### Verification Commands

- `[focused command]`
- `[repository gate]`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable.
- No unrelated file or approved behavior changes.
- Memory is current and the final report records exact evidence and unresolved risks.
