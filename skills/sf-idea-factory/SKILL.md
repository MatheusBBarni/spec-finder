---
name: sf-idea-factory
description: Expands a raw product or feature idea into an approved, research-backed _idea.md under .spec-finder/tasks. Use before creating a PRD when the problem or opportunity still needs discovery.
argument-hint: "[feature idea]"
---

# Spec Finder Idea Factory

Turn a raw idea into the approved foundation for the Spec Finder pipeline.

<HARD-GATE>
Do not write `_idea.md` until research, viability analysis, trade-off review, opportunity scanning, and user approval are complete. Ask one question per turn and wait for the answer. Never invent market evidence.
</HARD-GATE>

## Workflow

1. Derive a 2-5 word kebab-case slug and target `.spec-finder/tasks/<slug>/`. Create `adrs/` only after the user confirms the direction.
2. Ask 3-6 targeted questions, one at a time, covering the problem, target user, current workaround, V1 boundary, and measurable success. Prefer A/B/C options with an `Other` fallback.
3. Research both tracks before drafting:
   - Explore the current codebase for related behavior, constraints, and integration points.
   - Perform 3-7 current web searches across competitors, adoption data, user expectations, technical feasibility, and cost when relevant. Cite primary sources.
4. Present a viability assessment with 3-6 measurable KPIs and score Impact, Reach, Frequency, Differentiation, Defensibility, and Feasibility as Must do, Strong, Maybe, or Pass.
5. Challenge the proposal from at least three distinct perspectives: pragmatic engineering, architecture, security, product, and devil's advocate. Use real runtime delegation when available. Record tensions, evolved positions, and synthesis.
6. Present up to three opportunities: more ambitious, simpler, and adjacent. Recommend one and wait for the user's selection.
7. Create an accepted ADR for the selected V1 scope using `references/adr-template.md`.
8. Draft the complete document using `references/idea-template.md`; then ask for one whole-draft review.
9. After explicit approval, save `.spec-finder/tasks/<slug>/_idea.md` and point to `sf-create-prd` as the next step.

## Rules

- English artifacts; active, specific language.
- Business focus: WHAT, WHY, WHO. Defer implementation design to the TechSpec.
- Research summaries must distinguish codebase evidence, sourced facts, and inference.
- Keep V1 small. Put deferred ideas in Out of Scope.
- If the interactive question mechanism is unavailable, ask one question as the complete response and stop.

