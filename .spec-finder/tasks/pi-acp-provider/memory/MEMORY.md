# Workflow Memory

## Current State

- Packet `pi-acp-provider` tasks approved as task_01 through task_05.
- No implementation started.

## Shared Decisions

- TypeScript closed `Record<ProviderName, …>` forces launch recipe and exec-false onto task_01 with the enum.
- `tests/cli.test.ts` shares setup usage between help and README; task_03 updates that line, task_04 owns the full Pi README section.

## Shared Learnings

## Open Risks

- Unpinned `@automatalabs/pi-acp` may differ from the issue #15 0.4.0 probe. Live packet on task_05 records the pair.

## Handoffs
