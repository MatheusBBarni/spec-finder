---
name: sf-write-spec
description: Creates an approved, agent-executable Spec Finder spec in one simplified path from a feature request, idea, or spec slug. Researches the repository and current docs before asking, asks only remaining material decisions, and writes nothing until the user approves a complete draft. Writes only `.spec-finder/specs/<slug>-spec.md` as the complete implementation prompt an agent runs when pointed at that file. Use for a simplified spec path, sf-write-spec, write a spec, skip the idea/PRD/TechSpec/tasks stages, or one-shot specification. Do not use for idea-factory discovery, PRD-only, TechSpec-only, task regeneration, or packet creation.
---

# Write a Spec Finder Spec

One invocation produces exactly one saved artifact: `.spec-finder/specs/<slug>-spec.md`, the complete implementation prompt an agent runs when pointed at that file.
It does not create or update `.spec-finder/tasks/`, `_prd.md`, `_techspec.md`, `_tasks.md`, `task_NN.md`, ADRs, or memory files.
This is not `sf-idea-factory`, `sf-create-prd`, `sf-create-techspec`, and `sf-create-tasks` run in sequence.

Read `references/doctrine.md` before research.
Read `references/quality-bar.md` before drafting.

<HARD-GATE>
- NEVER require `sf-idea-factory`, `sf-create-prd`, `sf-create-techspec`, or `sf-create-tasks` before starting.
- NEVER write or replace `.spec-finder/specs/<slug>-spec.md` before repository research, remaining-decision clarification, a complete draft review, and explicit whole-draft approval.
- NEVER write or replace `.spec-finder/tasks/`, `_prd.md`, `_techspec.md`, `_tasks.md`, `task_NN.md`, ADRs, memory files, or any runner packet artifact.
- NEVER skip repository and current-docs research because the request looks simple.
- NEVER ask the user to decide facts the repository or current docs already answer.
- NEVER expand capabilities before explicit non-goals.
- NEVER accept acceptance criteria that are not binary Given/When/Then.
  Reject "works correctly" and other untestable phrases.
- NEVER micromanage private implementation except public contracts (signatures, schemas, CLI grammar, errors, valid and invalid examples).
- NEVER omit Always / Ask first / Never boundaries, named failure and edge cases, codebase-informed files, or named verification commands.
- NEVER create a slice that is not independently testable once its declared dependencies are done.
- NEVER omit `.spec-finder/specs/<slug>-spec.md`.
  That file is the implementation prompt and must contain everything needed to implement and verify without chat history.
- NEVER present a `.spec-finder/specs/<slug>-spec.md` draft that fails `references/quality-bar.md` or still contains template placeholders.
- NEVER omit Current System evidence (verified paths, callers/tests, and a current excerpt when the seam exists).
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

- A feature request, idea, or spec slug.
- Optional existing `.spec-finder/specs/<slug>-spec.md` for update mode.

If the user needs discovery of the problem, opportunity, or V1 boundary, stop and offer `sf-idea-factory`.
If they asked only for a PRD, TechSpec, task regeneration, or runner packet creation, use the specific skill for that output instead of this path.

## Mandatory phase checklist

1. Resolve the spec path and read existing artifacts.
2. Research the repository and current docs into a current-system ledger.
3. Present evidence and remaining decisions.
4. Ask only the remaining material questions.
5. Draft the complete spec as one review.
6. Obtain explicit whole-draft approval.
7. Write only `.spec-finder/specs/<slug>-spec.md`.
8. Re-read and validate against the quality bar.

## Workflow

### 1. Resolve context

- Derive or confirm a descriptive kebab-case slug.
- Target only `.spec-finder/specs/<slug>-spec.md`.
- Read repository instructions, `.spec-finder/config.json` when present, and the existing spec file when present.
- Create `.spec-finder/specs/` as needed.
  Do not write the spec file yet.
- In update mode, change only the approved delta.
  Preserve unrelated repository files and any existing task packets.

### 2. Research before questions

Complete research before asking.
Run independent tracks concurrently when the runtime can do real parallel work.

**Repository track - required.** Capture a current-system ledger the spec will quote:

- Current behavior versus desired behavior.
- Related flows, modules, interfaces, callers, consumers, tests, fixtures, and conventions.
- Exact verification commands from this repository.
- 1-3 short current-code excerpts that show the seam (evidence of now, not the fix).
- Distinguish shipped behavior from comments or plans.

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

### 4. Draft the complete spec

Read `references/spec-template.md` and `references/quality-bar.md`.

Fill every required section below with repository facts, not writer notes.
Strip every template placeholder from the spec file.
Run `references/quality-bar.md` against `.spec-finder/specs/<slug>-spec.md` and rewrite until it passes, then present the draft.
The spec stays dense; do not split it into packet files.
Do not ask for section-by-section or stage-by-stage approval.

**Agent-executable spec (`.spec-finder/specs/<slug>-spec.md`)**

- Read `references/spec-template.md` and fill every section.
- Include outcome, current vs desired, Current System evidence, Out of Scope before In Scope, Given/When/Then plus a failure path, public contracts with examples, Always / Ask first / Never, named failure cases, read-first files, named verification commands, independently testable slices, and Output.
- An executor pointed at only this file must be able to implement and verify.
- Keep slices inside the spec file.
  Do not project them into `.spec-finder/tasks/` or `task_NN.md`.

### 5. Review and save

- Present the complete draft once.
- Ask with `A. Approve and write the spec`, `B. Adjust the draft`, `C. Rewrite`, and `D. Discard`.
- Apply feedback and present the complete current draft again.
- Write files only after explicit approval of that version.
- Write exactly one file:

  - `.spec-finder/specs/<slug>-spec.md`

- Do not write `.spec-finder/tasks/<slug>/`, `_prd.md`, `_techspec.md`, `_tasks.md`, `task_NN.md`, ADRs, memory files, or any runner packet artifact.

### 6. Validate before completion

Re-read the generated spec and verify:

- `.spec-finder/specs/<slug>-spec.md` exists, has no `<slug>` or template placeholder, passes `references/quality-bar.md`, and contains Execution, Problem, Current System, Out of Scope, In Scope, Acceptance, Contracts, Agent Boundaries, Failure and Edge Cases, Relevant Files, Verification, Slices, and Output
- no acceptance line is "works correctly" or another untestable phrase
- the intended write set is exactly `.spec-finder/specs/<slug>-spec.md`
- no `.spec-finder/tasks/<slug>/` files, PRD, TechSpec, task index, task file, ADR, or memory file were created or changed by this skill

Fix validation failures and repeat.
Point to the spec file as the prompt an agent executes.
Do not point to `spec-finder run <slug>` or `sf-execute-task`; this path does not create their runner packet.

## Anti-patterns

- Running the four existing skills in sequence and calling that simplified.
- Creating a runner packet or projection beside the spec.
- A stakeholder outline that restates the feature request with no files, contracts, or current excerpts.
- Writer instructions or template placeholders left in the spec.
- Market council, KPI scoring, or invented baselines.
- Writing files before whole-draft approval.
- Guessed file paths.
- Public contracts as prose when a signature, schema, or CLI grammar exists.
- Layer splits when an outcome slice is possible.
- Forward dependencies such as Slice 01 depending on Slice 02.
- Generic "read the PRD" instructions; the spec must contain the executable contract itself.
- Shrinking the spec because packet files no longer exist.

## Failure rules

- Stop if the requested outcome and target user remain unclear after remaining questions.
- Stop if success cannot be stated as observable Given/When/Then after remaining questions.
- If codebase evidence conflicts, present both patterns and their actual usage before recommending one.
- If a material decision remains open, do not move it silently into Open Questions and save anyway.
- Preserve unrelated approved content in update mode.
