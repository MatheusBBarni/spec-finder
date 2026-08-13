# Task Memory: task_01

## Objective Snapshot

- Author TDD doctrine and plan skill

## Important Decisions

- Vendored slim doctrine from maintainer `/tdd` and replaced the interactive seam confirmation rule with non-interactive derivation from task, TechSpec, ADRs, and any existing `## TDD Plan`.
- Plan skill writes or replaces only the additive `## TDD Plan` section. Required create-tasks headings, `_tasks.md` IDs, and frontmatter status stay untouched.
- Not-applicable plans require exactly one reason line and empty Seams/Slices so later execute/report copies have a single source shape.

## Learnings

- Upstream `/tdd` still requires user-confirmed seams; ADR-002 and this packet override that for batch and unattended use.
- Vague identities such as "test happy path" are rejected in the plan HARD-GATE, not by a parser.

## Files / Surfaces

- `skills/sf-tdd-plan/SKILL.md`
- `skills/sf-tdd-plan/references/tdd-doctrine.md`
- `skills/sf-tdd-plan/references/tdd-plan-template.md`

## Errors / Corrections

## Ready for Next Run

- Doctrine file is the copy source for `task_02`–`task_04`. Copy bytes; do not rewrite.
- Do not append `SPEC_FINDER_SKILLS` until `task_05`.
