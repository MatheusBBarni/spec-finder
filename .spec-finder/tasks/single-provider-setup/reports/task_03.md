# Task 03 Final Report: Publish the Single-Provider Setup Contract

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: Unavailable; this documentation task used local source and terminal test evidence, and setup intentionally performs no live provider discovery.

## Changes

- `src/cli.tsx` — Replaced the multi-provider/symlink setup usage with the singular agent/model/speed/scope/copy grammar and added setup defaults, migration, destination, legacy-preservation, and requested-versus-runtime guidance while preserving the batch help.
- `README.md` — Rewrote the setup walkthrough and automation grammar; documented curated models, fresh and rerun behavior, v3 migration scope selection, provider-derived local/global destinations, Cursor legacy preservation, and the runtime capability boundary. Removed stale multi-select, repeated-agent, canonical-symlink, old Cursor destination, and bundled-skill-count claims. Updated the v3 configuration and CLI examples.
- `tests/cli.test.ts` — Added a documentation/help contract test covering the published syntax, defaults, migration, destinations, requested/runtime wording, rejected `--symlink`, and obsolete-claim regressions.
- `.spec-finder/tasks/single-provider-setup/memory/MEMORY.md` — Promoted the durable public setup documentation and runtime-boundary facts.
- `.spec-finder/tasks/single-provider-setup/memory/task_03.md` — Recorded the touched surfaces, final evidence, risks, and report handoff.

The task frontmatter and `handoff.phase: report` metadata remain under Spec Finder lifecycle ownership and were not changed by this report phase.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Publish one optional `--agent`, curated `--model`, `--speed auto|normal|fast`, independent scope, retained `--copy`, and rejected `--symlink` behavior in help and README. | Satisfied | `src/cli.tsx` and README use `spec-finder setup [--agent claude|codex|cursor] [--model auto|CURATED] [--speed auto|normal|fast] [--local|--global] [--copy]`; both describe pre-write rejection of repeated/duplicate/conflicting options and `--symlink`. The focused CLI/docs contract test passed. |
| 2. Document fresh/default and valid-rerun preservation, explicit v3 first-scope migration, provider-derived destinations, and requested-versus-runtime-applied wording. | Satisfied | README and help document fresh Codex/`gpt-5.6-luna`/normal/local defaults, saved-value reuse, changed-provider model defaults, v1/v2 in-memory migration with an explicit first scope, the provider destination table, and `requested model`/`requested speed` versus ACP applied/defaulted/unsupported outcomes. |
| 3. Document Cursor `.agents/skills` and preservation of legacy `.cursor/skills` without migration, cleanup, or deletion. | Satisfied | README maps Cursor to `.agents/skills` or `~/.agents/skills`, states legacy content is preserved untouched with no automatic migration, cleanup, merger, or deletion, and includes the exact `legacy Cursor skills: preserved (not migrated)` completion wording. |
| 4. Keep the documentation contract testable and remove obsolete claims. | Satisfied | `tests/cli.test.ts` asserts the shared usage and required terms, and rejects multi-select Space guidance, repeated-agent examples, canonical symlink targets, the old Cursor table row, and stale bundled-skill counts. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test tests/cli.test.ts` | Passed | 6 tests passed, 0 failed, 117 expectations. The output includes `CLI help > publishes the singular setup contract in help and README`. |
| `rtk bun run verify` | Passed | `tsc --noEmit` passed; 297 Bun tests passed, 0 failed, 1,723 expectations across 29 files; Bun build emitted `dist/cli.js` at 0.33 MB. |
| `rtk git diff --check` | Passed | No whitespace errors reported. |

These results were captured immediately after the implementation changes in the same ACP session and recorded in task memory; no verification rerun was necessary during report generation.

## Risks and Follow-ups

- The static provider model catalogue can become stale or unavailable for a particular provider account or client version. `auto` remains documented, and ACP/runtime feedback remains the authority for actual capability outcomes.
- Setup intentionally performs no live provider, network, native-platform, or provider-account validation; those evidence classes are not applicable to this task.
- The repository gate does not emit a standalone coverage percentage. The changed documentation contract is covered by the focused assertions, but no numeric coverage claim is made.
- Any future opt-in Cursor legacy migration or live setup capability discovery requires a separate product and recovery decision.

## Final Verdict

Completed. CLI help, README, and automated contract assertions now express the verified single-provider setup behavior without obsolete guidance. The required focused suite and full repository verification gate passed to terminal exit, memory is current, and lifecycle status remains with Spec Finder.
