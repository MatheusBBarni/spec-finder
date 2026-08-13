# Task Memory: task_02

## Objective Snapshot

- Author TDD execute skill

## Important Decisions

- Copied `skills/sf-tdd-plan/references/tdd-doctrine.md` byte-for-byte into `skills/sf-tdd-execute/references/`. Did not fork wording.
- Lifecycle split mirrors `sf-execute-task`: ACP stops after implementation, verification, and memory; manual path invokes `sf-tdd-report` then sets status to that verdict.
- Slice notes stay in existing headings only: `Important Decisions`, `Learnings`, `Ready for Next Run`. No `## TDD Slices`.

## Learnings

- Resume is driven by `Ready for Next Run`: `red done / green incomplete` reruns the same command identity; `green done → next red` starts the next slice.
- N/A with a one-line reason skips the entire red loop; missing reason is not a skip.

## Files / Surfaces

- `skills/sf-tdd-execute/SKILL.md`
- `skills/sf-tdd-execute/references/tdd-doctrine.md`

## Errors / Corrections

## Ready for Next Run

- Doctrine copy source remains `skills/sf-tdd-plan/references/tdd-doctrine.md` for `task_03` and `task_04`.
- Do not append `SPEC_FINDER_SKILLS` until `task_05`.
