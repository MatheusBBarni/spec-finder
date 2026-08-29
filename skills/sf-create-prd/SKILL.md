---
name: sf-create-prd
description: Creates or updates an approved business-focused Product Requirements Document through codebase and market research, one-at-a-time clarification, explicit product approach selection, ADR capture, and whole-draft approval. Start directly from a clear feature request, idea, or packet slug; `_idea.md` is optional. Use `sf-idea-factory` first only when the problem, opportunity, or V1 boundary still needs discovery. Use for defining product outcomes and requirements, not architecture, task breakdown, or implementation.
---

# Create a Spec Finder PRD

<HARD-GATE>
- NEVER require `_idea.md` or prior `sf-idea-factory` completion. Begin directly when the user provides a sufficiently clear feature request, idea, or packet slug.
- NEVER write or replace `_prd.md` before both research tracks, clarification, explicit approach selection, a complete draft review, and explicit user approval are complete.
- NEVER skip research or interaction because a feature appears simple or technical.
- NEVER infer a material product decision when multiple credible choices remain.
- NEVER drift into databases, APIs, frameworks, code structure, or testing design.
- NEVER treat a requested feature or “users want X” as the problem.
- NEVER expand MVP capabilities before explicit non-goals.
- NEVER save a goal without a baseline (or explicit unknown plus how it will be measured), target, window, and measurement method.
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
- Optional `_idea.md` as primary discovery context when it already exists.
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
- Read repository instructions and all existing packet artifacts, including `_idea.md` when present, an existing `_prd.md`, downstream artifacts, and every ADR. Read `.spec-finder/config.json` when present.
- When `_idea.md` exists, treat it as approved input, not immutable truth; surface conflicts with current evidence.
- New PRDs use `references/prd-template.md`. In update mode, identify the requested delta, preserve untouched sections, and keep the existing document structure. Do not migrate Overview / Core Features / Success Metrics layouts unless the user explicitly asks. The PRD is a living document; change only the approved delta.

### 2. Research before questions

Complete both tracks before asking the user questions. Run them in parallel only when the runtime can do real parallel work.

**Codebase track — required**

- Inspect related user flows, existing behavior, domain language, product constraints, integration boundaries, and tests.
- Cite concrete paths. Do not treat plans, comments, or dead code as shipped behavior.

**Market and user track — required**

- Perform 3-5 current searches across user expectations, comparable products, workflow conventions, adoption evidence, accessibility or compliance expectations, and pricing when relevant.
- Prefer primary and first-party sources. Capture URLs, dates, supported claims, and relevance.
- When `_idea.md` exists, reuse its current sourced research, but refresh claims likely to have changed.

Present:

- **Repository findings** with paths;
- **Sourced external findings** with citations;
- **Inferences** clearly labeled;
- **Unknowns and conflicts** that may require a decision.

If external research is unavailable, disclose the missing evidence and ask with lettered choices whether to proceed with a research-limited PRD, wait, or provide another direction. Do not silently downgrade the hard gate.

### 3. Clarify the product need

- Ask 3-6 questions following `references/question-protocol.md`.
- Follow the protocol order: need, users, testable success, non-goals and scope, then capabilities.
- Restate the problem from evidence (who, current workflow, failure, cost). A feature request is not a problem.
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

- Read `references/prd-template.md` and fill every mandatory section in this order: Problem and Evidence, Goals, Out of Scope, In Scope, User Stories, Constraints, Risks, ADRs, Open Questions.
- Target 800–1600 words. Cut anything that does not change a decision. Evidence is at most 8 decision-changing rows; if `_idea.md` exists, synthesize it rather than duplicating the ledger.
- Problem first: who, current workflow, failure, and cost, with evidence. Do not lead with features.
- Write Out of Scope before In Scope and before extra capabilities. Later phases belong in Out of Scope with a promotion trigger.
- Apply YAGNI: every in-scope `F-xx` must trace to a verified user need or goal.
- Use stable IDs so the TechSpec can trace them: `G-xx` (goals are the metrics), `US-xx`, `F-xx`. Add `M-xx` only when one goal needs more than one metric.
- Every `US-xx` uses Given/When/Then for observable product behavior, not implementation steps. Empty, failure, recovery, and accessibility paths are extra GWT triples, not a UX essay.
- Keep `F-xx` as a thin capability table. Do not write MUST/SHOULD feature specs.
- Put unresolved non-blocking items in Open Questions and explicitly exclude deferred work.
- Cite market claims near their source. Label estimates and inference. Never invent a baseline.

### 7. Review and save

- Present one complete draft and ask with `A. Approve`, `B. Adjust`, `C. Rewrite`, and `D. Discard`.
- Apply requested changes and present the complete current draft again.
- Write `.spec-finder/tasks/<slug>/_prd.md` only after explicit approval of that version.
- Re-read the saved file and validate:
  - the problem is evidenced and is not a feature request;
  - every `G-xx` has baseline (or explicit unknown plus measurement plan), target, window, and method;
  - Out of Scope exists and is not contradicted by In Scope;
  - every `US-xx` has Given/When/Then;
  - every `F-xx` maps to a goal or story and states an observable outcome, not a design;
  - no APIs, frameworks, schema, or testing design;
  - Evidence is capped, cited, and distinguished from inference;
  - ADRs are linked and no material branch sits in Open Questions;
  - length is in the 800–1600 word target unless the user approved a longer delta.
- Point to `sf-create-techspec` as the next step.

## Anti-patterns

- Calling assumptions “research”.
- Asking the user to decide facts discoverable from the repository or current sources.
- Offering approaches that differ only in implementation technology.
- Treating “users want X” or a solution as the problem.
- Drafting features before non-goals.
- Untestable goals or invented baselines.
- MUST/SHOULD or UX essays that belong in the TechSpec.
- Dumping the full research ledger into Evidence.
- Treating “nice to have” as MVP without a mapped goal or story.
- Hiding unresolved scope inside vague language such as “support common cases”.

## Failure rules

- Stop if both the requested outcome and target user remain unclear after clarification.
- Stop if success cannot be stated with a target, window, and measurement method after clarification.
- If research contradicts an existing `_idea.md`, present the conflict and ask with lettered choices whether current evidence, the approved idea, or another direction governs before drafting.
- If a material decision remains open, do not move it silently into Open Questions and save anyway.
- Preserve unrelated approved content in update mode.
