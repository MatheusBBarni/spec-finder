# Workflow Memory

## Current State

- Packet `tdd-skill-pack` implementation in progress. `task_01` and `task_02` delivered plan and execute. `task_03` authored `skills/sf-tdd-report/` with a byte-equivalent doctrine copy.

## Shared Decisions

- Approach A: standalone `skills/sf-tdd-*` trees, duplicated doctrine, additive `## TDD Plan`, memory notes in existing headings, TDD batch checkpoint parity, setup+contract tests.
- `spec-finder upgrade` stays npm-only; existing workspaces re-run `setup`.
- ACP `run` stays on `sf-execute-task` / `sf-task-report` in V1.
- Doctrine runtime source after setup is `skills/sf-tdd-plan/references/tdd-doctrine.md`. Later TDD skills copy that file; they do not rewrite it.

## Shared Learnings

- Upstream `/tdd` interactive seam confirmation is overridden in the vendored doctrine; seams are derived from task, TechSpec, ADRs, and any existing plan.

## Open Risks

- Four doctrine copies can drift; later TDD skill tasks must copy `skills/sf-tdd-plan/references/tdd-doctrine.md` rather than rewrite it.
- Setup `cp` fails if `task_05` runs before all four `SKILL.md` trees exist.

## Handoffs

- Next implementation: `task_04` batch skill, cloning core batch and invoking only `sf-tdd-execute` / `sf-tdd-report`.
