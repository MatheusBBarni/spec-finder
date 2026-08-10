# ADR-002: Safe single-provider transition

## Status

Accepted

## Date

2026-08-08

## Context

ADR-001 selected a full, reliability-focused single-provider setup contract. Product clarification established three consequential policies that determine how users experience the new contract: a non-interactive setup default, a provider model default, and the behavior of reruns that encounter legacy Cursor skill paths.

The selected approach must meet issue #2 without silently deleting user content or launching an agent during setup merely to discover dynamic capabilities.

## Decision Drivers

- Existing valid setup intent should remain stable on a non-interactive rerun.
- A fresh non-interactive workspace still needs one deterministic provider default.
- Default model choice must be provider-aware and understandable to users.
- The destination change for Cursor must not destroy or silently migrate user-owned content.
- The selected product approach must retain the full issue #2 scope.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | Setup currently defaults non-interactively to every provider and accepts repeated provider flags. | `src/commands.ts` | 2026-08-08 |
| Repository | The existing default runtime configuration uses Codex. | `src/config.ts` | 2026-08-08 |
| Repository | Current Cursor skills are installed below `.cursor/skills`; managed skill replacement is destructive before copying or linking. | `src/setup.ts` | 2026-08-08 |
| External | Codex documents `.agents/skills`; Claude Code documents `.claude/skills`; Cursor supports `.agents/skills`. | https://developers.openai.com/codex/skills; https://code.claude.com/docs/en/skills; https://forum.cursor.com/t/support-for-agent-folder-compatibility/154167 | Accessed 2026-08-08 |
| User decision | If `--agent` is omitted, reuse the valid configured provider or default to Codex. | PRD clarification, 2026-08-08 | 2026-08-08 |
| User decision | Default to the newest model in Spec Finder's maintained provider catalogue. | PRD clarification, 2026-08-08 | 2026-08-08 |
| User decision | Preserve valid saved model and speed when their non-interactive flags are omitted; apply the newest catalogue default only for fresh setup or a newly selected provider. | PRD clarification, 2026-08-08 | 2026-08-08 |
| User decision | Every setup run uses the new derived destination, preserves legacy paths untouched, and reports that no automatic migration occurred. | PRD clarification, 2026-08-08 | 2026-08-08 |
| User decision | Select the safe single-provider transition over fresh-workspace-only or guided migration approaches. | PRD approach selection, 2026-08-08 | 2026-08-08 |

## Decision

Adopt the safe single-provider transition:

- Non-interactive setup without `--agent` uses the provider from a valid existing configuration; a fresh workspace defaults to Codex.
- Setup presents the newest model in Spec Finder's maintained catalogue as the default for a fresh setup or newly selected provider, while retaining `auto` as a user-selectable option and keeping runtime capability validation truthful. A non-interactive rerun that omits model and speed preserves valid saved values.
- Every setup run derives and uses the selected provider's current destination. It leaves existing `.cursor/skills` content untouched and explicitly communicates that migration was not performed.
- The MVP includes the complete single-provider setup experience, persistence, documentation, and protective installation behavior from ADR-001. It does not introduce a migration wizard or live provider capability discovery.

## Alternatives Considered

### Fresh-workspace simplification

- **User value:** Minimal behavioral change for existing repositories.
- **Costs/risks:** Reruns retain the ambiguous legacy contract and create inconsistent outcomes between old and new workspaces.
- **Why not selected:** It does not provide the consistent single-provider setup outcome requested for all setup runs.

### Guided legacy-path migration

- **User value:** Could consolidate skills into the new destination.
- **Costs/risks:** Needs user-content ownership rules, recovery behavior, and added decision friction.
- **Why not selected:** The verified problem is setup ambiguity, not legacy-directory cleanup; preserving paths meets the reliability goal with less scope.

## Consequences

### Positive

- Reruns honor a developer's existing provider intent.
- Reruns also preserve valid saved model and speed intent unless the developer explicitly changes it.
- Fresh non-interactive setup remains deterministic.
- Users see a provider-relevant default model without live setup side effects.
- Existing Cursor skill paths survive the transition unchanged.

### Negative and trade-offs

- Spec Finder must maintain a current provider model catalogue.
- Users with legacy paths may have both old and new directories until they choose to clean up manually.
- Users still need runtime feedback when a preserved or requested model is no longer available from a provider.

### Risks and mitigations

- **Model catalogue becomes stale** — retain `auto`, document the default's release version, and report runtime unsupported outcomes clearly.
- **Rerun changes destination unexpectedly** — show the resolved destination and no-migration notice before completion.
- **User assumes legacy skills were moved** — use concise summary text that explicitly says legacy paths were preserved and not migrated.

## Reversibility

The product contract can be revised in a future setup release. No automatic migration means there is no user-content rollback to perform. A future migration capability requires new evidence and a separate product decision.

## Follow-ups

- Define the user-visible provider model catalogue and its release-update expectation.
- Define the exact setup summary language for reused defaults and preserved legacy paths.
- Translate the approved product behavior into a technical specification.

## References

- [ADR-001: Single-provider setup contract](adr-001-single-provider-setup-contract.md)
- GitHub issue #2: https://github.com/MatheusBBarni/spec-finder/issues/2
- [Codex skills documentation](https://developers.openai.com/codex/skills)
- [Claude Code skills documentation](https://code.claude.com/docs/en/skills)
- [Cursor `.agents/skills` support](https://forum.cursor.com/t/support-for-agent-folder-compatibility/154167)
