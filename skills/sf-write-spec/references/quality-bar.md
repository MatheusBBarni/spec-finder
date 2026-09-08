# Spec quality bar

Read this before drafting and again before presenting the spec.
This bar applies only to `.spec-finder/specs/<slug>-spec.md`.
Packet files are a thinner projection and are not scored here.
The saved spec is the prompt the operator will point an agent at.
Reject and rewrite the spec if any item fails.
Do not present a failing spec.

## Iron law

```
NO PROMPT WITHOUT CURRENT-SYSTEM EVIDENCE.
NO FILE PATHS WITHOUT VERIFICATION.
NO ALGORITHM THAT STEALS THE AGENT'S JOB.
NO AMBIGUOUS SUCCESS.
NO PLACEHOLDERS IN THE SAVED SPEC.
```

## Reject if

- Outcome is "make it better", "clean it up", "add support for X", or "follow best practices".
- Paths are guessed and not marked `create`.
- The spec contains the implementation the agent should invent (after-code, patch, step-by-step algorithm).
- Fewer than two **Never** lines.
- No copy-pastable command as done-when.
- Current behavior is not distinguished from desired behavior.
- **Current System** has no verified path, or omits a current excerpt when the seam already exists.
- **Contracts** are prose only, or lack one valid and one invalid example.
- **Acceptance** has only the happy path when a failure path exists.
- A **Relevant Files** row has no "read first because".
- A section is one vague sentence that does not change executor behavior.
- Writer-facing template prose remains ("Write exclusions before…", "Who is affected…", "The system as it is. Not the design.").
- Any `[…]` fill-in token or `<slug>` remains. The listed examples are not exhaustive; every template token must be replaced.
- The executor would still need chat history, a question, or a repo-wide hunt to start.

## Density by section

| Section | Minimum that earns the heading |
|---|---|
| Execution | Named outcome, job type, and the protocol below. Not "implement the feature". |
| Problem | Who, workflow today, how it fails, why now. A feature request is not the problem. |
| Current System | Behavior now, evidence table, preserve-invariants, callers/tests. Excerpt when the seam exists. |
| Out of Scope | Named exclusion + rationale + reconsideration trigger. At least one. |
| In Scope | Approach in one sentence including what it gives up, plus observable `F-xx`. |
| Acceptance | Given/When/Then for the happy path and at least one empty/invalid/conflict/permission/recovery path. |
| Contracts | Repository-language signature, schema, or CLI grammar; errors; valid and invalid examples. |
| Agent Boundaries | Concrete Always / Ask first / Never. Never-lines name a banned action, not "be careful". |
| Failure | Named mode, detection, observable result, recovery, evidence. |
| Relevant Files | Verified path, why read it, role (`edit`/`create`), pattern to follow. |
| Verification | Exact focused command and repository gate from this repo. |
| Slices | Outcome, files, Given/When/Then, focused command, out of scope. Independently testable. |
| Output | What to report when done. Not "summarize the work". |

## Bad versus good

Bad Current System:

> Update `src/engine.ts` as needed.

Good:

> Today `runTaskPacket` in `src/engine.ts` does one pass and returns.
> Callers: `src/commands.ts` `runCommand`.
> Tests: `tests/engine.test.ts`.
> Preserve: `run` stays single-pass.

```ts
// src/engine.ts — current evidence, not the fix
export async function runTaskPacket(options: RunOptions): Promise<RunResult> {
  // one pass, then return
}
```

Bad contract:

> The CLI should accept a loop command.

Good:

```text
spec-finder loop <task_slug> [--dry-run] [--max-iterations N]
```

- Valid: `spec-finder loop demo --dry-run` → prints plan, writes nothing, exit 0.
- Invalid: `spec-finder loop --multiple a,b` → exit 2, usage, no lock, no writes.

Bad Never:

> Do not do anything risky.

Good:

> Never change `spec-finder run` grammar or single-pass behavior.
> Never add a required config key.

## Greenfield

When the file does not exist yet, mark it `create`.
Current System still cites the adjacent module, test, and convention the new file must follow.
Do not invent a parallel architecture.

## Packet projection

The spec stays dense.
`_prd.md` / `_techspec.md` / `task_NN.md` share scope, contracts, slice order, and verification commands.
They may omit excerpts and the prompt protocol.
They must not add capabilities the spec does not have.
