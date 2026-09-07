---
name: sf-write-spec
description: Creates an approved, agent-executable Spec Finder spec in one simplified path from a feature request, idea, or packet slug. Researches the repository and current docs before asking, asks only remaining material decisions, and writes nothing until the user approves a complete draft. Writes `.spec-finder/specs/<slug>-spec.md` with everything an agent needs to execute, plus the runner packet (`_prd.md`, `_techspec.md`, `_tasks.md`, `task_NN.md`). Use for a simplified spec path, sf-write-spec, write a spec, skip the idea/PRD/TechSpec/tasks stages, or one-shot specification. Do not use for idea-factory discovery, PRD-only, TechSpec-only, or task regeneration.
---

# Write a Spec Finder Packet

One invocation produces `.spec-finder/specs/<slug>-spec.md`, the self-contained spec an agent executes, plus a runner packet `sf-execute-task` can consume.
This is not `sf-idea-factory`, `sf-create-prd`, `sf-create-techspec`, and `sf-create-tasks` run in sequence.

Read `references/doctrine.md` before research.

<HARD-GATE>
- NEVER require `sf-idea-factory`, `sf-create-prd`, `sf-create-techspec`, or `sf-create-tasks` before starting.
- NEVER write or replace `.spec-finder/specs/<slug>-spec.md` or packet files before repository research, remaining-decision clarification, a complete draft review, and explicit whole-draft approval.
- NEVER skip repository and current-docs research because the request looks simple.
- NEVER ask the user to decide facts the repository or current docs already answer.
- NEVER expand capabilities before explicit non-goals.
- NEVER accept acceptance criteria that are not binary Given/When/Then.
  Reject "works correctly" and other untestable phrases.
- NEVER micromanage private implementation except public contracts (signatures, schemas, CLI grammar, errors).
- NEVER omit Always / Ask first / Never boundaries, named failure and edge cases, codebase-informed files, or named verification commands.
- NEVER create a slice that is not independently testable once its declared dependencies are done.
- NEVER omit `.spec-finder/specs/<slug>-spec.md`.
  That file is the agent-executable spec and must contain everything needed to implement and verify without chat history.
- NEVER omit `_prd.md` or `_techspec.md`.
  The runner and `sf-execute-task` re-read those files.
- NEVER run idea-factory council, KPI scoring, or 3-7 market-search depth on this path.
</HARD-GATE>

## Interaction contract

- Ask exactly one remaining question per turn and wait for the answer.
- Use the runtime's blocking question mechanism when available.
  Otherwise make the question the complete response and stop.
- Present every answer choice with sequential uppercase labels: `A.`, `B.`, `C.`, and so on.
- Every question must provide 2-3 concrete suggested answers.
  Add `Other` whenever those answers are not exhaustive; lead with `A. (Recommended)`.
- End every choice prompt with: `Reply with the letter (for example, A), or the letter plus context.`
- Do not auto-resolve a decision that changes scope, public contracts, data ownership, security, migrations, or required evidence.

Read `references/question-protocol.md` before asking questions or requesting approval.

## Required inputs

- A feature request, idea, or packet slug.
- Optional existing packet files for update mode.

If the user needs discovery of the problem, opportunity, or V1 boundary, stop and offer `sf-idea-factory`.
If they asked only for a PRD, TechSpec, or task regeneration, use that skill instead of this path.

## Mandatory phase checklist

1. Resolve the packet and read existing artifacts.
2. Research the repository and current docs.
3. Present evidence and remaining decisions.
4. Ask only the remaining material questions.
5. Draft the complete packet (product, technical, slices) as one review.
6. Obtain explicit whole-draft approval.
7. Write `.spec-finder/specs/<slug>-spec.md`, the runner packet, and missing memory.
8. Re-read and validate.

## Workflow

### 1. Resolve context

- Derive or confirm a descriptive kebab-case slug.
- Target `.spec-finder/specs/<slug>-spec.md` and `.spec-finder/tasks/<slug>/`.
- Read repository instructions, `.spec-finder/config.json` when present, an existing spec file, and every existing packet file including `_idea.md`, `_prd.md`, `_techspec.md`, `_tasks.md`, ADRs, memory, and `task_NN.md`.
- Create directories as needed.
  Do not write spec files yet.
- In update mode, change only the approved delta.
  Preserve completed tasks and existing memory.

### 2. Research before questions

Complete research before asking.
Run independent tracks concurrently when the runtime can do real parallel work.

**Repository track - required**

- Inspect related flows, modules, interfaces, tests, fixtures, verification commands, and conventions.
- Trace callers and consumers, not only the apparent target file.
- Cite concrete paths.
  Distinguish shipped behavior from comments or plans.

**Current-docs track - required when the change depends on an evolving library, SDK, protocol, CLI, or platform**

- Consult current primary documentation.
- Capture version or date, the supported constraint, source URL, and design consequence.

Do not run idea-factory market searches, KPI scoring, or advisor council on this path.

Present:

- **Repository findings** with paths
- **Current-docs findings** with citations when that track ran
- **Inferences** labeled as inference
- **Remaining decisions** that still require the user

### 3. Clarify remaining decisions

- Ask 2-6 questions following `references/question-protocol.md`.
- Follow the remaining-decision order: need and success, non-goals, public contracts and failure, boundaries, then slice forks.
- Skip dimensions already fixed.
- If no material decision remains, skip to the complete draft.

### 4. Draft the complete packet

Read `references/spec-template.md`, `references/prd-template.md`, `references/techspec-template.md`, and `references/tasks-index-template.md`.
Read the sibling task contract: `../sf-create-tasks/references/task-template.md` and `../sf-create-tasks/references/task-context-schema.md`.
If those sibling files are missing, stop.
This path does not invent a second task format.

Fill every required section below.
Present the spec, product, technical, and slices together as one draft.
The spec file is the complete agent-executable contract.
Packet files are the runner projection of that same draft and must not diverge.
Do not ask for section-by-section or stage-by-stage approval.

**Agent-executable spec (`.spec-finder/specs/<slug>-spec.md`)**

- Read `references/spec-template.md` and fill every section.
- Include what/why, Out of Scope before In Scope, Given/When/Then, public contracts, Always / Ask first / Never, named failure cases, verified files, named verification commands, and independently testable slices.
- An executor that reads only this file must be able to implement and verify.

**Product (`_prd.md`)**

- Problem (what/why), then Out of Scope, then In Scope.
- User stories with binary Given/When/Then.
- Stable IDs: `US-xx`, `F-xx`.

**Technical (`_techspec.md`)**

- Technical non-goals before extra design.
- Public contracts as signatures, schemas, or CLI grammar.
- Always / Ask first / Never.
- Named failure and edge cases.
- Verified relevant files and patterns.
- Exact verification commands.

**Slices (`_tasks.md` and `task_NN.md`)**

- Split by user/operator outcome (`US-xx` / `F-xx`), not by layer.
- Independently testable once declared dependencies are done.
- No foundation-only task and no separate test-only task.
- Define logical slices without IDs, then topologically order, then assign `task_01` through `task_NN`.
- Every dependency is a strictly lower-numbered task.
- Each task uses the sibling task template, including frontmatter `status`, `title`, `type`, `complexity`, and `dependencies`.
- Replace every `<slug>` placeholder with the current packet slug.
- Each task names this packet's exact `_prd.md` and `_techspec.md` paths in `## Source Artifacts` and `<critical>`, and also names `.spec-finder/specs/<slug>-spec.md`.
- Each task has Given/When/Then, out of scope, verified files, focused tests, and the repository gate.

**Complexity**

- `low`: one primary file, no new interface.
- `medium`: 2-4 primary files or one bounded new interface.
- `high`: 5-7 primary files, a subsystem, concurrency, or several integrations.
- `critical`: indivisible cross-cutting work; split unless the user accepts it.

Create an ADR from `../sf-create-prd/references/adr-template.md` only for a consequential decision the user explicitly made.

### 5. Review and save

- Present the complete draft once.
- Ask with `A. Approve and write the packet`, `B. Adjust the draft`, `C. Rewrite`, and `D. Discard`.
- Apply feedback and present the complete current draft again.
- Write files only after explicit approval of that version:

  - `.spec-finder/specs/<slug>-spec.md`
  - `.spec-finder/tasks/<slug>/_prd.md`
  - `.spec-finder/tasks/<slug>/_techspec.md`
  - `.spec-finder/tasks/<slug>/_tasks.md`
  - `.spec-finder/tasks/<slug>/task_NN.md`
  - ADRs under `adrs/` when required

- Initialize missing `memory/MEMORY.md` and `memory/task_NN.md` using `sf-memory`.
  Never overwrite existing memory.
- Do not write `_idea.md` on this path unless it already exists.

### 6. Validate before completion

Re-read every generated file and verify:

- `.spec-finder/specs/<slug>-spec.md` exists, has no `<slug>` placeholder, and contains Execution, Problem, Out of Scope, In Scope, Acceptance, Contracts, Agent Boundaries, Failure and Edge Cases, Relevant Files, Verification, and Slices
- `_prd.md` has what/why, Out of Scope before In Scope, and Given/When/Then stories
- `_techspec.md` has technical non-goals, public contracts, Always / Ask first / Never, named failure cases, verified files, and named verification commands
- every `task_NN.md` parses as Spec Finder frontmatter and its H1 title matches
- IDs are contiguous, dependencies point backward, and the graph is acyclic
- every task names this packet's `_prd.md` and `_techspec.md` paths plus `.spec-finder/specs/<slug>-spec.md`, and contains no `<slug>` placeholder
- no slice is a layer-only foundation
- no acceptance line is "works correctly" or another untestable phrase

Fix validation failures and repeat.
Point to `spec-finder run <slug>` or `sf-execute-task` as the next step, not the four-skill pipeline.

## Anti-patterns

- Running the four existing skills in sequence and calling that simplified.
- Market council, KPI scoring, or invented baselines.
- Writing files before whole-draft approval.
- Guessed file paths.
- Public contracts as prose when a signature, schema, or CLI grammar exists.
- Layer splits (schema, API, UI, tests) when an outcome slice is possible.
- Forward dependencies such as `task_01` depending on `task_02`.
- Generic "read the PRD" instructions that omit this packet's paths.

## Failure rules

- Stop if the requested outcome and target user remain unclear after remaining questions.
- Stop if success cannot be stated as observable Given/When/Then after remaining questions.
- If codebase evidence conflicts, present both patterns and their actual usage before recommending one.
- If a material decision remains open, do not move it silently into Open Questions and save anyway.
- Preserve unrelated approved content in update mode.
