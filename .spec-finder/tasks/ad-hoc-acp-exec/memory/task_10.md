# Task Memory: task_10

## Objective Snapshot

- Published the packet-free `exec` contract in CLI help and README while preserving task 09's blocked verdict: no real exec provider is certified and host access remains read-only.

## Important Decisions

- Document `claude`, `codex`, and `cursor` as schema-recognized `--provider` values, but state that all three real exec launches are rejected before spawn until complete task 09 certification exists.
- Keep direct canonical host access explicitly distinct from an OS sandbox. Describe guarded writes only as a future capability gated by complete containment, permission, cancellation, cleanup, and cross-platform/provider evidence.
- Keep M-01 and M-02 as an external ledger handoff with no telemetry, counters, trust persistence, history, or measurement file in Spec Finder.

## Learnings

- The focused contract gate `rtk bun test ./tests/cli.test.ts ./tests/commands.test.ts ./tests/exec.test.ts` passed: 33 tests, 0 failures, 196 expectations.
- `rtk bun run check` and `rtk bun run build` passed. `rtk bun run verify` reached terminal exit 1 after 236 tests: 229 passed, 7 failed in pre-existing cockpit/store rendering assertions unrelated to the documentation surfaces.
- Report-phase preflight confirmed the task remains `status: in_progress`, `reports/task_10.md` was absent before report assembly, and the implementation evidence is fresh enough that no verification rerun is required.

## Files / Surfaces

- `src/cli.tsx` — exact exec grammar, flags, precedence, streams, exits, cancellation, certification, and no-state help.
- `README.md` — workspace/permission/host boundary, recovery, persistence, compatibility/rollback, non-goals, M-03–M-07 review, and M-01/M-02 manual handoff.
- `tests/cli.test.ts` — help and README contract assertions plus parser alignment for the documented invocation.

## Errors / Corrections

- Do not treat task 09's fixture/native-macOS evidence as release readiness; README and help must remain fail-closed and read-only.
- Do not repair unrelated cockpit/store failures while executing this docs task; preserve the existing dirty worktree and surface the full-gate blocker.

## Ready for Next Run

- Final report records a blocked verdict from the repository-wide gate while preserving the task 09 certification blocker and the passing task-owned evidence; lifecycle status remains runtime-owned.
