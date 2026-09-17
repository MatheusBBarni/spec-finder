# TDD spec quality bar

Apply this bar before presenting and after saving `.spec-finder/specs/<slug>-spec.md`.

## Iron law

```text
NO PROMPT WITHOUT CURRENT-SYSTEM EVIDENCE.
NO TEST PLAN WITHOUT CONFIRMED PUBLIC SEAMS.
NO GREEN WITHOUT AN OBSERVED RED.
NO HORIZONTAL TEST BATCH.
NO IMPLEMENTATION-COUPLED OR TAUTOLOGICAL TEST.
NO EXTERNAL TDD SKILL DEPENDENCY.
NO ARTIFACT EXCEPT THE SPEC.
NO PLACEHOLDERS IN THE SAVED SPEC.
```

## Reject if

- the outcome, current behavior, or desired behavior is ambiguous
- a repository path is guessed rather than verified or marked `create`
- a proposed test seam was not explicitly confirmed by the user
- a test reaches a private method, mocks an internal collaborator, or verifies through a side channel
- an expected value is computed with production logic instead of an independent literal, example, or contract
- tests are written as a horizontal batch before implementation
- any slice lacks one test, an intended red reason, minimal green behavior, or the same exact focused command for both states
- a later slice starts before the current slice is green
- refactoring occurs inside a red-green slice
- a mock is used away from a system boundary
- a red command can pass before implementation without stopping the slice
- the spec tells the executor to load or invoke an external TDD skill
- the workflow creates a packet, PRD, TechSpec, task, ADR, report, or memory artifact
- acceptance omits a relevant invalid, empty, conflict, permission, or recovery path
- public contracts lack a signature, schema, protocol, or CLI grammar plus valid and invalid examples
- exact focused commands or the repository gate are absent
- writer instructions, `[fill-in]` tokens, or `<slug>` remain

## Required density

| Section | Required content |
|---|---|
| Current System | Verified behavior, paths, callers, tests, preserved invariants, and current excerpt when a seam exists |
| Public Test Seams | Confirmed public interface, observable behavior, test location, exact command, and why it is public |
| TDD Execution | Red, minimal green, same command, vertical ordering, stop conditions, boundary-only mocking |
| Slices | One observable outcome with Given/When/Then, one seam, one test, red reason, minimal green, exact command |
| Review | Refactoring only after all slices are green, followed by focused and repository verification |
| Output | Per-slice red/green evidence, changed files, repository gate, decisions, and follow-ups |

A spec passes only when an executor can perform each red-green cycle without chat history or an external TDD skill.
