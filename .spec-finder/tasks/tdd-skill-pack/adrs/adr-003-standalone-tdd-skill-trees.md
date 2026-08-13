# ADR-003: Standalone TDD Skill Trees and Install Contract

## Status

Accepted

## Date

2026-08-13

## Context

The approved PRD and ADR-001 require four portable TDD skills (`sf-tdd-plan`, `sf-tdd-execute`, `sf-tdd-report`, `sf-tdd-batch`) installed through normal Spec Finder setup, with ACP `run` remaining on core execute/report.

Repository constraints:

- Managed install is a fixed allowlist plus recursive copy of each named tree under `skills/` (`src/setup.ts` `SPEC_FINDER_SKILLS`, `src/paths.ts` `bundledSkillsPath()`).
- `spec-finder upgrade` only runs `npm install --global spec-finder@latest` and does not recopy agent destinations (`src/commands.ts` `upgradeCommand`).
- Agent Skills are destination-local: a file outside an installed skill directory is not available after setup.
- ADR-002 requires self-contained doctrine and forbids depending on a user-global `/tdd` path.
- Core batch already owns dependency order, stop-on-failure, and optional checkpoint CLI phases.

Technical clarification selected standalone skill trees (Approach A), duplicated doctrine per skill, re-run setup after upgrade, TDD batch checkpoint parity, and setup-plus-contract tests.

## Decision Drivers

- G-01 / G-03 / G-05: honest TDD after a clean setup, without extra global skills.
- G-02 / M-04: do not change ACP default prompts.
- F-01: four independently invocable skills; core path remains default.
- Repository installer copies whole skill trees only when listed.
- Smallest design that satisfies every approved requirement (Approach A).

## Evidence

| Kind | Finding | Source | Version/date |
|---|---|---|---|
| Repository | Nine named trees are staged and promoted; missing source `SKILL.md` fails setup. | `src/setup.ts` `SPEC_FINDER_SKILLS` | 2026-08-13 |
| Repository | Upgrade is npm-only and does not call `setupWorkspace`. | `src/commands.ts` `upgradeCommand` | 2026-08-13 |
| Repository | ACP prompts hard-require `sf-execute-task` and optionally `sf-task-report`. | `src/engine.ts` `implementationPrompt` / `reportPrompt`; `tests/engine.test.ts` | 2026-08-13 |
| Official docs | Agent Skills are per-directory installs; siblings are not automatically on the skill path. | Installed skill destination layout | 2026-08-13 |
| User decision | Approach A: standalone trees; Q1 re-run setup; Q3 duplicate doctrine; Q4 checkpoint parity; Q6 setup + contract tests. | TechSpec clarification | 2026-08-13 |

## Decision

Ship four **standalone** skill trees under `skills/`:

- `sf-tdd-plan`
- `sf-tdd-execute`
- `sf-tdd-report`
- `sf-tdd-batch`

Each tree contains its own `SKILL.md` and a copy of slim `references/tdd-doctrine.md`. Skill-specific templates live beside that copy (`tdd-plan-template.md`, slice-log guidance, `tdd-report-template.md`). `sf-tdd-batch` may include `agents/openai.yaml` to match `sf-batch-tasks`.

Install contract:

- Append the four names to `SPEC_FINDER_SKILLS` after the core execute/report/batch cluster and before `sf-archive-tasks`.
- Setup/upgrade product language means: a released package contains the trees; `spec-finder setup` copies them; `spec-finder upgrade` refreshes the package only. Existing workspaces must re-run `setup` to recopy destinations.
- Do not add a fifth shared skill, a non-skill shared folder, or an installer change beyond the allowlist.
- Do not change `implementationPrompt` / `reportPrompt`.

Runtime-adjacent helpers, overlay-on-core skills, and TDD report parsers are out of V1.

`sf-tdd-batch` mirrors core batch: same range grammar, dependency gate, skip-completed unless `force`, stop-on-failure, dual-ownership ban, and `spec-finder checkpoint begin/complete` when `auto_commit: true`. It invokes only `sf-tdd-execute` / `sf-tdd-report`.

Verification: extend setup so all 13 managed skills install with `SKILL.md`; assert the four TDD names are listed; keep engine tests that lock core prompt strings. Red/green honesty is a skill-and-template contract, not a new parser.

## Alternatives Considered

### Thin overlays on core skills

- **Benefits:** Less duplicated workflow prose.
- **Costs/risks:** Execute can fall back to core mid-loop; overlay drift from core checklists.
- **Why not selected:** Isolation of red/green gates is the product reason for a parallel pack.

### Shared evidence helper or CLI checker

- **Benefits:** Stronger automated M-02 later.
- **Costs/risks:** New runtime-adjacent contract the PRD does not require; V1 clarification declined a parser.
- **Why not selected:** Skill gates plus setup/contract tests meet the ship bar.

### Single doctrine owner skill or non-skill shared folder

- **Benefits:** One copy to maintain.
- **Costs/risks:** Plan/report/batch fail if the owner is missing; unlisted folders are not installed.
- **Why not selected:** Self-contained install requires each skill to carry doctrine.

## Consequences

### Positive

- Clean setup can plan, execute, report, and batch TDD without `/tdd` or sibling-path assumptions.
- Core skills and ACP `run` stay mode-neutral.
- Installer change stays list-plus-trees; copy/promote/rollback loops are reused.

### Negative and trade-offs

- Four doctrine copies can drift; maintainers must refresh them together.
- Existing workspaces stay on nine skills until they re-run `setup`.
- Overlay reuse of core checklist text is duplicated in TDD skills.

### Risks and mitigations

- **Doctrine drift** — keep an alignment note naming `/tdd` as origin; refresh all four copies together.
- **Operators expect upgrade to recopy skills** — README states upgrade is package-only and setup recopies destinations.
- **Missing tree fails setup** — every listed skill must ship `SKILL.md` before release.

## Reversibility and Rollback

- High. Remove the four names and trees, restore the setup test title, and revert README rows. Destinations keep stale copies until the next setup, matching current unmanaged-skill behavior.
- No packet-root or engine prompt migration is required to roll back.

## Implementation Notes

- Do not invent `src/tdd-*.ts` or a `spec-finder tdd-*` command in V1.
- Do not edit core `sf-execute-task`, `sf-task-report`, `sf-batch-tasks`, or `sf-memory` contracts.
- Retitle the setup test that currently says “exactly nine”.
- Document when-to-use TDD vs core and the re-run-setup note in `README.md`.

## Follow-ups

- Later runtime opt-in can retarget engine prompts without changing these trees.
- Optional later shared helper or audit skill if missing-red becomes recurring.

## References

- [ADR-001: Parallel Opt-In TDD Skill Pack](adr-001-parallel-tdd-skill-pack.md)
- [ADR-002: Self-Contained Doctrine and TDD Completion Policy](adr-002-self-contained-doctrine-and-completion-policy.md)
- [Issue #14](https://github.com/MatheusBBarni/spec-finder/issues/14)
