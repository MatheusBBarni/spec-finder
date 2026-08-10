# Workflow Memory

## Current State

- Approved task packet contains `task_01` through `task_03`; task_01 implementation establishes the config/profile contract for the installer consumer.
- Task 03 implementation and verification are complete; its report handoff is active while lifecycle status remains runtime-owned.

## Shared Decisions

- Persist setup intent as strict config v3 state; do not infer historic v2 scope.
- Keep static setup policy separate from ACP/runtime capability authority.
- Treat managed-skill installation as a staged, rollback-capable operation and leave legacy Cursor paths untouched.
- v3 stores `setup.status` as `unconfigured` or `configured` with `scope` and provider-derived `.agents/skills`/`.claude/skills`; v1/v2 readers migrate in memory only.
- The reviewed static policy defaults Codex to `gpt-5.6-luna`, Claude to `fable`, and Cursor to `auto`; `auto` is universal and custom saved runtime models remain outside curated setup choices.
- Runtime `run` overrides apply after stored-config parsing through a runtime-only validator and do not revalidate or mutate persisted setup metadata.

## Shared Learnings

- Active ordered-batch edits overlap command, help, README, and test files; setup executors must preserve those changes.
- Task 02 finalizes the setup contract at one provider-derived root: Claude uses `.claude/skills`, Codex/Cursor use `.agents/skills`, and legacy `.cursor/skills` is preserved and reported as not migrated.
- Setup writes are an ordered, lock-scoped transaction across the selected skills root and workspace config; stage/backup artifacts are private and retained on rollback or cleanup failure rather than treated as success.
- Setup never launches ACP/provider discovery; model and speed in setup summaries are requested values, with runtime capability outcomes remaining the ACP authority.
- Public setup guidance now uses one `--agent`, curated `--model`, `--speed auto|normal|fast`, independent scope, and compatibility `--copy`; `--symlink` is documented as rejected. README examples intentionally avoid a bundled-skill count.
- README and help document v3 migration without guessed historic scope, provider-derived destinations, valid-rerun preservation, and Cursor `.agents/skills` with legacy `.cursor/skills` left untouched and not migrated.

## Open Risks

- Static defaults can become stale or unavailable for a provider account; runtime reporting remains the source of truth.
- Global skill roots and workspace config are different filesystem roots, so recovery is ordered/best-effort rather than a single filesystem atomic operation.
- The v3 reader must remain available across release rollback; setup policy values are requested defaults, not provider entitlement claims.

## Handoffs

- `task_01` establishes the config/profile and runtime-override contracts consumed by `task_02`; the installer should serialize configured v3 metadata with the profile destination and explicit scope.
- `task_03` consumed task_02's finalized parser, summary, destination, and error wording; its focused and full verification gates passed.
- The report phase uses the captured focused/full gates; task_03 status remains under the Spec Finder lifecycle owner.
