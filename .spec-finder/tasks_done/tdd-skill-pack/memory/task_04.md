# Task Memory: task_04

## Objective Snapshot

- Author TDD batch skill

## Important Decisions

- Cloned core batch workflow and swapped invoke targets to `sf-tdd-execute` and `sf-tdd-report` only.
- Checkpoint policy stays config-owned `auto_commit` plus `spec-finder checkpoint begin/complete`. No Git logic in the skill.
- Codex wrapper lives at `skills/sf-tdd-batch/agents/openai.yaml` matching core batch's display pattern.

## Learnings

- Core `sf-batch-tasks` must stay untouched. A missing `sf-tdd-execute` is a stop, not a fallback to core execute.

## Files / Surfaces

- `skills/sf-tdd-batch/SKILL.md`
- `skills/sf-tdd-batch/references/tdd-doctrine.md`
- `skills/sf-tdd-batch/agents/openai.yaml`

## Errors / Corrections

## Ready for Next Run

- `task_05` appends the four TDD names to `SPEC_FINDER_SKILLS` and documents when-to-use.
