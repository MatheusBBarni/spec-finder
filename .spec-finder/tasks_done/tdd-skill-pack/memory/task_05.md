# Task Memory: task_05

## Objective Snapshot

- Install TDD pack and document when-to-use

## Important Decisions

- Appended `sf-tdd-plan`, `sf-tdd-execute`, `sf-tdd-report`, `sf-tdd-batch` after `sf-batch-tasks` and before `sf-archive-tasks`.
- Did not retarget `implementationPrompt` or `reportPrompt`. Added an engine test lock for `Use the sf-task-report skill if it is installed.`
- README pipeline lists the four TDD skills, when-to-use versus core, ACP `run` stays core, and upgrade is npm-only so existing workspaces re-run setup.

## Learnings

- Setup matrix already used `SPEC_FINDER_SKILLS.length`; the title change plus explicit 13-name assertion covers M-01 without weakening the copy check.

## Files / Surfaces

- `src/setup.ts`
- `tests/setup.test.ts`
- `tests/engine.test.ts`
- `README.md`

## Errors / Corrections

## Ready for Next Run

- Packet V1 ship bar is the four trees plus allowlist, prompt locks, and README. No remaining implementation tasks in this packet.
