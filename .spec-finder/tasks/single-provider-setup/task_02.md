---
status: pending
title: Implement Single-Provider Setup and Safe Installation
type: refactor
complexity: high
dependencies:
  - task_01
---

# Task 02: Implement Single-Provider Setup and Safe Installation

## Overview

Replace the current multi-target setup flow with one resolved provider, requested model and speed, an accessible single-choice terminal flow, and a provider-derived destination. Install the selected managed skills through the approved staged transaction so failure, traversal, lock contention, and legacy Cursor content are handled safely and truthfully.

## Source Artifacts

- PRD: `.spec-finder/tasks/single-provider-setup/_prd.md`
- TechSpec: `.spec-finder/tasks/single-provider-setup/_techspec.md`

<critical>
- Read `.spec-finder/tasks/single-provider-setup/_prd.md`, `.spec-finder/tasks/single-provider-setup/_techspec.md`, relevant packet ADRs, repository instructions, and current Git state before editing. These paths contain the current packet slug.
- Treat this task's numeric ID as its canonical execution position; `task_01` must be completed first and provides the v3 config and provider-policy contract.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_02.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated batch work in `src/commands.ts` and `tests/commands.test.ts`, and defer public help/README updates to `task_03`.
- Reference TechSpec sections “Data and Control Flow,” “Failure and Recovery Behavior,” “Security and Privacy,” and “Testing and Evidence” for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST resolve exactly one setup provider in interactive and non-interactive flows: reject repeated `--agent`, duplicate/conflicting inputs, and `--symlink`; retain `--copy` compatibility; reuse valid saved intent; and choose the approved fresh/changed-provider defaults (F-01, F-03).
2. MUST provide keyboard-accessible single-select provider, scope, model, and speed choices, including explicit v2-migration scope selection and same-provider custom-model preservation without adding custom values to the curated picker (US-01, US-02).
3. MUST derive Claude `.claude/skills` and Codex/Cursor `.agents/skills`, persist a configured v3 setup result with provider/model/speed/destination/scope, and summarize requested—not runtime-applied—values (F-02, F-04).
4. MUST replace destructive multi-target replacement with a selected-root lock, preflight, same-parent staging, managed-entry backups, ordered commit, reverse rollback, and retained recovery artifacts on cleanup/rollback failure; apply traversal protection to local and global paths (F-05; ADR-003).
5. MUST leave legacy `.cursor/skills` and unrelated skills untouched, never launch ACP/provider discovery during setup, and clearly report legacy preservation (G-04, no-live-discovery constraint).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-01, US-01, F-01 | Singular flags and keyboard flow. | Parser and terminal-picker harness tests. |
| G-02, F-02 | Provider-derived local/global destinations. | 3-provider × 2-scope installer matrix. |
| G-03, US-02, F-03 | Saved/fresh/changed-provider model and speed resolution. | Resolver and custom-keep regression matrix. |
| G-04, US-04, F-05 | Legacy/unrelated preservation and failure-safe writes. | Legacy fixture, traversal, lock, and injected-failure tests. |
| F-04, terminal-usability constraint | Validated persistence, concise result, cancellation/no-success behavior. | Config output, summary, cancellation, and invalid-input tests. |
| M-01, M-02, M-04 | Acceptance coverage, six destinations, and no observed loss. | Focused command/setup suite before full verification. |

## Subtasks

- [ ] 02.1 Replace target-array and mode resolution with one typed setup request that consumes task_01 policy/config data and records input origins.
- [ ] 02.2 Extend the setup picker for true single-choice defaults, required-unselected legacy scope, Enter behavior, and cancellation without Space toggles.
- [ ] 02.3 Rebuild the setup command result around requested provider/model/speed/destination/scope and actionable invalid/cancelled outcomes.
- [ ] 02.4 Implement selected-root preflight, lock, stage, backup, ordered commit, rollback, and cleanup for known managed `sf-*` skills only.
- [ ] 02.5 Move Cursor installation to `.agents/skills` while proving legacy `.cursor/skills` and unrelated skills are never targets.
- [ ] 02.6 Add resolver, picker, destination, traversal, lock, legacy, and injected transaction-failure coverage; run the repository gate and update handoff memory.

## Implementation Details

Consume `SetupProviderProfile` and v3 config APIs from `task_01`; do not recreate defaults, config validation, or runtime provider launch logic in this task. The filesystem service must accept only the resolved provider-derived target and use a narrow test filesystem/failure seam rather than a public arbitrary-path override. A global setup may span workspace config and provider-home skills, so promise ordered commit and recoverable rollback rather than a false cross-root atomic rename.

### Relevant Files

- `src/commands.ts` — singular setup argv parsing, saved/fresh resolution, interactive flow, cancellation/errors, and setup summary; preserve batch sections.
- `src/ui/setup-picker.ts` — single-choice initial/no-selection behavior and keyboard semantics.
- `src/setup.ts` — selected destination, task-root handling, local/global traversal protection, lock, staged transaction, rollback, and legacy preservation status.
- `tests/commands.test.ts` — replace old setup-only multi-provider/mode expectations while preserving batch tests.
- `tests/setup.test.ts` — replace old multi-target/symlink fixtures with single-provider, safe-installation, and recovery matrix.

### Dependent Files

- `src/config.ts` and `src/setup-profile.ts` — task_01 contracts consumed without duplicating schema/defaults.
- `src/cli.tsx`, `README.md`, and `tests/cli.test.ts` — task_03 documents final parser/summary behavior.
- `src/providers.ts` and `src/acp-client.ts` — unchanged runtime authorities; setup must not call them.

### Related ADRs

- [ADR-001: Single-provider setup contract](adrs/adr-001-single-provider-setup-contract.md) — one provider and no live capability discovery.
- [ADR-002: Safe single-provider transition](adrs/adr-002-safe-single-provider-transition.md) — reuse/default behavior and legacy policy.
- [ADR-003: Versioned setup profile and transactional installation](adrs/adr-003-versioned-setup-profile-and-transaction.md) — staged rollback, traversal, and recovery constraints.

## Deliverables

- Fully integrated one-provider setup command, accessible picker, persistence summary, and provider-derived destinations.
- Staged managed-skill installer with explicit failure/recovery behavior and legacy Cursor preservation.
- Focused command/setup test matrix, updated `memory/MEMORY.md` and `memory/task_02.md`, and `reports/task_02.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given repeated `--agent`, duplicate model/speed, conflicting scope, invalid curated model, or `--symlink`, when setup arguments are parsed, then it fails before lock or filesystem mutation; `--copy` remains accepted.
- [ ] Given a fresh non-interactive workspace, a configured rerun, a changed provider, and a same-provider custom model, when setup intent resolves, then provider/model/speed/scope follow the approved defaults and preservation rules.
- [ ] Given the interactive provider/scope/model/speed flow, when keyboard arrows/Enter/cancel are used, then one value is chosen, migrated v2 scope requires selection, and cancellation claims no success.

### Integration Tests

- [ ] Given each provider and local/global scope, when setup completes, then exactly nine managed skills install at the derived destination and config v3 records the selected logical destination/scope.
- [ ] Given legacy `.cursor/skills` plus unrelated selected-root content, when Cursor setup completes or fails, then legacy and unrelated content are byte-for-byte preserved while `.agents/skills` is the only Cursor destination.
- [ ] Given injected stage, backup, promotion, config-commit, rollback, or cleanup failures, when the transaction runs, then prior managed/config state restores when possible; retained recovery paths are reported and success is absent otherwise.
- [ ] Given a symlinked local/global ancestor or an existing transaction lock, when setup starts, then it fails closed before a managed entry is changed.

### Platform or Manual Evidence

- [ ] Exercise the terminal harness with arrows, Enter, and cancellation; no external provider account or network evidence is applicable because setup intentionally performs no live discovery.

### Verification Commands

- `rtk bun test tests/commands.test.ts tests/setup.test.ts`
- `rtk bun run verify`

## Success Criteria

- Every mapped setup, destination, persistence, safety, and recovery requirement has direct automated evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable.
- No legacy Cursor content, unrelated skill, runtime ACP behavior, or unrelated batch change is modified.
- Memory is current and the final report records exact evidence and unresolved risks.
