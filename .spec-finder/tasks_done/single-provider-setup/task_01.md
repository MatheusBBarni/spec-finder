---
status: completed
title: Add Versioned Setup Configuration and Provider Policy
type: backend
complexity: high
dependencies: []
---

# Task 01: Add Versioned Setup Configuration and Provider Policy

## Overview

Establish the strict v3 configuration and static setup-policy contract that all later setup behavior consumes. This gives setup a validated provider/destination/scope lifecycle, curated requested-model defaults, and keeps temporary `run` overrides compatible without allowing them to corrupt persisted setup metadata.

## Source Artifacts

- PRD: `.spec-finder/tasks/single-provider-setup/_prd.md`
- TechSpec: `.spec-finder/tasks/single-provider-setup/_techspec.md`

<critical>
- Read `.spec-finder/tasks/single-provider-setup/_prd.md`, `.spec-finder/tasks/single-provider-setup/_techspec.md`, relevant packet ADRs, repository instructions, and current Git state before editing. These paths contain the current packet slug.
- Treat this task's numeric ID as its canonical execution position; it has no dependencies and is the foundation for `task_02` and `task_03`.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_01.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work, including active batch changes in `src/commands.ts` and `tests/commands.test.ts`, and do not absorb setup-picker or installer work from `task_02`.
- Reference TechSpec sections “Core Interfaces,” “Data Models and Lifecycle,” “Integration Points,” and “Compatibility, Migration, and Rollback” for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST introduce strict config version 3 with a discriminated `setup` state: v1/v2 inputs migrate in memory to `unconfigured`, while a persisted configured state validates scope and the provider-derived logical destination without storing arbitrary absolute paths (F-04; ADR-003).
2. MUST add a source-controlled setup provider policy with universal `auto`, Codex default `gpt-5.6-luna`, Claude default `fable`, Cursor default `auto`, and provider-derived `.agents/skills` or `.claude/skills` destinations; it MUST not launch a provider or claim runtime entitlement (F-02, F-03).
3. MUST preserve runtime compatibility by parsing the stored v3 config before applying temporary `run --provider`/model overrides; those overrides must not rewrite or re-validate unchanged setup metadata (TechSpec “External Interfaces”).
4. SHOULD retain valid non-empty custom saved models for runtime and expose them only through the later setup keep action, rather than widening setup picker or flag values beyond the curated policy (F-03; ADR-003).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-03, US-02, US-03, F-03 | Curated defaults and preserved valid saved values. | Descriptor/default and config migration tests. |
| F-04, strict-config constraint | Strict v3 setup lifecycle and safe legacy migration. | Invalid-state, unknown-key, cross-field, and v1/v2 tests. |
| TechSpec “Config → provider runtime” | Runtime override is post-load and non-mutating. | `run --provider` configured-v3 regression. |
| M-03 | Valid omitted intent remains available to the later resolver. | Explicit saved model/speed/config fixtures. |

## Subtasks

- [ ] 01.1 Create the focused setup-policy module with exhaustive provider, destination, curated-model, and default validation.
- [ ] 01.2 Upgrade centralized config parsing, migration, and candidate serialization to strict v3 setup-state behavior without weakening runtime fields.
- [ ] 01.3 Preserve `run` override behavior by separating stored-config validation from ephemeral runtime override validation.
- [ ] 01.4 Add deterministic unit coverage for policy defaults, legacy migration, strict invalid input, custom-model retention, and runtime override compatibility.
- [ ] 01.5 Run focused and repository-wide verification, then record durable task findings in packet memory for the installer consumer.

## Implementation Details

Use the existing `ProviderName` type from `src/config.ts`; do not invent a parallel provider enum or move ACP/provider-launch policy out of its existing runtime boundary. Keep the setup profile source-controlled and setup-specific. Implement only the configuration and runtime-override seam here; `task_02` owns setup argument parsing, picker behavior, writes, locks, and filesystem staging.

### Relevant Files

- `src/config.ts` — strict schema, legacy migration, config serialization, and exported runtime types.
- `src/setup-profile.ts` — create; provider labels, destinations, curated choices, and setup defaults.
- `src/commands.ts` — preserve `run` override compatibility only; retain unrelated batch logic and defer setup-command replacement to `task_02`.
- `tests/config.test.ts` — strict v3, migration, and invalid cross-field coverage.
- `tests/commands.test.ts` — configured-v3 runtime override regression while preserving current batch tests.
- `tests/setup-profile.test.ts` — create; exhaustive static policy/default contract tests.

### Dependent Files

- `src/setup.ts` — `task_02` will consume v3 serialization and profile-derived destination data.
- `src/providers.ts` and `src/acp-client.ts` — retain requested-value/runtime-outcome behavior; run their existing regressions without changing their transport contracts.
- `src/engine.ts`, `src/batch.ts`, `src/events.ts`, and `src/ui/store.ts` — consume runtime config and must remain compatible with the added setup field.

### Related ADRs

- [ADR-001: Single-provider setup contract](adrs/adr-001-single-provider-setup-contract.md) — setup policy does not claim ACP capability availability.
- [ADR-003: Versioned setup profile and transactional installation](adrs/adr-003-versioned-setup-profile-and-transaction.md) — v3 state, static defaults, and runtime override boundary.

## Deliverables

- Strict v3 configuration and in-memory v1/v2 migration behavior.
- Reviewed static provider setup policy with the approved defaults and destinations.
- Preserved runtime override behavior over a configured v3 setup document.
- Focused automated evidence, updated `memory/MEMORY.md` and `memory/task_01.md`, and `reports/task_01.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given valid v1 or v2 JSON, when parsed, then it yields v3 with `setup.status: "unconfigured"` and retains runtime provider/model/reasoning/speed/permissions.
- [ ] Given configured v3 metadata whose destination does not match its stored provider, when parsed, then it fails with an actionable strict-config error; unknown setup keys also fail.
- [ ] Given every provider profile, when its defaults are inspected, then the destination and approved default are valid policy members and no live provider command is called.
- [ ] Given a configured Codex v3 document, when `run --provider claude` is resolved, then the runtime request uses Claude while persisted setup metadata remains unchanged.

### Integration Tests

- [ ] At the config-to-provider boundary, verify existing Claude/Cursor launch translation and ACP permission/model/speed outcome tests still accept the expanded config shape.

### Platform or Manual Evidence

- [ ] Not applicable: this task adds no terminal rendering, external provider launch, or platform-specific packaging behavior.

### Verification Commands

- `rtk bun test tests/config.test.ts tests/setup-profile.test.ts tests/commands.test.ts tests/providers.test.ts tests/acp-client.test.ts`
- `rtk bun run verify`

## Success Criteria

- All mapped configuration, provider-policy, and runtime-override requirements are evidenced by deterministic tests.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable.
- No setup installer, picker, ACP transport, or unrelated batch behavior is absorbed into this task.
- Memory is current and the final report records exact evidence and unresolved risks.
