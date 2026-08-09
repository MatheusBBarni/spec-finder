# Workflow Memory

## Current State

- The approved packet contains five pending tasks in canonical order: phased
  ACP contract, engine reference issuance, transcript safety, cockpit state
  projection, and final OpenTUI acceptance rendering.

## Shared Decisions

- The engine is authoritative for phase and task outcome; ACP metadata and
  report prose cannot determine completed, failed, or blocked state.
- `session_update.phase` and completed-only `task_status.reportReference` are
  additive local event fields. `AcpTurnOptions.phase` is required.
- Report references require canonical workspace containment and are omitted
  when unsafe. The cockpit performs only defense-in-depth display validation.
- Report session-info is not transcript content. Other unknown updates remain
  bounded, path-redacted, and control-safe.
- Engine activity/no-UI emission remains unchanged; interactive cockpit activity
  is formatted safely before display.

## Shared Learnings

- Current provider fixture intentionally reuses `test-session`, so session ID
  cannot identify report phase.
- Current batch/store code uses packet-qualified internal task keys; preserve
  the active-packet stale-event fence when adding phase/reference fields.
- Full repository gate is `rtk bun run verify`; visible cockpit work requires
  captured OpenTUI frame evidence.

## Open Risks

- Canonical `realpath` proof may fail or resolve outside workspace; omission is
  correct and must not fail an otherwise validated completion.
- ACP v1 rejects unknown wire variants; fallback coverage is for supported
  adapter/test-level unknown values, not a protocol upgrade claim.

## Handoffs

- Complete task_01 before task_02 or task_03.
- task_02 and task_03 may proceed in parallel after task_01.
- Complete task_03 before task_04, then complete task_02 and task_04 before
  task_05.
