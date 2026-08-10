# ADR-001: Single-provider setup contract

## Status

Accepted

## Date

2026-08-08

## Context

Spec Finder setup currently treats Claude, Codex, and Cursor as a multi-provider skill-installation selection. Interactive setup uses a multi-select, non-interactive setup defaults to every provider, and repeated `--agent` flags are accepted. The runtime configuration is already singular: it has one provider, model, and speed. This makes a newly installed workspace ambiguous about the provider that its default runtime configuration represents.

Issue #2 requires one canonical provider per setup, an explicit provider-derived destination, separate local/global scope selection, provider-aware model and speed setup, persistence, and updated tests and documentation. The selected direction is the full, reliability-focused issue scope rather than a picker-only subset or live provider discovery during setup.

## Decision Drivers

- A setup invocation must produce one unambiguous provider/model/speed intent.
- Codex and Cursor support `.agents/skills`; Claude uses `.claude/skills`.
- Actual ACP model and speed capabilities can be advertised only after session initialization.
- A reliability-focused V1 cannot replace managed skill entries destructively and leave partial state after a failure.
- The user selected the full single-provider contract on 2026-08-08.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | Setup defaults to all providers, accepts repeated `--agent`, and prompts with a multi-select. | `src/commands.ts` | 2026-08-08 |
| Repository | Skill paths currently map Claude to `.claude/skills`, Codex to `.agents/skills`, and Cursor to `.cursor/skills`; setup installs a list of targets. | `src/setup.ts` | 2026-08-08 |
| Repository | Strict runtime config already stores one provider, model, and speed. | `src/config.ts` | 2026-08-08 |
| Repository | Runtime ACP configuration validates advertised model and speed choices after session initialization. | `src/acp-client.ts` | 2026-08-08 |
| External | Codex documents repository and user skills under `.agents/skills`. | https://developers.openai.com/codex/skills | Accessed 2026-08-08 |
| External | Claude Code documents project and personal skills under `.claude/skills`. | https://code.claude.com/docs/en/skills | Accessed 2026-08-08 |
| External | Cursor staff confirmed support for `.agents/skills`. | https://forum.cursor.com/t/support-for-agent-folder-compatibility/154167 | 2026-03-11 |
| External | ACP session configuration selectors for models and related settings are stable. | https://agentclientprotocol.com/announcements/session-config-options-stabilized | 2026-02-04 |
| User decision | Primary user is a developer initializing one repository; V1 is a quick, reliability-focused full issue scope; automated behavior coverage defines release success. | Idea clarification, 2026-08-08 | 2026-08-08 |
| User decision | Select the full single-provider contract over a picker-only alternative and live discovery during setup. | Opportunity decision, 2026-08-08 | 2026-08-08 |

## Decision

Deliver the full single-provider setup contract from issue #2:

- Each interactive or non-interactive setup resolves exactly one provider; repeated or conflicting provider flags fail clearly.
- The setup flow displays the selected provider's derived skill destination: `.agents` for Codex and Cursor, `.claude` for Claude. Local/global scope remains an independent decision.
- Setup persists the selected provider, requested model, speed, destination, and scope in the runtime configuration or an appropriate validated setup configuration. The technical specification will select the precise representation without persisting absolute paths or provider commands.
- The model flow always includes `auto` and constrains explicit values by provider policy. ACP remains authoritative for the model and speed values actually supported by a launched agent; setup does not launch a provider merely to populate choices.
- Copy/symlink behavior remains compatible with a single destination, but installation and configuration writes must preserve unrelated skills and avoid destructive automatic migration of existing Cursor directories.
- Tests and documentation cover the complete accepted behavior, including invalid input, cancellation, local/global paths, persistence, and truthful runtime outcomes.

## Alternatives Considered

### Essence-first picker

- **Benefits:** Smaller change that quickly removes multi-select UI and repeated flags.
- **Costs/risks:** Leaves model/speed persistence, safe-write behavior, and parts of the issue acceptance criteria unresolved.
- **Why not selected:** The user explicitly chose the full contract rather than an incomplete subset.

### Hybrid with live provider capability discovery

- **Benefits:** Could enumerate currently advertised model and speed values during setup.
- **Costs/risks:** Adds provider launch, authentication, network, latency, and side-effect boundaries to setup.
- **Why not selected:** The available evidence supports ACP as the runtime authority but does not justify initiating an ACP session during a reliability-focused setup workflow.

## Consequences

### Positive

- One setup result corresponds to one explicit runtime provider intent.
- Provider-specific skill paths become visible and testable.
- Existing runtime reporting remains truthful when an agent cannot support a requested model or speed.

### Negative and trade-offs

- Setup gains model, speed, persistence, and failure-safety responsibilities beyond a simple picker replacement.
- The V1 must distinguish setup-valid requested values from runtime-advertised capabilities.
- Existing users of `.cursor/skills` are not automatically migrated.

### Risks and mitigations

- **Provider model values drift** — retain `auto`, isolate provider policy, and validate against ACP at runtime.
- **Interrupted write removes managed content** — preflight and stage managed entries, make commit points recoverable, and test error paths.
- **Destination change strands existing Cursor skills** — never delete or migrate legacy paths automatically; document the behavior and preserve unrelated content.
- **Strict config compatibility breaks existing workspaces** — define validated defaults or a migration path in the technical specification and test existing configuration behavior.

## Reversibility

The setup contract is reversible through a subsequent setup run with another provider. Existing user-owned and legacy destination trees must remain intact, so reverting the implementation does not require filesystem cleanup. Configuration-schema changes require an explicit compatibility strategy before release.

## Follow-ups

- Define the provider-policy source and model-list freshness behavior without live setup discovery.
- Define the validated storage boundary for scope and logical destination metadata.
- Specify failure-safe copy/symlink and configuration persistence semantics across local and global destinations.
- Produce the PRD from the approved idea packet.

## References

- GitHub issue #2: https://github.com/MatheusBBarni/spec-finder/issues/2
- [Codex skills documentation](https://developers.openai.com/codex/skills)
- [Claude Code skills documentation](https://code.claude.com/docs/en/skills)
- [Cursor `.agents/skills` support](https://forum.cursor.com/t/support-for-agent-folder-compatibility/154167)
- [ACP session configuration announcement](https://agentclientprotocol.com/announcements/session-config-options-stabilized)
