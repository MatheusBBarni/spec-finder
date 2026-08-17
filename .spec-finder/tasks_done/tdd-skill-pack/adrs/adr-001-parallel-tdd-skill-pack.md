# ADR-001: Parallel Opt-In TDD Skill Pack

## Status

Accepted

## Date

2026-08-11

## Context

Spec Finder already requires tests with implementation and focused verification before task completion.
It does not force an honest red-before-green loop when files are created or changed.
Agents can still implement production code first, backfill tests, bulk-write horizontal test suites, or couple tests to internals, and still report “tests exist.”

Issue #14 and the owner decision prefer a **parallel** `sf-tdd-*` skill pack rather than hardening core `sf-create-*`, `sf-execute-task`, and `sf-task-report` into mandatory TDD.
Core skills must stay mode-neutral for research, docs, and non-code packets.
The primary users for V1 are Spec Finder operators and maintainers equally.
The primary product outcome is honest red→green proof per behavior slice.

## Decision Drivers

- Deliver honest red→green proof when operators opt into TDD.
- Keep the default non-TDD path intact for non-code and existing workflows.
- Serve operators and maintainers with the same skill path and docs.
- Avoid dual lifecycle ownership with the ACP runtime.
- Prefer the smallest credible pack that meets the verified need.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | Core execute requires focused tests and verification but not a red phase before production code. | `skills/sf-execute-task/SKILL.md` | 2026-08-11 |
| Repository | Create-tasks keeps tests with implementation and forbids test-only tasks, but does not encode red-before-green order. | `skills/sf-create-tasks/SKILL.md` | 2026-08-11 |
| Repository | ACP runtime always targets `sf-execute-task` and `sf-task-report`. | `src/engine.ts` | 2026-08-11 |
| Repository | Setup installs a fixed managed skill list by copy. | `src/setup.ts` (`SPEC_FINDER_SKILLS`) | 2026-08-11 |
| External | Agent TDD skills use vertical slices and red-before-green to stop horizontal bulk testing. | [AI Hero TDD skill](https://www.aihero.dev/skill-test-driven-development-claude-code) | Accessed 2026-08-11 |
| External | Vendor AI TDD guides use explicit red/green phase separation. | [VS Code TDD guide](https://code.visualstudio.com/docs/agents/guides/test-driven-development-guide) | Accessed 2026-08-11 |
| User decision | Primary outcome: honest red→green proof; users: operators and maintainers equally; approach A: full parallel pack, skill-only opt-in. | PRD clarification | 2026-08-11 |
| User decision | Issue #14 Option B: parallel pack; do not harden core skills. | [Issue #14 comment](https://github.com/MatheusBBarni/spec-finder/issues/14#issuecomment-5258656876) | 2026-08-11 |

## Decision

Ship a **parallel, opt-in TDD skill pack** under Spec Finder’s managed skills:

- `sf-tdd-plan` - produce or update ordered TDD slice plans (seams + tracer bullets) as additive enrichment on existing tasks/memory.
- `sf-tdd-execute` - TDD-only executor that forces red → green vertical slices for behavioral work.
- `sf-tdd-report` - completion report path that requires red and green command evidence per behavioral slice (or an explicit not-applicable reason).
- `sf-tdd-batch` - dependency-safe range runner that only uses the TDD executor and stops on failure.

Product boundary for V1:

- Core `sf-*` skills remain the default non-TDD path and stay mode-neutral.
- Operators opt in by invoking TDD skills (manual skill path). ACP `run` continues to target core execute/report until a separate opt-in design.
- Packet layout stays under `.spec-finder/tasks/<slug>/` (task TDD plan sections, memory slice logs, reports).
- No second packet root, no cockpit red/green meters, no mandatory runtime switch, no audit skill, no mandatory dogfood packet in the V1 success bar.

## Alternatives Considered

### Execute-centric thin pack (no dedicated plan skill)

- **User value:** Smaller surface; faster single-task TDD start.
- **Costs/risks:** Weaker reusable slice plans across tasks; harder batch prep and resume storytelling.
- **Why not selected:** Clarification chose full pack with honest red→green proof; planning seams and ordered slices is part of that outcome.

### Plan-gated pack (plan always required before execute)

- **User value:** Strongest pre-execution clarity of seams and slice order.
- **Costs/risks:** Extra ceremony on small fixes; conflicts with low-friction opt-in for both operators and maintainers.
- **Why not selected:** User selected the skill-only full pack without a hard plan-before-execute product gate.

### Harden core skills into mandatory TDD

- **User value:** Every implementation path goes red-first.
- **Costs/risks:** Breaks research/docs packets; forces migration of existing muscle memory; dual ownership harder to reason about.
- **Why not selected:** Issue #14 Option B and owner decision reject this for V1.

## Consequences

### Positive

- Operators and maintainers get a clear opt-in path for honest TDD.
- Non-code and existing non-TDD workflows remain unchanged.
- Red/green gates live only in TDD skills, so lifecycle ownership stays easier to reason about.
- Setup can install the pack alongside core skills without migrating every packet.

### Negative and trade-offs

- Opt-in means many runs can still skip red if people keep using core skills.
- Four new skills increase docs and mental model surface.
- Runtime cockpit `run` does not enforce TDD until a later product decision.

### Risks and mitigations

- **Operators never discover the pack** - document when to use TDD vs core in README; install skills by default with setup/upgrade.
- **Agents invent fake red evidence** - report completion forbids completed without red and green command evidence (or not-applicable reason); doctrine bans horizontal slicing and theater.
- **Lifecycle dual-ownership with ACP runtime** - TDD skills mirror core ownership rules; runtime continues to own status/report for ACP runs.

## Reversibility

High.
Removing or ignoring the pack restores the prior product surface.
Core skills and packet layout do not depend on TDD skills.
A later runtime opt-in can target these skills without redesigning the packet root.

## Follow-ups

- Separate product decision for ACP `run` / future `loop` opt-in (config, frontmatter, or CLI).
- Optional later `sf-tdd-audit` read-only checker if missing-red evidence becomes a recurring operator pain.
- Optional dogfood packet after V1 if maintainers want end-to-end sample evidence.

## References

- [Issue #14](https://github.com/MatheusBBarni/spec-finder/issues/14)
- User `/tdd` doctrine (normative reference for vendored slim copy)
- Spec Finder core skills: `sf-execute-task`, `sf-task-report`, `sf-batch-tasks`, `sf-create-tasks`, `sf-memory`
