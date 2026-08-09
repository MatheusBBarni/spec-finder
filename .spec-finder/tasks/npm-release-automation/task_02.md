---
status: pending
title: Add no-publish release validation
type: infra
complexity: medium
dependencies:
  - task_01
---

# Task 02: Add no-publish release validation

## Overview

Provide a maintainer-runnable local `release:check` command that evaluates the actual npm dry-run package contents through the task 01 contract. It makes release-candidate evidence repeatable before a workflow exists while preserving the existing build, test, verify, and prepack behavior.

## Source Artifacts

- PRD: `.spec-finder/tasks/npm-release-automation/_prd.md`
- TechSpec: `.spec-finder/tasks/npm-release-automation/_techspec.md`

<critical>
- Read `.spec-finder/tasks/npm-release-automation/_prd.md`, `.spec-finder/tasks/npm-release-automation/_techspec.md`, packet ADRs, repository instructions, and current Git state before editing.
- Treat `task_02` as the canonical execution position; `task_01` must be complete first.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_02.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not change `verify`, `prepack`, public CLI behavior, ACP code, or configuration.
- Reference TechSpec sections “Candidate preflight” and “Testing and Evidence” instead of duplicating their architecture.
- Run focused tests, `bun run release:check`, and `bun run verify` to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST add a `release:check` script that performs only local, deterministic release-candidate validation.
2. MUST obtain and parse `npm pack --dry-run --json` output before passing packed paths to task 01 helpers.
3. MUST preserve the existing `verify` and `prepack` scripts exactly and must not invoke `npm publish`, Git mutation, GitHub APIs, or credential lookup.
4. SHOULD report a concise actionable failure for malformed pack output or allowlist failure.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD F-02, F-03 | Repeatable candidate and packed-content gate before publication. | Mocked runner and pack JSON tests. |
| PRD F-06, G-05 | No-publish release-contract evidence is independently runnable. | `bun run release:check`. |
| TechSpec Candidate preflight | Use actual local dry-run pack data without remote mutation. | Command contract tests. |
| ADR-003 | Reuse small repository-owned helpers. | Imports from task 01 module. |

## Subtasks

- [ ] 02.1 Add a deterministic release-check runner that invokes only local npm pack dry-run behavior and delegates validation to task 01 helpers.
- [ ] 02.2 Add `release:check` to `package.json` without changing existing script semantics.
- [ ] 02.3 Add focused tests with injected pack output/process seams for valid JSON, malformed JSON, rejected paths, and prohibited mutation commands.

## Implementation Details

The runner may spawn the local `npm` executable only for `pack --dry-run --json`; do not turn the command into an npm publish preflight or a registry-authority probe. Use process seams in tests rather than real registry/network execution. The successful command must remain safe to rerun from a dirty development workspace because it produces no release artifacts.

### Relevant Files

- `scripts/release/check.ts` — create local no-publish command runner.
- `tests/release-check.test.ts` — create focused runner/JSON/error tests.
- `package.json` — add `release:check`, preserving `verify` and `prepack`.
- `scripts/release/contract.ts` — task 01 contract dependency.

### Dependent Files

- `.github/workflows/release.yml` — task 03 invokes the deterministic local gate before remote operations.
- `README.md` — task 06 documents the command as no-publish evidence.

### Related ADRs

- [ADR-001: Maintainer-dispatched stable npm releases](adrs/adr-001-maintainer-dispatched-stable-npm-releases.md) — package inspection before remote publication.
- [ADR-003: Repository-owned release workflow and helpers](adrs/adr-003-repository-owned-release-workflow-and-helpers.md) — deterministic no-publish seam.

## Deliverables

- `release:check` script, no-publish runner, and test suite.
- Updated `memory/MEMORY.md` and `memory/task_02.md` when warranted.
- `reports/task_02.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given valid `npm pack --dry-run --json` data, the runner passes its paths to the allowlist and exits successfully.
- [ ] Given malformed JSON, nonzero pack exit, or unexpected paths, the runner exits nonzero with actionable text.
- [ ] Given the injected process command, it is exactly local npm pack dry-run and never `publish`, Git, or GitHub CLI work.

### Integration Tests

- [ ] `bun run release:check` completes from the repository without contacting a registry or creating a tarball/tag/release.

### Platform or Manual Evidence

- [ ] Confirm the command leaves no `*.tgz`, Git ref, npm publication, or GitHub Release mutation in the local workspace.

### Verification Commands

- `bun test tests/release-check.test.ts`
- `bun run release:check`
- `bun run verify`

## Success Criteria

- The new command proves local package selection and helper behavior with at least 80% measurable coverage for changed testable logic.
- Existing `verify` and `prepack` strings remain unchanged, and no remote release command is reachable.
- Focused tests, `bun run release:check`, and `bun run verify` pass; memory and `reports/task_02.md` contain fresh evidence.
