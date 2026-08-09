# Config-Driven Per-Task Git Checkpoints

## Overview

Add an explicit `auto_commit` setting to Spec Finder configuration. When enabled, each task that fully completes implementation, verification, report generation, and status transition receives one local Git commit. The behavior is consistent across ACP runtime and manual batch execution, defaults to `false`, and never pushes or modifies remote state.

This is a bounded workflow capability: it improves resumability and reviewability without expanding Spec Finder into a Git hosting or recovery system.

## Problem

A multi-task packet can complete several tasks successfully and then stop. Without per-task commits, the operator must manually reconstruct a checkpoint, and a later run cannot reliably resume from a known repository state. The manual batch skill already describes optional commit behavior, but the ACP runtime has no equivalent and the policy is currently invocation-specific.

The primary user is an operator running a packet. Secondary users are reviewers and maintainers who need to inspect, revert, bisect, or selectively retain completed task work.

### Evidence

| Kind | Finding | Source | Date | Confidence |
|---|---|---|---|---|
| Repository | Configuration is strict and has no `auto_commit` field. | [src/config.ts](/Users/matheusbbarni/projects/spec-finder/src/config.ts) | 2026-08-04 | High |
| Repository | Runtime completion follows implementation, report validation, and status transition. | [src/engine.ts](/Users/matheusbbarni/projects/spec-finder/src/engine.ts) | 2026-08-04 | High |
| Repository | Manual batch execution already defines per-task commit concepts through an invocation flag. | [sf-batch-tasks](/Users/matheusbbarni/projects/spec-finder/skills/sf-batch-tasks/SKILL.md) | 2026-08-04 | High |
| Repository | No shared Git checkpoint helper or commit test suite exists. | `src/`, `tests/` | 2026-08-04 | High |
| External | Porcelain status is intended for stable machine parsing and reports staged, unstaged, and untracked paths. | [Git status](https://git-scm.com/docs/git-status) | 2026-08-04 | High |
| External | Exact pathspec staging is safer than blanket staging. | [Git add](https://git-scm.com/docs/git-add) | 2026-08-04 | High |
| External | Commits record the index, so existing staged changes can be captured accidentally. | [Git commit](https://git-scm.com/docs/git-commit) | 2026-08-04 | High |
| User decision | Config-only, default `false`, both execution paths, completed-only commits, fail-closed dirty-state handling, and `completed-uncommitted` on Git failure. | Clarification and direction decisions | 2026-08-04 | High |

## Target Users

| Persona | Context | Need | Current workaround |
|---|---|---|---|
| Packet operator | Running several dependent tasks | Resume from the last verified task | Commit manually or rerun with uncertain repository state |
| Reviewer | Reviewing completed task increments | Inspect one task’s changes independently | Reconstruct boundaries from a large accumulated diff |
| Maintainer | Diagnosing a stopped or failed packet | Revert or bisect task-level changes | Use ad hoc commits or preserve an uncommitted worktree |

## Core Features

| ID | Priority | Feature | Observable user value | Evidence |
|---|---|---|---|---|
| F-01 | Critical | Strict boolean `auto_commit` setting, default `false` | Existing users retain current behavior unless explicitly opted in | `src/config.ts`; user decision |
| F-02 | Critical | Shared policy across ACP runtime and manual batch execution | Checkpoint behavior does not depend on invocation path | User direction decision |
| F-03 | Critical | Commit only after verified task completion and substantive report | Each checkpoint represents a completed task, not partial work | `src/engine.ts`; `sf-execute-task` |
| F-04 | Critical | Fail-closed clean Git state/index gate | Unrelated or pre-staged work cannot be silently included | Git status/commit evidence; user decision |
| F-05 | Critical | Explicit task-owned staging and cached-diff inspection | The commit contains only the approved task change set | Git add evidence |
| F-06 | High | Exactly one deterministic local commit per eligible task | Operators receive predictable resumability checkpoints | User decision; council synthesis |
| F-07 | High | `completed-uncommitted` delivery outcome on Git failure | Implementation evidence remains truthful while automatic progression stops | User decision; council synthesis |
| F-08 | High | No push, PR, identity changes, hook bypass, stash, reset, or clean | Auto-commit remains a local checkpoint, not a control plane | GitHub security evidence; council synthesis |

## KPIs

| ID | KPI | Baseline | Target | Measurement method | Window |
|---|---|---:|---:|---|---|
| KPI-01 | Eligible successful tasks that receive an automatic checkpoint | unknown | ≥95% in clean-worktree runs | Runtime and batch outcome reports | First release and first 30 days |
| KPI-02 | Unrelated files included in auto-commits | 0 known | 0 | Staged-diff audit fixtures | Every verification run |
| KPI-03 | Default-off compatibility | unknown | 100% of omitted/false configurations produce no commits | Config and integration tests | Every verification run |
| KPI-04 | Incorrect full-success claims after commit failure | unknown | 0 | Failure-path tests | Every verification run |
| KPI-05 | Runtime/manual behavior parity | 0 shared implementation today | 100% of policy cases match | Cross-path integration tests | Before release |

## Feature Assessment

| Criterion | Score | Evidence-backed rationale |
|---|---|---|
| Impact | Strong | Turns verified task boundaries into resumable, reviewable checkpoints. |
| Reach | Strong | Applies to both supported task execution paths. |
| Frequency | Strong | Evaluated after every successful task. |
| Differentiation | Maybe | Integrated task-aware checkpointing is useful, but Git commits are familiar. |
| Defensibility | Maybe | Lifecycle-aware safety semantics are specific, but create no durable data moat. |
| Feasibility | Strong | Completion seams already exist; Git-state safety is the main implementation risk. |

## Independent Critique

### Consensus

Engineering, security, product, and devil’s-advocate advisors agreed that the feature is worthwhile only as an explicit, default-off, local checkpoint policy. They supported waiting for the runtime-owned completion boundary, exact staging, cached-diff inspection, no push, and no hook/signing bypass.

They also agreed that a Git delivery failure must not erase verified implementation evidence. The truthful result is a completed task with an explicit uncommitted delivery failure, followed by a stop in automatic progression.

### Unresolved Tensions

| Tension | Position A | Position B | Decision consequence |
|---|---|---|---|
| Dirty worktree policy | Product considered isolating disjoint task paths for better usability. | Security and engineering preferred rejecting any pre-existing staged, modified, or untracked state because Git commits the index. | V1 uses the stricter fail-closed policy; isolation can be reconsidered with a dedicated baseline/index design. |
| Commit failure status | One view treats failed delivery as a failed overall run. | Another separates implementation completion from commit delivery. | Preserve task completion evidence, expose `completed-uncommitted`, and stop further automatic progression. |
| Config versus invocation flag | Invocation flags offer flexibility. | A single config source avoids runtime/manual divergence. | `config.json` is authoritative; invocation-level auto-commit controls are non-authoritative or removed. |

### Position Evolution and Dissent

The product perspective partially conceded that strict dirty-state rejection is appropriate for V1 because attribution is not independently durable. All advisors held firm that commit failure must not be disguised as successful delivery or repaired by weakening Git safety.

### Recommended Direction

Adopt the config-driven per-task checkpoint with a shared helper, strict clean-state gate, explicit staging, deterministic local commit, and separate implementation/delivery outcomes.

## Opportunity Decision

| Direction | Outcome | Effort | Principal risk | Decision |
|---|---|---|---|---|
| A. Refined config-driven checkpoints | Both execution paths commit verified tasks when explicitly enabled | Medium | Strict dirty-state gate may reduce eligible runs | **Selected** |
| B. Runtime-only checkpoint | Smaller initial implementation | Small | Manual and ACP workflows diverge | Rejected |
| C. Transactional checkpoint subsystem | Baseline manifests and isolated indexes/worktrees | Large | Adds a second Git-state subsystem | Rejected |

The user selected Direction A. The accepted scope is recorded in [ADR-001: Config-Driven Per-Task Git Checkpoints](/Users/matheusbbarni/projects/spec-finder/.spec-finder/tasks/config-driven-task-checkpoints/adrs/adr-001-config-driven-task-checkpoints.md).

## Out of Scope (V1)

- **Pushes, pull requests, or remote synchronization** — local checkpoints are sufficient for resumability; remote delivery requires separate authentication and branch-policy decisions.
- **Automatic commits for failed or blocked tasks** — V1 checkpoints only verified successful tasks.
- **Dirty-worktree isolation or alternate-index transactions** — deferred until attribution requirements justify the complexity.
- **Automatic retries or hook/signing bypasses** — Git failures require operator resolution.
- **Commit history analytics, task-duration metrics, or recovery commands** — these are separate workflow capabilities.
- **User-configurable commit formats or thresholds** — V1 uses one deterministic policy.
- **Whole-worktree staging** — blanket staging would violate the safety contract.

## Architecture Decision Records

- [ADR-001: Config-Driven Per-Task Git Checkpoints](/Users/matheusbbarni/projects/spec-finder/.spec-finder/tasks/config-driven-task-checkpoints/adrs/adr-001-config-driven-task-checkpoints.md)

## Research Limitations

- No direct market-demand or willingness-to-pay evidence was found; the value proposition is operational.
- No baseline exists for manual checkpoint frequency, task reruns, or dirty-worktree refusal rates.
- Current external evidence covers Git semantics and automation safety, not Spec Finder user adoption.
- The existing workspace has unrelated dirty changes, so implementation must preserve them and test clean fixtures separately.

## Open Questions

- Which exact implementation, report, memory, and status files belong in each task commit?
- What deterministic commit-message format should be used?
- Should the legacy `sf-batch-tasks ... auto-commit=true` token be rejected or documented as ignored?
- What user-facing text should explain a `completed-uncommitted` result?
