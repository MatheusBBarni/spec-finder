---
status: pending
title: Establish secure release-workflow preflight
type: infra
complexity: high
dependencies:
  - task_02
---

# Task 03: Establish secure release-workflow preflight

## Overview

Add a manually dispatched workflow that safely establishes the stable-release boundary without yet publishing anything. It validates source identity on `main`, runs the deterministic local gate, uses reviewed action pins and least-privilege permissions, and produces candidate/state handoff for later workflow stages.

## Source Artifacts

- PRD: `.spec-finder/tasks/npm-release-automation/_prd.md`
- TechSpec: `.spec-finder/tasks/npm-release-automation/_techspec.md`

<critical>
- Read `.spec-finder/tasks/npm-release-automation/_prd.md`, `.spec-finder/tasks/npm-release-automation/_techspec.md`, packet ADRs, repository instructions, and current Git state before editing.
- Treat `task_03` as the canonical execution position; `task_02` must be complete first.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_03.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not add a release command to `src/cli.tsx`, `src/commands.ts`, ACP code, or configuration.
- Reference TechSpec sections “Workflow interface”, “Candidate preflight”, and “Security and Privacy” instead of duplicating their architecture.
- Run focused tests, `bun run release:check`, and `bun run verify` to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST create `.github/workflows/release.yml` with manual `release`/`reconcile` mode selection and a fail-closed `main` source guard.
2. MUST use a non-cancelling stable-release concurrency group, full source identity capture, deterministic candidate artifact handoff, and an always-run non-success summary path.
3. MUST use job-level least privilege and reviewed immutable action SHAs with version comments; no job may carry a long-lived npm token.
4. MUST run `bun run release:check` and `bun run verify` before any future mutating job can be eligible.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD F-01, G-02 | Deliberate maintainer entry point and source identity. | Workflow policy tests. |
| PRD F-02 | Failed candidate stops before public artifacts. | Job dependency/guard assertions. |
| TechSpec Workflow interface; Candidate preflight | Mode, `main`, candidate artifact, and preflight contract. | Parsed workflow tests. |
| TechSpec Security and Privacy | Explicit permissions and immutable action pins. | Parsed workflow tests. |

## Subtasks

- [ ] 03.1 Create the manual workflow with `release`/`reconcile` input, `main` guard, deterministic concurrency, and full checkout/source SHA handling.
- [ ] 03.2 Add read-only preflight jobs that run the established local gates and expose accepted candidate/state data for downstream jobs.
- [ ] 03.3 Pin workflow actions to reviewed commit SHAs with version comments and scope every job permission to its current need.
- [ ] 03.4 Add static workflow-contract tests that verify policy shape without claiming to emulate GitHub Actions runtime behavior.

## Implementation Details

Use the repository’s existing `yaml` dependency for static policy assertions if a parser is required; such tests must assert observable workflow contracts, not brittle formatting. The skeleton must be valid and safe when manually dispatched before task 04: it may block/summary, but no path may publish npm, write tags, or create a GitHub Release.

### Relevant Files

- `.github/workflows/release.yml` — create safe manual workflow and preflight boundary.
- `tests/release-workflow.test.ts` — create static workflow-policy tests.
- `scripts/release/check.ts` — task 02 preflight command dependency.
- `package.json` — existing script surface consumed by workflow; do not change unless required for a proven workflow invocation issue.

### Dependent Files

- `.github/workflows/release.yml` — tasks 04 and 05 extend this same file serially.
- `README.md` — task 06 documents the finalized dispatch path.

### Related ADRs

- [ADR-001: Maintainer-dispatched stable npm releases](adrs/adr-001-maintainer-dispatched-stable-npm-releases.md) — maintainer dispatch and trusted publishing boundary.
- [ADR-003: Repository-owned release workflow and helpers](adrs/adr-003-repository-owned-release-workflow-and-helpers.md) — workflow orchestration versus helper ownership.

## Deliverables

- Safe workflow skeleton and static workflow-policy tests.
- Updated `memory/MEMORY.md` and `memory/task_03.md` when warranted.
- `reports/task_03.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given the workflow document, static tests assert `workflow_dispatch` exposes only approved modes and rejects non-`main` sources before mutation jobs.
- [ ] Static tests assert concurrency does not cancel an in-progress release and action references are immutable SHA pins with version comments.
- [ ] Static tests assert preflight calls `release:check` and `verify`, and later jobs cannot run without accepted preflight output.

### Integration Tests

- [ ] Parse the committed YAML through the repository dependency and verify explicit job permissions and artifact handoff shape.

### Platform or Manual Evidence

- [ ] Document that local static validation cannot prove GitHub dispatch, token permissions, OIDC exchange, or hosted-runner behavior.

### Verification Commands

- `bun test tests/release-workflow.test.ts`
- `bun run release:check`
- `bun run verify`

## Success Criteria

- The committed workflow has no publish, Git write, or GitHub Release mutation path before task 04.
- Static policy coverage reaches at least 80% for new testable workflow-contract assertions; runtime behavior is clearly marked as external evidence.
- Focused tests and both local gates pass; memory and `reports/task_03.md` contain fresh evidence.
