# Task 03 Final Report: Resolve Exec Invocation, Runtime, and Permission Policy

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: unavailable; evidence comes from local Bun tests and injected TTY/config fixtures

Task 03 adds the packet-free exec parser, canonical runtime and permission projections, and the per-turn permission broker. The implementation remains independent from CLI dispatch, provider startup, ACP transport, output rendering, and capability certification as required by the task boundary.

## Changes

- `src/commands.ts` — Added pure strict exec parsing, typed runtime overrides, discriminated parse failures, and a throwing adapter; existing command routing remains unchanged.
- `src/exec-config.ts` — Added canonical workspace-bound runtime resolution, complete-profile precedence, final override validation, independent user permission projection, safe `prompt` fallback, and named configuration errors.
- `src/permission-registry.ts` — Added the in-memory `PermissionBroker` implementation for agent and host-write requests, once-scoped option preference, TTY-aware prompting, noninteractive fail-closed behavior, and exactly-once abort settlement.
- `tests/exec-args.test.ts` — Added strict grammar and repeated-override error matrix.
- `tests/exec-config.test.ts` — Added repository/user precedence, invalid-repository blocking, nested canonical workspace, override revalidation, and independent permission projection coverage.
- `tests/permission-registry.test.ts` — Added approve-all/deny/prompt, TTY, concurrency, host-write, signal, and abort-race coverage.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` and `memory/task_03.md` — Recorded durable resolver/broker contracts, handoffs, and final verification context.

Unrelated pre-existing worktree changes were preserved and are not attributed to Task 03.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Accept exactly one non-empty prompt and only the four supported runtime flags; reject missing values, unknown flags, and extra positionals before execution. | Satisfied | `parseExecArguments` returns an error branch without executable context for missing/blank prompts, option-like or missing values, unknown flags, and extra positionals. The focused parser suite covers each matrix row and repeated values use the last occurrence. |
| 2. Select a complete repository or user runtime profile without field merging, block fallback past an invalid repository profile, and revalidate explicit overrides. | Satisfied | `resolveExecConfig` uses `findExecWorkspace`, selects repository before user only when the repository projection is valid, refuses an invalid existing repository profile, and validates the final override projection. `tests/exec-config.test.ts` covers repository, user fallback, invalid repository, nested invocation, and overrides. |
| 3. Keep permission authority user-owned and independent from unrelated runtime fields; ignore repository permissions and default unusable user permission to `prompt` without presenting it as sandboxing. | Satisfied | `projectUserPermission` reads only the user projection, repository permission fields are not consulted, invalid unrelated user runtime fields do not discard a valid user permission when repository runtime is selected, and invalid permission falls back to `prompt`. `ResolvedExecContext` keeps `permission` separate from `hostAccess`, which remains explicitly `read-only`. |
| 4. Support concurrent requests, prefer once-scoped offered options, fail closed without an interactive terminal, and settle pending requests exactly once on abort. | Satisfied | `PermissionRegistry` prefers `*_once`, uses rejection/cancellation in noninteractive `prompt` mode, multiplexes concurrent input through one reader, and idempotently settles all pending requests on `cancelPending()` or an abort signal. The permission suite covers concurrency, TTY/non-TTY behavior, host-write aliases, and abort races. |
| 5. Inject cwd, home, input, output, and cancellation dependencies for deterministic tests. | Satisfied | Resolver options inject `cwd`, `home`, config reading, and workspace discovery; `PermissionRegistry` injects input/output, interactive mode, and `AbortSignal`; parser behavior is pure. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test ./tests/exec-args.test.ts ./tests/exec-config.test.ts ./tests/permission-registry.test.ts ./tests/config.test.ts ./tests/commands.test.ts` | Passed | 44 passed, 0 failed, 153 expect calls. |
| `rtk bun run check` | Passed | `tsc --noEmit` completed successfully; the same check also passed inside the final verify gate. |
| `rtk bun run verify` | Passed | 189 passed, 0 failed, 968 expect calls across 22 files; Bun build bundled 20 modules successfully (`dist/cli.js`, 209.37 KB). |
| `rtk bun test --coverage ./tests/exec-args.test.ts ./tests/exec-config.test.ts ./tests/permission-registry.test.ts` | Passed | 22 passed, 0 failed, 70 expect calls; `src/exec-config.ts` measured 99.45% lines and `src/permission-registry.ts` measured 91.38% lines (84.78% functions). |
| `rtk git diff --check` | Passed | No whitespace errors reported. |

## Risks and Follow-ups

- Exec host access remains explicitly read-only until the downstream containment, permission, cancellation, cleanup, and release-certification gates pass.
- This task does not wire the broker into the shared ACP lifecycle or CLI/provider orchestration; Tasks 05 and 08 must consume these contracts without reintroducing packet config loading or repository-owned permission authority.
- Live provider behavior, cross-platform descendant cleanup, and real interactive-provider evidence remain release work owned by later tasks, especially Tasks 04, 07, and 09.
- The approved hostile same-user pathname replacement race in canonical workspace access remains a documented residual risk from Task 02.
- The worktree remains intentionally dirty with unrelated user-owned changes; no unrelated files were reverted.

## Final Verdict

Task 03 is completed: strict invocation parsing, whole-profile runtime selection, independent user permission authority, and the abort-aware exactly-once permission registry are implemented and covered by focused matrices. The required focused tests, TypeScript check, coverage run, whitespace check, and full verification gate all passed to terminal exit. Task frontmatter status remains runtime-owned `in_progress`, and no lifecycle status was changed by this report phase.
