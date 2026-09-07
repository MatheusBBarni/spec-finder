# [Feature] Spec

This file is the agent-executable spec.
An executor that reads only this file must be able to implement, verify, and stop without chat history.

- **Slug:** `<slug>`
- **This file:** `.spec-finder/specs/<slug>-spec.md`
- **Runner packet:** `.spec-finder/tasks/<slug>/`

## Execution

1. Read this file completely before editing.
2. Implement slices in numeric order.
   A slice may start only when every listed dependency is done.
3. Stay inside Out of Scope and Agent Boundaries.
4. Run the named verification commands to terminal exit.
   On failure, fix in scope and re-run until clean.
5. Do not ask the user questions while executing.
   Ambiguity is a decision: pick the interpretation that matches Contracts and Given/When/Then, record it, continue.
6. Do not claim done unless the named commands exited 0.
7. Do not invent capabilities that are not in In Scope.

## Problem

Who is affected, the current workflow, how it fails, and why this is worth solving now.

## Out of Scope

Write exclusions before extra capabilities.
Each item needs a rationale and a reconsideration trigger.

- **[Excluded capability]** - [Rationale and reconsideration trigger]

## In Scope

Selected approach in one sentence, including what it gives up.

| ID | Capability | Observable outcome |
|---|---|---|
| F-01 | [Capability] | [User-visible result] |

## Acceptance

Binary Given/When/Then only.
Never write "works correctly".

### US-01: [Short name]

- **Given** [precondition]
- **When** [action]
- **Then** [observable result]

Add extra triples for empty, invalid, conflict, permission, and recovery paths that belong to this change.

## Contracts

Public signatures, schemas, CLI grammar, and error shapes.
Private implementation is not specified here.

### Public interfaces

Repository language for types, functions, CLI, or protocol contracts.

### Errors

Named errors and the observable behavior for each.

## Agent Boundaries

### Always

- [Pattern, path, or command the executor follows without asking]

### Ask first

These are out of this spec unless already decided above.
During execution, record a follow-up; do not invent them.

- [New dependency, schema migration, extra public contract, or security change]

### Never

- [Hard ban]

## Failure and Edge Cases

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| [Named case] | [How it is detected] | [Observable result] | [Recovery] | [Test or command] |

## Relevant Files and Patterns

Verified paths.
Say `create` when the file does not exist yet.

| Path | Role | Pattern to follow |
|---|---|---|
| `path/to/file` | [Edit or create] | [Existing convention or file] |

## Verification

Done is these commands exiting 0.

- **Focused:** `[exact command]`
- **Repository gate:** `[exact command]`
- **Unit:** [contract, inputs, expected outcome]
- **Integration:** [boundary, fixture, failure case]
- **Platform / e2e:** [evidence unit tests cannot prove, or `Not applicable` with reason]

Prohibited completion phrases: "tests should pass", "implementation looks correct".

## Slices

Split by user/operator outcome, not by layer.
Numeric order is the execution order.
Every dependency is a lower-numbered slice.

### Slice 01: [Imperative title]

- **Outcome:** [Independently testable result]
- **Primary:** US-01 / F-01
- **Dependencies:** none
- **Acceptance:**
  - **Given** [precondition]
  - **When** [action]
  - **Then** [observable result]
- **Files:** `path/to/file` - [role]
- **Focused tests:** `[exact command]`
- **Out of scope:** [excluded work]

## Open Questions

Non-blocking unresolved items only.
Do not save with a material branch undecided.
