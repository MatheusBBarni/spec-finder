---
status: completed
title: Publish the CLI Contract and Release Evidence
type: docs
complexity: medium
dependencies:
  - task_04
  - task_05
---

# Task 06: Publish the CLI Contract and Release Evidence

## Overview

Document the opt-in batch command and its fail-safe semantics in CLI help and the README, and add coverage for the public help surface. Finish with the focused/full verification and acceptance evidence required to release the feature without changing the default single-slug workflow.

## Source Artifacts

- PRD: `.spec-finder/tasks/ordered-multiple-task-run/_prd.md`
- TechSpec: `.spec-finder/tasks/ordered-multiple-task-run/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ordered-multiple-task-run/_prd.md`, `.spec-finder/tasks/ordered-multiple-task-run/_techspec.md`, all three packet ADRs, repository instructions, current Git state, and completed `task_01` through `task_05` evidence before editing.
- Treat `task_04` and `task_05` as required lower-numbered dependencies; document their actual implemented behavior rather than promising unimplemented options.
- Use `sf-memory`; read `.spec-finder/tasks/ordered-multiple-task-run/memory/MEMORY.md` and `.spec-finder/tasks/ordered-multiple-task-run/memory/task_06.md` before editing and update them before finishing.
- Implement only public documentation/help and release evidence. Preserve unrelated dirty files and do not add retries, resume, parallelism, telemetry, or configuration changes.
- Reference TechSpec sections `CLI contract`, `Failure and Recovery Behavior`, `Compatibility, Migration, and Rollback`, `Testing and Evidence`, and `Observability`.
- Run focused tests and the exact repository verification gate to terminal exit. Do not mark status complete or write `reports/task_06.md`.
</critical>

<requirements>
1. MUST document exactly one opt-in `--multiple <slug1,slug2,...>` grammar, supported runtime flags, and rejection rules (F-06, G-04, US-06).
2. MUST document serial fail-fast behavior, distinct failure/cancellation outcomes, later `not_started` packets, already-complete success, no retry, and manual recovery (F-02, F-04, F-05, US-03, US-04).
3. MUST preserve the existing single-slug examples and explain that batch mode introduces no persistence, rollback, or telemetry (C-01, C-03, C-05, C-06).
4. MUST run and record the focused tests, `rtk bun run verify`, and the three-packet acceptance evidence for release review (M-03, M-05).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-04, US-06, F-06 | Help and README expose opt-in compatibility | Help test and documentation diff |
| US-03, US-04, F-04 | Recovery guidance and no retry | README/output wording review |
| F-05 | Already-complete semantics documented | README example/wording assertion |
| C-01, C-03, C-05, C-06 | Scope and non-goals remain explicit | Documentation review |
| M-03, M-05 | Release evidence and regression gate | Acceptance record and `bun run verify` |

## Subtasks

- [ ] 06.1 Update CLI help with batch grammar, runtime flags, and strict input constraints.
- [ ] 06.2 Add README command examples, outcome table, cancellation/failure guidance, no-retry statement, and compatibility/non-goal notes.
- [ ] 06.3 Add public-help tests that assert batch discoverability without removing single-run help.
- [ ] 06.4 Run focused batch, store, cockpit, command, and help tests followed by the full verification gate.
- [ ] 06.5 Perform and record the three-packet success and failure/cancellation acceptance scenario.

## Implementation Details

Keep the public grammar consistent with the parser and command behavior from `task_01` and `task_04`. Documentation must distinguish packet-level task statuses from batch-level `cancelled` and `not_started` outcomes, and must not imply automatic retry, rollback, resume, or durable history. The existing README's single-slug and `--no-ui` sections are the documentation anchors.

### Relevant Files

- `src/cli.tsx` — help usage text and batch discoverability.
- `README.md` — command examples, semantics, recovery, compatibility, and non-goals.
- `tests/cli.test.ts` — create; capture `main(["help"])` output and assert both modes are documented.

### Dependent Files

- `src/commands.ts` — actual parser/output contract from `task_04`.
- `src/ui/App.tsx` — actual cockpit wording from `task_05`.
- `.spec-finder/tasks/ordered-multiple-task-run/reports/task_01.md` through `reports/task_05.md` — prior evidence used for final report context.

### Related ADRs

- [ADR-001: Ordered Multi-Packet Run Coordinator](adrs/adr-001-ordered-multiple-task-run.md) — public ordered/fail-safe semantics.
- [ADR-002: Compact Fail-Safe Sequence Product Scope](adrs/adr-002-compact-fail-safe-sequence-product-scope.md) — manual recovery and rollout scope.
- [ADR-003: Coordinator Batch Envelope and Active Projection](adrs/adr-003-coordinator-batch-envelope-active-projection.md) — compatibility and lifecycle boundary.

## Deliverables

- Updated help and README documentation.
- Public help regression test.
- Focused/full verification and three-packet acceptance evidence.
- Factual shared and `task_06` memory updates.
- `reports/task_06.md` produced by the report phase.

## Tests

### Unit Tests

- [ ] `main(["help"])` includes both single-slug and `--multiple` usage without advertising retries or parallelism.
- [ ] Help output names supported runtime flags and strict batch input constraints.

### Integration Tests

- [ ] Documentation examples match actual `--no-ui` and cockpit outcome terminology from completed tasks.
- [ ] Existing single-run help and README examples remain present.

### Platform or Manual Evidence

- [ ] Capture all-success and failure/cancellation three-packet runs, including exit status, stopping packet, later not-started packets, and no-retry guidance.
- [ ] Confirm final evaluation evidence meets M-03 and that existing single-run verification meets M-05.

### Verification Commands

- `rtk bun test ./tests/cli.test.ts ./tests/commands.test.ts ./tests/batch.test.ts ./tests/store.test.ts ./tests/cockpit.test.tsx`
- `rtk bun run verify`

## Success Criteria

- Help and README accurately describe the implemented public contract and explicit non-goals.
- Public help regression and all focused/full verification pass to terminal exit.
- Three-packet acceptance evidence is recorded with truthful outcomes and exit behavior.
- No unrelated changes, hidden scope expansion, or contradictory documentation remains.
