---
name: sf-create-techspec
description: Translates an approved PRD into an approved, codebase-informed Technical Specification through architecture research, technical clarification, explicit approach selection, ADR capture, requirement traceability, and whole-draft approval. Use for implementation design, not product discovery, task generation, or coding.
---

# Create a Spec Finder TechSpec

<HARD-GATE>
- NEVER write or replace `_techspec.md` before source requirements, codebase exploration, relevant official documentation, technical clarification, explicit approach selection, ADR capture, complete draft review, and explicit user approval are complete.
- NEVER propose architecture from memory when the repository or current documentation can verify it.
- NEVER silently choose a material boundary, dependency, persistence, security, migration, or failure-policy decision.
- NEVER skip design review because the change appears small.
- NEVER require section-by-section approval; present one complete draft after the technical direction is selected.
</HARD-GATE>

## Interaction contract

- Ask exactly one technical question per turn and wait for the answer.
- Use the runtime's blocking question mechanism when available. Otherwise make the question the complete response and stop.
- Present every answer choice with sequential uppercase labels: `A.`, `B.`, `C.`, and so on. Never present selectable answers as unlabeled bullets.
- Every question must provide 2-3 concrete suggested answers. Add `Other` whenever those answers are not exhaustive, with the evidence-backed recommendation first as `A. (Recommended)`. Label `Other` with the next available letter.
- End every choice prompt with: `Reply with the letter (for example, A), or the letter plus context.` Accept lowercase letters and full option text too.
- Ask about HOW, WHERE, and WHICH only when the answer is not already dictated by approved requirements, repository conventions, or current official documentation.
- Do not auto-resolve decisions that change public contracts, data ownership, security posture, migrations, dependencies, or required evidence.

Read `references/question-protocol.md` before asking questions.

## Required inputs

- A packet slug with an approved `_prd.md`.
- Optional `_idea.md` and existing `_techspec.md` for context/update mode.

If `_prd.md` is absent, stop and present lettered choices: `A. (Recommended) Create the PRD first`, `B. Proceed from a bounded description and accept the traceability gap`, and `C. Other`. Proceed without a PRD only after the user selects the traceability-gap option; record that gap in the Executive Summary and Open Questions.

## Mandatory phase checklist

1. Load PRD, idea, ADRs, existing design, memory, and repository rules.
2. Explore architecture, implementation seams, dependencies, tests, and build gates.
3. Verify evolving libraries, SDKs, protocols, or platform constraints in official sources.
4. Present technical evidence, conflicts, and unknowns.
5. Ask 3-6 technical clarification questions.
6. Present 2-3 technical approaches and obtain explicit selection.
7. Record the primary design and other consequential choices in ADRs.
8. Draft a traceable TechSpec, obtain explicit approval, save, and validate.

## Workflow

### 1. Load authoritative context

- Read `_prd.md`, `_idea.md` when present, existing `_techspec.md`, `_tasks.md`, all ADRs, packet memory, repository instructions, and `.spec-finder/config.json` when relevant.
- Extract every goal, story, capability, constraint, metric, risk, and open question into a requirements ledger with stable IDs.
- In update mode, identify the requested delta and the downstream artifacts it may invalidate.

### 2. Research the implementation context

**Repository exploration — always required**

- Inspect architecture, module boundaries, domain models, existing interfaces, persistence, concurrency, configuration, error conventions, security boundaries, observability, tests, fixtures, and verification commands.
- Trace relevant callers and consumers, not only the apparent target file.
- Cite concrete paths and distinguish current behavior from proposed behavior.

**External technical research — conditionally required**

- When the design depends on an evolving library, SDK, protocol, CLI, cloud service, security standard, or platform capability, consult current primary documentation before recommending an approach.
- Capture exact version or date, supported API/constraint, source URL, and design consequence.
- Do not introduce a dependency based only on popularity or memory.

Run independent exploration tracks concurrently when real delegation is available. Otherwise explore sequentially and do not claim independent confirmation.

### 3. Present technical evidence

Before questions, present:

- **Existing architecture:** components, boundaries, and paths.
- **Reusable patterns:** conventions the design should preserve.
- **External constraints:** verified current documentation.
- **Conflicts:** repository patterns or requirements that disagree.
- **Unknowns:** decisions or spikes needed before implementation.

If a conflict could change product behavior, stop and return it to the PRD owner/user rather than resolving it as a technical preference.

### 4. Clarify material decisions

- Ask 3-6 one-at-a-time questions covering only relevant dimensions: component ownership, state/data lifecycle, public interfaces, integration, compatibility/migration, failure/recovery, security/privacy, performance, observability, and test/platform evidence.
- Skip dimensions already fixed by evidence; do not manufacture questions to reach a quota.
- When uncertainty can be resolved with a bounded spike, offer the spike and its decision criterion instead of asking for a guess.

### 5. Present technical approaches

- Offer 2-3 viable designs labeled `A.`, `B.`, and `C.` in presentation order; label another design with the next letter. For each include component changes, data flow, affected contracts, migration path, failure behavior, security implications, testing burden, operational cost, reversibility, and rejected complexity.
- Recommend the smallest design that satisfies every approved requirement and repository constraint.
- State the primary trade-off explicitly and identify any prerequisite or evidence gap.
- Wait for explicit user selection before creating an accepted ADR or drafting.

### 6. Record ADRs

- Read `references/adr-template.md` and allocate sequential zero-padded ADRs without replacing existing files.
- Create at least one ADR for the selected primary technical approach.
- Create additional ADRs only for consequential independent decisions such as persistence, protocol, compatibility, security boundary, or migration strategy.
- Record evidence, rejected alternatives, consequences, risks, rollback/reversal considerations, and implementation notes.

### 7. Draft the TechSpec

- Read `references/techspec-template.md` and fill every applicable section.
- Map every PRD goal, story, feature, constraint, and metric to components, interfaces, and verification in a traceability matrix. No requirement may disappear silently.
- Use repository language for interface examples and keep each example under 20 lines.
- Prefer existing modules and dependencies. Justify every new package, directory, abstraction, or service.
- Specify success and failure behavior, security/privacy, migration/compatibility, observability, rollback, and platform-specific evidence.
- Provide dependency-ordered build sequencing; every step after the first names prerequisites.
- End with links to every relevant ADR.

### 8. Review, save, and validate

- Present one complete draft and ask with `A. Approve`, `B. Adjust`, `C. Rewrite`, and `D. Discard`.
- Apply feedback and present the complete current draft again.
- Write `.spec-finder/tasks/<slug>/_techspec.md` only after explicit approval.
- Re-read the saved file and validate requirement traceability, evidence citations, interfaces, failure behavior, security, tests, sequencing, risks, and ADR links.
- Point to `sf-create-tasks` as the next step.

## Anti-patterns

- Greenfield architecture that ignores existing seams.
- Technology selection without a requirements or repository rationale.
- “Handle errors” without named failure modes and recovery behavior.
- Tests that do not map to contracts and requirements.
- Copying PRD prose instead of translating it into technical obligations.
- Hiding unresolved decisions as implementation details.

## Failure rules

- If codebase evidence conflicts, present both patterns and their actual usage before recommending one.
- If official documentation is unavailable for a critical external dependency, present lettered choices to wait for documentation, proceed with a documented research-limited design, or provide another direction.
- If an approved product requirement is technically infeasible, do not weaken it silently; return the conflict for decision.
- Preserve unrelated approved sections in update mode and identify downstream task files that require regeneration.
