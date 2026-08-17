---
status: completed
title: Author TDD report skill
type: docs
complexity: medium
dependencies:
  - task_01
---

# Task 03: Author TDD report skill

## Overview

Add `sf-tdd-report` so a manual TDD completion claim is falsifiable. The report keeps the core report fields and adds per-slice red and green command evidence, or a task-level not-applicable reason. Core `sf-task-report` stays the non-TDD path.

## Source Artifacts

- PRD: `.spec-finder/tasks/tdd-skill-pack/_prd.md`
- TechSpec: `.spec-finder/tasks/tdd-skill-pack/_techspec.md`

<critical>
- Read `.spec-finder/tasks/tdd-skill-pack/_prd.md`, `.spec-finder/tasks/tdd-skill-pack/_techspec.md`, relevant packet ADRs, repository instructions, and current Git state before editing. These paths must contain the current packet slug in generated output.
- Treat this task's numeric ID as its canonical execution position; every declared dependency must already be completed and have a lower numeric ID.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_03.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb follow-up scope.
- Reference TechSpec sections for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST create `skills/sf-tdd-report/` with `SKILL.md`, a doctrine copy from `task_01`, and `references/tdd-report-template.md` that includes core report fields plus a TDD Evidence table (F-05, M-02).
2. MUST forbid honest `completed` when any behavioral slice lacks red and green command evidence without task-level not-applicable coverage (G-01, G-04, F-05).
3. MUST allow `completed` for not-applicable work when the one-line reason from `## TDD Plan` is repeated in the report and no theater red rows are required (US-06, M-03).
4. MUST NOT change `sf-task-report` or write task frontmatter status (F-05 MUST NOT, lifecycle constraint).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| F-05, M-02 | Red+green table or incomplete | TDD report template + HARD-GATE |
| G-04, US-06, M-03 | N/A completes without fake red | N/A report shape |
| US-02 | Visible fail then pass | Table columns for red and green |
| F-05 MUST NOT | Core report remains | No edits under `skills/sf-task-report/` |
| TechSpec sequencing step 4 | Report after doctrine | Depends on `task_01` only |

## Subtasks

- [x] 03.1 Report skill tree and template exist, including core outcome/changes/requirements/verification/risks fields.
- [x] 03.2 Behavioral completed is blocked when any slice is missing red or green command identity.
- [x] 03.3 Not-applicable completed is allowed only with the one-line reason and no invented red rows.
- [x] 03.4 Report skill does not write frontmatter status and does not edit core `sf-task-report`.
- [x] 03.5 `bun run verify` stays green.

## Implementation Details

Follow `.spec-finder/tasks/tdd-skill-pack/_techspec.md` TDD report slice table and F-05 acceptance. Evidence excerpts must stay short (command identity, result meaning, decisive snippet). Do not add a TypeScript parser. This task is parallelizable with `task_02`; do not wait for execute files.

### Relevant Files

- `skills/sf-tdd-report/SKILL.md` — create; completed gate
- `skills/sf-tdd-report/references/tdd-report-template.md` — create; core fields + TDD Evidence
- `skills/sf-tdd-report/references/tdd-doctrine.md` — create; copy of plan doctrine

### Dependent Files

- `skills/sf-tdd-plan/references/tdd-doctrine.md` — source copy from `task_01`
- `skills/sf-task-report/SKILL.md` — unchanged sibling
- `skills/sf-task-report/references/report-template.md` — fields the TDD template must still include

### Related ADRs

- [ADR-002: Self-Contained Doctrine and TDD Completion Policy](adrs/adr-002-self-contained-doctrine-and-completion-policy.md) — completed requires red+green or N/A
- [ADR-004: TDD Plan and Evidence Persistence](adrs/adr-004-tdd-plan-and-evidence-persistence.md) — N/A in plan + report only

## Deliverables

- `skills/sf-tdd-report/` with template and completed gate
- Contract review evidence for M-02 and M-03 shapes
- Updated `memory/MEMORY.md` and `memory/task_03.md` when warranted
- `reports/task_03.md` final evidence report

## Tests

### Unit Tests

- [ ] Not applicable: Markdown skill only; no TypeScript behavior change.

### Integration Tests

- [ ] Not applicable: setup allowlist is unchanged until `task_05`.

### Platform or Manual Evidence

- [ ] Given a behavioral sample report that omits red evidence for a slice, when the skill gate is applied, then `completed` is forbidden.
- [ ] Given a behavioral sample report with the same focused command failing then passing per slice, when reviewed, then `completed` is allowed.
- [ ] Given a not-applicable sample with a one-line reason and no red table rows, when reviewed, then `completed` is allowed.
- [ ] Given `skills/sf-task-report/`, when this task finishes, then those files are unchanged.
- [ ] Given the TDD template, when compared to the core template, then Outcome, Changes, Requirements, Verification, Risks, and Final Verdict remain present.

### Verification Commands

- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage is not measurable for Markdown-only changes; state that in the report.
- No unrelated file or approved behavior changes.
- Memory is current and the final report records exact evidence and unresolved risks.
