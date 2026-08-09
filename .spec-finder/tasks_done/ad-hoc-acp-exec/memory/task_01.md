# Task Memory: task_01

## Objective Snapshot

- Added the minimal neutral ACP contracts and froze packet-facing lifecycle behavior without changing task status or creating a report.

## Important Decisions

- Kept `src/acp-turn.ts` type-only and dependency-injectable. It imports only ACP protocol types and contains no packet, task, cockpit, or process-global stream ownership.
- Preserved the current packet adapter and permission/event semantics; lifecycle counters are additive fixture observations rather than new packet events.

## Learnings

- The existing packet engine reuses one ACP process/session for implementation and report turns. The fixture counter log makes initialization/session creation/prompt counts explicit.
- Current packet runtime-option behavior for the cursor fixture emits model launch-time default plus reasoning and speed defaults; permission modes retain allow, reject, and cancelled outcomes.

## Files / Surfaces

- `src/acp-turn.ts`
- `tests/acp-turn.test.ts`
- `tests/acp-client.test.ts`
- `tests/engine.test.ts`
- `tests/fixtures/mock-agent.ts`

## Errors / Corrections

- No implementation or verification errors. The worktree contained unrelated checkpoint, UI, and packet changes; they were preserved.

## Ready for Next Run

- Focused ACP/engine tests passed (19 pass, 0 fail); neutral contract tests passed (2 pass, 0 fail); `bun run check` passed; `bun run verify` passed (159 pass, 0 fail, build succeeded).
- The recorded verification evidence is fresh and sufficient for the report phase; no lifecycle status change is authorized here.
