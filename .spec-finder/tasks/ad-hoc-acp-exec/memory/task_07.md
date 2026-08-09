# Task Memory: task_07

## Objective Snapshot

- Implemented packet/exec provider launch separation and a source-owned, disabled-by-default exec certification gate without changing packet provider support.

## Important Decisions

- Kept packet launch resolution as the default and preserved the existing Codex `CODEX_CONFIG` task/report developer instruction only in packet mode.
- Kept runtime/permission resolution usable for fixture-backed tests; the pre-spawn gate lives in `resolveExecLaunch`/`resolveExecProviderLaunch`, while injected fixture launches are cloned and allowed for downstream integration tests.
- Represented certification as source-owned immutable entries for Claude, Codex, and Cursor, all `exec: false` pending task 09; no trust, telemetry, or user provider options were added.
- Kept the mode resolver pure for packet/exec instruction and model assertions, and made the explicit exec resolver the only real-launch gate; fixture copies receive the requested mode so packet and exec intent cannot bleed together.

## Learnings

- Model/environment launch copies are independently allocated; the provider registry is never returned directly, so one invocation cannot contaminate another.
- `src/exec-config.ts` provides the exec composition seam while `src/providers.ts` retains packet aliases and packet-compatible model mappings.

## Files / Surfaces

- `src/providers.ts` — mode-aware launch policy, certification registry/error/query, aliases, and immutable cloning.
- `src/exec-config.ts` — pre-spawn exec launch gate and fixture-launch adapter.
- `tests/providers.test.ts`, `tests/exec-config.test.ts` — packet regression, mode/certification, fixture immutability, and pre-spawn rejection coverage.

## Errors / Corrections

- Initial provider resolver changes exposed a TypeScript overload union and an incorrect imported alias; split the fixture/non-fixture branches and corrected the alias before verification.

## Ready for Next Run

- Focused provider/config tests, strict typecheck, and `rtk bun run verify` passed to terminal exit. Real-provider live certification remains disabled and is explicitly assigned to task 09; lifecycle status/report remain runtime-owned.
- Final-report phase consumed the implementation turn's terminal evidence without rerunning gates; the report is the only new lifecycle artifact, and task frontmatter remains `in_progress` for runtime-owned status handling.
