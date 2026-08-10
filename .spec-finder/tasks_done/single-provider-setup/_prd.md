# Single-provider setup Product Requirements Document

## Overview

Spec Finder will replace its ambiguous multi-provider setup flow with a safe, single-provider transition for developers setting up one repository. The MVP provides one canonical provider, a provider-derived skill destination, preserved defaults on rerun, newest catalogue defaults for fresh setup, separate scope selection, and clear results without deleting legacy Cursor paths.

## Research Evidence

| Kind | Finding | Source | Date | Product consequence |
|---|---|---|---|---|
| Repository | Setup currently defaults to all providers, accepts repeated `--agent`, and presents a multi-select picker. | `src/commands.ts` | 2026-08-08 | Users cannot infer one canonical runtime provider from setup. |
| Repository | Current skill paths use `.claude/skills`, `.agents/skills`, and `.cursor/skills` respectively. | `src/setup.ts` | 2026-08-08 | The new destination contract must be explicit and safe for existing users. |
| Repository | Runtime configuration is already strict and singular: one provider, model, and speed. | `src/config.ts` | 2026-08-08 | Setup should create one equally unambiguous user intent. |
| Repository | Runtime capability outcomes are reported after an ACP session starts. | `src/acp-client.ts` | 2026-08-08 | Setup must not promise provider capability availability that it cannot establish. |
| External | Codex supports repository and user skills in `.agents/skills`. | [Codex skills docs](https://developers.openai.com/codex/skills) | Accessed 2026-08-08 | `.agents` is a supported destination for Codex. |
| External | Claude Code supports project and personal `.claude/skills`. | [Claude Code skills docs](https://code.claude.com/docs/en/skills) | Accessed 2026-08-08 | Claude retains its provider-specific destination. |
| External | Cursor supports `.agents/skills`. | [Cursor staff confirmation](https://forum.cursor.com/t/support-for-agent-folder-compatibility/154167) | 2026-03-11 | Cursor can use the shared `.agents` destination. |
| External | ACP session configuration selectors are stable. | [ACP announcement](https://agentclientprotocol.com/announcements/session-config-options-stabilized) | 2026-02-04 | Actual runtime outcomes remain provider-advertised. |
| User decision | A rerun without `--agent` reuses its valid configured provider; fresh non-interactive setup defaults to Codex. | PRD clarification | 2026-08-08 | Existing intent remains stable. |
| User decision | New or newly changed provider selections default to the newest model in Spec Finder’s maintained catalogue; omitted model/speed retain valid saved values. | PRD clarification | 2026-08-08 | Defaults are current without silently changing rerun intent. |
| User decision | All setup runs use the new derived destination but leave legacy Cursor paths intact and report no migration. | PRD clarification | 2026-08-08 | Transition avoids user-content deletion. |

## Goals

| ID | Goal | Measurable outcome |
|---|---|---|
| G-01 | Make setup provider intent unambiguous. | Every completed setup outcome identifies exactly one provider. |
| G-02 | Make skill placement understandable and correct. | Every completed setup outcome shows the selected provider’s destination and scope. |
| G-03 | Give developers useful defaults without replacing existing intent. | Fresh or changed-provider setup defaults to the newest catalogue model; valid omitted rerun values remain unchanged. |
| G-04 | Make the transition safe for existing workspaces. | No setup run automatically migrates or deletes legacy Cursor skill paths. |
| G-05 | Make behavior discoverable to interactive and automated users. | CLI help and README describe the same setup contract. |

## User Stories

| ID | Persona | Story | Acceptance signal |
|---|---|---|---|
| US-01 | Repository developer | As a developer using interactive setup, I want to choose one provider with normal keyboard navigation, so that my configuration is unambiguous. | The flow confirms one provider and does not offer multi-select toggles. |
| US-02 | Automation user | As a developer running setup non-interactively, I want omitted values to preserve my valid existing intent, so that reruns are predictable. | The resulting summary shows the reused provider, model, and speed. |
| US-03 | New repository developer | As a first-time user, I want deterministic provider and model defaults, so that setup works without needing provider flags. | The summary identifies Codex and the current catalogue default model. |
| US-04 | Existing Cursor user | As a developer with legacy Cursor skills, I want setup to preserve those paths, so that adopting the new destination never removes my content. | The result explicitly reports that no legacy migration occurred. |
| US-05 | Team maintainer | As a maintainer documenting setup, I want provider paths and defaults to be consistent across help and README, so that teammates can follow the workflow without guesswork. | Documentation and CLI help describe the same one-provider contract. |

## Core Features

### F-01: Single-provider setup selection

- **User value:** One setup decision maps directly to one runtime provider.
- **Mapped goals/stories:** G-01, G-05, US-01, US-02, US-03.
- **MUST:** Require exactly one provider in interactive and non-interactive setup; reject repeated or conflicting provider flags with clear guidance.
- **SHOULD:** Default a rerun to its valid configured provider and a fresh non-interactive setup to Codex.
- **Acceptance conditions:** Keyboard users can navigate, confirm, or cancel a single-choice provider picker; no completed setup result contains multiple providers.

### F-02: Provider-derived destination and independent scope

- **User value:** Developers know where their selected provider will discover skills.
- **Mapped goals/stories:** G-02, G-04, US-01, US-04.
- **MUST:** Display `.agents` for Codex and Cursor, `.claude` for Claude, and keep local/global scope independently selectable.
- **SHOULD:** Show the resolved destination and scope before setup completes.
- **Acceptance conditions:** A completed summary always names provider, destination, and scope; fresh and existing workspaces follow the same destination rule.

### F-03: Model and speed defaults that preserve intent

- **User value:** Developers start with a current, provider-relevant model while retaining deliberate existing settings.
- **Mapped goals/stories:** G-03, US-02, US-03.
- **MUST:** Offer `auto` and provider-specific model choices; default fresh setup or a newly selected provider to the newest model in Spec Finder’s maintained catalogue; offer `auto`, `normal`, and `fast` speed.
- **SHOULD:** Preserve valid saved model and speed when non-interactive reruns omit those options.
- **Acceptance conditions:** Setup summaries distinguish selected or reused values; unsupported runtime choices receive truthful feedback rather than appearing applied.

### F-04: Validated setup result and summary

- **User value:** Users can see and trust the configuration setup produced.
- **Mapped goals/stories:** G-01, G-02, G-03, US-01, US-02.
- **MUST:** Save validated provider, model, speed, logical destination, and scope information, then summarize the effective values.
- **SHOULD:** Make cancellation and invalid input recoverable with concise, actionable messages.
- **Acceptance conditions:** Successful setup communicates all five values; cancelled or invalid setup does not claim success.

### F-05: Safe legacy-path transition

- **User value:** Existing projects gain the new contract without losing user-owned skills.
- **Mapped goals/stories:** G-04, US-04.
- **MUST:** Use the selected provider’s new derived destination on every setup run and leave legacy `.cursor/skills` content untouched.
- **SHOULD:** State explicitly when legacy paths were preserved and not migrated.
- **Acceptance conditions:** A user with legacy Cursor paths can run setup and understand that the old content was neither moved nor deleted.

### F-06: Consistent setup guidance

- **User value:** Interactive users, automation users, and maintainers receive one coherent contract.
- **Mapped goals/stories:** G-05, US-05.
- **MUST:** Update setup help and README to remove multi-provider and repeated-flag guidance.
- **SHOULD:** Explain defaults, destination mapping, scope, preservation behavior, and the boundary between requested values and runtime outcomes.
- **Acceptance conditions:** Documentation examples use one provider and match observed setup behavior.

## User Experience

A new developer runs `spec-finder setup`, selects one provider, sees its derived destination, chooses scope, sees the newest provider-catalogue model selected by default, chooses speed, and receives a concise summary of provider, model, speed, destination, and scope.

A developer rerunning setup without provider, model, or speed options sees their valid saved intent reused. If they select a different provider, setup presents that provider’s newest catalogue model as the default. If setup encounters legacy Cursor paths, the outcome says they were preserved and not migrated.

The interactive flow supports keyboard-only navigation, confirmation, and cancellation. Cancellation does not present a success summary. Invalid or conflicting input explains the corrective action. Runtime feedback remains clear when a requested value is unavailable from the active provider.

## High-Level Constraints

- Provider choice is singular for every setup result.
- Local and global installation scope remain user-visible, independent choices.
- The destination is provider-derived rather than an arbitrary user path.
- Setup does not launch a provider merely to discover live model or speed capabilities.
- Setup must preserve unrelated skills and legacy Cursor paths; no automatic migration is part of the MVP.
- Configuration remains strict and user-owned; invalid setup values receive clear errors.
- The experience must be usable from interactive terminals and deterministic in non-interactive execution.

## Non-Goals

- **Multi-provider setup or runtime orchestration** — conflicts with the one-provider product promise.
- **Live provider capability discovery during setup** — expands setup into an authenticated, network-dependent workflow without verified need.
- **Automatic or guided migration of legacy Cursor paths** — requires separate user-content ownership and recovery decisions.
- **Additional provider integrations or command customization** — does not advance the verified setup clarity goal.
- **Usage telemetry or adoption analytics** — no collection or privacy contract exists.

## Phased Rollout Plan

### MVP

- Deliver F-01 through F-06 for all new setup and rerun flows.
- Publish the updated help and README alongside the behavior.
- Exit when the defined acceptance conditions and success metrics are met, and no setup outcome claims an automatic legacy migration.

### Later phases

- Consider opt-in legacy-path migration only after evidence of user demand and explicit recovery requirements.
- Consider live capability discovery only if static catalogue defaults create demonstrated user friction.
- Consider product-use measurement only after a privacy-preserving measurement policy exists.

## Success Metrics

| ID | Metric | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| M-01 | Single-provider setup acceptance coverage | Current behavior permits multiple providers | 100% of issue #2 acceptance paths verified | Release acceptance evidence | Before release |
| M-02 | Provider/destination/scope correctness | Current Cursor destination is `.cursor/skills` | 6/6 provider × scope outcomes show the required destination | Release acceptance evidence | Before release |
| M-03 | Intent preservation on non-interactive rerun | Unknown | 100% of valid omitted provider/model/speed cases preserve saved intent | Release acceptance evidence | Before release |
| M-04 | Legacy-path preservation | Unknown | 0 observed legacy or unrelated skill entries automatically migrated or removed | Release acceptance evidence | Before release |
| M-05 | Release-gate health | Unknown | 1/1 successful full release verification | Release verification record | Before release |

## Risks and Mitigations

| Risk | Evidence | Likelihood/impact | Mitigation | Owner/decision trigger |
|---|---|---|---|---|
| Provider model catalogue becomes stale | Vendor model availability can change; ACP resolves actual runtime outcomes. | Medium / High | Keep `auto`, label requested values honestly, and update the catalogue with releases. | Product owner; repeated unavailable-default reports or documented provider change. |
| Existing automation changes behavior unexpectedly | Current non-interactive setup defaults to all providers. | Medium / High | Publish the new deterministic fallback and preservation rules in help and README. | Product owner; release readiness review. |
| Users expect legacy Cursor content to move | The new destination differs from the current Cursor path. | Medium / Medium | State clearly that legacy paths are preserved and not migrated. | Product owner; user feedback demonstrating confusion. |
| Setup damages user-managed content | Current managed-skill replacement can be destructive on failure. | Low / High | Require protective setup behavior and no automatic legacy deletion before release. | Release owner; any failure-path evidence. |

## Architecture Decision Records

- [ADR-001: Single-provider setup contract](adrs/adr-001-single-provider-setup-contract.md) — accepted full scope and runtime-capability boundary.
- [ADR-002: Safe single-provider transition](adrs/adr-002-safe-single-provider-transition.md) — accepted defaults and legacy-path rollout policy.

## Research Limitations

No telemetry establishes setup frequency, completion rate, or support burden. Model catalogues are inherently time-sensitive. Cursor’s `.agents/skills` support is supported by a staff forum statement rather than a fully readable static reference page. No live provider sessions were started during research.

## Open Questions

- What user-facing release note communicates a changed provider catalogue default most clearly?
- What evidence threshold should justify revisiting an opt-in legacy-path migration?
