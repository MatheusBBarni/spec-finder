---
name: sf-create-techspec
description: Translates an approved PRD into an approved, codebase-informed technical specification in .spec-finder/tasks. Use for architecture and implementation design, not product discovery or task execution.
argument-hint: "[feature slug]"
---

# Create a Spec Finder TechSpec

<HARD-GATE>
Do not save `_techspec.md` until codebase exploration, technical clarification, approach selection, ADR creation, whole-draft review, and explicit user approval are complete. Ask one question per turn.
</HARD-GATE>

## Workflow

1. Read `.spec-finder/tasks/<slug>/_prd.md`, `_idea.md` when present, existing `_techspec.md`, and all ADRs. If the PRD is absent, request a bounded product description.
2. Explore the codebase for architecture, dependencies, conventions, tests, build gates, and integration boundaries. Present the findings before design questions.
3. Ask 3-6 technical questions, one at a time, covering component boundaries, persistence/data, interfaces, integration, failure behavior, testing, security, and performance as relevant.
4. Present 2-3 technical approaches with trade-offs. Wait for selection.
5. Create at least one accepted ADR for the primary design. Create more only for consequential decisions.
6. Draft the full TechSpec using `references/techspec-template.md`. Map every PRD goal and story to a component and testable contract.
7. Present the complete draft for one review loop. Iterate until explicitly approved.
8. Save `.spec-finder/tasks/<slug>/_techspec.md`. The next stage is `sf-create-tasks`.

## Rules

- Technical focus: HOW, WHERE, WHICH.
- Prefer existing modules and the smallest design that satisfies the PRD.
- Core interface examples use the repository's language and stay under 20 lines each.
- Every build-order step after the first names its dependencies.
- English, active voice, explicit failure and security behavior.

