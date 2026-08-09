---
status: completed
title: Prove releases with platform smoke and summary
type: infra
complexity: high
dependencies:
  - task_04
---

# Task 05: Prove releases with platform smoke and summary

## Overview

Complete the workflow with isolated Ubuntu and Windows clean-install evidence and an always-run maintainer summary. A release becomes complete only when its public identity and both documented user paths are proven; otherwise its summary truthfully reports blocked or partial state and the next action.

## Source Artifacts

- PRD: `.spec-finder/tasks/npm-release-automation/_prd.md`
- TechSpec: `.spec-finder/tasks/npm-release-automation/_techspec.md`

<critical>
- Read `.spec-finder/tasks/npm-release-automation/_prd.md`, `.spec-finder/tasks/npm-release-automation/_techspec.md`, packet ADRs, repository instructions, and current Git state before editing.
- Treat `task_05` as the canonical execution position; `task_04` must be complete first.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_05.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not change existing `version`, `setup`, or `upgrade` command implementations.
- Reference TechSpec sections “End-to-End or Platform Evidence”, “Observability”, and “Failure and Recovery Behavior” instead of duplicating their architecture.
- Run focused tests, `bun run release:check`, and `bun run verify` to terminal exit.
- Do not perform a live publish, change lifecycle status, or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST run post-publication smoke on GitHub-hosted Ubuntu and Windows runners using isolated workspace, home/user-profile, global npm prefix, and executable PATH state.
2. MUST prove the installed exact package runs `spec-finder version`, `spec-finder setup`, and `spec-finder upgrade` successfully in each clean environment.
3. MUST emit an always-run plain-text final summary with source/version, package/tag/Release links when available, platform status, and exactly one recovery action.
4. MUST report `complete` only after matching artifacts and both smoke jobs pass; cancellation, preflight failure, and smoke failure must remain `blocked` or `partial`.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD G-01, F-03, F-06 | Complete identity includes clean cross-platform distribution proof. | Matrix contract tests and live-run evidence. |
| PRD G-03, F-04 | Summary is legible, linked, and recovery-aware. | Summary-policy tests. |
| PRD G-05, US-05 | V1 evidence includes Ubuntu/Windows clean install and no-publish gate. | Local gate plus workflow matrix. |
| TechSpec End-to-End Evidence; Observability | Isolated smoke and always-run result aggregation. | Workflow static tests and external runner logs. |

## Subtasks

- [ ] 05.1 Add post-publication Ubuntu/Windows matrix jobs with a temporary workspace, isolated home/profile, npm global prefix, and PATH.
- [ ] 05.2 Prove exact install, version output, workspace setup, and `@latest` upgrade behavior without relying on the release runner’s global state.
- [ ] 05.3 Aggregate candidate, artifact, and matrix results in an always-run text-first final summary with one recovery action.
- [ ] 05.4 Extend workflow-policy tests for matrix platforms, isolation controls, completion criteria, and blocked/partial summaries.

## Implementation Details

`src/commands.ts` selects `npm.cmd` on Windows and `npm` elsewhere; the workflow must let the installed command exercise that existing behavior rather than replace it. `setup` writes from the current working directory and provider locations, so smoke must use a fresh temporary project and isolated home/profile. `upgrade` deliberately targets `latest`; an old partial version after a newer stable release must not be reported as exact-version upgrade evidence.

### Relevant Files

- `.github/workflows/release.yml` — extend with platform matrix, environment isolation, and final summary job.
- `tests/release-workflow.test.ts` — extend static matrix/summary assertions.
- `src/commands.ts` — existing smoke consumer; do not modify.
- `src/setup.ts` — existing workspace/home mutation behavior exercised by smoke; do not modify.

### Dependent Files

- `README.md` — task 06 documents the exact final summary meanings and evidence boundary.
- `.spec-finder/tasks/npm-release-automation/reports/task_05.md` — required execution evidence must distinguish static checks from live matrix output.

### Related ADRs

- [ADR-001: Maintainer-dispatched stable npm releases](adrs/adr-001-maintainer-dispatched-stable-npm-releases.md) — selected clean global-install smoke contract.
- [ADR-002: Guided stable-release experience](adrs/adr-002-guided-stable-release-experience.md) — completion and partial-state presentation.
- [ADR-003: Repository-owned release workflow and helpers](adrs/adr-003-repository-owned-release-workflow-and-helpers.md) — Ubuntu/Windows proof and summary boundary.

## Deliverables

- Cross-platform smoke matrix and always-run final summary implementation with static policy coverage.
- Updated `memory/MEMORY.md` and `memory/task_05.md` when warranted.
- `reports/task_05.md` final evidence report.

## Tests

### Unit Tests

- [ ] Static workflow tests assert an Ubuntu and Windows matrix, temporary global prefix/PATH isolation, and fresh workspace/home/profile setup.
- [ ] Static workflow tests assert the smoke invokes installed `version`, `setup`, and `upgrade` rather than source-tree substitutes.
- [ ] Static workflow tests assert final summary execution on upstream failures and reject `complete` unless all artifact and platform states pass.

### Integration Tests

- [ ] `bun run release:check` and `bun run verify` remain green while workflow policy tests validate the committed YAML.

### Platform or Manual Evidence

- [ ] Run one real release workflow after external trusted-publisher setup and retain Ubuntu/Windows logs proving the three installed commands.
- [ ] Record any blocked/partial live run with its final summary and recovery action; do not represent static local evidence as Windows execution.

### Verification Commands

- `bun test tests/release-workflow.test.ts`
- `bun run release:check`
- `bun run verify`

## Success Criteria

- The workflow cannot label a release complete before both platform smoke results and all public identities are successful.
- Static policy coverage reaches at least 80% for new testable workflow-contract assertions; native Windows proof remains an explicit external evidence gate.
- Focused tests and local gates pass; memory and `reports/task_05.md` contain fresh evidence.
