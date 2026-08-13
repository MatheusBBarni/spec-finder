---
status: pending
title: Author TDD doctrine and plan skill
type: docs
complexity: medium
dependencies: []
---

# Task 01: Author TDD doctrine and plan skill

## Overview

Create the first standalone TDD skill tree so operators can add or update an additive `## TDD Plan` on an existing `task_NN.md` without replacing `sf-create-tasks`. The tree must carry a slim self-contained doctrine so later TDD skills can copy it and a clean setup destination does not need a user-global `/tdd` skill.

## Source Artifacts

- PRD: `.spec-finder/tasks/tdd-skill-pack/_prd.md`
- TechSpec: `.spec-finder/tasks/tdd-skill-pack/_techspec.md`

<critical>
- Read `.spec-finder/tasks/tdd-skill-pack/_prd.md`, `.spec-finder/tasks/tdd-skill-pack/_techspec.md`, relevant packet ADRs, repository instructions, and current Git state before editing. These paths must contain the current packet slug in generated output.
- Treat this task's numeric ID as its canonical execution position; every declared dependency must already be completed and have a lower numeric ID.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_01.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb follow-up scope.
- Reference TechSpec sections for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST create `skills/sf-tdd-plan/` with `SKILL.md`, slim `references/tdd-doctrine.md`, and `references/tdd-plan-template.md` so plan works after setup without a global `/tdd` path (F-02, F-03, G-03, US-07).
2. MUST make `sf-tdd-plan` add or update `## TDD Plan` on an existing `task_NN.md` with applicability, optional one-line not-applicable reason, derived public seams, and ordered observable slice identities, without rewriting `_tasks.md` IDs or required create-tasks sections (F-03, US-04, US-06).
3. MUST vendor `/tdd` rules (red before green, one vertical slice, public seams, good tests as behavior specs) and the three stop-condition anti-patterns, and MUST override upstream interactive seam confirmation with non-interactive derivation (F-02, ADR-002).
4. SHOULD reject vague slice names such as “test happy path” when they lack observable behavior (F-03 SHOULD).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| F-02, G-03, US-07 | Self-contained doctrine in the plan tree | `references/tdd-doctrine.md` present; no required `/tdd` path |
| F-03, US-04 | Additive plan on existing tasks | Skill writes `## TDD Plan` only |
| G-04, US-06, ADR-004 | N/A + one-line reason in the plan | Plan template applicability fields |
| ADR-002 | Non-interactive seams | Doctrine override of `/tdd` confirmation |
| TechSpec sequencing step 1–2 | Doctrine then plan skill | This task produces both |

## Subtasks

- [ ] 01.1 Slim doctrine exists and names `/tdd` as origin while remaining usable without that path.
- [ ] 01.2 Plan skill can add or update `## TDD Plan` on an existing implementation task.
- [ ] 01.3 Not-applicable tasks can be recorded with exactly one reason line and no fake slices.
- [ ] 01.4 Vague slice names without observable behavior are rejected during planning.
- [ ] 01.5 Repository verification stays green with no TypeScript or core-skill role changes.

## Implementation Details

Follow `.spec-finder/tasks/tdd-skill-pack/_techspec.md` Development Sequencing steps 1–2 and the `## TDD Plan` contract in Implementation Design. Do not append `SPEC_FINDER_SKILLS` yet. Do not edit core `sf-create-tasks`, `sf-memory`, or engine prompts.

### Relevant Files

- `skills/sf-tdd-plan/SKILL.md` — create; plan contract and HARD-GATE
- `skills/sf-tdd-plan/references/tdd-doctrine.md` — create; slim vendored doctrine
- `skills/sf-tdd-plan/references/tdd-plan-template.md` — create; additive section shape

### Dependent Files

- `skills/sf-create-tasks/references/task-template.md` — required task sections that must remain intact
- `skills/sf-memory/references/memory-guidelines.md` — default headings later execute will reuse; do not change
- Upstream doctrine at the maintainer `/tdd` skill — origin text only; do not require that path at runtime

### Related ADRs

- [ADR-002: Self-Contained Doctrine and TDD Completion Policy](adrs/adr-002-self-contained-doctrine-and-completion-policy.md) — vendor doctrine; no interactive seam gate
- [ADR-004: TDD Plan and Evidence Persistence](adrs/adr-004-tdd-plan-and-evidence-persistence.md) — plan lives on the task file; N/A is not frontmatter

## Deliverables

- Installable-looking `skills/sf-tdd-plan/` tree with doctrine and plan template
- Contract evidence that plan is additive and N/A requires a reason
- Updated `memory/MEMORY.md` and `memory/task_01.md` when warranted
- `reports/task_01.md` final evidence report

## Tests

### Unit Tests

- [ ] Not applicable: this task adds Markdown skill files only; no TypeScript behavior change.

### Integration Tests

- [ ] Not applicable: `SPEC_FINDER_SKILLS` is unchanged until `task_05`, so setup will not copy this tree yet.

### Platform or Manual Evidence

- [ ] Given `references/tdd-doctrine.md`, when reviewed, then it states red before green, one vertical slice, public seams, good tests as behavior specs, and bans implementation-coupled, tautological, and horizontal slicing.
- [ ] Given the same doctrine, when an agent would follow upstream `/tdd` seam confirmation, then the vendored copy tells it to derive seams from task, TechSpec, and plan artifacts instead.
- [ ] Given `tdd-plan-template.md` and `SKILL.md`, when a behavioral task is planned, then the section lists applicability `applicable`, public seams, and ordered slice identities that name observable behavior.
- [ ] Given a non-behavioral task, when planned, then applicability is `not_applicable` with a one-line reason and no invented red slices.
- [ ] Given a slice named only “test happy path”, when planned, then the skill rejects it for lacking observable behavior.

### Verification Commands

- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage is not measurable for Markdown-only changes; state that in the report.
- No unrelated file or approved behavior changes.
- Memory is current and the final report records exact evidence and unresolved risks.
