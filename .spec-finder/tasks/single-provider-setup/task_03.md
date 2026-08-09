---
status: pending
title: Publish the Single-Provider Setup Contract
type: docs
complexity: medium
dependencies:
  - task_02
---

# Task 03: Publish the Single-Provider Setup Contract

## Overview

Publish the finalized setup behavior in CLI help and README so interactive users, automation users, and maintainers receive the same single-provider contract. This task closes the packet with documentation assertions and fresh repository-wide release evidence after the command, picker, summary, and transaction behavior are stable.

## Source Artifacts

- PRD: `.spec-finder/tasks/single-provider-setup/_prd.md`
- TechSpec: `.spec-finder/tasks/single-provider-setup/_techspec.md`

<critical>
- Read `.spec-finder/tasks/single-provider-setup/_prd.md`, `.spec-finder/tasks/single-provider-setup/_techspec.md`, relevant packet ADRs, repository instructions, and current Git state before editing. These paths contain the current packet slug.
- Treat this task's numeric ID as its canonical execution position; `task_01` and `task_02` must be completed first, and this task is the packet leaf.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_03.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated ordered-batch documentation/help/test changes and do not change the finalized setup implementation except for a discovered documentation-contract defect.
- Reference TechSpec sections “External Interfaces,” “Observability,” “Compatibility, Migration, and Rollback,” and “Testing and Evidence” for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST make CLI help and README describe one optional `--agent`, optional curated `--model`, `--speed auto|normal|fast`, independent `--local|--global`, retained `--copy`, and rejected `--symlink` behavior (F-06).
2. MUST document fresh/default and valid-rerun preservation behavior, v3's explicit first-scope choice for migrated configurations, provider-derived destination mapping, and requested-versus-runtime-applied capability wording (G-05; ADR-003).
3. MUST state that Cursor uses `.agents/skills` and that legacy `.cursor/skills` is preserved without automatic migration, cleanup, or deletion (G-04, US-04).
4. SHOULD keep the documentation contract testable and avoid stale claims such as multi-select Space toggles, repeated agents, canonical symlink targets, or an incorrect bundled-skill count (US-05).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-05, US-05, F-06 | Help and README exactly match final setup contract. | CLI help assertions and documentation review. |
| G-03, F-03 | Explain defaults, saved-value reuse, `auto`, and runtime capability boundary. | README examples/table assertions. |
| G-04, US-04, F-05 | Explain Cursor destination and no legacy migration. | README preservation assertion/review. |
| M-05 | Provide final release-gate evidence after all implementation/docs work. | Fresh `rtk bun run verify` output in report. |

## Subtasks

- [ ] 03.1 Update CLI usage/help text for the finalized singular setup arguments and unsupported-option guidance while retaining unrelated batch help.
- [ ] 03.2 Rewrite README setup walkthrough, examples, destination table, config migration guidance, and legacy Cursor explanation to match observed behavior.
- [ ] 03.3 Add or extend help/documentation contract tests that protect against obsolete multi-provider, symlink, and old Cursor-path wording.
- [ ] 03.4 Review displayed setup summary terminology against requested-versus-runtime-applied capability boundaries.
- [ ] 03.5 Run focused help tests and full verification, then complete packet memory and release evidence handoff.

## Implementation Details

Use the actual output produced by `task_02` as the documentation authority; do not promise provider availability discovered at setup time. Keep examples deterministic and avoid copying stale counts from the current README. Update only setup-related sections in dirty shared files so ordered-batch content and tests remain intact.

### Relevant Files

- `src/cli.tsx` — setup usage/help text; preserve current batch command documentation.
- `README.md` — setup walkthrough, examples, destinations, config migration, and legacy preservation policy; preserve unrelated batch sections.
- `tests/cli.test.ts` — setup-help assertions alongside existing batch-help coverage.

### Dependent Files

- `src/commands.ts` — task_02's finalized parser, summary, errors, and requested-value terminology.
- `src/setup.ts` and `src/setup-profile.ts` — final destination/default behavior documented here.
- `.spec-finder/tasks/single-provider-setup/reports/task_03.md` — runtime-owned final evidence report required before packet completion.

### Related ADRs

- [ADR-001: Single-provider setup contract](adrs/adr-001-single-provider-setup-contract.md) — public one-provider and runtime-authority boundary.
- [ADR-002: Safe single-provider transition](adrs/adr-002-safe-single-provider-transition.md) — default/reuse and legacy communication.
- [ADR-003: Versioned setup profile and transactional installation](adrs/adr-003-versioned-setup-profile-and-transaction.md) — migration and failure-recovery language.

## Deliverables

- Consistent CLI help and README for the approved setup contract.
- Automated help/documentation regression evidence and a fresh full verification result.
- Updated `memory/MEMORY.md` and `memory/task_03.md`, and `reports/task_03.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given CLI help output, when setup usage is rendered, then it advertises a singular agent/model/speed/scope/copy contract and omits multi-provider ellipses and `--symlink` support.

### Integration Tests

- [ ] At the documentation-to-command boundary, verify README examples and destination statements match final help and observed setup behavior, including Cursor legacy preservation and requested runtime capability wording.

### Platform or Manual Evidence

- [ ] Inspect rendered terminal help and Markdown for readable keyboard/default/migration guidance; no external provider account validation is applicable.

### Verification Commands

- `rtk bun test tests/cli.test.ts`
- `rtk bun run verify`

## Success Criteria

- Help and README express the same verified single-provider setup contract without obsolete behavior.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable.
- No unrelated batch documentation/help/test behavior changes.
- Memory is current and the final report records exact evidence and unresolved risks.
