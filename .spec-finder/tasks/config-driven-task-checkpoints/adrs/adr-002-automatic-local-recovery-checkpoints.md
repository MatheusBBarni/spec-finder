# ADR-002: Automatic Local Recovery Checkpoints as the MVP Product Approach

## Status

Accepted

## Date

2026-08-04

## Context

The approved idea identifies reliable resumption as the primary user outcome: after a packet stops, an operator should be able to continue without rerunning work that already passed its implementation, verification, report, and completion gates.

Research confirms that small, meaningful commits support review and rollback, while explicit approval and no-push boundaries reduce risk for mutating agent workflows. The repository does not yet have a user-visible checkpoint-delivery outcome, and a task that is implementation-complete but not checkpointed must not silently allow downstream work to proceed.

## Decision Drivers

- Primary success outcome is resumption without rerunning verified tasks.
- `auto_commit` remains explicit opt-in and default-off.
- Both ACP and manual batch workflows need one product contract.
- The checkpoint is local-only and never proves review, merge, or remote acceptance.
- A checkpoint failure must be visible and recoverable without discarding verified work.
- MVP scope must remain smaller than a Git-state management subsystem.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | The current runtime has a verified task completion boundary but no checkpoint-delivery outcome. | `src/engine.ts`, `src/tasks.ts`, UI/archive status handling | 2026-08-04 |
| Repository | The manual workflow already frames commits as per-task checkpoints but uses an invocation flag and different dirty-state behavior. | `skills/sf-batch-tasks/SKILL.md` | 2026-08-04 |
| External | GitHub describes small meaningful commit groups as useful for review, rollback, and clear history. | [Writing code for a project](https://docs.github.com/en/pull-requests/concepts/writing-code-for-a-project) | 2026-08-04 |
| External | GitHub agent workflows preserve explicit mutation controls, branch protections, and human review. | [Copilot cloud agent risks](https://docs.github.com/en/enterprise-cloud%40latest/copilot/concepts/agents/cloud-agent/risks-and-mitigations) | 2026-08-04 |
| User decision | The user selected Approach A: automatic local recovery checkpoints. | PRD approach decision | 2026-08-04 |

## Decision

Adopt **automatic local recovery checkpoints** as the MVP product approach:

- `auto_commit: true` opts the repository into one local checkpoint after each verified task; the default remains `false`.
- The checkpoint preserves the complete task record: task-owned implementation/test/docs changes, report, task memory, and status evidence, with shared metadata only when attributable.
- A task that completes implementation and verification but cannot safely produce its checkpoint is presented as **checkpoint-blocked**. Downstream tasks do not start automatically. After the operator resolves the Git condition, the completed work can be continued without rerunning the verified task.
- The product does not push, create pull requests, bypass hooks or signing, commit failed/blocked tasks, or provide dirty-worktree reconciliation in MVP.
- Discovery and rollout are documentation-only: generated/example configuration explains the opt-in; setup does not ask users to enable it interactively.

## Alternatives Considered

### Review-before-commit checkpoints

- **User value:** Gives the operator explicit approval before every history mutation.
- **Costs/risks:** Adds friction and weakens unattended recovery after a stopped packet.
- **Why not selected:** The primary success metric is resumption without rerunning verified tasks, and explicit config opt-in already provides a user-controlled boundary.

### Managed recovery workflow

- **User value:** Could reconcile dirty state and provide a richer first-class recovery experience.
- **Costs/risks:** Expands MVP into a durable Git-state management product with additional policy and recovery semantics.
- **Why not selected:** Repository evidence does not establish that this complexity is necessary to test the core hypothesis.

## Consequences

### Positive

- The MVP directly tests the approved resumability hypothesis.
- Operators retain ordinary local Git history for review, rollback, and continuation.
- The default-off, documentation-only rollout minimizes surprise and preserves current behavior.
- Checkpoint failures are visible without falsely treating verified implementation as failed.

### Negative and trade-offs

- Strict safety gates may refuse checkpoints when the worktree is dirty.
- Operators must manually resolve Git state before automatic progression can continue.
- A checkpoint-blocked outcome adds product language and lifecycle surface to an otherwise simple task flow.

### Risks and mitigations

- **Users mistake a local checkpoint for reviewed or merged work** — clearly label it local-only and never imply remote acceptance.
- **Checkpoint failure causes confusing recovery** — show the exact refusal reason, preserve verified task evidence, and explain the continuation path.
- **Opt-in is undiscovered** — document the setting in generated/example configuration and the main configuration guide.
- **MVP grows into Git reconciliation** — keep dirty-state isolation, remote operations, and recovery automation as explicit later-phase candidates.

## Reversibility

The approach is reversible by leaving `auto_commit` false or removing the feature without changing task implementation semantics. A later phase can add review-before-commit or managed recovery if resumption data shows that strict local checkpoints are insufficient.

## Follow-ups

- Define the user-visible checkpoint-blocked and continuation language.
- Establish the first 30-day measurement method for eligible stopped runs and rerun avoidance.
- Validate whether complete task records produce useful reviewable commits without excessive noise.

## References

- [Approved idea](/Users/matheusbbarni/projects/spec-finder/.spec-finder/tasks/config-driven-task-checkpoints/_idea.md)
- [ADR-001: Config-Driven Per-Task Git Checkpoints](adr-001-config-driven-task-checkpoints.md)
- [sf-create-prd template](../../../../skills/sf-create-prd/references/prd-template.md)
