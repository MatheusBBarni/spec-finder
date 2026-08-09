# Task 01 Final Report: Freeze Packet ACP Behavior and Define Neutral Turn Contracts

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: mock ACP provider fixture; live provider/session identity unavailable

Task 01 established the packet-free ACP turn seam and added deterministic regression coverage for the packet adapter and engine lifecycle. The active `runAcpTurn` implementation was intentionally left in place for the later extraction task, and packet/UI ownership was not moved into the new module.

## Changes

- `src/acp-turn.ts` — Added type-only, dependency-injectable contracts for runtime context, host access, permissions, supervisor/process cleanup, neutral events, turn requests/results, and execution outcomes.
- `tests/acp-turn.test.ts` — Verified that the contract module has no runtime packet/process-global dependencies and that its host, permission, supervisor, request, and result boundaries can be composed through injection.
- `tests/acp-client.test.ts` — Froze packet lifecycle counters, runtime-option events, permission outcomes, session updates, and terminal results for the existing ACP adapter.
- `tests/engine.test.ts` — Froze the successful implementation/report turn boundary and substantive-report completion requirement, including lifecycle counters.
- `tests/fixtures/mock-agent.ts` — Added deterministic `initialize`, `session/new`, and `session/prompt` lifecycle logging through `SPEC_FINDER_TEST_LIFECYCLE_LOG`.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` and `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_01.md` — Recorded the neutral seam, preserved packet adapter ownership, lifecycle observations, verification evidence, and handoff guidance.
- `.spec-finder/tasks/ad-hoc-acp-exec/reports/task_01.md` — Recorded this evidence-backed final report.

Other pre-existing dirty worktree changes, including checkpoint, batch, UI, and packet changes outside this task's owned surfaces, were preserved and are not attributed to Task 01.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Create task-neutral turn, event, outcome, host-access, permission, and supervisor contracts without task IDs, packet events, cockpit state, or terminal rendering policy. | Satisfied | `src/acp-turn.ts` contains only neutral TypeScript contracts and type-only ACP protocol imports. `tests/acp-turn.test.ts` dynamically imports it and observes no runtime exports/dependencies (`Object.keys(module) === []`). `rtk bun run check` passed. |
| 2. Freeze current packet initialization, session, prompt, runtime-option, permission, event, and result behavior. | Satisfied | `tests/acp-client.test.ts` asserts `initialize`, `session/new`, and `session/prompt` ordering; model/reasoning/speed default runtime-option events; approve-all allow, deny reject, and prompt cancellation behavior; session updates; and terminal stop results. The focused ACP/engine suite passed 19 tests. |
| 3. Prove successful packet execution owns separate implementation and report turns and completes only after a substantive report, without defining lexical containment or direct-child cleanup as new contracts. | Satisfied | The successful-task test in `tests/engine.test.ts` observes two prompts (`session/prompt` twice), one ACP process identity, completed task state, and a substantive final report. No new neutral contract asserts host lexical containment or direct-child cleanup; process-tree certification remains assigned to later tasks. |
| 4. Keep the neutral seam minimal and dependency-injectable. | Satisfied | `src/acp-turn.ts` exposes injectable `WorkspaceAccess`, `PermissionBroker`, `ProcessSupervisor`, `ProviderLaunch`, `AcpTurnRequest`, and `AcpTurnResult` interfaces without packet/UI imports. `tests/acp-turn.test.ts` composes these boundaries directly. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test ./tests/acp-client.test.ts ./tests/engine.test.ts` | Passed | 19 passed, 0 failed, 103 expect calls. |
| `rtk bun test ./tests/acp-turn.test.ts` | Passed | 2 passed, 0 failed, 3 expect calls. |
| `rtk bun run check` | Passed | TypeScript `tsc --noEmit` completed successfully. |
| `rtk bun run verify` | Passed | Check passed; full Bun suite passed with 159 passed, 0 failed, 871 expect calls across 18 files; Bun build succeeded and bundled 20 modules. |
| `rtk git diff --check` | Passed | No whitespace errors reported. |

The verification evidence above was produced immediately before this report phase and remains fresh; no verification command was rerun.

## Risks and Follow-ups

- `runAcpTurn` remains the active packet implementation by design. Task 05 must adapt/extract it through `src/acp-turn.ts` while preserving the frozen packet behavior and keeping packet events in the adapter.
- This task does not certify cross-platform process-tree cleanup or live-provider behavior. Those platform/process guarantees belong to Tasks 04 and 09.
- The neutral module is contracts-only at this stage; it does not implement one-turn exec behavior, host hardening, or the guarded write/cancellation gates assigned to later tasks.
- The repository remains intentionally dirty with unrelated user-owned changes. They were preserved, and the full verification gate passed against the resulting worktree.

## Final Verdict

Task 01 is completed: the neutral ACP contract seam and packet-visible regression baseline are present, the required focused suites and repository verification gate passed with the exact results above, and no lifecycle status change was made. Later extraction work must consume these contracts rather than redefine them.
