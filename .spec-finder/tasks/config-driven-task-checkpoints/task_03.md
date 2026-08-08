---
status: pending
title: Build the safe Git checkpoint service
type: backend
complexity: high
dependencies:
  - task_01
  - task_02
---

# Task 03: Build the safe Git checkpoint service

## Overview

Create the shared Git checkpoint service that both ACP runtime and manual execution will use. It must capture temporal baselines, calculate candidate paths, stage only those paths, verify the cached diff, create a deterministic local commit, and return disabled/created/blocked outcomes without remote or safety-control bypasses.

<critical>
- Read the PRD, TechSpec, ADRs, repository instructions, current Git state, and completed task_01/task_02 evidence before editing.
- Treat this task's numeric ID as its canonical execution position; task_01 and task_02 must be completed first.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_03.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not integrate the service into runtime, CLI, UI, or archive consumers.
- Reference TechSpec §System Architecture and §Security and Privacy instead of duplicating the interface design in task code.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST parse NUL-delimited porcelain status, capture HEAD/baseline digests, and reject pre-existing or ambiguous state according to the approved clean-baseline contract.
2. MUST stage explicit temporal candidate paths, verify `git diff --cached --check` and cached path contents, and create exactly one deterministic local commit.
3. MUST return a bounded blocked outcome on Git, hook, signing, path, or baseline failure and restore candidate staging when safe; never push, change identity, bypass hooks, stash, reset, or clean.
4. SHOULD expose typed begin/complete/retry operations without introducing a new package or packet-level ledger.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD F-03/F-04/F-07 | Complete record, safety refusal, and local-only mutation boundary | Git integration fixtures |
| PRD C-02–C-05, NG-01/02/03 | No remote mutation, no failed-task commit, explicit staging, clean-baseline refusal | Negative Git tests |
| TechSpec §Core Interfaces | Shared service returns typed outcomes | TypeScript compile and unit tests |
| TechSpec §External Interfaces | Exact Git command boundary and deterministic message | Process invocation tests |
| PRD M-02 | Zero unrelated files enter commits | Temporary repository audit |

## Subtasks

- [ ] 03.1 Implement safe Git process invocation, repository-root validation, and NUL porcelain/HEAD parsing.
- [ ] 03.2 Implement baseline and temporal candidate-delta calculation with digest/path validation.
- [ ] 03.3 Implement explicit staging, cached-diff verification, deterministic commit, and candidate-only staging restoration.
- [ ] 03.4 Add typed disabled/created/blocked outcomes and bounded diagnostics.
- [ ] 03.5 Exercise Git edge cases in temporary repositories, including hooks, unusual paths, and retry drift.

## Implementation Details

Follow TechSpec §System Architecture, §External Interfaces, §Failure and Recovery Behavior, and §Security and Privacy. Use argument arrays and an explicit working directory. Keep the service independent of ACP and UI lifecycles; task_04 and task_05 own those integrations.

### Relevant Files

- `src/checkpoints.ts` — create the shared checkpoint service.
- `tests/checkpoints.test.ts` — create temporary Git repository coverage for the service.

### Dependent Files

- `src/tasks.ts` — completed in task_02; supplies metadata and update helpers.
- `src/engine.ts` — task_04 calls begin/complete/retry.
- `src/commands.ts` — task_05 exposes the same operations to the manual skill.

### Related ADRs

- [ADR-003: Shared Checkpoint Module and Task Delivery State](adrs/adr-003-shared-checkpoint-module-and-task-delivery-state.md) — shared module, temporal attribution, and task metadata.
- [ADR-001: Config-Driven Per-Task Git Checkpoints](adrs/adr-001-config-driven-task-checkpoints.md) — fail-closed local-only safety boundary.

## Deliverables

- New shared checkpoint service with typed outcomes.
- Temporary-repository unit/integration tests covering safe Git behavior.
- Updated `memory/MEMORY.md` and `memory/task_03.md` when warranted.
- `reports/task_03.md` final evidence report.

## Tests

### Unit Tests

- [ ] Parse clean, modified, staged, untracked, renamed, unusual-path, and NUL-delimited status entries.
- [ ] Reject baseline changes outside known packet-memory bootstrap paths.
- [ ] Compute candidate paths from a clean task baseline and reject path-set drift.
- [ ] Produce the exact deterministic message `chore(spec-finder): checkpoint <task_id>`.

### Integration Tests

- [ ] In a temporary repository, enabled checkpointing creates one commit containing only candidate paths.
- [ ] Dirty/staged/untracked baseline refuses without commit.
- [ ] Cached-diff check failure restores candidate staging and returns blocked.
- [ ] A failing commit hook returns blocked without bypassing the hook and can retry after the hook is removed.
- [ ] Base-HEAD drift refuses retry and does not stage.
- [ ] No remote, push, identity, `--no-verify`, stash, reset, or clean command is invoked.

### Platform or Manual Evidence

- [ ] Capture `git --version` and one native hook-failure result on the available platform.

### Verification Commands

- `bun test tests/checkpoints.test.ts`
- `bun run verify`

## Success Criteria

- The service satisfies all Git safety and local-only requirements with temporary-repository evidence.
- Focused tests and `bun run verify` pass to terminal exit.
- No runtime, CLI, UI, archive, or manual-skill behavior is changed outside the reusable service seam.
