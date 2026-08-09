# Task 07 Final Report: Add Exec Provider Launch Policy and Certification Gate

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: fixture-backed ACP tests; no live provider session was run because live certification belongs to Task 09.

Task 07's implementation boundary is complete. Provider launch resolution now carries explicit packet/exec intent, preserves packet behavior, omits packet Codex task/report guidance for exec-shaped launches, and rejects every uncertified real provider before an exec process can start. The source-owned exec certification baseline is disabled for Claude, Codex, and Cursor pending Task 09.

## Changes

- `src/providers.ts` — Added packet/exec launch modes, mode metadata, packet and exec resolver aliases, immutable argument/environment cloning, Codex instruction separation, source-owned certification registry/query/error, and fixture launch support.
- `src/exec-config.ts` — Added the pre-spawn exec launch gate and the injected-fixture adapter consumed by the packet-free exec composition boundary.
- `tests/providers.test.ts` — Added packet compatibility, exec instruction/model, certification, mode, fixture, and immutability coverage.
- `tests/exec-config.test.ts` — Added pre-spawn certification rejection and fixture-launch coverage.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` — Promoted the durable provider-mode and disabled-certification handoff.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_07.md` — Recorded implementation decisions, corrections, terminal evidence, and report-phase handoff.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Distinguish packet and exec launch contexts without changing Claude, Codex, or Cursor packet behavior. | Satisfied | `ProviderLaunchMode`, mode metadata, `resolvePacketProviderLaunch`, and the packet-default resolver preserve existing commands, model mappings, environment, and packet Codex guidance. Provider regressions and the full suite passed. |
| 2. Remove active-task/report developer instructions from exec Codex launches while preserving packet instructions. | Satisfied | Packet mode still writes `CODEX_CONFIG.developer_instructions`; exec mode omits `CODEX_CONFIG`. `tests/providers.test.ts` asserts both paths. |
| 3. Reject uncertified providers before exec process startup without affecting packet support. | Satisfied | `EXEC_PROVIDER_CERTIFICATION` is source-owned with `exec: false` for all three real providers. `resolveExecProviderLaunch` and `resolveExecLaunch` throw `ProviderCertificationError` before spawn; packet resolution remains available. Tests cover Claude, Codex, and Cursor. |
| 4. Add no provider-specific user flags, custom commands, persistent trust state, or runtime history. | Satisfied | The change adds only internal mode/certification APIs and an injected fixture seam. Certification is static source policy; no CLI flags, persistence, telemetry, or trust state were added. |
| 5. Return independent launch copies so modes cannot contaminate later invocations. | Satisfied | Resolved args/env objects are cloned per call, fixture mode is normalized, and tests mutate one result before resolving another and assert distinct arrays/maps. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test ./tests/providers.test.ts ./tests/exec-config.test.ts` | Passed | 15 tests passed, 0 failed, 42 expectations. |
| `rtk bun run check` | Passed | TypeScript `tsc --noEmit` exited 0. |
| `rtk bun run verify` | Passed | 222 tests passed, 0 failed, 1,099 expectations across 24 files; Bun build completed and produced `dist/cli.js` (241.40 KB). |
| `rtk git diff --check` | Passed | No whitespace errors reported. |

No separate coverage command was run, so no coverage percentage is claimed.

## Risks and Follow-ups

- All real exec providers remain disabled until Task 09 completes terminal live-provider certification; this is intentional and not an implementation failure.
- Live Claude/Codex/Cursor behavior, native Linux/Windows process-tree evidence, and write-capability certification were not run in this task and remain release gates.
- Injected fixture launches intentionally bypass the production certification registry for deterministic downstream integration tests; real provider resolution remains gated.
- The task frontmatter remains `status: in_progress`; Spec Finder owns status transitions. No task report existed before this report phase, and no unrelated worktree changes were altered.

## Final Verdict

Completed for the Task 07 implementation boundary. Packet and exec launch intent is explicit, packet compatibility is preserved, exec Codex task/report guidance is absent, and the disabled-by-default certification gate rejects all uncertified real providers before startup. Required focused and repository verification completed with terminal success; live provider and platform certification correctly remain assigned to Task 09.
