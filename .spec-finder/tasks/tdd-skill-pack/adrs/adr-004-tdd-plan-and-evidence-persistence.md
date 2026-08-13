# ADR-004: TDD Plan and Evidence Persistence

## Status

Accepted

## Date

2026-08-13

## Context

The TDD pack must persist ordered seams/slices and falsifiable red/green evidence without a second packet root and without changing core skill templates.

Current contracts:

- `task_NN.md` has required body sections; extra headings are allowed (`skills/sf-create-tasks/references/task-context-schema.md`).
- Task frontmatter is Zod `.passthrough()` (`src/tasks.ts`); unknown keys survive but the engine ignores them.
- Per-task memory is `.spec-finder/tasks/<slug>/memory/task_NN.md` with fixed headings. `sf-memory` compaction preserves those default headings and forbids dumping large transcripts.
- Core reports live at `reports/task_NN.md` and do not have a red-phase table.

PRD F-03/F-04/F-05 require additive planning, per-slice red-before-green notes, and a report gate. ADR-002 forbids interactive seam approval and requires a one-line not-applicable reason.

## Decision Drivers

- F-03: an existing task can gain a visible TDD plan without renumbering the graph.
- F-04 / G-01: slice N cannot implement before red evidence for the same test identity.
- F-05 / G-04: completed behavioral reports need red and green command evidence, or a task-level not-applicable reason.
- Do not change mode-neutral `sf-memory` or invent a runtime-owned `execution`/`tdd` frontmatter key in V1.

## Evidence

| Kind | Finding | Source | Version/date |
|---|---|---|---|
| Repository | Extra task headings are skill-legal; required sections stay. | `skills/sf-create-tasks/references/task-template.md` | 2026-08-13 |
| Repository | Memory compaction preserves default headings only. | `skills/sf-memory/references/memory-guidelines.md` | 2026-08-13 |
| Repository | Frontmatter passthrough would persist `tdd:` / `execution:` without engine behavior. | `src/tasks.ts` `frontmatterSchema` | 2026-08-13 |
| Repository | Memory forbids large command transcripts. | `skills/sf-memory/SKILL.md` | 2026-08-13 |
| User decision | Q2: task `## TDD Plan` + existing memory headings. Q5: not-applicable in plan + report, not frontmatter. | TechSpec clarification | 2026-08-13 |

## Decision

### Durable plan

`sf-tdd-plan` adds or updates an additive `## TDD Plan` section on the existing `task_NN.md`. It does not replace required create-tasks sections, renumber IDs, or rewrite `_tasks.md` except where that index already mentions the task outcome in prose.

The section records:

- Applicability: `applicable` or `not_applicable`.
- When `not_applicable`, exactly one line of reason. Missing reason is incomplete.
- Derived public seams and an ordered slice list with observable test identities (not vague names such as “test happy path”).

Seams are derived from the approved task, TechSpec, and any existing plan. No interactive letter-choice gate is required to start execute.

### Per-slice evidence

`sf-tdd-execute` writes factual per-slice notes into the current `memory/task_NN.md` **existing** headings:

- `Important Decisions` — applicability, seam derivation, test identity chosen.
- `Learnings` — red command, intended fail reason, green rerun of the same identity, decisive short excerpt.
- `Ready for Next Run` — next slice; `red done / green incomplete` vs `green done → next red`.

Do not add `## TDD Slices` in V1. Do not change `sf-memory` templates. Keep excerpts short enough to satisfy the no-transcript memory rule; the report holds the auditable table.

### Report

Manual `sf-tdd-report` writes `reports/task_NN.md` using a TDD template that includes the core report fields plus a per-slice red/green table (or the task-level not-applicable reason). Honest `completed` is forbidden when any behavioral slice lacks red evidence without not-applicable coverage.

ACP `run` still targets `sf-task-report` and does not consume this template in V1.

### Not-applicable

Record only in `## TDD Plan` and the TDD report. Do not add `tdd` or `execution` frontmatter keys in V1.

## Alternatives Considered

### Dedicated `## TDD Slices` memory heading

- **Benefits:** Easier to scan the slice log.
- **Costs/risks:** Core memory compaction may drop the heading, or `sf-memory` must change (core skill).
- **Why not selected:** Clarification refused a core memory change.

### Memory-only plan

- **Benefits:** No task-file mutation.
- **Costs/risks:** Breaks F-03’s visible plan-on-task review surface.
- **Why not selected:** Plan must be reviewable on the task file.

### Frontmatter `tdd: not_applicable`

- **Benefits:** Easy to grep.
- **Costs/risks:** Looks like a runtime contract while the engine ignores it.
- **Why not selected:** Clarification refused a V1 frontmatter key.

## Consequences

### Positive

- Plan review lives on the task artifact operators already read.
- Resume works from existing memory headings without a new schema.
- Core memory and task frontmatter contracts stay unchanged.

### Negative and trade-offs

- Slice logs are mixed into generic memory headings; agents must follow skill guidance to keep them findable.
- `sf-create-tasks` regeneration must preserve an existing `## TDD Plan` the same way it preserves other approved body content; that is a TDD-plan skill concern when re-planning, not a create-tasks rewrite.

### Risks and mitigations

- **Memory excerpts too large** — require command identity, exit meaning, and a short decisive excerpt only.
- **Regeneration wipes the plan** — `sf-tdd-plan` is the re-author path; create-tasks remains non-TDD and must not be taught to delete unknown sections.
- **Not-applicable overuse** — missing reason blocks completed; reason must state there is no new/changed product behavior.

## Reversibility and Rollback

- High. Remove `## TDD Plan` sections and ignore TDD memory bullets. No migration of frontmatter or memory templates.
- Later audit or frontmatter opt-in can be added without moving these artifacts.

## Implementation Notes

- Plan template belongs in `skills/sf-tdd-plan/references/`.
- Report template belongs in `skills/sf-tdd-report/references/`.
- Execute skill must name the three memory headings and the resume rule.
- Test identity is the focused command plus the test name/filter used in both red and green runs.

## Follow-ups

- Optional later `## TDD Slices` heading only if operators cannot find resume state and a core memory change is explicitly approved.
- Runtime opt-in still deferred (PRD open question).

## References

- [ADR-002: Self-Contained Doctrine and TDD Completion Policy](adr-002-self-contained-doctrine-and-completion-policy.md)
- [ADR-003: Standalone TDD Skill Trees and Install Contract](adr-003-standalone-tdd-skill-trees.md)
