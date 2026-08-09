# Task 05 Final Report: Extract the ACP v1 Turn Core and Preserve Packet Semantics

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: mock ACP fixture; report handoff from the same ACP session. Live provider certification is unavailable and remains downstream work.

Task 05 extracted the ACP v1 negotiation, authentication, session configuration, one-prompt turn, semantic cancellation, optional close, permission settlement, and supervised cleanup into a packet-free neutral core. `runAcpTurn` now uses an explicit packet compatibility adapter, preserving packet events, permission behavior, workspace policy, and engine outcomes. The implementation phase left terminal focused and repository-wide verification evidence; this report phase consumed that evidence without rerunning fresh gates.

## Changes

- `src/acp-turn.ts` — Added the neutral ACP v1 lifecycle owner with protocol-version validation, advertised authentication, absolute-cwd session creation, complete config-option replacement, one prompt, update consumption, raw stop reasons, injected permission/workspace/supervisor contracts, semantic cancellation, bounded optional close, and typed cleanup outcomes.
- `src/acp-client.ts` — Rebuilt the packet-facing compatibility adapter. It maps neutral activity and updates to `RunEvent`, preserves packet permission and lexical workspace behavior, and translates provider/cleanup failures at the per-turn boundary while retaining callback stop errors.
- `src/process-supervisor.ts` — Used the canonical supervised process seam and corrected direct-descendant escalation fallback for the packet/core cleanup contract.
- `src/engine.ts` — Applied the narrow packet retry-handoff correction required to replace a crashed provider session before phase retry consumes a dead session.
- `tests/acp-turn.test.ts` — Added neutral-core coverage for the import boundary, protocol mismatch, advertised auth, complete config replacement, optional close, stop-reason categories, semantic cancellation, pending-permission settlement, trailing updates, and cleanup failure.
- `tests/acp-client.test.ts` and `tests/engine.test.ts` — Preserved and extended packet permission, runtime-option, process-failure, cancellation, retry, and engine-outcome regressions.
- `tests/process-supervisor.test.ts` and `tests/fixtures/mock-agent.ts` — Covered supervised cleanup behavior and deterministic ACP protocol/auth/config/close/cancel/stop-reason/provider-process modes.
- `package.json` and `bun.lock` — Pinned `@agentclientprotocol/sdk` exactly to `1.2.1`; ACP callers use stable v1 root imports.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` and `memory/task_05.md` — Recorded durable lifecycle, adapter, cleanup, platform-risk, and verification handoff facts.

The worktree contains unrelated pre-existing packet, checkpoint, CLI, UI, and other task changes; they were preserved and are not attributed to Task 05.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Negotiate ACP v1, authenticate only through advertised methods, create one fresh absolute-cwd session, reconcile complete config state, and send exactly one prompt. | Satisfied | `src/acp-turn.ts` validates protocol `1`, selects only advertised auth, validates absolute workspace/provider cwd, creates one session, replaces rather than merges config-option state after responses/updates, and exposes one-prompt `runAcpTurn`. `tests/acp-turn.test.ts` covers protocol rejection before `session/new`, advertised auth ordering, config replacement, and one-prompt lifecycle logs. |
| 2. Send semantic `session/cancel`, settle pending permissions once, consume trailing updates, and escalate only after semantic grace. | Satisfied locally; live-provider certification pending | The neutral cancellation coordinator sends one `session/cancel`, calls the injected permission broker's cancellation once, continues update consumption during the two-second grace, and uses injected supervised cleanup after grace expiry. The mock-provider semantic-cancellation test asserts the cancelled stop reason, one permission settlement, cancel notification, and trailing update; supervisor tests cover bounded/idempotent escalation. Live Claude/Codex/Cursor cancellation remains a release matrix. |
| 3. Call `session/close` only when advertised, bound it, and distinguish semantic stop from transport/process/cleanup failure. | Satisfied locally; cross-platform certification pending | `src/acp-turn.ts` gates `session/close` on the advertised capability, bounds it with the one-second close timeout, preserves the raw stop reason, and returns typed cleanup failure separately. Tests assert close present/absent behavior and that an `end_turn` with failed supervision has `cleanup: "failed"` and `outcome: "failed"` rather than a successful result. |
| 4. Adapt neutral events/results back to packet-facing `runAcpTurn` without importing packet types into the core. | Satisfied | `tests/acp-turn.test.ts` asserts the core source does not import `./events.ts`; `src/acp-client.ts` owns the `RunEvent` translation and packet permission/workspace adapter. The focused packet and engine suites preserve the frozen task_01 lifecycle, permission, retry, cancellation, and outcome behavior. |
| 5. Pin `@agentclientprotocol/sdk` exactly to `1.2.1` and use stable ACP v1 root imports. | Satisfied | `package.json` declares `"@agentclientprotocol/sdk": "1.2.1"`; `bun.lock` resolves the same exact version; `src/acp-turn.ts` imports the SDK from its stable root and uses protocol version `1`. |
| 6. Preserve packet runtime-option and permission behavior while keeping exec-specific policies injectable. | Satisfied for this task boundary | The adapter keeps packet runtime-option launch behavior and `PacketPermissionBroker`; neutral requests accept injected runtime, permission, workspace, supervisor, signal, and event contracts. Packet tests cover approve-all, deny, prompt/cancellation, and runtime-option events. Exec rendering, routing, and provider certification remain outside this task. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test ./tests/acp-turn.test.ts ./tests/acp-client.test.ts ./tests/engine.test.ts ./tests/process-supervisor.test.ts ./tests/workspace-access.test.ts ./tests/permission-registry.test.ts` | Passed | 47 tests, 0 failures, 206 expectations. |
| `rtk bun run check` | Passed | TypeScript `tsc --noEmit` completed successfully after the final source changes. |
| `rtk bun run verify` | Passed | 205 tests, 0 failures, 1,024 expectations across 23 files; the Bun build completed and produced `dist/cli.js` at 240.19 KB. |
| `rtk git diff --check` | Passed | No whitespace errors reported. |

The handoff evidence was complete and fresh after the final implementation fixes, so verification was not rerun during the report phase. No separate coverage command was run; no coverage percentage is claimed.

## Risks and Follow-ups

- Native descendant-cleanup evidence is currently macOS-only. Linux and Windows process-tree certification remain the explicit Task 09 release gate; the focused suite's Windows branch is simulated/injected rather than native Windows evidence.
- Live provider certification, including cancellation, authentication, optional close, permission, and persistence behavior for Claude, Codex, and Cursor, remains downstream work. The mock fixture does not substitute for that matrix.
- Exec-specific output rendering, CLI routing, exit mapping, and provider certification are intentionally not included; Tasks 06 and 08 consume the neutral seam.
- The accepted same-user concurrent pathname replacement race remains in the canonical workspace threat model and is not claimed as an OS sandbox.
- Exact SDK pinning is deliberate; future SDK upgrades require a new ACP compatibility and provider verification task.
- Changed testable logic was exercised by focused and full suites, but coverage was not separately measured.
- The broad dirty worktree was preserved; unrelated changes should be isolated before any commit or release review.

## Final Verdict

Task 05 is completed for its implementation boundary: one neutral ACP v1 lifecycle owns protocol/session behavior, cancellation, permission settlement, optional close, and supervised cleanup; the packet adapter preserves the existing `runAcpTurn` contract; the SDK is exactly pinned; and the required focused and full repository gates passed with terminal evidence. This report does not claim live-provider or universal platform certification, which remain downstream release work. Task frontmatter remains runtime-owned and was not changed by the report phase.
