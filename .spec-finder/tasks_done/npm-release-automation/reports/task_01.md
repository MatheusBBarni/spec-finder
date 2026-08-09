# Task 01 Final Report: Define deterministic release-contract helpers

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: ACP runtime handoff from the same session; provider identity unavailable
- Outcome: Added the pure, typed release-contract layer for candidate validation, packed-file allowlisting, remote-state classification, installer guidance, and text-first summaries. The implementation performs no network, filesystem, npm, Git, GitHub, CLI, ACP, or configuration work.

## Changes

- `scripts/release/contract.ts` — Added stable-version and package-identity validation, explicit packed-path normalization/allowlisting, release/reconcile state transitions, installer footer generation, and secret-safe summary formatting.
- `tests/release-helpers.test.ts` — Added deterministic Bun fixtures for accepted/rejected candidates and paths, all 54 release/reconcile state combinations, unknown-state blocking, footer output, complete/partial summaries, and secret omission.
- `.spec-finder/tasks/npm-release-automation/memory/MEMORY.md` — Recorded durable release-identity, allowlist, reconciliation, and downstream handoff decisions.
- `.spec-finder/tasks/npm-release-automation/memory/task_01.md` — Recorded task-local decisions, touched surfaces, corrections, and exact verification evidence.
- `.spec-finder/tasks/npm-release-automation/reports/task_01.md` — Added this evidence-backed final report.

The current worktree contains unrelated pre-existing packet, runtime, CLI, UI, and task changes; they were preserved and are not attributed to Task 01. The runtime-owned `task_01.md` frontmatter transition to `in_progress` with `handoff: phase: report` is present in the current diff. This report phase did not change task status.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Provide pure typed helpers for candidate validation, packed-path allowlisting, remote-state classification, installer footer generation, and text-first release summaries. | Satisfied | `scripts/release/contract.ts` exports typed result/data models and the required helper surface. `tests/release-helpers.test.ts` imports every public helper and the repository TypeScript check reaches the module through the test include graph. |
| 2. Reject malformed input, prerelease/invalid versions, unsafe/unexpected paths, unknown states, and mismatched public identities without network or mutation work. | Satisfied | Candidate and path tests cover prerelease, malformed, mismatched, traversal, unsafe separator, duplicate, incomplete, and unexpected inputs. State tests cover unknown values and mismatch blocking. The helper has no process, network, filesystem, npm, Git, or GitHub imports or calls; protected CLI/ACP/config/package surfaces were not changed by this task. |
| 3. Distinguish `release` from `reconcile`, with reconciliation unable to authorize publication. | Satisfied | The 54-case transition table covers both modes across all npm/tag/Release state combinations. Only an all-absent `release` state returns `action: "publish"` and `canPublish: true`; every accepted `reconcile` result has `canPublish: false`, and mismatches/unsafe states are blocked. |
| 4. Make formatter output identify package, tag, GitHub Release, smoke state, and one recovery action without credentials. | Satisfied | Footer tests assert the public package link plus exact install and upgrade guidance. Complete-summary tests assert package/tag/Release links, source, preflight, smoke, and a single next-action line; partial-summary tests assert recovery wording and omission of a token-bearing URL/action. Falsely complete summaries are rejected. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `bun test tests/release-helpers.test.ts` | Passed, exit 0 | Bun 1.3.13 ran 11 tests in 1 file: 11 passed, 0 failed, 118 expectation calls. |
| `bun run check` | Passed, exit 0 | `tsc --noEmit` completed without TypeScript diagnostics and type-checked the imported `scripts/release/` helper. |
| `bun run verify` | Passed, exit 0 | The exact repository gate ran `bun run check && bun test && bun run build`: 248 tests passed, 0 failed, 1,317 expectation calls; the build bundled 27 modules into `dist/cli.js` (0.29 MB). |
| `git diff --check` | Passed, exit 0 | No whitespace errors were reported in the implementation handoff diff check. |
| Platform/manual evidence | Not applicable for Task 01 | This task is deliberately pure. npm publication, GitHub/OIDC behavior, tag/Release mutation, and Ubuntu/Windows smoke remain later workflow or external readiness gates. |

The report phase consumed the immediately preceding implementation handoff evidence and did not rerun already-fresh verification. No separate coverage command was run, so no numeric coverage percentage is claimed; the focused fixtures exercise the required helper branches and the complete state-transition matrix.

## Risks and Follow-ups

- Live npm registry, trusted-publisher/OIDC, Git tag, GitHub Release, and platform smoke behavior remain unproven by this pure task and belong to downstream release tasks/external readiness.
- Task 02 should consume `validateCandidate` and `validatePackedPaths` from a local `npm pack --dry-run --json` check without adding mutation or credential behavior.
- The broad dirty worktree should remain isolated before any commit or release review; unrelated changes were preserved.

## Final Verdict

Completed. All four numbered requirements are satisfied within the Task 01 boundary, the focused and repository verification gates passed to terminal exit with the evidence recorded above, and the pure helper surface preserves the approved CLI/ACP/config and no-network boundaries. Remaining live-release and cross-platform concerns are explicit downstream follow-ups, not blockers for this task.
