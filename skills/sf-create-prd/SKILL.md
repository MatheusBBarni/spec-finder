---
name: sf-create-prd
description: Creates or updates an approved business-focused Product Requirements Document through codebase and market research, one-at-a-time clarification, explicit product approach selection, ADR capture, and whole-draft approval. Use for defining product outcomes and requirements, not architecture, task breakdown, or implementation.
---

# Create a Spec Finder PRD

<HARD-GATE>
- NEVER write or replace `_prd.md` before both research tracks, clarification, explicit approach selection, a complete draft review, and explicit user approval are complete.
- NEVER skip research or interaction because a feature appears simple or technical.
- NEVER infer a material product decision when multiple credible choices remain.
- NEVER drift into databases, APIs, frameworks, code structure, or testing design.
- NEVER require section-by-section approval; synthesize one complete draft after the approach decision.
</HARD-GATE>

## Interaction contract

- Ask exactly one question per turn and wait for the answer.
- Use the runtime's blocking question mechanism when available. Otherwise make the question the complete response and stop.
- Present every answer choice with sequential uppercase labels: `A.`, `B.`, `C.`, and so on. Never present selectable answers as unlabeled bullets.
- Every question must provide 2-3 concrete suggested answers. Add `Other` whenever those answers are not exhaustive; lead with `A. (Recommended)` and label `Other` with the next available letter.
- End every choice prompt with: `Reply with the letter (for example, A), or the letter plus context.` Accept lowercase letters and full option text too.
- Ask only product questions about WHAT users need, WHY it matters, WHO needs it, constraints, priority, and measurable success.
- Do not auto-resolve scope, rollout, target-user, capability, or success-metric decisions.

Read `references/question-protocol.md` before asking questions.

## Required inputs

- A feature name, idea, or packet slug.
- Optional `_idea.md` as primary discovery context.
- Optional `_prd.md` for update mode.

## Mandatory phase checklist

1. Resolve the packet and read existing artifacts.
2. Complete codebase and market/user research.
3. Present the evidence summary and research limitations.
4. Ask 3-6 product clarification questions.
5. Present 2-3 product approaches and obtain an explicit selection.
6. Record consequential product decisions in ADRs.
7. Draft the complete PRD and obtain explicit approval.
8. Save, re-read, validate, and hand off to `sf-create-techspec`.

## Workflow

### 1. Resolve context

- Derive or confirm the slug and target `.spec-finder/tasks/<slug>/`.
- Read `_idea.md`, existing `_prd.md`, downstream artifacts, every ADR, repository instructions, and `.spec-finder/config.json` when present.
- Treat `_idea.md` as approved input, not immutable truth; surface conflicts with current evidence.
- In update mode, identify the requested delta and preserve untouched sections.

### 2. Research before questions

Complete both tracks before asking the user questions. Run them in parallel only when the runtime can do real parallel work.

**Codebase track — required**

- Inspect related user flows, existing behavior, domain language, product constraints, integration boundaries, and tests.
- Cite concrete paths. Do not treat plans, comments, or dead code as shipped behavior.

**Market and user track — required**

- Perform 3-5 current searches across user expectations, comparable products, workflow conventions, adoption evidence, accessibility or compliance expectations, and pricing when relevant.
- Prefer primary and first-party sources. Capture URLs, dates, supported claims, and relevance.
- Reuse current sourced research from `_idea.md`, but refresh claims likely to have changed.

Present:

- **Repository findings** with paths;
- **Sourced external findings** with citations;
- **Inferences** clearly labeled;
- **Unknowns and conflicts** that may require a decision.

If external research is unavailable, disclose the missing evidence and ask with lettered choices whether to proceed with a research-limited PRD, wait, or provide another direction. Do not silently downgrade the hard gate.

### 3. Clarify the product need

- Ask 3-6 questions following `references/question-protocol.md`.
- Cover the primary problem, target user, current workflow, capabilities, business value, constraints, MVP boundary, rollout, and measurable success as relevant.
- Do not ask questions already answered by approved artifacts or research unless evidence conflicts.
- Translate technical-sounding requests into user outcomes. Ask which events need notification, not whether to use polling; ask what export users need, not which library to use.

### 4. Present product approaches

- Offer 2-3 meaningfully different approaches in scope, phasing, workflow, or strategy, labeled `A.`, `B.`, and `C.` in presentation order; label another direction with the next letter.
- For each state: included capability, excluded capability, user value, principal risk, evidence, and reversibility.
- Recommend the smallest credible option that satisfies the verified need and name what it gives up.
- Wait for explicit selection. If evidence is insufficient to recommend, say so and present the missing decision as lettered answers rather than an open-ended prompt.

### 5. Record decisions

- Read `references/adr-template.md`.
- Create the next zero-padded ADR only after the user selects an approach.
- Record the decision, alternatives, evidence, consequences, and risks. Do not label an inferred preference `Accepted`.
- Create additional ADRs only for consequential scope, rollout, or policy decisions.

### 6. Draft the complete PRD

- Read `references/prd-template.md` and fill every mandatory section.
- Apply YAGNI: every MVP capability must trace to a verified user need or business outcome.
- Use stable IDs for goals, stories, features, and metrics so the TechSpec can trace them.
- Define acceptance conditions as observable product behavior, not implementation steps.
- Put unresolved non-blocking items in Open Questions and explicitly exclude deferred work.
- Cite market claims near their source. Label estimates and inference.

### 7. Review and save

- Present one complete draft and ask with `A. Approve`, `B. Adjust`, `C. Rewrite`, and `D. Discard`.
- Apply requested changes and present the complete current draft again.
- Write `.spec-finder/tasks/<slug>/_prd.md` only after explicit approval of that version.
- Re-read the saved file and validate IDs, traceability, metrics, non-goals, ADR links, citations, and unresolved questions.
- Point to `sf-create-techspec` as the next step.

## Anti-patterns

- Calling assumptions “research”.
- Asking the user to decide facts discoverable from the repository or current sources.
- Offering approaches that differ only in implementation technology.
- Treating “nice to have” as MVP without a mapped goal or story.
- Hiding unresolved scope inside vague language such as “support common cases”.

## Failure rules

- Stop if both the requested outcome and target user remain unclear after clarification.
- If research contradicts `_idea.md`, present the conflict and ask with lettered choices whether current evidence, the approved idea, or another direction governs before drafting.
- If a material decision remains open, do not move it silently into Open Questions and save anyway.
- Preserve unrelated approved content in update mode.
