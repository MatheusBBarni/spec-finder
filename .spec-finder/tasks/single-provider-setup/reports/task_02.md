# Task 02 Final Report: Implement Single-Provider Setup and Safe Installation

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: Unavailable; setup intentionally performs no live provider or ACP discovery.

The implementation handoff completed the singular setup resolver, keyboard-accessible picker, provider-derived destinations, and staged installation transaction. The task frontmatter remains runtime-owned and was not changed during this report phase.

## Changes

- `src/commands.ts` — Replaced setup target-array/mode resolution with one `SetupRequest`; added singular flag validation, saved/fresh/v2 scope resolution, model and speed defaults, interactive flow, cancellation handling, and requested-value summaries.
- `src/ui/setup-picker.ts` — Added true single-select behavior with initial and required-unselected states, no Space toggling for single selects, Enter confirmation, cancellation, and raw-mode restoration.
- `src/setup.ts` — Derived `.claude/skills` and `.agents/skills` roots, added local/global traversal preflight, selected-root locking, same-parent staging, managed-entry backups, ordered commit, reverse rollback, cleanup, retained recovery artifacts, and legacy Cursor status reporting.
- `tests/commands.test.ts` — Added parser, default/reuse, v2 scope, custom-model, picker, cancellation, summary, and runtime-boundary coverage while retaining batch coverage.
- `tests/setup.test.ts` — Added the 3-provider × 2-scope destination matrix, v3 persistence, legacy/unrelated preservation, traversal, lock, and injected transaction-failure coverage.
- `.spec-finder/tasks/single-provider-setup/memory/MEMORY.md` and `memory/task_02.md` — Recorded durable setup/transaction handoff facts and the final verification evidence.

The current diff also contains unrelated checkpoint work in `src/checkpoints.ts` and `tests/checkpoints.test.ts`; those files were preserved and not modified for this task. The task file's active checkpoint and `handoff.phase: report` metadata remain lifecycle-owned.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Resolve exactly one provider; reject repeated/duplicate/conflicting inputs and `--symlink`; retain `--copy`; reuse saved intent and apply approved defaults. | Satisfied | `src/commands.ts` now parses singular provider/model/speed/scope inputs. The focused command suite covers repeated `--agent`, duplicate model/speed, conflicting scope, invalid curated model, `--symlink`, `--copy`, fresh Codex defaults, configured reruns, same-provider custom-model preservation, changed-provider defaults, and v2 scope requirements. |
| 2. Provide keyboard-accessible single-select provider, scope, model, and speed choices, including v2 scope selection and custom-model preservation without expanding the curated picker. | Satisfied | `src/ui/setup-picker.ts` and the command picker harness cover arrow/Enter navigation, one value per step, ignored Space in single-select mode, required-unselected migrated scope, cancellation, and raw-mode restoration. `tests/commands.test.ts` covers the explicit custom-model keep behavior. |
| 3. Derive provider destinations, persist configured v3 setup metadata, and summarize requested values. | Satisfied | `tests/setup.test.ts` exercises all six provider/scope combinations, installs exactly `SPEC_FINDER_SKILLS.length` (nine) managed entries, and asserts v3 `setup` scope/destination. `tests/commands.test.ts` asserts provider, requested model/speed, destination, and legacy status in the command result. |
| 4. Use lock, preflight, staging, managed backups, ordered commit, reverse rollback, retained recovery artifacts, and traversal protection. | Satisfied | `src/setup.ts` implements the transaction phases and scoped lock. `tests/setup.test.ts` covers commit/config restoration, injected stage/backup/promotion failures, local/global symlink ancestors, existing locks, and rollback/cleanup failures that retain recovery paths and withhold success. |
| 5. Preserve legacy `.cursor/skills` and unrelated skills, avoid ACP/provider discovery, and report legacy preservation. | Satisfied | The setup transaction targets only the profile-derived root and known managed entries. `tests/setup.test.ts` verifies byte-for-byte legacy and unrelated preservation and the Cursor `.agents/skills` destination; the persistence test records setup without live provider discovery, and the command summary explicitly says legacy content was preserved and not migrated. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test tests/commands.test.ts tests/setup.test.ts` | Passed | 30 tests passed, 0 failed, 162 `expect()` calls. |
| `rtk bun run verify` | Passed | TypeScript check passed; 296 Bun tests passed with 0 failures and 1,680 `expect()` calls across 29 files; Bun build emitted `dist/cli.js` at 0.33 MB. |
| `rtk git diff --check` | Passed | No whitespace errors reported. |

These results were captured immediately after implementation in the task handoff memory and were fresh at report time, so verification was not rerun.

## Risks and Follow-ups

- The setup model catalogue is static; a requested default can become unavailable for a provider account or client version. Runtime ACP outcomes remain authoritative, and summaries intentionally say “requested.”
- Global setup spans the provider-home skill root and workspace config, so recovery is ordered/best-effort rather than one cross-root atomic rename. Injected rollback and cleanup failures retain paths for operator recovery.
- Public help and README updates are intentionally deferred to task_03, as required by this task's scope.
- The repository gate did not emit a standalone coverage percentage; this report makes no numeric coverage claim beyond the focused and full behavioral test evidence.
- No native-platform, external-account, network, or live-provider evidence applies to this setup task because live discovery is explicitly out of scope.

## Final Verdict

Completed. The task-specific implementation and its focused/full terminal gates provide evidence for all five numbered obligations, including singular intent resolution, accessible selection, provider-derived v3 persistence, failure-safe installation, and preservation of legacy/unrelated content. Task status and lifecycle metadata remain under Spec Finder ownership; no unresolved blocker prevents the next lifecycle phase.
