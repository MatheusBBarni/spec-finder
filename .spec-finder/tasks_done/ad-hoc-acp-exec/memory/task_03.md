# Task Memory: task_03

## Objective Snapshot

- Implemented strict exec parsing, whole-profile runtime resolution, independent user permission projection, and the abort-aware permission broker without adding CLI routing or provider startup.

## Important Decisions

- `parseExecArguments` returns a discriminated `{ mode: "exec", prompt, overrides }` or `{ mode: "error", error }` result; repeated supported flags use the last value, and a throwing adapter is available for future command routing.
- `resolveExecConfig` accepts either an override object plus injected dependencies or a full options object. It uses `findExecWorkspace`, blocks fallback after an invalid existing repository runtime profile, and keeps the resolved host mode read-only.
- Runtime validation projects only version/provider/model/reasoning/speed; user permissions are read independently and invalid/missing values default to `prompt`.
- `PermissionRegistry` owns in-memory request state, chooses only options offered for each request, uses stderr-only interactive prompts, and settles concurrent pending requests exactly once on abort or signal cancellation.

## Learnings

- Canonical workspace discovery returns `realpath` values on macOS (`/private/...` versus `/var/...`); tests must compare canonical paths rather than lexical temp-directory strings.
- The existing packet config schema cannot be used for exec projections because repository permissions must be ignored and user permission must survive unrelated user runtime validation failures.

## Files / Surfaces

- `src/commands.ts` — pure exec parser, typed overrides, parse-error and throwing-adapter exports.
- `src/exec-config.ts` — canonical workspace/runtime/permission resolution and named config failures.
- `src/permission-registry.ts` — concurrent, TTY-aware, abort-idempotent permission broker and ACP response adapter.
- `tests/exec-args.test.ts`, `tests/exec-config.test.ts`, `tests/permission-registry.test.ts` — focused grammar, precedence, projection, TTY, concurrency, and cancellation matrices.

## Errors / Corrections

- Initial nested-invocation test used a non-existent directory and expected lexical temp paths; created the nested directory and compared `realpath` output so the test exercises the actual canonical workspace contract.

## Ready for Next Run

- Focused and full repository verification passed; no lifecycle status or report was changed. Downstream exec orchestration can consume the new contracts.
- Final-report handoff is fresh: the implementation run recorded the exact focused and full-gate results, and the runtime-owned task status remains `in_progress` for this report phase.
