# Task Memory: task_05

## Objective Snapshot

- Extracted the ACP v1 protocol/session lifecycle into `src/acp-turn.ts` and rebuilt `src/acp-client.ts` as the packet compatibility adapter without moving packet events, task IDs, or packet host-path policy into the neutral core.

## Important Decisions

- The neutral core owns v1 initialize validation, advertised authentication, one fresh absolute-cwd session, complete config-option replacement, prompt/update consumption, raw stop reasons, capability-gated bounded close, and supervised cleanup.
- `withAcpTurnSession` is the reusable session owner for packet implementation/report handoffs; public `runAcpTurn` executes exactly one prompt. `SessionCallbackError` preserves adapter callback failures such as packet cancellation and report-stop semantics while lifecycle failures remain typed neutral errors.
- Semantic cancellation sends `session/cancel` once, settles the injected permission broker once, consumes trailing updates during the two-second grace, and escalates through the injected supervisor only after grace expiry. Cleanup and close failures remain distinct from the semantic stop reason.
- The packet adapter maps only neutral lifecycle events needed by the existing `RunEvent` contract, retains lexical packet workspace access and permission behavior, and adapts provider/cleanup failures to `AcpProcessExitError` at the per-turn boundary so crashed providers can be replaced before phase retry consumes a dead session.
- `@agentclientprotocol/sdk` is pinned exactly to `1.2.1`; the implementation uses stable ACP v1 root imports.

## Learnings

- Provider connection-close errors must be normalized against `SupervisedProcess.closed` inside the neutral turn loop; waiting until the outer SDK connection rejects causes the packet phase loop to consume the dead session instead of replacing it.
- Forced POSIX group escalation can return `EPERM` after the group leader exits while a tracked descendant remains. Falling back to direct signals for the supervised PID/recorded descendants preserves bounded cleanup and confirmation without signalling an unrelated host group.
- Absolute workspace and provider cwd validation belongs at the neutral session boundary so every ACP session is created with a real absolute cwd.

## Files / Surfaces

- `src/acp-turn.ts`
- `src/acp-client.ts`
- `src/process-supervisor.ts`
- `src/engine.ts` (packet process-retry handoff correction required by the adapter contract)
- `tests/acp-turn.test.ts`
- `tests/acp-client.test.ts`
- `tests/engine.test.ts`
- `tests/process-supervisor.test.ts`
- `tests/fixtures/mock-agent.ts`
- `package.json`, `bun.lock`

## Errors / Corrections

- The first focused run exposed four regressions: provider-crash retries stayed on a dead session, cancelled report handoffs were normalized as transport failures, and immediate idempotent supervisor escalation reported `failed`. Normalizing process closure inside `runSessionTurn`, preserving callback errors, adapting per-turn packet failures, correcting the packet retry handoff accounting, and adding direct descendant escalation resolved them.
- Temporary ACP/fixture diagnostics were removed before final verification.

## Ready for Next Run

- Required focused command passed: `rtk bun test ./tests/acp-turn.test.ts ./tests/acp-client.test.ts ./tests/engine.test.ts ./tests/process-supervisor.test.ts ./tests/workspace-access.test.ts ./tests/permission-registry.test.ts` — 47 tests, 0 failures, 206 expectations.
- `rtk bun run check` passed after the final source changes.
- `rtk bun run verify` passed after the final source changes — 205 tests, 0 failures, 1,024 expectations, and the Bun build completed (`dist/cli.js`, 240.19 KB).
- Task frontmatter and `reports/task_05.md` remain runtime-owned; no completion status or final report was written by this implementation phase.
- Report-phase handoff: the focused and repository verification results above were produced after the final implementation fixes and are the evidence basis for `reports/task_05.md`; no rerun is required unless the evidence becomes stale.
