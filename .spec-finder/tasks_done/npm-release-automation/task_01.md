---
status: completed
title: Define deterministic release-contract helpers
type: infra
complexity: medium
dependencies: []
---

# Task 01: Define deterministic release-contract helpers

## Overview

Create the pure release-contract layer that turns candidate metadata and observed remote state into explicit, testable decisions. This gives the later workflow deterministic package validation, reconciliation behavior, installer guidance, and maintainer summaries without adding release behavior to the public CLI.

## Source Artifacts

- PRD: `.spec-finder/tasks/npm-release-automation/_prd.md`
- TechSpec: `.spec-finder/tasks/npm-release-automation/_techspec.md`

<critical>
- Read `.spec-finder/tasks/npm-release-automation/_prd.md`, `.spec-finder/tasks/npm-release-automation/_techspec.md`, the packet ADRs, repository instructions, and current Git state before editing.
- Treat `task_01` as the canonical execution position; it has no dependencies.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_01.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not add release commands to `src/cli.tsx`, `src/commands.ts`, ACP code, or configuration.
- Reference TechSpec sections “Implementation Design”, “Data Models and Lifecycle”, and “Security and Privacy” for design details instead of duplicating them.
- Run focused tests and `bun run verify` to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST provide pure typed helpers for stable candidate validation, packed-file allowlisting, remote-state classification, installer footer generation, and text-first release-summary formatting.
2. MUST reject malformed input, prerelease/invalid versions, unsafe or unexpected packed paths, unknown states, and mismatched public identities without network or mutation work.
3. MUST distinguish `release` from `reconcile`, including the rule that reconciliation cannot authorize a publish.
4. SHOULD make formatter output sufficient for a workflow summary to identify package, tag, GitHub Release, smoke state, and one recovery action without exposing credentials.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD F-02, F-03 | Candidate and packed-content gates fail before mutation. | Validator and allowlist unit cases. |
| PRD F-03, F-07 | One explicit identity/state model distinguishes release and reconciliation. | State-transition table tests. |
| PRD F-04, F-05 | Summary and installer footer are concise and complete. | Formatter unit cases. |
| TechSpec Core Interfaces; Security and Privacy | Helpers are pure, typed, fail-closed, and secret-free. | No-network helper surface and tests. |

## Subtasks

- [ ] 01.1 Create a focused `scripts/release/` contract module with explicit candidate, packed-path, remote-state, and summary result types.
- [ ] 01.2 Encode stable-version, safe packed-path, release/reconcile, and public-identity rules as pure fail-closed behavior.
- [ ] 01.3 Add deterministic Bun fixtures covering accepted, rejected, partial, and recovery states.
- [ ] 01.4 Ensure all helper modules are imported by the test suite so the current TypeScript include policy type-checks them.

## Implementation Details

Use the TechSpec’s explicit state model; do not perform npm, Git, GitHub API, environment, or filesystem mutation from the helper module. The expected packed-file contract must account for npm’s implicit `package/package.json` alongside the repository’s `dist`, `skills`, `README.md`, and `LICENSE` package entries.

### Relevant Files

- `scripts/release/contract.ts` — create pure release-contract helpers.
- `tests/release-helpers.test.ts` — create deterministic Bun tests importing every helper module.
- `package.json` — relevant package identity and published-file contract; do not modify in this task.
- `tsconfig.json` — current include policy requires helpers to be reached from tests.

### Dependent Files

- `scripts/release/check.ts` — task 02 consumes candidate and packed-path helpers.
- `.github/workflows/release.yml` — tasks 03–05 consume classification and formatter output.
- `src/version.ts` — existing package-metadata consumer; remains unchanged.

### Related ADRs

- [ADR-001: Maintainer-dispatched stable npm releases](adrs/adr-001-maintainer-dispatched-stable-npm-releases.md) — fail-closed stable-release boundary.
- [ADR-003: Repository-owned release workflow and helpers](adrs/adr-003-repository-owned-release-workflow-and-helpers.md) — helpers stay outside the user-facing CLI.

## Deliverables

- Pure release-contract helper module and deterministic test suite.
- Updated `memory/MEMORY.md` and `memory/task_01.md` when warranted.
- `reports/task_01.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given a stable `package.json` identity and allowed paths, validation accepts the candidate and derives `v<version>`.
- [ ] Given prerelease, malformed, or mismatched identity input, validation returns a blocking reason.
- [ ] Given `package/package.json`, `dist/cli.js`, `skills/**`, `README.md`, and `LICENSE`, the allowlist accepts; given traversal or another file, it rejects.
- [ ] Given every `release`/`reconcile` remote-state combination, classification accepts only safe transitions and rejects unknown or mismatched states.
- [ ] Given complete, blocked, and partial inputs, the summary includes artifact state and one next action with no secret-bearing data.

### Integration Tests

- [ ] Import all helpers from `tests/release-helpers.test.ts` and confirm `bun run check` reaches their TypeScript types.

### Platform or Manual Evidence

- [ ] Not applicable: this task is deliberately pure and performs no remote or platform operation.

### Verification Commands

- `bun test tests/release-helpers.test.ts`
- `bun run verify`

## Success Criteria

- Pure helpers cover all approved candidate/state/formatter contracts with at least 80% measurable coverage for new testable logic.
- No user CLI, ACP, config, npm registry, Git, or GitHub state is changed.
- Focused tests and `bun run verify` pass to terminal exit; memory and `reports/task_01.md` contain fresh evidence.
