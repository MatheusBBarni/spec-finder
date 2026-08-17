# Parallel TDD Skill Pack Technical Specification

## Executive Summary

V1 adds four **standalone** portable skills — `sf-tdd-plan`, `sf-tdd-execute`, `sf-tdd-report`, `sf-tdd-batch` — beside the existing core pack. Each tree ships its own slim doctrine and templates. Setup copies them through the existing `SPEC_FINDER_SKILLS` allowlist (13 managed skills). `spec-finder upgrade` stays npm-only; existing workspaces re-run `setup` to recopy destinations.

TDD work stays inside the current packet root. Durable seams and slice order live in an additive `## TDD Plan` on `task_NN.md`. Per-slice red/green notes reuse existing `memory/task_NN.md` headings. Manual reports use a TDD template that requires red+green command evidence or a one-line not-applicable reason.

ACP `run` continues to prompt `sf-execute-task` / `sf-task-report`. Core skills stay mode-neutral. No new packet root, runtime module, report parser, or frontmatter execution key.

**Primary trade-off:** four doctrine copies and skill-enforced honesty instead of a shared helper or runtime hook. That is the smallest design that meets every approved requirement and the installer contract.

## Technical Evidence

| Kind | Finding/constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository | Managed install is a named-tree copy; unlisted dirs are not installed. | `src/setup.ts` `SPEC_FINDER_SKILLS` | 2026-08-13 | Four new trees + four allowlist names. |
| Repository | Upgrade is `npm install --global spec-finder@latest` only. | `src/commands.ts` `upgradeCommand` | 2026-08-13 | Docs: re-run `setup` after upgrade. |
| Repository | Setup test length follows the allowlist; title says “exactly nine”. | `tests/setup.test.ts` | 2026-08-13 | Retitle; assert 13 names including TDD. |
| Repository | ACP prompts hard-code core execute/report. | `src/engine.ts`; `tests/engine.test.ts` | 2026-08-13 | Do not change prompts in V1. |
| Repository | Extra task headings allowed; frontmatter is passthrough. | `task-context-schema.md`; `src/tasks.ts` | 2026-08-13 | Additive `## TDD Plan`; no new YAML key. |
| Repository | Memory has fixed headings; no large transcripts. | `skills/sf-memory/` | 2026-08-13 | Slice notes in existing headings only. |
| Repository | Core report has no red table; engine checks length ≥ 120. | `report-template.md`; `src/engine.ts` | 2026-08-13 | TDD report template is skill-only. |
| Repository | Core batch already has deps, stop-on-failure, checkpoint CLI. | `skills/sf-batch-tasks/SKILL.md` | 2026-08-13 | TDD batch clones that contract, swaps execute/report. |
| Official / upstream | `/tdd` doctrine: red-first, one slice, public seams, three anti-patterns; also requires interactive seam confirmation. | `~/.agents/skills/tdd/SKILL.md` | 2026-08-13 | Vendor slim copy; override interactive seams per ADR-002. |
| User decision | Approach A; Q1–Q6 as recorded. | TechSpec clarification | 2026-08-13 | ADRs 003–004. |

## Requirement Traceability

| PRD ID | Technical obligation | Component/interface | Verification | Status/gap |
|---|---|---|---|---|
| G-01 | Per behavioral slice: fail focused command, then pass the same identity. | `sf-tdd-execute`, memory notes, `sf-tdd-report` | Skill gates + sample report shape review | Covered |
| G-02 | Core create/execute/report/batch and ACP prompts unchanged in role. | Core skills; `implementationPrompt` / `reportPrompt` | Existing engine tests + no core skill rewrite | Covered |
| G-03 | Setup destination can TDD without global `/tdd`. | Four skill trees + duplicated doctrine | Setup install of 13 `SKILL.md` files | Covered |
| G-04 | Completed requires red+green or not-applicable reason. | `## TDD Plan`; TDD report template | Skill contract review (M-03) | Covered |
| G-05 | README when-to-use; setup installs four skills. | `README.md`; `SPEC_FINDER_SKILLS` | Doc presence + setup test | Covered |
| US-01 | Opt-in without core rewrites. | Parallel trees only | Diff excludes core skill role changes | Covered |
| US-02 | Red fail then green pass visible. | Memory notes + report table | Template requires both columns | Covered |
| US-03 | Same pack for operators and maintainers. | One skill set + one README surface | README rows | Covered |
| US-04 | Plan enriches existing tasks. | `sf-tdd-plan` → `## TDD Plan` | Plan skill contract | Covered |
| US-05 | TDD batch stop-on-failure. | `sf-tdd-batch` | Skill HARD-GATE | Covered |
| US-06 | Not-applicable one-line reason. | Plan + report | Missing reason = incomplete | Covered |
| US-07 | Doctrine in installed pack. | Per-skill `tdd-doctrine.md` | Install tree inspection | Covered |
| US-08 | Cockpit `run` stays core. | `src/engine.ts` | Engine prompt tests | Covered |
| F-01 | Four skills; core default; setup install. | `skills/sf-tdd-*`; allowlist | M-01 | Covered |
| F-02 | Slim self-contained doctrine. | Duplicated `references/tdd-doctrine.md` | Clean-destination usability | Covered |
| F-03 | Additive plan; N/A; no interactive seams. | `sf-tdd-plan` | Plan template | Covered |
| F-04 | Forced red→green; no horizontal slice; resume; lifecycle split. | `sf-tdd-execute` | Skill HARD-GATE | Covered |
| F-05 | Report gate; do not replace core report. | `sf-tdd-report` | Template + M-02 review | Covered |
| F-06 | When-to-use + ACP stays core. | `README.md` | M-05 | Covered |
| M-01 | 4 TDD skills installed. | Setup result | `tests/setup.test.ts` | Covered |
| M-02 | Sample completed TDD reports include red+green. | Report template + skill rule | Contract review, not parser | Covered (no runtime parser; Q6) |
| M-03 | N/A completes without theater red. | Plan/report | Contract review | Covered |
| M-04 | ACP still names core skills. | Engine prompts | Engine tests | Covered |
| M-05 | README documents TDD vs core. | `README.md` | Doc check | Covered |
| Constraints | Packet layout, dual-ownership ban, no target-framework mandate, portable skills. | All TDD skills | Design below | Covered |
| Non-goals | No core hardening, no default `run` switch, no audit skill, no dogfood ship gate, no cockpit meters, no edit-blocking hooks. | Explicit absences | Impact analysis | Covered |

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs/outputs | Dependencies |
|---|---|---|---|---|
| `skills/sf-tdd-plan` | New | Derive/update seams + ordered slices; record N/A | Reads task/TechSpec/ADRs; writes `## TDD Plan` | `sf-memory` (read); doctrine copy |
| `skills/sf-tdd-execute` | New | One-task red→green loop; memory notes; lifecycle split | Reads task + plan + memory; edits production/tests; updates memory | Doctrine; `sf-memory`; `sf-tdd-report` on manual path |
| `skills/sf-tdd-report` | New | Evidence report + completed gate | Reads memory/diff/commands; writes `reports/task_NN.md` | Doctrine; TDD report template |
| `skills/sf-tdd-batch` | New | Range orchestration via TDD execute only | Range → sequential tasks; checkpoint CLI | `sf-tdd-execute`, `sf-tdd-report`, config `auto_commit` |
| `SPEC_FINDER_SKILLS` | Existing | Copy allowlist | 13 names | `bundledSkillsPath()` |
| `src/engine.ts` prompts | Existing, unchanged | ACP still targets core execute/report | Same | Tests lock strings |
| Core `sf-*` | Existing, unchanged | Default non-TDD path | Unchanged | — |
| Packet artifacts | Existing | `task_NN.md`, `memory/`, `reports/` | Additive section + notes | No new files required |

### Data and Control Flow

**Normal (manual, behavioral)**

1. Optional `sf-tdd-plan` writes/updates `## TDD Plan`.
2. `sf-tdd-execute` (or batch) derives seams if the section is missing, walks slice N: write one failing public-seam test → focused command must fail for the intended missing behavior → minimal production code → same command must pass → memory note.
3. Manual path invokes `sf-tdd-report`, then sets status to the report verdict.
4. Batch continues only on `status: completed` + completed verdict; then optional `checkpoint complete`.

**Not-applicable**

Plan records `not_applicable` + one-line reason. Execute skips fake red. Report may complete with that reason and no red table rows.

**Empty plan**

Execute derives seams from task + TechSpec + memory and proceeds. Interactive approval is forbidden. Plan skill remains recommended for multi-slice work.

**Failure**

Red command passes unexpectedly, green fails, or evidence is missing → stop the slice; task stays `failed`/`blocked`; partial notes remain in memory. Batch does not start the next task.

**Cancellation / resume**

Read `Ready for Next Run`. If red exists for the same test identity and green is incomplete, finish green. If green is done, start the next red. Do not invent a different red test without a recorded reason.

**ACP `run`**

Unchanged. If an operator somehow invokes a TDD skill during ACP, TDD execute/report still must not write status or the report; the runtime owns those phases. V1 does not prompt TDD skills.

## Implementation Design

### Core Interfaces

Allowlist append (TypeScript, existing module):

```ts
export const SPEC_FINDER_SKILLS = [
  "sf-idea-factory",
  "sf-create-prd",
  "sf-create-techspec",
  "sf-create-tasks",
  "sf-memory",
  "sf-execute-task",
  "sf-task-report",
  "sf-batch-tasks",
  "sf-tdd-plan",
  "sf-tdd-execute",
  "sf-tdd-report",
  "sf-tdd-batch",
  "sf-archive-tasks",
] as const
```

Errors: if a listed tree is missing, existing stage `cp` fails and setup aborts; no new error type.

TDD plan section (Markdown contract on `task_NN.md`):

```markdown
## TDD Plan

- Applicability: applicable | not_applicable
- Not-applicable reason: <one line or omitted>

### Seams
- `<public interface>` — <observable behavior>

### Slices (order is execution order)
1. `<test identity>` at `<seam>` — <observable behavior>
```

Ownership: `sf-tdd-plan` (and execute when deriving). Compatibility: extra section; required create-tasks sections stay.

TDD report slice table (manual `reports/task_NN.md`):

```markdown
## TDD Evidence
| Slice | Test identity | Red command / result | Green command / result |
|---|---|---|---|
| 1 | user can checkout with valid cart | `bun test a.test.ts -t checkout` fail | same command pass |
```

Or a single not-applicable reason line covering the whole task. Honest `completed` is invalid without one of those two shapes.

### Data Models and Lifecycle

- **Plan:** Markdown on the task file. Updated in place. Regeneration of tasks by `sf-create-tasks` is out of TDD-plan scope; re-planning uses `sf-tdd-plan`.
- **Slice evidence:** factual bullets in `Important Decisions`, `Learnings`, `Ready for Next Run`. Create-if-missing memory files still come from `sf-memory`.
- **Not-applicable:** plan + report only. No frontmatter key.
- **Concurrency:** one lifecycle owner per run (existing rule). Batch is sequential.
- **Retention:** same as other packet artifacts; archive skill treats completed packets as today.

### External Interfaces

No new network, provider, or CLI command. Batch reuses:

```text
spec-finder checkpoint begin <slug> <task_id>
spec-finder checkpoint complete <slug> <task_id>
```

Same success/failure as core batch: non-zero begin stops before execute; non-zero complete stops before the next task.

Skill invocation (documentation only, same style as core batch):

```text
/sf-tdd-plan <slug> [task_id|range|all]
/sf-tdd-execute <slug> <task_id>
/sf-tdd-report <slug> <task_id>
/sf-tdd-batch <slug> <range> [force]
```

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility/migration |
|---|---|---|---|---|
| `SPEC_FINDER_SKILLS` | 9 names | +4 TDD names | Missing tree fails setup | Existing dest stale until re-setup |
| `tests/setup.test.ts` | “exactly nine” | 13 skills / retitle | Test fail | Assertion already uses `.length` |
| `src/engine.ts` | Core skill strings | None | — | V1 compatible |
| `sf-create-tasks` | Required sections | None | Extra `## TDD Plan` legal | No template change |
| `sf-memory` | Fixed headings | None | Extra heading would be at risk | Notes stay in default headings |
| `sf-batch-tasks` | Core execute | Unchanged sibling | — | TDD batch is parallel |
| `README.md` | 9-row pipeline | Add TDD rows + when-to-use + re-setup note | Doc gap vs M-05 | Additive |
| Target-repo tests | Repo’s focused command | TDD skills use that command | Cannot invent a framework | No Bun mandate for foreign repos |

## Failure and Recovery Behavior

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| Listed TDD tree missing at setup | `cp` / `access(SKILL.md)` | Setup fails; prior dest rolled back by existing transaction | Restore trees; rerun setup | Existing setup transaction |
| Upgrade without re-setup | Destination still 9 skills | TDD invoke missing | Run `spec-finder setup` | README |
| Red command passes | Execute observes unexpected pass | Stop; do not write production for that slice | Fix test honesty or mark N/A with reason | Memory + report not completed |
| Green command fails | Focused rerun non-zero | Stop; keep red notes | Minimal fix; rerun same identity | Memory |
| Missing red on behavioral complete | Report skill gate | Forbid `completed`; use `failed`/`blocked` | Resume execute | Report template |
| N/A missing reason | Plan/report validation | Incomplete | Add one-line reason | Plan section |
| Horizontal slicing | Execute HARD-GATE | Stop; do not accept all-tests-then-code | Restart as vertical slices | Doctrine |
| Dual lifecycle write | Execute/report HARD-GATE | Do not write status/report under ACP | Leave runtime as owner | Same as core |
| Batch task failed/blocked | Status/verdict gate | Stop range | Fix task; rerun remaining | Batch summary |
| Checkpoint begin/complete blocked | CLI non-zero | Stop like core batch | Resolve git; rerun delivery | Checkpoint metadata |
| Stale/partial command output | Existing execute rule | Not evidence | Poll to terminal exit | Skill text |
| Doctrine drift across 4 copies | Maintainer review | Misaligned gates | Refresh all four copies together | Alignment note |

## Security and Privacy

- No new secrets, network, or permissions.
- Trust boundary remains the workspace + already-installed skills.
- Reports/memory may contain command text and short excerpts; do not paste secrets, env files, or full transcripts.
- Fail closed on missing red evidence (cannot claim completed).
- Setup continues to refuse symlink-managed destinations (existing preflight).
- Abuse case: fabricated red excerpts — V1 mitigation is human-readable command identity + excerpt, not cryptographic proof.

## Compatibility, Migration, and Rollback

- **Versioning:** additive skills. No config schema change. Config stays strict (`src/config.ts` untouched).
- **Existing packets:** valid without `## TDD Plan`. Execute may derive seams.
- **Existing destinations:** remain 9 skills until `setup`.
- **Rollout:** ship trees + allowlist; document re-setup.
- **Backward compatibility:** core path identical; ACP prompts identical.
- **Rollback:** remove four names/trees and README rows. Stale dest copies persist until next setup (same as today’s unmanaged leftovers).
- **Cleanup:** none required beyond optional dest delete of `sf-tdd-*`.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|
| `skills/sf-tdd-plan/` | Create | Low | Author SKILL + doctrine + plan template |
| `skills/sf-tdd-execute/` | Create | Medium | Author loop + lifecycle + memory rules |
| `skills/sf-tdd-report/` | Create | Medium | Author template + completed gate |
| `skills/sf-tdd-batch/` | Create | Low | Clone batch; swap execute/report |
| `src/setup.ts` | Allowlist +4 | Low | Append names |
| `tests/setup.test.ts` | Title + coverage | Low | Retitle; assert TDD `SKILL.md` |
| `tests/engine.test.ts` | Keep prompt locks | Low | Add/keep assertions for core names |
| `README.md` | Docs | Low | Pipeline + when-to-use + re-setup |
| `package.json` `files: skills` | None extra | None | Trees ship automatically |
| Core `sf-*` skills | None | High if touched | Do not change roles |
| `src/engine.ts` | None | High if changed | Do not retarget V1 |
| `src/memory.ts` / `sf-memory` | None | Medium if extra heading | Do not add `## TDD Slices` |
| `src/tasks.ts` | None | Medium if new YAML key | Do not add `tdd`/`execution` |
| Historical “nine skills” task docs | Stale wording | Low | Do not rewrite archived packets |

## Testing and Evidence

### Unit Tests

- `SPEC_FINDER_SKILLS` contains exactly the four TDD names plus the nine core names (order as specified).
- Setup matrix still installs every listed skill’s `SKILL.md` for each provider × local/global.
- Engine implementation prompt still contains `Use the sf-execute-task skill`.
- Engine report prompt still contains `Use the sf-task-report skill if it is installed.`

### Integration Tests

- Existing setup transaction/rollback tests remain valid with 13 trees (they iterate the allowlist).
- No new ACP session test that targets TDD skills.

### End-to-End or Platform Evidence

- Manual/contract review: a sample behavioral TDD report shape includes red and green columns; a sample N/A report completes with a one-line reason and no theater red (M-02, M-03).
- README contains TDD vs core when-to-use and states ACP `run` stays on core (M-05).
- Native Windows/npm smoke already runs `setup`/`upgrade`; no extra platform suite unless setup regressions appear.

### Verification Gates

- Focused: `bun test tests/setup.test.ts` and `bun test tests/engine.test.ts` while iterating.
- Repository: `bun run verify`.

## Observability

- No new metrics or structured runtime events.
- Operator-visible signals: plan section, memory bullets, report table, batch summary, setup `installed managed skills: 13`.
- Success: completed report with red+green or N/A reason.
- Failure: failed/blocked verdict, batch stop, setup transaction error.
- Redact secrets from command excerpts.

## Development Sequencing

1. Author shared slim doctrine text (from `/tdd`, with non-interactive seam override) — no code dependencies.
2. Create `skills/sf-tdd-plan` (SKILL + doctrine copy + plan template) — depends on step 1 for doctrine content.
3. Create `skills/sf-tdd-execute` (loop, lifecycle, memory headings, doctrine copy) — depends on step 1; may derive plan if step 2 section absent.
4. Create `skills/sf-tdd-report` (template + completed gate + doctrine copy) — depends on step 1; consumes execute evidence shape from step 3.
5. Create `skills/sf-tdd-batch` (clone core batch, TDD execute/report, checkpoints) — depends on steps 3–4.
6. Append names to `SPEC_FINDER_SKILLS` and update setup/engine contract tests — depends on steps 2–5 so `cp` finds `SKILL.md`.
7. Update `README.md` pipeline, when-to-use, and re-run-setup note — depends on skill names from steps 2–5.
8. Run `bun run verify` — depends on steps 6–7.

Steps 2–5 are sequentially authored but trees are independent at runtime. Doctrine copies in 2–5 must stay byte-equivalent except skill-local templates.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|
| Four doctrine copies drift | ADR-003 | Inconsistent gates | Refresh all copies when `/tdd` material changes; maintainers |
| Upgrade does not recopy dest | `upgradeCommand` | Missing TDD skills after npm bump | README re-setup; Q1 |
| Fake red excerpts | Agent anti-pattern | False completed | Report requires command identity + fail-then-pass; no parser in V1 |
| N/A overuse | ADR-002 | Skipped needed red | One-line reason required; tighten later if abused |
| Weak derived seams | No interactive gate | Tests at poor boundaries | Review via plan/report; later audit skill |
| Runtime opt-in mechanism | PRD open question | Out of V1 | Separate design: config vs frontmatter vs CLI |
| `/tdd` version cadence | PRD open question | Doctrine lag | Maintainer refresh policy, not a V1 code gate |
| Optional dogfood packet | PRD non-goal | No sample packet in ship bar | Post-V1 if wanted |

## Architecture Decision Records

- [ADR-001: Parallel Opt-In TDD Skill Pack](adrs/adr-001-parallel-tdd-skill-pack.md) — four-skill parallel pack; core path unchanged.
- [ADR-002: Self-Contained Doctrine and TDD Completion Policy](adrs/adr-002-self-contained-doctrine-and-completion-policy.md) — vendored doctrine, non-interactive seams, N/A escape, V1 ship bar.
- [ADR-003: Standalone TDD Skill Trees and Install Contract](adrs/adr-003-standalone-tdd-skill-trees.md) — Approach A, duplicated doctrine, re-run setup, checkpoint parity, contract tests.
- [ADR-004: TDD Plan and Evidence Persistence](adrs/adr-004-tdd-plan-and-evidence-persistence.md) — `## TDD Plan` on tasks; memory notes in existing headings; N/A in plan+report only.
