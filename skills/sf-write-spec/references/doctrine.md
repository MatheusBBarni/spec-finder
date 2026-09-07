# Agent-executable spec doctrine

These rules are mandatory on `sf-write-spec`.
They are the spec contract, not style notes.

## Persistent contract

The agent-executable spec is `.spec-finder/specs/<slug>-spec.md`.
It must contain everything an executor needs without chat history: what/why, non-goals, Given/When/Then, contracts, boundaries, failure cases, files, named verification, and slices.
The packet files (`_prd.md`, `_techspec.md`, `task_NN.md`) are the runner projection of that same draft.
Do not leave intent only in chat.
Do not let the spec file and the packet diverge.

## What and why, not how

State the user/operator outcome and why it matters.
Do not prescribe private implementation except public contracts: signatures, schemas, CLI grammar, and error shapes.
Point at existing files and patterns instead of inventing architecture.

## Binary acceptance

Every story and every task uses Given/When/Then with an observable result.
Reject "works correctly", "handle errors", "be robust", and "feel fast".
A tester who cannot see the code must be able to pass or fail the criterion.

## Non-goals first

Write explicit non-goals before extra capabilities.
If work is out of scope, name it and give a reconsideration trigger.
Agents fill gaps; unnamed exclusions become extra features.

## Three-tier boundaries

The TechSpec must include Always / Ask first / Never.

- **Always:** follow these without asking (patterns, tests, named verification).
- **Ask first:** material expansions the spec writer must resolve with the user before save.
  During later execution they are out of this packet unless already decided.
  Record a follow-up; do not invent them mid-run.
- **Never:** hard bans for authoring and execution.

## Named failure and edge cases

Name empty, invalid, conflict, timeout, permission, and recovery cases that apply.
Each row needs detection, observable behavior, and recovery or rollback.
"Handle errors" is not a case.

## Codebase-informed context

Cite verified paths, callers, tests, and conventions.
Mark files to create as `create`.
Do not assume context the repository does not show.

## Named verification as done

Done is a command that exits 0, plus the focused tests for the slice.
Write the exact command text.
Prohibited completion phrases: "tests should pass", "implementation looks correct".

## Bounded independently testable slices

Split by user/operator outcome, not by layer.
A slice is independently testable once declared dependencies are done.
No foundation-only task.
No separate test-only task.
Numeric IDs are the execution order and always depend backward.

## Research, then ask, then approve

Research the repository and current docs before any question.
Ask only remaining material decisions.
Write nothing until the user explicitly approves one complete draft.
