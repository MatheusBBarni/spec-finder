# Task Memory: task_09

## Objective Snapshot

- Certification was executed as far as this host permits. The release decision is blocked because mandatory native Linux/Windows and complete live-provider/write matrices do not have terminal evidence.
- Spec Finder remains the lifecycle owner for this ACP invocation; task frontmatter and `reports/task_09.md` were intentionally left untouched.

## Important Decisions

- Do not enable any `exec` provider or guarded write capability. `EXEC_PROVIDER_CERTIFICATION` remains `false` for Claude, Codex, and Cursor, and `resolveExecConfig`/`exec.ts` remain explicitly read-only.
- Preserve packet compatibility independently of exec certification; packet provider resolution remains available and the certification tests continue to exercise that boundary.

## Learnings

- `rtk bun test ./tests/providers.test.ts ./tests/exec-config.test.ts ./tests/exec.test.ts` passed: 27 tests, 0 failures, 97 expectations.
- `rtk bun test ./tests/process-supervisor.test.ts ./tests/workspace-access.test.ts ./tests/acp-turn.test.ts ./tests/acp-client.test.ts` passed: 29 tests, 0 failures, 103 expectations. Native macOS fixture coverage includes normal closure, POSIX group cleanup, escalation/second cancellation, detached-descendant deadline handling, and cleanup confirmation; the Windows branch assertion is injected, not native Windows evidence.
- `rtk bun run check` passed. `rtk bun run verify` passed: 235 tests, 0 failures, 1,161 expectations, and the Bun build completed.
- The host is Darwin 25.6 ARM64. Native Linux and Windows certification cannot be claimed here; PowerShell and `pwsh` are absent. `cursor-agent` is absent. Claude Code 2.1.206 and a Codex binary are present, but the source ACP adapter package probe did not reach a terminal result and no live ACP matrix was certified.
- The `npx` ACP adapter probe was interrupted after it produced no terminal output (exit 130). Partial/hanging provider resolution is not certification evidence.

## Files / Surfaces

- Reviewed `src/providers.ts`, `src/exec-config.ts`, and `src/exec.ts`; no source files were changed for this task because no mandatory capability matrix passed completely.
- Updated this task memory and promoted the environment-neutral release blocker to shared memory.

## Errors / Corrections

- Do not treat provider version availability, fixture tests, injected Windows-branch tests, or a hanging `npx` probe as live/native certification. Keep the source-owned gates fail-closed.

## Ready for Next Run

- Remain blocked pending terminal evidence from native macOS/Linux/Windows process-tree matrices and complete Claude/Codex/Cursor read-only, cancellation, persistence, and guarded-write matrices on every required host/provider combination.
- Final-report handoff: `reports/task_09.md` records verdict `blocked`; task frontmatter and lifecycle status remain runtime-owned and unchanged.
