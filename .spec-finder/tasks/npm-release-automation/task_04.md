---
status: pending
title: Orchestrate publication and reconciliation
type: infra
complexity: high
dependencies:
  - task_03
---

# Task 04: Orchestrate publication and reconciliation

## Overview

Extend the guarded workflow so `release` publishes one new stable npm version and creates matching source/release metadata, while `reconcile` can repair only missing matching metadata and never republishes. This establishes the truthful public identity and partial-release behavior before platform smoke is added.

## Source Artifacts

- PRD: `.spec-finder/tasks/npm-release-automation/_prd.md`
- TechSpec: `.spec-finder/tasks/npm-release-automation/_techspec.md`

<critical>
- Read `.spec-finder/tasks/npm-release-automation/_prd.md`, `.spec-finder/tasks/npm-release-automation/_techspec.md`, packet ADRs, repository instructions, and current Git state before editing.
- Treat `task_04` as the canonical execution position; `task_03` must be complete first.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_04.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not modify public CLI, ACP, configuration, or installer command behavior.
- Reference TechSpec sections “Mutation and reconciliation”, “External Interfaces”, and “Failure and Recovery Behavior” instead of duplicating their architecture.
- Run focused tests, `bun run release:check`, and `bun run verify` to terminal exit.
- Do not configure npm trusted publishing, perform a live publish, change lifecycle status, or write the final report when those phases are externally owned.
</critical>

<requirements>
1. MUST permit `npm publish --access public` only in `release` mode after accepted preflight proves the exact version is absent; use OIDC and no long-lived token fallback.
2. MUST have `reconcile` prove the exact npm version is already published and then skip `npm publish` unconditionally.
3. MUST create or verify an annotated `v<version>` tag at the reviewed SHA before a GitHub Release, and reject mismatched tag/release identities without force updates.
4. MUST create generated GitHub notes plus the repository-owned package/install/upgrade footer and preserve a distinct partial state when later metadata work fails.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD F-03, F-05 | npm, tag, GitHub Release, and notes share one version. | Static workflow identity assertions. |
| PRD F-04, F-05 | Release metadata provides public guidance and artifact links. | Footer/Release workflow assertions. |
| PRD F-07, US-06 | Partial release and reconciliation remain truthful. | `release` versus `reconcile` assertions. |
| TechSpec Mutation and reconciliation | Publish, tag, Release ordering and idempotency boundary. | Parsed workflow tests and local gates. |
| ADR-001, ADR-003 | OIDC publication, no automatic rollback, no republish reconciliation. | Permission/command/static policy checks. |

## Subtasks

- [ ] 04.1 Add release-only publish orchestration that rechecks the candidate and records the exact published package identity.
- [ ] 04.2 Add exact annotated-tag creation/verification and GitHub Release metadata creation with generated notes and the fixed installer footer.
- [ ] 04.3 Add reconciliation branches that accept only matching existing npm/tag/release state, create only missing metadata, and fail closed on mismatch.
- [ ] 04.4 Extend workflow-policy tests for publish permissions, command reachability, identity checks, and the no-republish guarantee.

## Implementation Details

The implementation must keep publishing and GitHub metadata in separate least-privilege jobs. A preflight query cannot eliminate a registry race, so a duplicate-version failure remains a terminal partial/recovery outcome rather than an idempotent success. Do not rely on GitHub creating an implicit tag: verify the intended remote tag and its source SHA before Release creation. Select current reviewed action revisions only through official documentation at implementation time, then record immutable SHA pins and version comments.

### Relevant Files

- `.github/workflows/release.yml` — extend with publish, tag, Release, and reconciliation jobs.
- `tests/release-workflow.test.ts` — extend static workflow contract coverage.
- `scripts/release/contract.ts` — task 01 state/summary helper dependency.
- `scripts/release/check.ts` — task 02 candidate-gate dependency.

### Dependent Files

- `.github/workflows/release.yml` — task 05 adds platform smoke and final result aggregation.
- `README.md` — task 06 explains the implemented partial-state and recovery behavior.

### Related ADRs

- [ADR-001: Maintainer-dispatched stable npm releases](adrs/adr-001-maintainer-dispatched-stable-npm-releases.md) — OIDC, immutable npm versions, and recovery boundary.
- [ADR-002: Guided stable-release experience](adrs/adr-002-guided-stable-release-experience.md) — public guidance and legible partial state.
- [ADR-003: Repository-owned release workflow and helpers](adrs/adr-003-repository-owned-release-workflow-and-helpers.md) — explicit reconciliation design.

## Deliverables

- Release and reconciliation workflow implementation with static policy coverage.
- Updated `memory/MEMORY.md` and `memory/task_04.md` when warranted.
- `reports/task_04.md` final evidence report.

## Tests

### Unit Tests

- [ ] Static workflow tests show that a `release` publish command is gated by accepted preflight and `id-token: write` only in its publish job.
- [ ] Static workflow tests show that the `reconcile` path contains no reachable `npm publish` command and rejects absent/mismatched npm state.
- [ ] Static workflow tests show that tag verification precedes GitHub Release creation and that generated notes are supplemented with package/install/upgrade guidance.
- [ ] Static workflow tests show that mismatch paths do not force-push tags or overwrite Releases.

### Integration Tests

- [ ] `bun run release:check` and `bun run verify` remain green after workflow changes, proving local contract behavior has not regressed.

### Platform or Manual Evidence

- [ ] Record that npm OIDC, namespace ownership, tag writes, generated notes, and Release API behavior require the external live-release gate; do not claim them from static tests.

### Verification Commands

- `bun test tests/release-workflow.test.ts`
- `bun run release:check`
- `bun run verify`

## Success Criteria

- The workflow expresses one fail-closed release identity and an explicit no-republish reconciliation path.
- Static policy coverage reaches at least 80% for new testable workflow-contract assertions; no live publication occurs during implementation.
- Focused tests and local gates pass; memory and `reports/task_04.md` contain fresh evidence.
