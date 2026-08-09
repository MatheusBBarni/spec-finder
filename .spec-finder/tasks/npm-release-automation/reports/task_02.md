# Task 02 Final Report: Add no-publish release validation

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: same ACP session; provider identity unavailable
- Outcome: Added a maintainer-runnable `release:check` command that evaluates the actual local npm dry-run package report through the Task 01 release contract without publication or remote-release operations.

## Changes

- `scripts/release/check.ts` — Added the fixed `npm pack --dry-run --json` process seam, lifecycle-prefixed JSON parser, packed-path and candidate validation delegation, concise failure handling, offline temporary npm-cache environment, and success CLI output.
- `tests/release-check.test.ts` — Added injected-process tests for valid prefixed output, malformed and structurally invalid reports, nonzero exits, process failures, rejected paths, invalid identity, and prohibited mutation commands.
- `package.json` — Added `release:check` as `bun run scripts/release/check.ts`; the existing `verify` and `prepack` script strings remain unchanged.
- `.spec-finder/tasks/npm-release-automation/memory/MEMORY.md` — Preserved durable release-check handoff and parser behavior for downstream workflow tasks.
- `.spec-finder/tasks/npm-release-automation/memory/task_02.md` — Recorded implementation decisions, the managed-cache correction, touched surfaces, and exact terminal evidence.

The worktree contains unrelated pre-existing changes, including an existing dependency pin and runtime-owned task handoff metadata. They were preserved and are not attributed to Task 02. Task frontmatter status remains runtime-owned and no remote release action was performed.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Add a local deterministic `release:check` script. | Satisfied | `package.json` exposes `release:check`; `bun run release:check` exited 0 and reported `spec-finder@0.1.0` with 35 packed paths. |
| 2. Obtain and parse `npm pack --dry-run --json` before passing paths to Task 01 helpers. | Satisfied | `scripts/release/check.ts` invokes the exact command, accepts npm lifecycle progress before its JSON array, parses `files[].path`, then calls `validatePackedPaths` and `validateCandidate`; the valid-output test asserts normalized `package/package.json`. |
| 3. Preserve `verify`/`prepack` and avoid publish, Git, GitHub, and credential operations. | Satisfied | Existing script strings are unchanged. The injected command test observes exactly `npm pack --dry-run --json` and asserts no `publish`, `git`, or `gh` command; the runner uses npm offline settings and contains no remote-release or credential lookup path. |
| 4. Report actionable malformed-output and allowlist failures. | Satisfied | Focused tests cover malformed/empty/structurally invalid JSON, nonzero npm exit diagnostics, process failure, and unexpected packed paths; the runner emits bounded actionable error text. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `bun test tests/release-check.test.ts` | Passed, exit 0 | 8 tests passed, 0 failed, 17 expectation calls. |
| `bun run release:check` | Passed, exit 0 | Printed `release:check passed: spec-finder@0.1.0 (35 packed paths)`. The command ran the local dry-run path only. |
| `bun run verify` | Passed, exit 0 | `bun run check`, the full Bun suite, and the build completed; 256 tests passed, 0 failed, 1,334 expectation calls, and `dist/cli.js` bundled successfully. |
| `git diff --check` | Passed, exit 0 | No whitespace errors reported. |
| Workspace artifact check | Passed | `find . -maxdepth 1 -name '*.tgz' -print` produced no output after `release:check`; the command did not create a tarball. |

## Risks and Follow-ups

- Live npm trusted-publisher/OIDC configuration, package ownership, Git tag and GitHub Release behavior, and Ubuntu/Windows clean-install smoke remain external or downstream workflow gates; this local task does not prove them.
- The runner uses a temporary offline npm cache because the managed workstation's default npm cache contains root-owned files. This keeps the command rerunnable without relying on that user-owned cache.
- The broad dirty worktree remains user-owned and should be isolated before any commit or release review.
- No separate repository coverage threshold is configured; the focused suite covers all specified runner behaviors, while process-spawn and CLI-wrapper execution is evidenced by the real `release:check` integration run.

## Final Verdict

Completed. The local release-check command, package script, and deterministic test suite satisfy all four numbered requirements, preserve the existing verification and prepack contracts, and passed the focused test, real no-publish check, repository verification gate, and whitespace check to terminal exit. Lifecycle status and subsequent workflow/report ownership remain with Spec Finder.
