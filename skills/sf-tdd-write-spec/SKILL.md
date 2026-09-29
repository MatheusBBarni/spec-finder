---
name: sf-tdd-write-spec
description: Creates one approved, agent-executable Spec Finder spec whose implementation proceeds through Matt Pocock-style public-seam red-green vertical slices. Accepts a clear feature request or an approved `.spec-finder/tasks/<slug>/_prd.md` as product input. Writes the spec under `## Implementation Spec` inside that task-folder `_prd.md`, prints that path, and bundles its TDD doctrine locally so the external `tdd` skill is not a dependency. A thin task with no PRD belongs to `sf-create-prd` first. Do not use for TechSpec, task, implementation, or report creation.
---

# Write a TDD Spec Finder Spec


## Coexistence with a PRD

`sf-create-prd` and this skill share `.spec-finder/tasks/<slug>/_prd.md`.

1. A thin or poorly written task with little context goes to `sf-create-prd` first.
2. An approved `.spec-finder/tasks/<slug>/_prd.md` is the product source of truth. Preserve every line above `## Implementation Spec`.
3. This invocation writes the spec only under `## Implementation Spec` in that file, with confirmed public test seams and red-green slices. Then it prints the path.
4. A clear request may start here with no PRD. Create `.spec-finder/tasks/<slug>/_prd.md` containing only that spec section. If the change has no public-seam behavior, offer `sf-write-spec` instead.

One invocation changes exactly one file: `.spec-finder/tasks/<slug>/_prd.md`.
The `## Implementation Spec` section is a complete implementation prompt with confirmed public test seams and ordered red-green vertical slices.

Read `references/tdd-doctrine.md` before research.
Read `references/spec-template.md` and `references/quality-bar.md` before drafting.

<HARD-GATE>
- NEVER require the external `tdd` skill, a user-global `/tdd` path, or another TDD skill. The bundled `references/tdd-doctrine.md` is authoritative for this workflow.
- NEVER write or replace the spec before repository research, public-seam confirmation, complete draft review, and explicit whole-draft approval.
- NEVER write `.spec-finder/specs/`, `_techspec.md`, `_tasks.md`, `task_NN.md`, ADRs, reports, or memory artifacts. Writing `## Implementation Spec` inside `.spec-finder/tasks/<slug>/_prd.md` is the only packet write allowed.
- NEVER write production code or execute the implementation. This skill authors the spec only.
- NEVER require a PRD. When an approved `.spec-finder/tasks/<slug>/_prd.md` exists, treat it as the product source of truth and inline its decisions.
- NEVER invent product scope for a thin task that has no approved PRD. Stop and offer `sf-create-prd`.
- NEVER tell the executor to read the PRD instead of this spec.
- NEVER re-decide problem, users, goals, non-goals, or in-scope capabilities that the approved PRD already fixed, unless repository evidence conflicts.
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

Input: a clear feature request, idea, existing spec slug, or an approved `.spec-finder/tasks/<slug>/_prd.md`.
Optional update input: an existing `## Implementation Spec` in `.spec-finder/tasks/<slug>/_prd.md`.

Write exactly one file after approval:

- `.spec-finder/tasks/<slug>/_prd.md`

If an approved PRD exists, preserve its product sections and inline its decisions into `## Implementation Spec`. Do not rewrite the product sections.
If the input is a thin task and no approved PRD exists, stop and offer `sf-create-prd`.
A request is thin when it does not state who is affected, the current workflow failure, a testable success outcome, and at least one explicit non-goal.
If the user asks for discovery, packet creation, implementation, or reporting, use the corresponding skill instead.
If they want a spec without prescribed red-green slices, use `sf-write-spec`.

## Workflow

### 1. Resolve and research

1. Derive or confirm a descriptive kebab-case slug.
2. Read repository instructions, current configuration when relevant, the existing spec in update mode, applicable ADRs, and `.spec-finder/tasks/<slug>/_prd.md` when it exists.
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
3. Ask only unresolved material questions. Skip need, success, and non-goals already fixed by the approved PRD. Still confirm public seams, contracts, failures, boundaries, and slice ordering.
4. If work has no changed behavior at a public seam, state that TDD is not applicable and offer `sf-write-spec`; do not invent test theater.

### 3. Draft one complete spec

Fill `references/spec-template.md` with repository facts. The draft must include:

- outcome, current system, Out of Scope before In Scope, and observable acceptance
- approved PRD decisions inlined into Problem, Out of Scope, In Scope, and Acceptance when `.spec-finder/tasks/<slug>/_prd.md` exists, plus a Product source line citing that path
- every in-scope `F-xx` and `US-xx` from that PRD, or an explicit exclusion with the PRD rationale
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

Write the approved spec under `## Implementation Spec` in `.spec-finder/tasks/<slug>/_prd.md`.
If the file exists, keep every line above that heading and replace the heading through the end of the file.
If the heading is absent, append it after the approved product sections.
If the file does not exist, create it with only that heading and the approved spec.
Do not write `.spec-finder/specs/`, `_techspec.md`, `_tasks.md`, `task_NN.md`, ADRs, reports, or memory files.

### 5. Validate

Re-read `.spec-finder/tasks/<slug>/_prd.md` and verify:

- `## Implementation Spec` is the only section this skill created or changed
- when an approved PRD was the input, its in-scope capabilities are inlined or explicitly excluded
- approved product sections above the heading are unchanged
- every template token is replaced
- confirmed seams, test locations, and command identities are explicit
- each slice is red → minimal green before the next red
- red and green use the same focused command
- expected values have an independent source of truth
- mocks appear only at system boundaries
- implementation-coupled, tautological, and horizontal tests are prohibited
- refactoring is deferred until all slices are green
- the repository gate and completion output are named

Fix any validation failure before completion.

### 6. Print the spec location

After validation, end the response with this block and nothing after it.
Replace `<slug>` with the real slug.
The path line is what the user copies and pastes to an agent:

```text
Copy this path and point an agent at it:
.spec-finder/tasks/<slug>/_prd.md
```
