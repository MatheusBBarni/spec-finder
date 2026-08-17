# Parallel TDD Skill Pack - Product Requirements Document

## Overview

Spec Finder already requires tests with implementation, but agents can still implement production code first and finish with a green suite that never went red.
Operators and maintainers who want honest test-first file creation need an **opt-in parallel skill pack** that forces red → green vertical slices, records red and green command evidence, and leaves core skills mode-neutral for research, docs, and non-TDD work.

**Selected approach:** full parallel pack (`sf-tdd-plan`, `sf-tdd-execute`, `sf-tdd-report`, `sf-tdd-batch`), skill-only opt-in, self-contained doctrine, non-interactive seam derivation, not-applicable escape for non-behavioral tasks.
**MVP boundary:** install via setup/upgrade, enforceable red→green (or not-applicable) completion policy, and docs for when to use TDD vs core.
**Out of MVP:** default ACP `run` switch, interactive seam gates, audit skill, mandatory dogfood packet, cockpit red/green UI.

## Research Evidence

| Kind | Finding | Source | Date | Product consequence |
|---|---|---|---|---|
| Repository | Core execute verifies focused tests but does not require a failing test before production code. | `skills/sf-execute-task/SKILL.md` | 2026-08-11 | Need a separate TDD execute path for red-before-green. |
| Repository | Create-tasks keeps tests with implementation; no red-before-green order or seam list. | `skills/sf-create-tasks/SKILL.md` | 2026-08-11 | Plan skill enriches tasks additively; does not replace create-tasks. |
| Repository | Task report has no red-phase evidence requirement. | `skills/sf-task-report/references/report-template.md` | 2026-08-11 | TDD report path must require red + green evidence. |
| Repository | Batch only invokes core execute; runtime prompts only core skills. | `skills/sf-batch-tasks/SKILL.md`, `src/engine.ts` | 2026-08-11 | TDD batch is parallel; cockpit `run` stays non-TDD in V1. |
| Repository | Setup installs a fixed managed skill list by copy. | `src/setup.ts` | 2026-08-11 | New skills must install with setup/upgrade. |
| External | Agents default to horizontal bulk tests; vertical one-test-one-impl is the fix. | [AI Hero TDD skill](https://www.aihero.dev/skill-test-driven-development-claude-code) | Accessed 2026-08-11 | Ban horizontal slicing as a hard product rule. |
| External | AI-assisted TDD products separate red/green phases and plan before coding. | [VS Code TDD guide](https://code.visualstudio.com/docs/agents/guides/test-driven-development-guide) | Accessed 2026-08-11 | Plan + execute + report phase shape is market-aligned. |
| External | Prompt-only TDD is weak; some stacks add hooks. | [TDD Guard](https://nizar.se/tdd-guard-for-claude-code/) | Accessed 2026-08-11 | V1 uses skill gates + evidence; runtime hooks later. |
| User decision | Outcome A; users C; doctrine A; seams C; non-behavior A; ship bar A; approach A. | PRD clarification | 2026-08-11 | Scope and policies below. |
| User decision | Parallel pack, not core hardening. | [Issue #14](https://github.com/MatheusBBarni/spec-finder/issues/14) | 2026-08-11 | Core path remains default. |

## Goals

| ID | Goal | Measurable outcome |
|---|---|---|
| G-01 | Honest red→green for opted-in behavioral work | Every behavioral slice under TDD execute shows a failing focused command before production code for that slice, then a pass of the same command. |
| G-02 | Mode-neutral core path preserved | Core create/execute/report/batch behavior and ACP default prompts remain non-TDD. |
| G-03 | Self-contained opt-in for operators and maintainers | After setup/upgrade, TDD plan/execute/report/batch work without a separate global `/tdd` skill. |
| G-04 | Truthful completion and non-behavior honesty | TDD completed verdicts require red+green evidence or an explicit not-applicable reason; no theater tests required for non-behavioral tasks. |
| G-05 | Discoverable pack | README states when to use TDD vs core; setup installs the four skills. |

## User Stories

| ID | Persona | Story | Acceptance signal |
|---|---|---|---|
| US-01 | Operator | As an operator, I want to opt into TDD for a task without changing core skills, so research/docs packets stay simple. | Invoking TDD skills does not require core skill rewrites; core path still works. |
| US-02 | Operator | As an operator, I want each behavior slice to fail for the right reason before production code, so tests are honest. | Slice log/report shows red command fail then green pass. |
| US-03 | Maintainer | As a maintainer, I want the same TDD skills and docs as operators, so dogfooding and external use match. | One skill pack and one when-to-use doc surface both audiences. |
| US-04 | Operator | As an operator, I want ordered seams and slices planned for multi-slice work, so execution is not ad hoc. | `sf-tdd-plan` can add/update a TDD plan on an existing task without replacing create-tasks. |
| US-05 | Operator | As an operator, I want batch TDD runs to stop on failure, so a broken slice does not cascade silently. | `sf-tdd-batch` runs only via TDD execute and stops when a task fails/blocks. |
| US-06 | Operator | As an operator on non-behavioral work, I want an explicit not-applicable path, so I am not forced into fake red tests. | Plan/report records one-line reason; completed allowed without red cycles. |
| US-07 | Operator | As an operator after install, I want TDD usable immediately, so I do not hunt for a global doctrine skill. | Setup-installed pack includes doctrine needed for red/green work. |
| US-08 | Returning operator | As an operator using cockpit `run`, I want familiar non-TDD defaults, so V1 does not surprise me. | Default ACP prompts still name core execute/report. |

## Core Features

### F-01: Parallel TDD skill pack (plan, execute, report, batch)

- **User value:** Clear opt-in path for honest TDD without forcing every packet.
- **Mapped goals/stories:** G-01, G-02, G-05; US-01, US-03, US-04, US-05, US-08.
- **MUST:** Ship four portable skills: `sf-tdd-plan`, `sf-tdd-execute`, `sf-tdd-report`, `sf-tdd-batch`.
- **MUST:** Leave core `sf-create-tasks`, `sf-execute-task`, `sf-task-report`, and `sf-batch-tasks` as the default non-TDD path.
- **MUST:** Install the pack through normal Spec Finder setup/upgrade alongside core skills.
- **SHOULD:** Mirror core batch dependency safety and stop-on-failure behavior in `sf-tdd-batch`.
- **Acceptance conditions:** Operators can invoke each skill by name; core path remains available and is the ACP default.

### F-02: Self-contained TDD doctrine

- **User value:** Install alone is enough to run the loop correctly.
- **Mapped goals/stories:** G-03; US-03, US-07.
- **MUST:** Bundle slim doctrine covering red before green, one vertical slice, public seams, good tests as behavior specs, and stop-condition anti-patterns (implementation-coupled, tautological, horizontal slicing).
- **MUST NOT:** Require a user-global `/tdd` skill path to complete TDD work after setup.
- **SHOULD:** State that doctrine is kept aligned with the upstream `/tdd` skill for maintainers.
- **Acceptance conditions:** A clean setup destination can plan/execute/report TDD without installing extra doctrine skills.

### F-03: TDD planning as additive enrichment

- **User value:** Seams and ordered tracer-bullet slices are visible before or during multi-slice work.
- **Mapped goals/stories:** G-01, G-04; US-04, US-06.
- **MUST:** `sf-tdd-plan` can add or update ordered TDD plan content (seams + slice-level test names/order) for existing implementation tasks without replacing `sf-create-tasks`.
- **MUST:** Support marking a task not applicable for TDD with a one-line reason when there is no new/changed product behavior.
- **MUST NOT:** Require interactive seam approval before execute (seams may be derived from task, techspec, and plan artifacts).
- **SHOULD:** Reject vague slice names such as “test happy path” during planning when they lack observable behavior.
- **Acceptance conditions:** An existing task file can gain a TDD plan section/log without renumbering or rewriting the core task graph.

### F-04: Forced red→green execution loop

- **User value:** Behavioral changes cannot honestly complete under TDD without watching tests fail first.
- **Mapped goals/stories:** G-01, G-04; US-02, US-06.
- **MUST:** For each behavioral slice: write one failing test at a public seam, run focused command and require failure for the intended missing behavior, write minimal production code, rerun and require pass.
- **MUST:** Forbid production implementation for slice N before red evidence for slice N exists in the session or recorded task memory for the same failing test identity.
- **MUST:** Forbid horizontal “all tests then all code” slicing.
- **MUST:** Skip fake red cycles when not-applicable is recorded with a reason; still allow honest completion for that path.
- **MUST:** Preserve Spec Finder lifecycle ownership (manual skill vs ACP runtime dual-ownership ban).
- **SHOULD:** Resume interrupted slices from memory (red done/green incomplete → green; green done → next red).
- **Acceptance conditions:** A behavioral TDD execute leaves per-slice red and green command notes; a not-applicable task can complete without invented tests.

### F-05: Red+green evidence report gate

- **User value:** Completion claims are falsifiable.
- **Mapped goals/stories:** G-01, G-04; US-02, US-06.
- **MUST:** `sf-tdd-report` require, for each behavioral slice, failing command evidence and passing command evidence (or task-level not-applicable reason).
- **MUST:** Forbid honest `completed` when any behavioral slice lacks red evidence without not-applicable coverage.
- **MUST NOT:** Replace or break core `sf-task-report` for the non-TDD path.
- **SHOULD:** Record files touched and decisive excerpts sufficient to audit honesty.
- **Acceptance conditions:** A report without red evidence cannot claim completed for behavioral work; core report skill remains usable for non-TDD runs.

### F-06: Discoverability and when-to-use guidance

- **User value:** Operators and maintainers know which path to choose.
- **Mapped goals/stories:** G-05; US-01, US-03, US-08.
- **MUST:** Document the optional TDD pack, how it differs from core execute/report, and when to use each path.
- **MUST:** State that ACP `run` remains on core skills until a separate opt-in design.
- **Acceptance conditions:** A reader of product docs can choose TDD vs core without reading issue #14.

## User Experience

**Primary journey**

1. Operator or maintainer installs/upgrades Spec Finder (skills land in the agent skill destination).
2. For code-changing work that needs honest tests, they run `sf-tdd-plan` (recommended for multi-slice work) then `sf-tdd-execute` for one task, or `sf-tdd-batch` for a range.
3. Execute walks one slice at a time: red → observe fail → green → observe pass → memory note.
4. Manual path finishes with `sf-tdd-report` and status aligned to verdict.
5. Non-TDD or research work continues on core skills unchanged.
6. Cockpit `run` continues to feel like today (core execute/report).

**Empty / loading / success / failure**

- **Empty plan:** execute may derive seams/slices from task and techspec without interactive approval; recommended plan skill remains available.
- **Success:** report shows completed with red+green table (or not-applicable reason).
- **Failure:** batch stops; task remains failed/blocked with partial slice evidence retained in memory when available.
- **Recovery:** resume from last incomplete slice using memory; do not invent a different red test without reason.

**Accessibility / discoverability**

- Skills discoverable by name after setup.
- Docs use plain product language: when honest red-first matters vs when core path is enough.
- No color-only status; evidence is command text in reports/memory.

## High-Level Constraints

- Preserve ACP vs manual lifecycle ownership; never dual-write status/report.
- Stay inside existing packet layout under `.spec-finder/tasks/<slug>/`.
- Do not change default runtime execution skill targets in V1.
- Do not force TDD on idea/PRD-only or non-behavioral packets.
- Do not prescribe target-repo test frameworks; use the repository’s existing focused test and verification commands.
- Portable Agent Skills with progressive disclosure; long doctrine in references.

## Non-Goals

- **Hardening core skills into mandatory TDD** - reconsider only if evidence shows opt-in adoption is near-zero and non-code packets can stay safe.
- **Default ACP `run` to TDD skills** - separate opt-in design (config, frontmatter, or CLI).
- **Interactive seam approval at every execute** - rejected for V1; review via plan/report.
- **Read-only audit skill (`sf-tdd-audit`)** - later if missing-red becomes a recurring pain.
- **Mandatory dogfood packet in the ship bar** - optional follow-up.
- **Cockpit red/green meters, CI service install, property-based/mutation testing mandates** - separate products.
- **Replacing Bun/test-framework choices in target repos** - out of scope.
- **Runtime hook enforcement that blocks file edits** - later hardening option, not V1.

## Phased Rollout Plan

### MVP

- Four skills: plan, execute, report, batch.
- Self-contained doctrine and evidence templates.
- Setup/upgrade installs the pack.
- Red→green hard gates + not-applicable escape + report completion gate.
- README when-to-use guidance.
- **Entry:** approved PRD and downstream design/tasks.
- **Exit:** skills installable; gates documented and skill-enforceable; docs published; any code/helpers for install pass the repo verification gate.

### Later phases

- Runtime opt-in for `run` / future `loop` when TDD path is selected.
- Optional `sf-tdd-audit` for missing-red / anti-pattern checks.
- Optional dogfood packet with sample plan/memory/report evidence.
- Cockpit visualization of red/green only with a separate UX decision.

## Success Metrics

| ID | Metric | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| M-01 | Pack install coverage | 0 TDD skills in managed list | 4 TDD skills installed by setup/upgrade | Setup result / managed skill list inspection | Release gate |
| M-02 | Behavioral red evidence gate | N/A (no TDD report path) | 100% of sample behavioral TDD reports that claim completed include red and green command evidence per slice | Manual or automated inspection of skill rules + sample report shape | Release gate |
| M-03 | Non-behavior honesty | N/A | Not-applicable tasks can complete with one-line reason and no forced theater red cycle | Skill contract review / example path | Release gate |
| M-04 | Core path preservation | Core path is default | ACP default prompts still name `sf-execute-task` / `sf-task-report`; core skills unchanged in role | Engine prompt and skill surface review | Release gate |
| M-05 | Discoverability | Issue-only knowledge | README documents TDD vs core when-to-use | Doc presence check | Release gate |

## Risks and Mitigations

| Risk | Evidence | Likelihood/impact | Mitigation | Owner/decision trigger |
|---|---|---|---|---|
| Opt-in underuse | No runtime default | Medium / Medium | Docs + install-by-default skills; later runtime opt-in if needed | Product; revisit after first maintainer usage cycle |
| Fake red / weakened tests | Known agent anti-pattern | Medium / High | Doctrine bans + report gate forbids completed without real fail-then-pass evidence | Skill authors; block completed on missing red |
| Not-applicable overuse | Classification is agent-driven | Medium / Medium | Require one-line reason; missing reason = incomplete | Skill authors; tighten criteria if abuse appears |
| Doctrine drift from `/tdd` | Vendored copy | Medium / Low | Alignment note and refresh when doctrine material changes | Maintainers |
| Confusion with core execute | Two paths | Medium / Medium | Explicit when-to-use docs; never claim silent drop-in replacement | Docs; PRD non-goals |
| Lifecycle dual-ownership | Existing hard rule | Low / High | Mirror core ownership rules in TDD execute/report | Runtime + skills |

## Architecture Decision Records

- [ADR-001: Parallel Opt-In TDD Skill Pack](adrs/adr-001-parallel-tdd-skill-pack.md) - approach A: four-skill parallel pack; core path unchanged; skill-only opt-in.
- [ADR-002: Self-Contained Doctrine and TDD Completion Policy](adrs/adr-002-self-contained-doctrine-and-completion-policy.md) - self-contained doctrine, non-interactive seams, not-applicable escape, V1 ship bar.

## Research Limitations

- No quantitative baseline for how often Spec Finder agents implement before tests under core execute.
- External agent-TDD evidence is strong on patterns, not Spec Finder adoption.
- Hook-based enforcement was researched and deferred; not validated as needed for V1.
- Success metric baselines are unknown; release uses contract and install evidence, not field conversion rates.

## Open Questions

- Preferred mechanism for a later runtime opt-in (`config`, task frontmatter `execution: tdd`, or CLI flag) when that work is scheduled.
- Whether maintainers want an optional dogfood packet after V1 as a docs/sample artifact rather than a ship gate.
- How aggressively to version/align vendored doctrine when the upstream `/tdd` skill changes.
