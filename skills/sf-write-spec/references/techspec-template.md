# [Feature] Technical Specification

This file is the technical half of the persistent spec contract.
Executors re-read it.
Keep prose short.
Public contracts may be longer than the prose.

## Context

- **PRD:** `.spec-finder/tasks/<slug>/_prd.md`
- Current seam and why a design is needed, in one sentence.

### Evidence

Decision-changing rows only.
Prefer repository paths and current official docs.
Label inference.

| Kind | Finding | Source | Design consequence |
|---|---|---|---|
| Repository / Official docs / Inference | [Finding] | [Path or URL] | [Consequence] |

## Technical Non-Goals

Write these before extra design.

- **[Excluded design]** - [Rationale and reconsideration trigger]

## Decision

Chosen approach, the primary trade-off, and what it gives up.

## Contracts

Signatures, schemas, CLI grammar, and error shapes.
Not a prose restatement of the PRD.
Omit unused fields.

### Public interfaces

Repository language for types, functions, CLI, or protocol contracts.

### Examples

- Valid: [input] → [output]
- Invalid: [input] → [error / observable failure]

### Errors

Named errors, mapping to user/system behavior, and fail-closed cases.

## Agent Boundaries

### Always

Actions and patterns the executor follows without asking.

- [Pattern or command, with path when it is a file]

### Ask first

Material expansions this packet does not decide.
During execution they are out of scope unless already decided above.
Record a follow-up; do not invent them mid-run.

- [Expansion that would change public contracts, dependencies, schema, or security]

### Never

Hard bans.

- [Prohibited action]
- [Second hard ban]

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

## Tests

Named contracts and exact commands.

- **Unit:** [contract, inputs, expected outcome]
- **Integration:** [boundary, fixture, failure case]
- **Platform / e2e:** [evidence unit tests cannot prove, or `Not applicable` with reason]
- **Gates:** `[focused command]` ; `[repository-wide gate]`

## Sequencing

Build-order constraints for implementation, not a task plan.

1. [Step] - no dependencies.
2. [Step] - depends on step 1 because [reason].

## Open Questions

Non-blocking unresolved items only.
Do not save with a material design branch undecided.

## Architecture Decision Records

- [ADR-NNN: Title](adrs/adr-NNN.md) - [Decision summary]
