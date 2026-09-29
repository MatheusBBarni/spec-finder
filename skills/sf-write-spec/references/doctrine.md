# Agent-executable spec doctrine

These rules are mandatory on `sf-write-spec`.
They are the spec contract, not style notes.

## The spec is the prompt

`.spec-finder/tasks/<slug>/_prd.md` is the file an agent is pointed at.
The `## Implementation Spec` section is the complete implementation prompt.
An executor that reads that file plus the repository must implement, verify, and stop without chat history.
If the executor would need to ask a question, reverse-engineer the seam, or guess a public contract, the spec is not done.
Do not leave intent only in chat.

## Single output only

`sf-write-spec` changes exactly one file: `.spec-finder/tasks/<slug>/_prd.md`.
It writes only the `## Implementation Spec` section.
It never writes `.spec-finder/specs/`, a TechSpec, task index, task file, ADR, or memory file.
The spec section must carry every implementation decision.

## Approved product sections stay above the spec

Approved product sections in `.spec-finder/tasks/<slug>/_prd.md` stay above `## Implementation Spec`.
Inline their problem, non-goals, capabilities, and acceptance into the spec section.
Do not tell the executor to read a different file.
Do not re-decide product scope the product sections already fixed unless repository evidence conflicts and the user chooses.
A thin task with no approved PRD is not a spec. Hand it to `sf-create-prd`.
A clear request may still start here. Create the file with only the spec section.

## Current system is mandatory

State the system as it is, then the change against that baseline.
Cite verified paths, callers, tests, and short current-code excerpts labeled as evidence of now, not as the fix.
Point at existing files and patterns instead of inventing architecture.
Greenfield work still names the adjacent modules to follow.

## What and why, plus contracts, not algorithms

State the user/operator outcome and why it matters.
Public contracts are required: signatures, schemas, CLI grammar, error shapes, and one valid plus one invalid example.
Do not prescribe private algorithms, "after" code, or a sketched patch.
Do not write a stakeholder PRD with no files.

## Density

Every section must change executor behavior.
One vague sentence is a fail.
Prefer tables, signatures, Given/When/Then, and labeled excerpts over essays.
Writer instructions and template placeholders must not appear in the saved spec.

## Binary acceptance

Every story and every slice uses Given/When/Then with an observable result.
Include empty, invalid, conflict, permission, or recovery paths that apply.
Reject "works correctly", "handle errors", "be robust", and "feel fast".
A tester who cannot see the code must be able to pass or fail the criterion.

## Non-goals first

Write explicit non-goals before extra capabilities.
If work is out of scope, name it and give a reconsideration trigger.
Agents fill gaps; unnamed exclusions become extra features.

## Three-tier boundaries

Always / Ask first / Never:

- **Always:** follow these without asking (patterns, tests, named verification).
- **Ask first:** material expansions the spec writer must resolve with the user before save.
  During later execution they are out of this spec unless already decided.
  Record a follow-up; do not invent them mid-run.
- **Never:** hard bans for authoring and execution. At least two.

## Named failure and edge cases

Name empty, invalid, conflict, timeout, permission, and recovery cases that apply.
Each row needs detection, observable behavior, and recovery or rollback.
"Handle errors" is not a case.

## Named verification as done

Done is a command that exits 0, plus the focused tests for the slice.
Write the exact command text from the repository.
Prohibited completion phrases: "tests should pass", "implementation looks correct".

## Bounded independently testable slices

Split by user/operator outcome, not by layer.
A slice is independently testable once declared dependencies are done.
No foundation-only task.
No separate test-only task.
Slices stay under `## Implementation Spec`. Do not project them into `task_NN.md`.

## Research, then ask, then approve

Research the repository and current docs before any question.
Ask only remaining material decisions.
Write nothing until the user explicitly approves one complete draft whose spec file passes `quality-bar.md`.
