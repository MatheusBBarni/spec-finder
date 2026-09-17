---
name: sf-tdd-write-spec
description: Creates one approved, agent-executable Spec Finder spec whose implementation proceeds through Matt Pocock-style public-seam red-green vertical slices. Writes only `.spec-finder/specs/<slug>-spec.md` and bundles its TDD doctrine locally, so the external `tdd` skill is not a dependency. Use for one-shot specifications that must prescribe TDD execution; do not use for packet, PRD, TechSpec, task, implementation, or report creation.
---

# Write a TDD Spec Finder Spec

One invocation produces exactly one saved artifact: `.spec-finder/specs/<slug>-spec.md`.
The spec is a complete implementation prompt with confirmed public test seams and ordered red-green vertical slices.

Read `references/tdd-doctrine.md` before research.
Read `references/spec-template.md` and `references/quality-bar.md` before drafting.

<HARD-GATE>
- NEVER require the external `tdd` skill, a user-global `/tdd` path, or another TDD skill. The bundled `references/tdd-doctrine.md` is authoritative for this workflow.
- NEVER write or replace the spec before repository research, public-seam confirmation, complete draft review, and explicit whole-draft approval.
- NEVER write or replace packet, PRD, TechSpec, task, ADR, report, or memory artifacts.
- NEVER write production code or execute the implementation. This skill authors the spec only.
- NEVER approve a TDD slice without one failing public-seam test, the same focused command for red and green, and only enough implementation to make that test pass.
- NEVER permit implementation-coupled tests, tautological expectations, or horizontal slicing.
- NEVER place refactoring inside the red-green loop. Put it in the review stage after all slices are green.
- NEVER skip repository research or ask the user for facts the repository or current primary docs answer.
- NEVER save acceptance criteria that are not observable Given/When/Then.
</HARD-GATE>

## Interaction contract

- Research first.
- Before writing any test plan, present the proposed public seams and confirm the proposed public seams with the user.
- Ask exactly one remaining question per turn using the runtime's blocking question mechanism when available.
- Give 2-3 concrete labeled choices, recommendation first. Do not auto-resolve scope, contract, security, migration, ownership, seam, or evidence decisions.
- Present the complete draft once and obtain explicit whole-draft approval before writing.

## Required input and output

Input: a feature request, idea, or existing spec slug.
Optional update input: an existing `.spec-finder/specs/<slug>-spec.md`.

Write exactly one file after approval:

- `.spec-finder/specs/<slug>-spec.md`

If the user asks for discovery, packet creation, implementation, or reporting, use the corresponding skill instead.

## Workflow

### 1. Resolve and research

1. Derive or confirm a descriptive kebab-case slug.
2. Read repository instructions, current configuration when relevant, the existing spec in update mode, and applicable ADRs.
3. Build a current-system ledger:
   - current versus desired behavior
   - public interfaces and candidate test seams
   - callers, consumers, tests, fixtures, and conventions
   - 1-3 short current-code excerpts showing the seam
   - exact focused commands and repository gate
4. Consult current primary docs when an evolving dependency, protocol, SDK, CLI, or platform affects the contract.
5. Distinguish evidence from inference.

### 2. Confirm seams and remaining decisions

1. Present repository findings and candidate public seams.
2. Ask the user which public interfaces and seams the tests should cover. Do not draft tests before confirmation.
3. Ask only unresolved material questions: need and success, non-goals, public contracts and failures, boundaries, then slice ordering.
4. If work has no changed behavior at a public seam, state that TDD is not applicable and offer `sf-write-spec`; do not invent test theater.

### 3. Draft one complete spec

Fill `references/spec-template.md` with repository facts. The draft must include:

- outcome, current system, Out of Scope before In Scope, and observable acceptance
- public contracts with valid and invalid examples
- the confirmed public test seams and why each is public
- test locations and exact focused command identities
- ordered outcome slices, one vertical slice at a time
- for every slice: one failing public-seam test, observed red reason, minimal green behavior, and the same focused command
- anti-pattern stop conditions and system-boundary-only mocking
- review/refactoring after all slices are green
- named failure cases, verified relevant files, repository gate, and final output

Apply `references/quality-bar.md`. Remove all placeholders. Do not split the draft into other artifacts.

### 4. Approve and save

Ask:

- `A. Approve and write the spec`
- `B. Adjust the draft`
- `C. Rewrite`
- `D. Discard`

Write only the approved spec. In update mode, change only the approved delta.

### 5. Validate

Re-read the saved file and verify:

- it is the only artifact this skill created or changed
- every template token is replaced
- confirmed seams, test locations, and command identities are explicit
- each slice is red → minimal green before the next red
- red and green use the same focused command
- expected values have an independent source of truth
- mocks appear only at system boundaries
- implementation-coupled, tautological, and horizontal tests are prohibited
- refactoring is deferred until all slices are green
- the repository gate and completion output are named

Fix any validation failure before completion. Point to the saved spec as the implementation prompt.
