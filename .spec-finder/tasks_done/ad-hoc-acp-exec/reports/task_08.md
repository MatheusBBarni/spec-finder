# Task 08 Final Report: Integrate the Packet-Free Exec Command

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: fixture-backed mock ACP agent; no live provider session was run because provider certification belongs to Task 09.

Task 08's implementation boundary is complete. `spec-finder exec "<prompt>"` now composes one packet-free ACP v1 turn with pre-spawn configuration and certification checks, canonical workspace routing, user-owned permission handling, read-only host access, sanitized terminal output, semantic cancellation, and stable exit codes. The command does not enter packet, task, report, memory, cockpit, lock, or history lifecycles.

## Changes

- `src/exec.ts` — Added the packet-free composition root, preflight and certification gate, canonical fixture launch handling, read-only host capability, neutral ACP turn wiring, safe output publication, cancellation/error normalization, and exit-code mapping.
- `src/commands.ts` — Added strict `exec` argument parsing and the SIGINT/stream dispatch boundary.
- `src/cli.tsx` — Registered `exec` and documented its precedence, output, cancellation, no-history, and Task 09 release boundaries.
- `src/acp-turn.ts` — Extended the neutral turn request with the read-only host-access mode used to suppress advertised ACP write capability for this task.
- `src/exec-output.ts` — Preserved the specific `limited:max-turn-requests` terminal label before generic limited normalization.
- `tests/fixtures/mock-agent.ts` — Expanded lifecycle, capability, tool/thought, refusal/limit, permission, cancellation, and cleanup fixture controls.
- `tests/exec.test.ts` — Added fixture-backed success, stream separation, no-artifact, permission, cancellation, certification, launch-boundary, failure, and read-only integration coverage.
- `tests/cli.test.ts` — Added help-contract assertions for the packet-free command and its release gates.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` — Retained durable exec integration and release-gate handoff facts.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_08.md` — Recorded task decisions, corrections, and exact report-phase handoff verification.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Expose exactly one fresh packet-free ACP v1 turn with no packet, task, report, memory, cockpit, or history participation. | Satisfied | `src/exec.ts` is a packet-free composition root and does not acquire the packet run lock or call packet lifecycle code. `tests/exec.test.ts` asserts exactly `initialize`, `session/new`, and `session/prompt` and compares the `.spec-finder` packet tree before and after execution. |
| 2. Join prompt/flag parsing, configuration precedence, canonical workspace resolution, user-owned permission policy, certified launch, ACP lifecycle, and safe output without duplicating lower-level contracts. | Satisfied | `src/commands.ts`, `src/exec.ts`, `resolveExecConfig`, `resolveExecLaunch`, `PermissionRegistry`, the neutral `runAcpTurn`, `ExecOutputReporter`, and `NodeProcessSupervisor` are composed through injected boundaries. The focused and full suites passed, including the existing configuration, ACP, and engine regression coverage. |
| 3. Complete validation before spawn, launch directly without a shell, and use canonical host access without presenting approval policy as a sandbox. | Satisfied for fixture scope | Malformed invocation and uncertified-provider tests assert no supervisor spawn. The launch-boundary test asserts the canonical workspace is used for both `session/new` and provider cwd, while the fixture is passed as a direct executable/argument launch. The command forces read-only host access and documents approval policy separately from sandboxing. |
| 4. Keep progress on stderr, publish only a successful final answer on stdout, and map completed, non-success, usage/configuration, and cancelled outcomes to 0, 1, 2, and 130. | Satisfied | Success, refusal, token/turn-limit, malformed invocation, permission-denied, normalized failure, and cancellation fixtures assert stdout/stderr separation and the expected exit values. `ExecOutputReporter` publishes buffered text only for confirmed successful completion. |
| 5. Coordinate Ctrl-C through semantic `session/cancel`, pending-permission cancellation, bounded cleanup, and one terminal outcome. | Satisfied for fixture scope | The cancellation integration waits for `session/prompt`, aborts the controller, asserts one `session/cancel`, consumes trailing updates, emits one cancelled result, and returns 130. The neutral permission/supervisor suites and full verification cover pending-request settlement and cleanup contracts. Native provider/platform timing evidence remains a Task 09 release gate. |
| 6. Keep real-provider and write-capable execution gated until Task 09 certification evidence exists. | Satisfied | The certification integration test rejects an uncertified real provider before supervisor invocation. The mock agent records `writeTextFile=false`, and the orchestrator always wraps host access in a read-only capability. No real-provider certification entries or write mode were enabled. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test ./tests/exec.test.ts ./tests/commands.test.ts ./tests/acp-client.test.ts ./tests/engine.test.ts` | Passed | 45 tests passed, 0 failed, 210 expectations. |
| `rtk bun test --coverage ./tests/exec.test.ts ./tests/exec-output.test.ts ./tests/exec-args.test.ts ./tests/exec-config.test.ts ./tests/cli.test.ts` | Passed | 45 tests passed, 0 failed, 197 expectations. Coverage: `src/exec.ts` 89.47% functions / 94.59% lines; `src/exec-output.ts` 100% / 100%; `src/exec-config.ts` 90.48% / 98.99%. |
| `rtk bun run check` | Passed | TypeScript `tsc --noEmit` completed successfully. |
| `rtk bun run verify` | Passed | 235 tests passed, 0 failed, 1,161 expectations across 25 files; the Bun build bundled 27 modules and produced `dist/cli.js` at approximately 0.29 MB. |
| `rtk git diff --check` | Passed | No whitespace errors were reported for the task-owned diff. |

## Risks and Follow-ups

- All real exec providers remain disabled until Task 09 completes live Claude/Codex/Cursor certification; no live provider/session evidence is claimed here.
- Write-capable host access remains disabled until canonical containment, permission, cancellation, cleanup, and adversarial release gates pass.
- Native Linux and Windows descendant-cleanup evidence, plus the provider cancellation/output matrix and five-second live bound, remain Task 09 release blockers. Existing fixture/macOS evidence does not substitute for that matrix.
- The host capability boundary does not claim to sandbox provider-owned tools, and the approved same-user concurrent pathname replacement risk remains documented.
- The coverage command measured the principal new exec/config/output modules; no whole-repository coverage percentage is claimed.
- Task frontmatter status was not changed; Spec Finder owns the lifecycle transition.

## Final Verdict

Completed for the Task 08 implementation boundary. The packet-free exec command, fixture-backed output/permission/cancellation behavior, pre-spawn certification gate, read-only write gate, and no-artifact boundary are implemented and verified by the recorded focused and repository-wide terminal results. Real-provider, write-capability, and native cross-platform certification are intentionally deferred to Task 09 and do not invalidate this fixture-backed task verdict.
