# Task Memory: task_01

## Objective Snapshot

- Add the explicit local ACP turn-phase contract without altering ACP wire
  behavior or existing event variants.

## Important Decisions

- Event phase remains optional for legacy synthetic consumers; runtime ACP-turn
  phase is required.

## Learnings

- `runAcpTurn` is the single forwarding seam for streamed session updates.

## Files / Surfaces

- `src/events.ts`, `src/acp-client.ts`, `tests/acp-client.test.ts`.

## Errors / Corrections

- None yet.

## Ready for Next Run

- Preserve concurrent batch event changes and hand explicit phase behavior to
  engine and transcript tasks.
