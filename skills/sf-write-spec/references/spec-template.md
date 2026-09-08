# [Feature] Spec

This file is the complete implementation prompt.
An executor that reads only this file plus the repository must implement, verify, and stop without chat history.
The operator will point an agent at this path. Do not ask the user questions.

- **Slug:** `<slug>`
- **This file:** `.spec-finder/specs/<slug>-spec.md`
- **Runner packet:** `.spec-finder/tasks/<slug>/`

## Execution

**Outcome:** [one-sentence user/operator result]
**Job:** [Feature | Improvement | Bug]

1. Read this file completely before editing.
2. Read every path in Relevant Files before editing.
3. Implement slices in numeric order.
   A slice may start only when every listed dependency is done.
4. Stay inside Out of Scope and Agent Boundaries.
5. Match Contracts and Given/When/Then.
   Private implementation is yours; do not invent extra capabilities.
6. Run the named verification commands to terminal exit.
   On failure, fix in scope and re-run until clean.
7. Do not ask the user questions while executing.
   Ambiguity is a decision: pick the interpretation that matches Contracts and Given/When/Then, record it under Output, continue.
8. Do not claim done unless the named commands exited 0.
9. Stop after Output. Do not start Ask-first follow-ups.

## Problem

[Who is affected.]
[Workflow today.]
[How it fails.]
[Why this is worth solving now.]

Desired after this spec: [observable change against that baseline].

## Current System

### Behavior now

[What happens today, including the failure this spec fixes.]

### Evidence

| Path | Today | Take from it |
|---|---|---|
| `path/to/file` | [Shipped behavior] | [Seam, convention, or invariant] |

### Current excerpts

```ts
// path/to/file — current evidence, not the fix
```


### Preserve

- [Invariant this change must not break]

### Callers and tests

- `path/to/caller` — [how it uses the seam]
- `path/to/test` — [existing case to extend or mirror]

## Out of Scope

- **[Excluded capability]** - [Rationale]. Reconsider when [trigger].

## In Scope

[One sentence: selected approach and what it gives up.]

| ID | Capability | Observable outcome |
|---|---|---|
| F-01 | [Capability] | [User-visible result] |

## Acceptance

Binary Given/When/Then only.
Never write "works correctly".
Include at least one empty, invalid, conflict, permission, or recovery path.

### US-01: [Short name]

- **Given** [precondition]
- **When** [action]
- **Then** [observable result]

### US-01 failure: [Short name]

- **Given** [precondition]
- **When** [action]
- **Then** [observable result]

## Contracts

Public signatures, schemas, CLI grammar, and error shapes.
Private implementation is not specified here.

### Public interfaces

```ts
// repository language
```

### Examples

- Valid: [input] → [output]
- Invalid: [input] → [error / observable failure]

### Errors

| Name | When | Observable behavior |
|---|---|---|
| [Error] | [Trigger] | [User/system result] |

## Agent Boundaries

### Always

- [Pattern, path, or command the executor follows without asking]

### Ask first

These are out of this spec unless already decided above.
During execution, record a follow-up; do not invent them.

- [New dependency, schema migration, extra public contract, or security change]

### Never

- [Hard ban]
- [Second hard ban]

## Failure and Edge Cases

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| [Named case] | [How it is detected] | [Observable result] | [Recovery] | [Test or command] |

## Relevant Files and Patterns

Read these before editing.
Verified paths only.
Say `create` when the file does not exist yet.

| Path | Read first because | Role | Pattern to follow |
|---|---|---|---|
| `path/to/file` | [What to extract] | [Edit or create] | [Existing convention or file] |

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

## Output

After verification, report and stop.

- **Done:** named commands exited 0; every In Scope capability and slice acceptance holds
- **Changed:** [files the executor will list]
- **Decisions:** ambiguities resolved against Contracts and Given/When/Then
- **Follow-ups:** Ask-first items not implemented

Do not ask what to do next.

## Open Questions

Non-blocking unresolved items only.
Do not save with a material branch undecided.
