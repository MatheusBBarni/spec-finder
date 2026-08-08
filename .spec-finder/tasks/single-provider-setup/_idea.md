# Single-provider setup with default model and speed

## Overview

A reliability-focused quick win for developers initializing one Spec Finder repository. V1 replaces the ambiguous multi-provider setup contract with one canonical provider, provider-derived skill destination, requested model and speed, separate local/global scope, validated persistence, and safe installation behavior.

## Problem

`spec-finder setup` currently defaults to all providers, accepts repeated `--agent`, and uses a multi-select picker, while runtime configuration already represents one provider, model, and speed. This leaves setup intent ambiguous and documents Cursor skills at a path that differs from the accepted shared `.agents` destination.

### Evidence

| Kind | Finding | Source | Date | Confidence |
|---|---|---|---|---|
| Repository | Setup defaults to all providers, accepts repeated `--agent`, and uses a multi-select picker. | `src/commands.ts` | 2026-08-08 | High |
| Repository | Setup currently maps Cursor to `.cursor/skills`; it installs a list of targets. | `src/setup.ts` | 2026-08-08 | High |
| Repository | Runtime config is strict and already stores one provider, model, and speed. | `src/config.ts` | 2026-08-08 | High |
| Repository | Runtime validates advertised ACP model/speed options after session initialization. | `src/acp-client.ts` | 2026-08-08 | High |
| External | Codex loads repository and user skills from `.agents/skills`. | [Codex skills docs](https://developers.openai.com/codex/skills) | Accessed 2026-08-08 | High |
| External | Claude Code uses `.claude/skills` at project and personal scopes. | [Claude Code skills docs](https://code.claude.com/docs/en/skills) | Accessed 2026-08-08 | High |
| External | Cursor supports `.agents/skills`. | [Cursor staff confirmation](https://forum.cursor.com/t/support-for-agent-folder-compatibility/154167) | 2026-03-11 | Medium |
| External | ACP stabilized session configuration selectors for models and related settings. | [ACP announcement](https://agentclientprotocol.com/announcements/session-config-options-stabilized) | 2026-02-04 | High |

## Target Users

| Persona | Context | Need | Current workaround |
|---|---|---|---|
| Repository developer | Runs `spec-finder setup` for one repository. | Produce an unambiguous provider/model/speed setup result. | Navigate a multi-provider flow despite one runtime provider. |
| Team maintainer | Documents or automates a repository’s setup. | Deterministic flags, paths, and generated configuration. | Infer the active provider from defaults and installed skill copies. |

## Core Features

| ID | Priority | Feature | Observable user value | Evidence |
|---|---|---|---|---|
| F-01 | Critical | Required single-provider selection | Interactive setup uses normal select navigation; flags accept exactly one provider. | `src/commands.ts`; issue #2 |
| F-02 | Critical | Provider-derived destination and independent scope | Setup clearly shows `.agents` for Codex/Cursor or `.claude` for Claude, with local/global separately chosen. | Vendor documentation; issue #2 |
| F-03 | Critical | Provider-aware requested model and speed | Users choose `auto` or provider-policy-valid model choices plus `auto`, `normal`, or `fast` speed. | `src/config.ts`; ACP source; issue #2 |
| F-04 | Critical | Validated persistence and summary | Setup saves and displays provider, requested model, speed, logical destination, and scope. | Issue #2; ADR-001 |
| F-05 | High | Failure-safe managed-skill installation | Reruns, errors, and cancellation preserve unrelated skills and do not automatically delete legacy Cursor paths. | `src/setup.ts`; council critique |
| F-06 | High | Truthful runtime capability outcomes | Unsupported explicit model/speed values are reported honestly after ACP session initialization. | `src/acp-client.ts`; ACP source |
| F-07 | High | Contract tests and documentation | Automated coverage and CLI/README guidance match the new one-provider behavior. | Existing tests and README; selected success measure |

## KPIs

| ID | KPI | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| KPI-01 | New single-provider acceptance-path coverage | Current tests encode multi-provider behavior | 100% of issue #2 acceptance paths covered | Command, setup, config, and picker tests | Before release |
| KPI-02 | Repeated-provider rejection | Current parser accepts repeats | 100% rejection for repeated/conflicting `--agent` cases | Parser test matrix | Before release |
| KPI-03 | Provider/destination/scope correctness | Unknown | 6/6 provider × local/global path cases pass | Temporary-root setup tests | Before release |
| KPI-04 | Managed-content preservation on failed setup | Source review identifies destructive replacement risk | 0 unrelated or legacy skill entries lost in simulated failure cases | Failure-injection tests | Before release |
| KPI-05 | Release-gate health | Unknown | 1/1 green `bun run verify` execution | Full local verification | Before release |

## Feature Assessment

| Criterion | Score | Evidence-backed rationale |
|---|---|---|
| Impact | Strong | Resolves a verified contradiction between multi-provider setup and singular runtime config. |
| Reach | Maybe | No usage telemetry establishes the number of affected repositories. |
| Frequency | Maybe | Setup is likely infrequent per repository; baseline is unknown. |
| Differentiation | Maybe | It aligns with current vendor conventions rather than creating a proprietary capability. |
| Defensibility | Pass | The behavior is valuable but readily reproducible. |
| Feasibility | Strong | Existing command, setup, config, picker, and ACP seams directly support the change. |

## Independent Critique

### Consensus

Four independent advisors support the full single-provider contract as a narrow reliability V1. They agree that provider identity, skill installation, and ACP-advertised runtime capabilities must not be conflated; no live provider launch is justified during setup.

### Unresolved Tensions

| Tension | Position A | Position B | Decision consequence |
|---|---|---|---|
| Setup metadata storage | Persist logical destination/scope metadata for explainable reruns. | Derive installation state and retain only runtime config. | Technical spec selects a validated setup-metadata boundary that cannot control runtime capability outcomes. |
| Write failure safety | Stage/commit managed entries and config safely. | Keep implementation lightweight. | V1 includes proportionate preflight and recoverable managed-entry writes, not a general transaction system. |
| Model-choice authority | Provider policy can offer setup choices. | ACP is authoritative only after session initialization. | Keep `auto`; model policy must be explicit and runtime validation remains truthful. |

### Position Evolution and Dissent

Product and engineering advisors both conceded that direct replacement of managed entries can violate the reliability goal after failures. Architecture partially conceded a single generalized provider framework, recommending separate setup and runtime descriptors that share only static facts. Security held firm on failure-safe writes and no destructive Cursor migration.

The remaining dissent is the exact strength of the cross-destination rollback guarantee and whether a maintained model catalogue can satisfy “only valid choices” without live discovery.

### Recommended Direction

Deliver the selected full single-provider contract, with static provider policy at setup and ACP as the runtime source of truth.

## Opportunity Decision

| Direction | Outcome | Effort | Principal risk | Decision |
|---|---|---|---|---|
| Full single-provider contract | Satisfies issue #2 end-to-end without live capability probing. | Moderate | Provider model-policy freshness and safe-write behavior. | **Selected** |
| Essence-first picker | Removes multi-select and repeated flags only. | Low | Leaves core persistence and reliability requirements incomplete. | Rejected |
| Hybrid live discovery | Launches providers during setup to enumerate live options. | High | Authentication, network, latency, and setup side effects. | Rejected |

## Out of Scope (V1)

- **Multi-provider setup or runtime orchestration** — contradicts the selected one-provider contract.
- **Live ACP capability discovery during setup** — adds provider/auth/network side effects without evidence of necessity.
- **Automatic migration or deletion of `.cursor/skills`** — risks removing or stranding user-owned content.
- **New provider integrations or provider-command customization** — does not test the core setup hypothesis.
- **Telemetry or adoption analytics** — useful later, but no collection contract exists today.

## Architecture Decision Records

- [ADR-001: Single-provider setup contract](adrs/adr-001-single-provider-setup-contract.md) — accepted scope and constraints.

## Research Limitations

No telemetry establishes setup frequency, completion rates, or support burden. Vendor model availability can change, and no live providers were launched during research. Cursor path support is supported by a staff forum statement rather than a fully readable reference page.

## Open Questions

- What provider-policy source and refresh process keeps setup model choices valid without live discovery?
- Should scope and logical destination live in runtime config or a separate validated setup metadata file?
- What precise staging and rollback semantics are required across local and global destinations?
