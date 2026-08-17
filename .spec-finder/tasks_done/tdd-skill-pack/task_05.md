---
status: completed
title: Install TDD pack and document when-to-use
type: infra
complexity: medium
dependencies:
  - task_01
  - task_02
  - task_03
  - task_04
---

# Task 05: Install TDD pack and document when-to-use

## Overview

Register the four TDD skill trees on the managed install allowlist, prove setup copies all thirteen `SKILL.md` files, keep ACP prompts on core execute/report, and document when to use TDD versus core plus the re-run-setup note after `upgrade`. This is the V1 ship bar for install and discoverability.

## Source Artifacts

- PRD: `.spec-finder/tasks/tdd-skill-pack/_prd.md`
- TechSpec: `.spec-finder/tasks/tdd-skill-pack/_techspec.md`

<critical>
- Read `.spec-finder/tasks/tdd-skill-pack/_prd.md`, `.spec-finder/tasks/tdd-skill-pack/_techspec.md`, relevant packet ADRs, repository instructions, and current Git state before editing. These paths must contain the current packet slug in generated output.
- Treat this task's numeric ID as its canonical execution position; every declared dependency must already be completed and have a lower numeric ID.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_05.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb follow-up scope.
- Reference TechSpec sections for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST append `sf-tdd-plan`, `sf-tdd-execute`, `sf-tdd-report`, and `sf-tdd-batch` to `SPEC_FINDER_SKILLS` in that order after `sf-batch-tasks` and before `sf-archive-tasks` (F-01, M-01, TechSpec Core Interfaces).
2. MUST keep `implementationPrompt` and `reportPrompt` targeting `sf-execute-task` and `sf-task-report` (G-02, US-08, M-04).
3. MUST document the optional TDD pack, when to use TDD versus core, that ACP `run` stays on core skills, and that `upgrade` is npm-only so existing workspaces re-run `spec-finder setup` (F-06, G-05, M-05, Q1).
4. SHOULD retitle the setup test that currently says “exactly nine” so the name matches the thirteen-skill allowlist (TechSpec Testing and Evidence).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| F-01, M-01, G-05 | Four TDD skills install via setup | `SPEC_FINDER_SKILLS` + setup matrix |
| G-02, US-08, M-04 | ACP prompts stay core | Engine tests |
| F-06, US-01, US-03, M-05 | README when-to-use | README pipeline + guidance |
| ADR-003 / Q1 | Upgrade does not recopy dest | README re-setup note |
| TechSpec sequencing steps 6–8 | Allowlist after trees exist | Depends on task_01–task_04 |

## Subtasks

- [x] 05.1 Allowlist contains the four TDD names in the approved order and setup copies each `SKILL.md`.
- [x] 05.2 Setup test title and assertions cover thirteen managed skills without weakening the matrix.
- [x] 05.3 Engine implementation and report prompts still name the core skills.
- [x] 05.4 README lists the TDD pack, when-to-use, ACP default, and re-run-setup after upgrade.
- [x] 05.5 Focused setup and engine tests plus `bun run verify` pass.

## Implementation Details

Do not retarget `src/engine.ts` prompts. Do not change `src/config.ts`. `package.json` already ships `skills/`; no files-entry change. Existing setup transaction tests iterate the allowlist and should keep passing once the four trees exist.

### Relevant Files

- `src/setup.ts` — append the four TDD names to `SPEC_FINDER_SKILLS`
- `tests/setup.test.ts` — retitle “exactly nine”; keep length + `SKILL.md` access; assert TDD names
- `tests/engine.test.ts` — keep and, if missing, add report-prompt lock for `sf-task-report`
- `README.md` — pipeline rows, when-to-use, upgrade/re-setup

### Dependent Files

- `skills/sf-tdd-plan/SKILL.md` — required by setup `cp` (`task_01`)
- `skills/sf-tdd-execute/SKILL.md` — required by setup `cp` (`task_02`)
- `skills/sf-tdd-report/SKILL.md` — required by setup `cp` (`task_03`)
- `skills/sf-tdd-batch/SKILL.md` — required by setup `cp` (`task_04`)
- `src/engine.ts` — prompt strings must remain core; do not retarget
- `src/commands.ts` `upgradeCommand` — stays npm-only; document, do not recopy skills

### Related ADRs

- [ADR-001: Parallel Opt-In TDD Skill Pack](adrs/adr-001-parallel-tdd-skill-pack.md) — skill-only opt-in; ACP stays core
- [ADR-003: Standalone TDD Skill Trees and Install Contract](adrs/adr-003-standalone-tdd-skill-trees.md) — allowlist + re-run setup + contract tests

## Deliverables

- Thirteen-skill managed install
- Engine prompt contract tests still green
- README discoverability for TDD versus core
- Updated `memory/MEMORY.md` and `memory/task_05.md` when warranted
- `reports/task_05.md` final evidence report

## Tests

### Unit Tests

- [ ] Given `SPEC_FINDER_SKILLS`, when inspected, then it contains `sf-tdd-plan`, `sf-tdd-execute`, `sf-tdd-report`, and `sf-tdd-batch` in that order between `sf-batch-tasks` and `sf-archive-tasks`.
- [ ] Given the implementation prompt text captured by `tests/engine.test.ts`, when a packet run starts, then it still contains `Use the sf-execute-task skill`.
- [ ] Given the report prompt builder in `src/engine.ts`, when tested or reviewed with a lock, then it still contains `Use the sf-task-report skill if it is installed.`

### Integration Tests

- [ ] At the setup destination boundary, given each provider and local/global scope, when `setupWorkspace` completes, then `result.installed` length equals `SPEC_FINDER_SKILLS.length` and each listed skill including the four TDD names has `SKILL.md`.
- [ ] At the README surface, given a reader who has not opened issue #14, when they read the specification pipeline section, then they can choose TDD versus core and see that `run` stays on core skills.

### Platform or Manual Evidence

- [ ] Given `spec-finder upgrade` behavior in `src/commands.ts`, when README is updated, then it states upgrade refreshes the npm package only and existing workspaces must re-run `spec-finder setup`.

### Verification Commands

- `bun test tests/setup.test.ts`
- `bun test tests/engine.test.ts`
- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable (`SPEC_FINDER_SKILLS` membership is fully asserted).
- No unrelated file or approved behavior changes.
- Memory is current and the final report records exact evidence and unresolved risks.
