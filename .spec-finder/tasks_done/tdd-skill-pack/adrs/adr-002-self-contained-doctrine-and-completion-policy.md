# ADR-002: Self-Contained Doctrine and TDD Completion Policy

## Status

Accepted

## Date

2026-08-11

## Context

The parallel TDD pack must enforce red-before-green without requiring operators to install a separate global `/tdd` skill.
It must also define when seams are confirmed, how non-behavioral work escapes forced red cycles, and what “ready for V1” means for operators and maintainers.

## Decision Drivers

- Setup alone must make the pack usable for both operators and maintainers.
- Honest red→green proof is the primary outcome for behavioral work.
- Avoid interactive friction that blocks unattended or batch use.
- Avoid theater tests on docs/chore/research-only tasks.
- Keep the V1 success bar small: installable pack, honest gates, clear docs.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | Setup installs managed skills into agent skill destinations; installs must be self-contained for those skills. | `src/setup.ts` | 2026-08-11 |
| Repository | Task memory already supports factual per-task logs suitable for red/green evidence. | `skills/sf-memory/SKILL.md` | 2026-08-11 |
| Repository | Core report template has no red-phase evidence section. | `skills/sf-task-report/references/report-template.md` | 2026-08-11 |
| External | Good agent TDD practice agrees seams/public interfaces and works vertical slices; horizontal bulk tests are an anti-pattern. | [AI Hero TDD skill](https://www.aihero.dev/skill-test-driven-development-claude-code), user `/tdd` skill | Accessed 2026-08-11 |
| User decision | Fully self-contained doctrine after setup. | PRD clarification Q3 | 2026-08-11 |
| User decision | Never require interactive seam approval; derive seams and proceed; review via plan/report artifacts. | PRD clarification Q4 | 2026-08-11 |
| User decision | Explicit not-applicable escape with one-line reason for non-behavioral tasks. | PRD clarification Q5 | 2026-08-11 |
| User decision | V1 success bar: installable pack + honest completion gate + docs; no mandatory dogfood or audit skill. | PRD clarification Q6 | 2026-08-11 |

## Decision

Adopt the following product policies for the TDD pack V1:

### Doctrine packaging

- The pack ships a **slim self-contained doctrine** (aligned with the user `/tdd` skill: red before green, one vertical slice, public seams, good-test rules, anti-patterns).
- After `setup`/`upgrade`, operators and maintainers can plan, execute, and report without a separate global `/tdd` install.
- Doctrine may cite `/tdd` as the normative origin for maintainers keeping alignment, but runtime use must not depend on that path being present.

### Seams and planning

- Seams and ordered slices are derived from the approved task, techspec, and any existing TDD plan artifacts.
- **No interactive seam approval is required** to start execute.
- Operators review seams through plan artifacts, memory slice logs, and reports rather than a mandatory letter-choice gate at execute start.
- `sf-tdd-plan` remains available and recommended for multi-slice or multi-task work, but is not a hard product gate before every execute.

### Behavioral vs non-behavioral work

- Behavioral tasks that add or change product behavior **must** complete at least one red→green cycle per planned behavioral slice, with command evidence.
- Non-behavioral tasks (docs, pure chore, config-only, research-only, no production behavior change) may be marked **not applicable** with a **one-line reason**.
- Execute and report skip fake red cycles when not-applicable is recorded; they must not invent hollow tests to satisfy the gate.

### Completion and ship bar

- `sf-tdd-report` cannot honestly claim `completed` for a behavioral task without red and green command evidence for each behavioral slice (or an explicit not-applicable reason covering the whole task).
- V1 is ready when: the four skills install via setup/upgrade; the gates above are documented and enforceable by the skills; README explains when to use TDD vs core skills.
- Out of V1 ship bar: mandatory dogfood packet, read-only audit skill, runtime hook enforcement, cockpit meters.

## Alternatives Considered

### Require user-global `/tdd` skill

- **User value:** Single doctrine ownership outside Spec Finder.
- **Costs/risks:** Setup alone is insufficient; operators and maintainers hit missing-skill failures.
- **Why not selected:** User required fully self-contained packaging.

### Interactive seam approval every execute

- **User value:** Strongest human control of test boundaries.
- **Costs/risks:** Blocks low-friction batch and unattended maintainer use.
- **Why not selected:** User chose no interactive seam approval.

### Always require a red→green cycle even for non-behavioral work

- **User value:** Uniform process.
- **Costs/risks:** Encourages theater tests; wastes operator time.
- **Why not selected:** User chose explicit not-applicable escape with reason.

### Ship dogfood packet and audit skill in V1

- **User value:** Stronger proof and post-hoc checking.
- **Costs/risks:** Scope and time beyond the selected success bar.
- **Why not selected:** User selected install + gates + docs only for V1.

## Consequences

### Positive

- Fresh installs can use TDD immediately.
- Batch and unattended TDD runs are not blocked by seam letter-choice prompts.
- Non-behavioral work can stay honest without fake red tests.
- Completion claims remain falsifiable via report evidence.

### Negative and trade-offs

- Spec Finder must maintain a slim doctrine copy aligned with `/tdd`.
- Stale or weak derived seams are possible without interactive confirmation; quality depends on plan/task quality and report review.
- Not-applicable depends on honest classification; misuse can skip needed red cycles.

### Risks and mitigations

- **Doctrine drift from upstream `/tdd`** - keep a short alignment note in the pack and refresh when doctrine material changes.
- **Not-applicable overuse** - require a one-line reason in plan/report; treat missing reason as incomplete.
- **Weak seams without interactive gate** - plan skill and report evidence remain the review surfaces; later audit skill can flag anti-patterns if needed.

## Reversibility

Medium-high.
Doctrine can later prefer an external skill if present.
Seam approval can be tightened to optional or mandatory interactive mode.
Not-applicable policy can be narrowed if abuse appears.
Dogfood and audit can be added without changing the pack’s opt-in model.

## Follow-ups

- Author slim doctrine and evidence templates under the pack references.
- Document not-applicable criteria in plan/execute/report skills.
- Defer runtime opt-in and audit skill to later issues unless new evidence elevates them.

## References

- [Issue #14](https://github.com/MatheusBBarni/spec-finder/issues/14)
- ADR-001: Parallel Opt-In TDD Skill Pack
- User `/tdd` skill doctrine
