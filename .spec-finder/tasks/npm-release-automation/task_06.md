---
status: pending
title: Document release and recovery operations
type: docs
complexity: low
dependencies:
  - task_05
---

# Task 06: Document release and recovery operations

## Overview

Document the final implemented release workflow for the maintainer after its full behavior, smoke contract, and summary states are known. The runbook makes prerequisites and recovery unambiguous while retaining existing installer-facing install, setup, version, and upgrade commands.

## Source Artifacts

- PRD: `.spec-finder/tasks/npm-release-automation/_prd.md`
- TechSpec: `.spec-finder/tasks/npm-release-automation/_techspec.md`

<critical>
- Read `.spec-finder/tasks/npm-release-automation/_prd.md`, `.spec-finder/tasks/npm-release-automation/_techspec.md`, packet ADRs, repository instructions, and current Git state before editing.
- Treat `task_06` as the canonical final execution position; `task_05` must be complete first.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_06.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and retain existing installer command semantics.
- Reference TechSpec sections “Compatibility, Migration, and Rollback”, “Failure and Recovery Behavior”, and “Observability” instead of duplicating their architecture.
- Run the repository verification gate to terminal exit and record that runtime workflow proof remains external.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST document trusted-publisher/package-authority prerequisites, the `main`-only manual dispatch path, and the two approved workflow modes.
2. MUST explain complete, blocked, and partial summaries; include package/tag/Release/smoke evidence and the next recovery action.
3. MUST document no-token fallback, no automatic rollback/unpublish, exact-version deprecation, corrective release, GitHub Release update, and reconcile boundaries.
4. SHOULD preserve concise installer guidance for global install and `spec-finder upgrade` and state that first live release/Windows evidence occurs in GitHub Actions.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD F-01, US-01 | Maintainer can discover and deliberately initiate stable release. | README dispatch/runbook review. |
| PRD F-04, F-05, US-03, US-04 | Summary and public installer guidance are understandable. | README artifact/status/command review. |
| PRD F-07, US-06 | Manual recovery is truthful and actionable. | README recovery-path review. |
| TechSpec Compatibility and Rollback; Observability | Documentation matches implemented modes and result states. | Cross-check task 05 workflow behavior. |

## Subtasks

- [ ] 06.1 Add maintainer prerequisites and the exact `main`-only dispatch/release/reconcile procedure to the README.
- [ ] 06.2 Document complete, blocked, and partial result interpretation, including artifact links and cross-platform smoke evidence.
- [ ] 06.3 Add recovery instructions for reconciliation, deprecation, corrective releases, and GitHub Release updates without unpublish or token fallback.
- [ ] 06.4 Review all installer-facing commands against existing CLI behavior and the completed workflow contract.

## Implementation Details

The README is the final operator-facing source of truth, so write it only after task 05’s workflow behavior is complete. Do not promise local proof for OIDC, npm publish, GitHub Release creation, or Windows smoke. Keep the existing global installer commands intact; `upgrade` remains `spec-finder@latest` and its historical-version limitation must be described accurately.

### Relevant Files

- `README.md` — modify with final maintainer release and recovery runbook.
- `.github/workflows/release.yml` — completed workflow behavior documented by this task; do not modify unless an evidence-backed documentation mismatch requires a coordinated correction.
- `src/commands.ts` — existing installer contract used for documentation review; do not modify.

### Dependent Files

- `.spec-finder/tasks/npm-release-automation/reports/task_06.md` — records final documentation and local verification evidence.
- Future maintainers and installers — consume the README instructions and public Release footer.

### Related ADRs

- [ADR-001: Maintainer-dispatched stable npm releases](adrs/adr-001-maintainer-dispatched-stable-npm-releases.md) — trusted publishing and corrective recovery.
- [ADR-002: Guided stable-release experience](adrs/adr-002-guided-stable-release-experience.md) — maintainer summary and installer guidance.
- [ADR-003: Repository-owned release workflow and helpers](adrs/adr-003-repository-owned-release-workflow-and-helpers.md) — `main` source and reconcile boundary.

## Deliverables

- Final README maintainer runbook and recovery guidance.
- Updated `memory/MEMORY.md` and `memory/task_06.md` when warranted.
- `reports/task_06.md` final evidence report.

## Tests

### Unit Tests

- [ ] Not applicable: this task changes operator documentation only; executable behavior is covered by tasks 01–05.

### Integration Tests

- [ ] Review README commands, modes, artifact states, and recovery wording against the completed `.github/workflows/release.yml`, `package.json`, and `src/commands.ts` contracts.

### Platform or Manual Evidence

- [ ] Confirm the README distinguishes local deterministic checks from the external GitHub-hosted Ubuntu/Windows live-release evidence.

### Verification Commands

- `bun run verify`

## Success Criteria

- Documentation matches the completed workflow and does not promise destructive rollback, a token fallback, or unsupported historical-version upgrade proof.
- Existing installer commands remain unchanged; coverage is not measurable for documentation-only changes.
- `bun run verify` passes; memory and `reports/task_06.md` contain fresh evidence.
