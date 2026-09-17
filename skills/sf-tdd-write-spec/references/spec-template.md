# [Feature] TDD Spec

This file is the complete implementation prompt and the only saved artifact from `sf-tdd-write-spec`.
An executor that reads only this file plus the repository must implement and verify without chat history.

- **Slug:** `<slug>`
- **This file:** `.spec-finder/specs/<slug>-spec.md`
- **Job:** [Feature | Improvement | Bug]
- **Outcome:** [observable user or operator result]

## Execution

1. Read this file and every path under Relevant Files before editing.
2. Follow TDD Execution and implement Slices in numeric order.
3. Stay inside Out of Scope, Contracts, and Agent Boundaries.
4. Run every focused command and the repository gate to terminal exit.
5. Do not claim completion without observed red and green evidence for every slice.
6. Stop after Output. Do not implement Ask-first follow-ups.

## Problem

[Who is affected, workflow today, failure, and why now.]

Desired after this spec: [observable change against the current baseline].

## Current System

### Behavior now

[Current shipped behavior and failure.]

### Evidence

| Path | Today | Take from it |
|---|---|---|
| `path/to/file` | [shipped behavior] | [seam, convention, or invariant] |

### Current excerpts

```ts
// path/to/file — current evidence, not the fix
```

### Preserve

- [invariant]

### Callers and existing tests

- `path/to/caller` — [use of the seam]
- `path/to/test` — [behavior to extend or mirror]

## Out of Scope

- **[excluded capability]** — [rationale]. Reconsider when [trigger].

## In Scope

[Selected approach and principal trade-off.]

| ID | Capability | Observable outcome |
|---|---|---|
| F-01 | [capability] | [result] |

## Acceptance

### US-01: [happy path]

- **Given** [precondition]
- **When** [action]
- **Then** [observable result]

### US-01 failure: [failure path]

- **Given** [precondition]
- **When** [action]
- **Then** [observable failure or recovery]

## Contracts

### Public interfaces

```ts
// repository-language signature, schema, protocol, or CLI grammar
```

### Examples

- Valid: [input] → [output]
- Invalid: [input] → [observable error]

### Errors

| Name | Trigger | Observable behavior |
|---|---|---|
| [named error] | [condition] | [result] |

## Public Test Seams

These seams were confirmed before this spec was approved.

| Seam | Public interface | Observable behavior | Test location | Focused command | Why this seam |
|---|---|---|---|---|---|
| S-01 | `[interface]` | [behavior] | `path/to/test` | `[exact command]` | [consumer-visible boundary] |

## TDD Execution

For every slice:

1. Write one failing public-seam test named for observable behavior.
2. Run the slice's focused command to terminal exit and require the intended red.
3. Add only enough production behavior for that test.
4. Run the same focused command and require green.
5. Start no later slice before this one is green.

Stop on implementation-coupled tests, tautological expectations, horizontal slicing, unexpected red passes, or failed green. Mock only system boundaries. Refactor only during Review after every slice is green.

## Agent Boundaries

### Always

- Test through the confirmed public seams with independently sourced expected values.
- Preserve exact red and green command evidence.

### Ask first

- New dependency, public contract, schema migration, security boundary, or test seam.

### Never

- Mock internal collaborators or test private methods.
- Write all tests before implementation.
- Refactor during a red-green slice.

## Failure and Edge Cases

| Failure mode | Detection | Observable behavior | Recovery | Evidence |
|---|---|---|---|---|
| [named case] | [detection] | [result] | [recovery] | [test or command] |

## Relevant Files and Patterns

| Path | Read first because | Role | Pattern to follow |
|---|---|---|---|
| `path/to/file` | [fact to extract] | [edit or create] | [verified convention] |

## Verification

- **Focused:** `[exact command]`
- **Repository gate:** `[exact command]`
- **Platform / e2e:** [needed evidence or Not applicable with reason]

## Slices

### Slice 01: [observable outcome]

- **Primary:** US-01 / F-01
- **Seam:** S-01
- **Dependencies:** none
- **Given/When/Then:** [binary behavior]
- **Test:** `path/to/test` — [public-interface assertion and independent expected value]
- **Red:** `[exact focused command]` fails because [missing behavior]
- **Green:** `[same exact focused command]` passes after only [minimal behavior]
- **Files:** `path/to/file` — [role]
- **Out of scope:** [excluded work]

## Review

After every slice is green:

1. Review duplication, naming, locality, and maintainability without changing behavior.
2. Refactor only where evidence justifies it.
3. Re-run all focused commands and the repository gate.

## Output

Report and stop:

- red and green result for each slice, including command identity
- changed files
- repository-gate result
- decisions made against Contracts and Acceptance
- Ask-first follow-ups not implemented

## Open Questions

Non-blocking items only. Do not save with a material branch, seam, or contract undecided.
