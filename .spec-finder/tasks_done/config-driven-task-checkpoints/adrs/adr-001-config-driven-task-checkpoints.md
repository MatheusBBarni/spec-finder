# ADR-001: Config-Driven Per-Task Git Checkpoints

## Status

Accepted

## Date

2026-08-04

## Context

Spec Finder executes tasks sequentially and already has a verified completion boundary: implementation, report generation, substantive-report validation, and a terminal task status. Operators want that boundary to become a recoverable Git checkpoint so a later run can resume from the last successfully delivered task.

The current configuration is strict and has no commit policy. The ACP runtime and the manual `sf-batch-tasks` workflow are separate execution paths; the manual skill currently describes an invocation-level `auto-commit=true` option. Git commits the index, so pre-existing staged, unstaged, or untracked work can be captured accidentally unless the checkpoint path fails closed. The feature must not push, create pull requests, alter authorship, bypass hooks, or become a second workflow-control plane.

## Decision Drivers

- Reliable resumability after each verified task.
- One policy across ACP runtime and manual batch execution.
- Explicit opt-in with a default of `false`.
- No accidental inclusion of unrelated or pre-existing work.
- Truthful separation between implementation completion and Git delivery.
- Preservation of existing task/report lifecycle ownership.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | Configuration is strict and `DEFAULT_CONFIG` has no `auto_commit` field. | `src/config.ts` and `tests/config.test.ts` | 2026-08-04 |
| Repository | The runtime owns report validation and the `completed` transition. | `src/engine.ts` and `tests/engine.test.ts` | 2026-08-04 |
| Repository | The manual batch skill already defines per-task commit safety concepts but exposes them as an invocation flag. | `skills/sf-batch-tasks/SKILL.md` | 2026-08-04 |
| External | Porcelain status is intended for stable machine parsing and includes staged, unstaged, and untracked paths. | [Git status documentation](https://git-scm.com/docs/git-status) | 2026-08-04 |
| External | Exact pathspec staging and cached-diff inspection are safer than blanket staging. | [Git add documentation](https://git-scm.com/docs/git-add) | 2026-08-04 |
| External | A commit records the current index, so a dirty index can include unrelated staged changes. | [Git commit documentation](https://git-scm.com/docs/git-commit) | 2026-08-04 |
| User decision | The user selected config-only policy, default `false`, both execution paths, successful-task-only commits, fail-closed dirty-state handling, and `completed-uncommitted` on checkpoint failure. | Idea-factory clarification and direction decisions | 2026-08-04 |

## Decision

Add a strict boolean `auto_commit` configuration setting with a default of `false`. When it is `true`, both `spec-finder run <slug>` and the manual `sf-batch-tasks` workflow use the same checkpoint behavior:

1. Wait until the task has passed implementation, verification, substantive-report validation, and the normal `completed` transition.
2. Require a clean, attributable Git state; any pre-existing staged, modified, untracked, or ambiguous work causes a fail-closed checkpoint refusal.
3. Stage only the explicit files attributable to that task, inspect the cached diff, and create exactly one local commit with a deterministic task-scoped message.
4. Never push, create a PR, alter Git identity, bypass hooks or signing, stash/reset/clean, or commit when `auto_commit` is `false`.
5. If the task work is complete but Git cannot safely create the checkpoint, preserve the implementation/task evidence as `completed-uncommitted`, report the reason, and stop automatic progression. The run must not claim full delivery success.

The configuration setting is the sole policy source; invocation-level `auto-commit=true|false` controls are removed or made non-authoritative so the two execution paths cannot diverge.

## Alternatives Considered

### Invocation-level auto-commit only

- **Benefits:** No configuration schema change; easy one-off control.
- **Costs/risks:** Runtime and manual workflows diverge, and unattended runs cannot inherit a repository policy.
- **Why not selected:** Conflicts with the user's config-only requirement and weakens resumability consistency.

### Runtime-only auto-commit

- **Benefits:** Smaller implementation and direct ownership by the ACP engine.
- **Costs/risks:** Manual batch execution retains different semantics and documentation.
- **Why not selected:** The user explicitly selected both supported execution paths.

### Transactional worktree/index isolation subsystem

- **Benefits:** Could attribute changes in a naturally dirty workspace and support richer recovery.
- **Costs/risks:** Larger Git-state surface, more failure modes, and a second subsystem to maintain.
- **Why not selected:** V1 needs a narrow, auditable checkpoint contract; strict fail-closed behavior is sufficient for the first measurable release.

## Consequences

### Positive

- Successful tasks produce reviewable, resumable local checkpoints when explicitly enabled.
- ACP and manual execution have one source of truth and one safety contract.
- Unrelated work is protected by a clean-state gate and explicit staging.
- Commit failures remain truthful without erasing verified implementation evidence.

### Negative and trade-offs

- A dirty working tree can prevent an otherwise successful task from being checkpointed.
- Existing users do not receive the behavior until they explicitly add `auto_commit: true`.
- Commit-message, artifact-allowlist, and failure-report details add implementation and test surface.

### Risks and mitigations

- **Unrelated changes enter a commit** — require clean status/index, explicit path staging, cached-diff inspection, and no blanket `git add`.
- **A hook or signing failure is bypassed** — surface the error and leave the task `completed-uncommitted`; never retry with weakened Git options.
- **A task is re-executed after a delivery-only failure** — preserve task completion evidence and stop automatic progression so the operator can resolve Git state first.
- **Commit policy diverges between paths** — centralize the helper and make config the sole authoritative switch.

## Reversibility

The setting is additive and default-off. Removing or setting `auto_commit` to `false` restores current no-commit behavior. Local commits can be reverted or reset by the operator using ordinary Git controls; Spec Finder itself never rewrites history.

## Follow-ups

- Define and test the exact task-owned artifact allowlist, including report, memory, task status, and any packet metadata.
- Define the deterministic commit-message format and user-visible checkpoint error text.
- Decide whether the manual skill should reject its legacy invocation token or document it as ignored for compatibility.
- Measure adoption and checkpoint refusal causes after the first release.

## References

- [sf-idea-factory packet](../_idea.md) (to be written after draft approval)
- [Runtime task lifecycle](../../../../src/engine.ts)
- [Manual batch workflow](../../../../skills/sf-batch-tasks/SKILL.md)
