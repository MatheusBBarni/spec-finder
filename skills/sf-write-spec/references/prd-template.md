# [Feature] Product Requirements

This file is the product half of the persistent spec contract.
Executors re-read it.
Keep it short.
Do not write APIs, schemas, or test design here.

## Problem

Who is affected, the current workflow, how it fails, and why it is worth solving now.
A feature request is not the problem.

## Out of Scope

Write exclusions before extra capabilities.
Each item needs a rationale and a reconsideration trigger.

- **[Excluded capability]** - [Rationale and reconsideration trigger]

## In Scope

Selected approach in one sentence, including what it gives up.

| ID | Capability | User value | Mapped stories | Observable outcome |
|---|---|---|---|---|
| F-01 | [Capability] | [Value] | US-01 | [User-visible result] |

## User Stories

### US-01: [Short name]

- **Persona:** [Persona]
- **Story:** As a [persona], I want [capability], so that [outcome].
- **Acceptance:**
  - **Given** [precondition]
  - **When** [action]
  - **Then** [observable result]

Add extra Given/When/Then triples for empty, failure, recovery, or permission paths that belong to this story.
Never write "works correctly".

## Constraints

Product-facing privacy, security, compatibility, or integration boundaries.
Do not prescribe implementation technology.

## Open Questions

Non-blocking unresolved items only.
Do not save with a material product branch undecided.
