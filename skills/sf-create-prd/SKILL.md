---
name: sf-create-prd
description: Creates or updates an approved business-focused PRD in .spec-finder/tasks from an idea and current research. Use for product requirements, not architecture or implementation tasks.
argument-hint: "[feature name or slug]"
---

# Create a Spec Finder PRD

<HARD-GATE>
Do not save `_prd.md` until codebase and market research, clarification, approach selection, a complete draft, and explicit user approval are complete. Ask one question per turn.
</HARD-GATE>

## Workflow

1. Resolve `.spec-finder/tasks/<slug>/`; read `_idea.md`, an existing `_prd.md`, and ADRs. Create the directory if needed.
2. Before questions, explore related code and perform 3-5 current market/user searches. Present separate codebase and market findings with sources.
3. Ask 3-6 product questions, one at a time. Focus on user problem, target user, capabilities, business value, constraints, and measurable success. Never ask about frameworks, APIs, databases, or code structure.
4. Present 2-3 meaningfully different product approaches with trade-offs. Lead with the smallest credible recommendation and wait for selection.
5. Record the selected approach in the next `adrs/adr-NNN.md` using `references/adr-template.md`.
6. Draft the complete PRD with `references/prd-template.md`. Map goals to user stories and features; place ambiguity in Open Questions.
7. Present one complete draft for review: approve, adjust, rewrite, or discard. Iterate until explicitly approved.
8. Save `.spec-finder/tasks/<slug>/_prd.md`. The next stage is `sf-create-techspec`.

## Rules

- Describe WHAT and WHY, not HOW.
- English, active voice, specific outcomes.
- Apply YAGNI; defer optional features.
- Preserve untouched sections in update mode.
- Use the runtime's blocking question tool when available; otherwise ask one question and stop.

