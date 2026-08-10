# Task 01 Final Report: Add Versioned Setup Configuration and Provider Policy

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: ACP implementation handoff; live provider identity unavailable
- Scope: configuration, static setup policy, and runtime-override compatibility only. Setup argument parsing, picker behavior, filesystem writes, locks, and installer transactions remain assigned to task_02.

## Changes

- `src/config.ts` — introduced strict v3 configuration, discriminated setup state, v1/v2 in-memory migration, provider/destination cross-field validation, validated candidate serialization, and runtime-only override application.
- `src/setup-profile.ts` — added the source-controlled provider policy, logical destinations, curated model lists, universal `auto`, and approved defaults.
- `src/commands.ts` — changed `run` and batch runtime overrides to use the post-load runtime-only validator without revalidating persisted setup metadata.
- `src/exec-config.ts` — retained packet-free runtime compatibility for v3 documents while accepting v2 projections.
- `tests/config.test.ts` — added migration, strict-state, destination-pairing, serialization, custom-model, and runtime-override coverage.
- `tests/setup-profile.test.ts` — added exhaustive provider/profile/default/destination coverage.
- `tests/commands.test.ts` — added the configured-Codex plus `run --provider claude` non-mutating regression.
- `.spec-finder/tasks/single-provider-setup/memory/MEMORY.md` and `memory/task_01.md` — recorded durable policy and installer handoff facts.

Unrelated `src/ui/App.tsx` and `tests/cockpit.test.tsx` worktree edits were preserved and not absorbed into this task. Task frontmatter and report lifecycle metadata remain runtime-owned.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Strict v3 setup state, safe v1/v2 migration, and provider-derived configured destination | satisfied | `configSchema` is v3 and strict; `setup` is a strict discriminated union; legacy migration yields `setup.status: "unconfigured"`; configured scope/destination and provider pairing are validated; absolute/arbitrary destinations are outside the enum. Covered by `tests/config.test.ts` migration, invalid-state, mismatch, and candidate-serialization tests. |
| 2. Static provider policy with universal `auto`, approved defaults, and derived destinations without entitlement claims | satisfied | `src/setup-profile.ts` is pure source-controlled data: Codex `gpt-5.6-luna`/`.agents/skills`, Claude `fable`/`.claude/skills`, Cursor `auto`/`.agents/skills`; curated lists exclude universal `auto`. `tests/setup-profile.test.ts` covers every provider and default. No setup provider launch or live capability discovery was added. |
| 3. Runtime overrides apply after stored v3 parsing without mutating or revalidating setup metadata | satisfied | `applyRuntimeConfigOverrides` validates only runtime fields and retains the stored setup object; `commands.ts` uses it for single and batch runs; `tests/commands.test.ts` proves a configured Codex document runs with temporary Claude while retaining Codex destination metadata. |
| 4. Valid custom saved models remain legal runtime values without widening curated setup choices | satisfied | Runtime model validation remains non-empty-string based, while `isCuratedSetupModel` accepts only `auto` or profile entries. `tests/config.test.ts` proves custom runtime retention; setup picker/keep-action scope remains deferred to task_02. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test tests/config.test.ts tests/setup-profile.test.ts tests/commands.test.ts tests/providers.test.ts tests/acp-client.test.ts` | exit 0 | 49 passed, 0 failed, 197 assertions across 5 files. |
| `rtk bun run verify` | exit 0 | TypeScript check passed; full suite passed with 293 tests and 0 failures across 29 files; build completed and emitted `dist/cli.js`. |
| `git diff --check` | exit 0 | No whitespace errors reported. |

These results were fresh and complete in the immediately preceding implementation handoff; verification was not rerun during this report-only phase.

## Risks and Follow-ups

- Static model defaults can become stale or unavailable for a provider account; ACP/runtime outcomes remain authoritative, and `auto` remains available.
- v1/v2 migration intentionally cannot infer historic installation scope. task_02 must require an explicit scope before writing configured v3 metadata for migrated workspaces.
- task_02 owns setup resolver/picker behavior, transactional installation, traversal protection, rollback, and legacy Cursor preservation; none was implemented here.
- No native-platform, terminal-rendering, external-provider, or entitlement evidence is required for this task; the policy intentionally performs no live discovery.

## Final Verdict

Completed. Task 01 establishes and tests the strict v3 configuration/profile contract and preserves runtime override compatibility, with the required focused suite and repository verification gate passing to terminal exit. The task remains in its runtime-owned lifecycle state until Spec Finder applies the verdict.
