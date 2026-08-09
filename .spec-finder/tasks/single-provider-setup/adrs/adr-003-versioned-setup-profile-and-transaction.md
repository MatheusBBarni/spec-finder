# ADR-003: Versioned setup profile and transactional installation

## Status

Accepted

## Date

2026-08-08

## Context

Issue #2 changes `spec-finder setup` from a multi-target skill copier into a single-provider configuration flow. The current v2 runtime config persists provider, model, reasoning, speed, and permissions, but not the selected setup scope or logical skill destination. Its installer also overwrites a config before replacing managed skills with destructive remove-and-copy operations.

The new flow must persist setup intent without falsely inferring whether an existing v2 configuration was installed locally or globally. It must install one provider's managed skills in a failure-safe way, derive paths from a reviewed provider policy, preserve legacy `.cursor/skills`, and avoid live provider discovery.

## Decision Drivers

- PRD F-01 through F-06, especially validated persistence and legacy-path safety.
- PRD M-03 and M-04 require preserved intent and no observed managed or unrelated-content loss in failure paths.
- `AGENTS.md` requires strict configuration and centralized configuration behavior.
- ACP exposes runtime configuration only after session initialization; setup cannot know account entitlement offline.
- The user selected a versioned config extension, rollback-capable installation, static catalogue defaults, and an explicit legacy-scope decision.

## Evidence

| Kind | Finding | Source | Version/date |
|---|---|---|---|
| Repository | v2 config is strict but stores no installation scope or destination. | `src/config.ts` | 2026-08-08 |
| Repository | Setup writes config before it destructively replaces each managed skill. | `src/setup.ts` | 2026-08-08 |
| Repository | Runtime reports model and speed outcomes after an ACP session starts. | `src/acp-client.ts` | 2026-08-08 |
| Official docs | ACP session configuration selectors are negotiated at runtime. | [ACP announcement](https://agentclientprotocol.com/announcements/session-config-options-stabilized) | 2026-02-04 |
| Official docs | Codex publishes `gpt-5.6-luna` in its model catalogue. | [Codex model catalogue](https://github.com/openai/codex/blob/main/codex-rs/models-manager/models.json) | Accessed 2026-08-08 |
| Official docs | Claude Code supports the `fable` alias, subject to client and account availability. | [Claude Code model configuration](https://code.claude.com/docs/en/model-config) | Accessed 2026-08-08 |
| User decision | Use a versioned validated `setup` section in the existing config. | Technical clarification | 2026-08-08 |
| User decision | Stage, commit, and roll back managed skills and config; protect local and global paths. | Technical clarification | 2026-08-08 |

## Decision

Introduce config version 3. Its strict `setup` field is a discriminated state: `unconfigured` for migrated configurations whose historic scope is unknowable, or `configured` with the selected `scope` and provider-derived logical `destination`. The configured destination is validated against the selected provider; absolute paths are never stored.

Create a focused `setup-profile` module that owns static setup-only provider metadata: display label, derived relative skill destination, curated model choices, and newest default. Runtime launch/ACP code remains authoritative for actual availability.

`setupWorkspace` becomes a staged transaction. It preflights the selected root, stages only managed `sf-*` entries and a v3 config candidate beside their final locations, backs up only existing managed entries, commits skills before config, and restores prior managed entries/config on any expected commit failure. It validates both local and global path ancestry against symlink traversal. Legacy `.cursor/skills` is neither inspected as an install target nor modified.

A migrated v2 configuration remains `unconfigured`. Its first interactive setup requires a scope selection; its first non-interactive setup without `--local` or `--global` fails with actionable guidance. A fresh workspace still defaults to local scope.

## Alternatives Considered

### Optional v2 setup metadata without a version bump

- **Benefits:** Fewer migration branches and a smaller diff.
- **Costs/risks:** Weakens the strict, explicit configuration contract and cannot distinguish unknown historic state from a persisted choice.
- **Why not selected:** The user selected versioned schema evolution and PRD F-04 requires validated persisted setup information.

### Separate `.spec-finder/setup.json`

- **Benefits:** Separates runtime and installer concerns.
- **Costs/risks:** Introduces two files that must be coordinated and rolled back together.
- **Why not selected:** The user selected one versioned user-visible config document; a second file adds transaction and recovery complexity without a product benefit.

### Direct replacement or per-entry atomic replacement

- **Benefits:** Minimal implementation and fewer temporary files.
- **Costs/risks:** A later failure can leave a partial install or config that describes skills never installed.
- **Why not selected:** It fails the selected no-loss behavior and PRD M-04.

### Live provider model discovery during setup

- **Benefits:** Could reflect account-specific entitlement at that moment.
- **Costs/risks:** Requires installed/authenticated providers, adds network and latency failure modes, and contradicts the approved non-goal.
- **Why not selected:** Static requested values plus truthful ACP runtime reporting meet the product contract with fewer side effects.

## Consequences

### Positive

- A completed v3 setup records a self-consistent provider, destination, and scope.
- Old configurations do not receive an invented historic scope.
- A normal transactional failure restores the prior config and only the managed skill entries it displaced.
- Setup metadata and provider defaults have one focused owner without coupling setup to ACP negotiation.

### Negative and trade-offs

- The installer gains staging, backup, rollback, cleanup, and failure-injection test complexity.
- A v2 user must state scope once before a non-interactive rerun can continue.
- Curated choices are syntax/policy-valid, not a guarantee of provider entitlement or client-version support.

### Risks and mitigations

- **Interrupted rollback or cleanup** — preserve recoverable backup paths, report them without claiming success, and never delete unrecognized entries.
- **Stale static catalogue** — keep `auto`, document the runtime boundary, and update the profile in normal releases.
- **Concurrent setup runs** — acquire an exclusive, scoped transaction lock; fail closed with recovery guidance if it already exists.

## Reversibility and Rollback

The v2-to-v3 reader migrates in memory and preserves the original v2 file until a successful setup commits v3. A release rollback can continue reading v3 only if it retains the v3 reader; otherwise users can restore the retained pre-commit config backup. Transaction rollback restores backed-up managed entries and config automatically when all filesystem operations remain available. If automatic rollback itself fails, the installer retains stage/backup locations and reports exact recovery paths rather than deleting data.

## Implementation Notes

- `setup.destination` is logical (`.agents/skills` or `.claude/skills`), never an arbitrary or absolute user path.
- `configured` metadata must match the provider descriptor; reject edited mismatches through strict config validation.
- Validate that pairing on the persisted document only. Runtime `run` overrides are applied after the stored config loads and do not alter or re-validate setup metadata.
- Keep `--copy` compatible as the sole effective mode; reject `--symlink` and repeated `--agent` values before any writes.
- `auto` is always selectable. The initial curated defaults are Codex `gpt-5.6-luna`, Claude `fable`, and Cursor `auto`.
- Preserve a same-provider out-of-catalogue saved model only through the explicit interactive keep action or omitted non-interactive model input; do not add it to the curated model list.

## Follow-ups

- Reassess the static catalogue only when provider documentation or user evidence warrants it.
- Consider opt-in legacy Cursor migration only under a separate user-content and recovery design.

## References

- [PRD](../_prd.md)
- [ADR-001: Single-provider setup contract](adr-001-single-provider-setup-contract.md)
- [ADR-002: Safe single-provider transition](adr-002-safe-single-provider-transition.md)
