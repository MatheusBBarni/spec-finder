# Workflow Memory

## Current State

- Task 01 and task 02 are completed and reported; task 03 is the active
  transcript-safety position, followed by cockpit projection and OpenTUI
  acceptance rendering.

## Shared Decisions

- The engine is authoritative for phase and task outcome; ACP metadata and
  report prose cannot determine completed, failed, or blocked state.
- `session_update.phase` and completed-only `task_status.reportReference` are
  additive local event fields. `AcpTurnOptions.phase` is required.
- The engine passes literal `implementation` and `report` phases to both the
  packet session seam and each turn, including retries and report-handoff
  resumes. It calculates a reference only after `assertReport` succeeds.
- The packet ACP adapter keeps its existing multi-turn session seam: callers
  may provide an explicit phase per `runTurn` while legacy session options
  remain source-compatible. Engine task 02 must pass `implementation` and
  `report` explicitly for its two turns.
- Report references require canonical workspace containment and are omitted
  when unsafe. The cockpit performs only defense-in-depth display validation.
- Canonical report references use realpath for both workspace root and target,
  derive a slash-normalized relative path, and fail closed for missing,
  control-containing, traversal, or externally resolved targets without
  changing a validated completion.
- Report session-info is not transcript content. Other unknown updates remain
  bounded, path-redacted, and control-safe.
- Engine activity/no-UI emission remains unchanged; interactive cockpit activity
  is formatted safely before display.
- Transcript projection keeps its existing `sessionId` argument and accepts the
  optional `AcpTurnPhase` as the fifth argument. Report-phase session-info is
  dropped; implementation or missing-phase session-info uses only the fixed
  `Session metadata` label.
- Explicit phase is preferred as the message/tool identity scope when present,
  so reused provider session IDs cannot merge implementation and report turns;
  legacy no-phase calls still use their session ID.
- `formatDisplayText` is the narrow reusable cockpit formatter for task 04. It
  deterministically orders structured values, removes `_meta`, redacts common
  absolute paths, neutralizes terminal controls, and caps output at 1,024
  characters with an ellipsis.

## Shared Learnings

- Current provider fixture intentionally reuses `test-session`, so session ID
  cannot identify report phase.
- The deterministic fixture accepts `SPEC_FINDER_TEST_SESSION_ID` and can emit
  a malicious report-phase `session_info_update`; engine tests observe the
  repeated session ID and explicit phase boundary.
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
- Task 02 leaves cockpit projection unchanged; later tasks consume the
  optional completed-only event reference and retain the no-UI boundary.
- Task 04 should pass each event's `sessionId` and optional phase to
  `applySessionUpdate` and reuse `formatDisplayText` for interactive activity
  reasons rather than duplicating display sanitization.
