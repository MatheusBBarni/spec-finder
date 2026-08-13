# Workflow Memory

## Current State

- Packet `tdd-skill-pack` has approved `_prd.md`, `_techspec.md`, ADRs 001–004, and an approved five-task graph. Implementation has not started.

## Shared Decisions

- Approach A: standalone `skills/sf-tdd-*` trees, duplicated doctrine, additive `## TDD Plan`, memory notes in existing headings, TDD batch checkpoint parity, setup+contract tests.
- `spec-finder upgrade` stays npm-only; existing workspaces re-run `setup`.
- ACP `run` stays on `sf-execute-task` / `sf-task-report` in V1.

## Shared Learnings

## Open Risks

- Four doctrine copies can drift; later TDD skill tasks must copy `skills/sf-tdd-plan/references/tdd-doctrine.md` rather than rewrite it.
- Setup `cp` fails if `task_05` runs before all four `SKILL.md` trees exist.

## Handoffs

- Next implementation: `task_01` doctrine + `sf-tdd-plan`.
