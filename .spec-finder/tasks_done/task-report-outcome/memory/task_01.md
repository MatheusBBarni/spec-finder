# Task Memory: task_01

## Objective Snapshot

- Add the explicit local ACP turn-phase contract without altering ACP wire
  behavior or existing event variants.

## Important Decisions

- Event phase remains optional for legacy synthetic consumers; runtime ACP-turn
  phase is required.
- The neutral ACP wire/session lifecycle remains unchanged. The packet adapter
  forwards the required one-turn phase and also accepts an explicit per-turn
  phase on its existing multi-turn session handle so task 02 can label both
  engine turns without introducing a new event family.

## Learnings

- `runAcpTurn` is the single forwarding seam for streamed session updates.
- The fixture reuses `test-session`; phase assertions therefore validate the
  explicit field rather than session identity. Permission-response updates are
  included in report-phase forwarding coverage.

## Files / Surfaces

- `src/events.ts`, `src/acp-client.ts`, `tests/acp-client.test.ts`.

## Errors / Corrections

- No implementation or verification errors. The existing engine call site was
  intentionally left for task 02 to supply its two authoritative phases.

## Verification

- `rtk bun test tests/acp-client.test.ts` passed with 6 tests and 26
  assertions.
- `rtk bun run check` passed.
- `rtk bun run verify` passed with 297 tests and the production bundle build.

## Ready for Next Run

- Preserve concurrent batch event changes and hand explicit phase behavior to
  engine and transcript tasks.

## Final Report Handoff

- The inspected source diff is unchanged after the recorded focused, type-check,
  full verification, and diff-check evidence; no rerun was needed for reporting.
- Engine call-site phase assignment remains the intentional task_02 follow-up;
  this task establishes the additive contract and forwarding seam it consumes.
