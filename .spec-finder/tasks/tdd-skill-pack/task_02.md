---
status: pending
title: Author TDD execute skill
type: docs
complexity: medium
dependencies:
  - task_01
---

# Task 02: Author TDD execute skill

## Overview

Add `sf-tdd-execute` as the one-task TDD executor that forces red → green vertical slices for behavioral work. It must reuse `task_01` doctrine, derive a plan when `## TDD Plan` is missing, record short red/green notes in existing memory headings, and preserve the ACP versus manual lifecycle split.

## Source Artifacts

- PRD: `.spec-finder/tasks/tdd-skill-pack/_prd.md`
- TechSpec: `.spec-finder/tasks/tdd-skill-pack/_techspec.md`

<critical>
- Read `.spec-finder/tasks/tdd-skill-pack/_prd.md`, `.spec-finder/tasks/tdd-skill-pack/_techspec.md`, relevant packet ADRs, repository instructions, and current Git state before editing. These paths must contain the current packet slug in generated output.
- Treat this task's numeric ID as its canonical execution position; every declared dependency must already be completed and have a lower numeric ID.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_02.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb follow-up scope.
- Reference TechSpec sections for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST create `skills/sf-tdd-execute/` with `SKILL.md` and a byte-equivalent copy of `skills/sf-tdd-plan/references/tdd-doctrine.md` (F-02, F-04, G-03).
2. MUST require, for each behavioral slice, one failing public-seam test, a focused command failure for the intended missing behavior, then minimal production code and a pass of the same command identity (G-01, F-04, US-02).
3. MUST forbid production implementation for slice N before red evidence for that same test identity, forbid horizontal all-tests-then-code, skip fake red when not-applicable is recorded with a reason, and resume from `Ready for Next Run` (F-04, G-04, US-06).
4. MUST choose exactly one lifecycle owner: under ACP, stop after implementation, verification, and memory; do not write `reports/task_NN.md` or frontmatter status. On a manual path, invoke `sf-tdd-report` after work (US-08, lifecycle constraint).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-01, F-04, US-02 | Red then green per slice | Execute HARD-GATE and loop checklist |
| F-04 SHOULD | Resume interrupted slices | Memory heading contract |
| G-04, US-06 | No theater red when N/A | N/A skip rule |
| G-02, US-08 | Dual-ownership ban | Same split as `sf-execute-task` |
| TechSpec sequencing step 3 | Execute after doctrine | Depends on `task_01` |

## Subtasks

- [ ] 02.1 Execute skill tree exists and carries the `task_01` doctrine copy.
- [ ] 02.2 Behavioral slices cannot implement before recorded red for the same test identity.
- [ ] 02.3 Not-applicable tasks complete the execute path without invented tests.
- [ ] 02.4 Interrupted work resumes green or the next red from existing memory headings.
- [ ] 02.5 ACP versus manual ownership matches core execute; `bun run verify` stays green.

## Implementation Details

Follow `.spec-finder/tasks/tdd-skill-pack/_techspec.md` Data and Control Flow and Failure and Recovery Behavior. Copy doctrine from `skills/sf-tdd-plan/references/tdd-doctrine.md`; do not fork wording. Write slice notes only under `Important Decisions`, `Learnings`, and `Ready for Next Run`. Do not add `## TDD Slices` and do not edit `sf-memory`.

### Relevant Files

- `skills/sf-tdd-execute/SKILL.md` — create; red→green loop and lifecycle HARD-GATE
- `skills/sf-tdd-execute/references/tdd-doctrine.md` — create; copy of plan doctrine

### Dependent Files

- `skills/sf-tdd-plan/references/tdd-doctrine.md` — source copy produced by `task_01`
- `skills/sf-execute-task/SKILL.md` — lifecycle split to mirror, not rewrite
- `skills/sf-memory/SKILL.md` — heading and no-transcript rules
- `src/engine.ts` — ACP still targets core execute; do not change

### Related ADRs

- [ADR-001: Parallel Opt-In TDD Skill Pack](adrs/adr-001-parallel-tdd-skill-pack.md) — parallel executor; core path stays default
- [ADR-004: TDD Plan and Evidence Persistence](adrs/adr-004-tdd-plan-and-evidence-persistence.md) — memory notes in default headings

## Deliverables

- `skills/sf-tdd-execute/` with doctrine copy and enforceable loop
- Contract evidence for red-before-green, N/A skip, resume, and lifecycle split
- Updated `memory/MEMORY.md` and `memory/task_02.md` when warranted
- `reports/task_02.md` final evidence report

## Tests

### Unit Tests

- [ ] Not applicable: Markdown skill only; no TypeScript behavior change.

### Integration Tests

- [ ] Not applicable: setup allowlist is unchanged until `task_05`.

### Platform or Manual Evidence

- [ ] Given slice N with no red note, when execute is followed, then it forbids production edits until a focused command fails for that test identity.
- [ ] Given a recorded `not_applicable` reason in `## TDD Plan`, when execute runs, then it does not invent a red test.
- [ ] Given memory `Ready for Next Run` stating red done and green incomplete, when execute resumes, then it reruns the same command identity rather than starting a new red.
- [ ] Given an ACP-owned run, when execute finishes implementation, then the skill does not write the report or change status.
- [ ] Given a temptation to write all tests first, when execute is followed, then horizontal slicing is a stop condition.

### Verification Commands

- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage is not measurable for Markdown-only changes; state that in the report.
- No unrelated file or approved behavior changes.
- Memory is current and the final report records exact evidence and unresolved risks.
