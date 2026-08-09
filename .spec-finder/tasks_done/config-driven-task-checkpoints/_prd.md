# Config-Driven Per-Task Git Checkpoints Product Requirements Document

## Overview

Spec Finder operators need reliable recovery after a multi-task packet stops. The selected approach is an explicit, documentation-led `auto_commit` opt-in that creates one local checkpoint after each verified task across both ACP runtime and manual batch execution.

The primary user is the packet operator. MVP value is resuming from the last verified task without rerunning completed work. The feature remains local-only, default-off, fail-closed, and separate from remote Git hosting or review.

## Research Evidence

| Kind | Finding | Source | Date | Product consequence |
|---|---|---|---|---|
| Repository | Configuration is strict v2 and has no `auto_commit`. | [src/config.ts](/Users/matheusbbarni/projects/spec-finder/src/config.ts) | 2026-08-04 | Add an explicit boolean with default `false`; update generated/example config. |
| Repository | Runtime completion follows implementation, report validation, and task completion. | [src/engine.ts](/Users/matheusbbarni/projects/spec-finder/src/engine.ts) | 2026-08-04 | Checkpoint eligibility begins only after verified completion. |
| Repository | Existing status, UI, execution-order, and archive behavior do not represent checkpoint delivery failure. | [src/tasks.ts](/Users/matheusbbarni/projects/spec-finder/src/tasks.ts), [src/ui/App.tsx](/Users/matheusbbarni/projects/spec-finder/src/ui/App.tsx), archive skill | 2026-08-04 | MVP needs a distinct checkpoint-blocked user outcome and recovery path. |
| Repository | Manual batch execution already describes per-task commits but uses an invocation flag and different dirty-state assumptions. | [sf-batch-tasks](/Users/matheusbbarni/projects/spec-finder/skills/sf-batch-tasks/SKILL.md) | 2026-08-04 | Config must become authoritative across both workflows. |
| External | Git supports stable status inspection, explicit path staging, cached-diff review, and index-based commits. | [git status](https://git-scm.com/docs/git-status), [git add](https://git-scm.com/docs/git-add), [git diff](https://git-scm.com/docs/git-diff), [git commit](https://git-scm.com/docs/git-commit) | 2026-08-04 | Safety messaging must explain refusal when attribution is ambiguous. |
| External | Small meaningful commits support review, rollback, and understandable history. | [GitHub project workflow](https://docs.github.com/en/pull-requests/concepts/writing-code-for-a-project) | 2026-08-04 | Task-sized checkpoints have a credible reviewer benefit. |
| External | Agent workflows preserve explicit mutation controls, branch protections, and human review. | [Copilot cloud agent risks](https://docs.github.com/en/enterprise-cloud%40latest/copilot/concepts/agents/cloud-agent/risks-and-mitigations) | 2026-08-04 | MVP must never push, bypass hooks/signing, or imply review/merge. |
| External | No primary source demonstrates broad demand for automatic per-task local commits. | Current research limitation | 2026-08-04 | Treat this as an opt-in workflow hypothesis, not a proven market requirement. |
| User decision | The user selected reliable resumption as the primary outcome, complete task records, documentation-only opt-in, a 90%/30-day recovery target, and Approach A. | Idea-factory and PRD decisions | 2026-08-04 | These define MVP scope and launch measurement. |

## Goals

| ID | Goal | Measurable outcome |
|---|---|---|
| G-01 | Enable reliable packet resumption | At least 90% of eligible stopped runs resume without rerunning verified tasks within 30 days. |
| G-02 | Preserve reviewable task boundaries | Each eligible successful task has one identifiable local checkpoint containing its complete task record. |
| G-03 | Keep repository mutation safe and explicit | No unrelated changes enter a checkpoint, and the default/false setting creates no commits. |
| G-04 | Provide one consistent product contract | ACP and manual batch workflows expose the same opt-in, success, refusal, and recovery behavior. |

## User Stories

| ID | Persona | Story | Acceptance signal |
|---|---|---|---|
| US-01 | Packet operator | As an operator, I want the configuration guide to explain the opt-in and its local-only effect so that I can enable it deliberately. | Generated/example configuration contains `auto_commit: false` and clear enablement language. |
| US-02 | Packet operator | As an operator, I want a verified completed task to create one checkpoint so that I can resume from it later. | A successful eligible task reports one local checkpoint and its identifier. |
| US-03 | Packet operator | As an operator, I want the complete task record preserved so that the checkpoint explains what was delivered. | Implementation changes, task evidence, report, memory, and status evidence are represented together. |
| US-04 | Packet operator | As an operator, I want a clear checkpoint-blocked result when Git is unsafe or unavailable so that I can resolve the condition without losing verified work. | The run explains the refusal, does not start downstream tasks, and identifies continuation without rerunning the verified task. |
| US-05 | Reviewer | As a reviewer, I want task-sized local history so that I can inspect or revert one task at a time. | Each eligible task has one understandable checkpoint boundary. |
| US-06 | Existing user | As an existing user, I want omitted or false configuration to preserve current behavior so that enabling the feature is never accidental. | No checkpoint is created and normal task behavior remains unchanged. |
| US-07 | Operator using either workflow | As an operator, I want ACP and manual batch execution to behave the same way so that the recovery contract is predictable. | Equivalent configuration and task outcomes produce equivalent checkpoint behavior. |

## Core Features

### F-01: Explicit configuration opt-in

- **User value:** Makes the history-changing behavior deliberate and discoverable.
- **Mapped goals/stories:** G-03, US-01, US-06.
- **MUST:** Support a boolean `auto_commit` setting whose default is `false`.
- **SHOULD:** Show the effective mode in configuration/run documentation and output.
- **Acceptance conditions:** New/default configuration is valid without the setting or with `false`; setting `true` is the only supported opt-in; invocation-level auto-commit flags cannot override the configuration contract.

### F-02: Verified task checkpoint

- **User value:** Turns a successfully delivered task into a resumable local boundary.
- **Mapped goals/stories:** G-01, G-02, US-02.
- **MUST:** Create at most one local checkpoint after implementation, verification, report validation, and task completion succeed.
- **SHOULD:** Report the checkpoint identifier and task association.
- **Acceptance conditions:** Failed, blocked, cancelled, or report-incomplete tasks do not receive automatic checkpoints; eligible successful tasks receive exactly one.

### F-03: Complete task record

- **User value:** Lets reviewers understand both the change and its evidence.
- **Mapped goals/stories:** G-02, US-03, US-05.
- **MUST:** Preserve task-owned implementation/test/docs changes, report, task memory, and status evidence.
- **SHOULD:** Include shared packet metadata only when clearly attributable to that task.
- **Acceptance conditions:** A checkpoint can be inspected as the complete record of the task without requiring unrelated worktree changes.

### F-04: Safety refusal

- **User value:** Prevents accidental inclusion of unrelated work.
- **Mapped goals/stories:** G-03, US-04.
- **MUST:** Refuse checkpoint creation when pre-existing staged, modified, untracked, or ambiguous state prevents trustworthy attribution.
- **SHOULD:** Explain the refusal in plain text and identify the next operator action.
- **Acceptance conditions:** No checkpoint is created, no unrelated change is altered, and no Git safety control is bypassed after refusal.

### F-05: Checkpoint-blocked recovery

- **User value:** Allows continuation after resolving Git state without rerunning verified work.
- **Mapped goals/stories:** G-01, G-03, US-04.
- **MUST:** Present implementation-complete but checkpoint-blocked as a distinct user-visible outcome.
- **MUST:** Stop before downstream tasks automatically start.
- **SHOULD:** Explain that the operator can resolve Git state and continue from the verified task.
- **Acceptance conditions:** A checkpoint failure never silently appears as ordinary success, never silently advances the packet, and never requires re-executing the verified task as the only recovery path.

### F-06: Cross-workflow consistency

- **User value:** Makes behavior predictable regardless of how execution begins.
- **Mapped goals/stories:** G-04, US-07.
- **MUST:** Apply the same configuration, eligibility, safety, success, and refusal contract to ACP runtime and manual batch execution.
- **SHOULD:** Use consistent user-facing terminology and outcome reporting.
- **Acceptance conditions:** Equivalent scenarios produce equivalent outcomes in both workflows.

### F-07: Local-only mutation boundary

- **User value:** Keeps the feature understandable and limits surprise.
- **Mapped goals/stories:** G-03, US-01, US-06.
- **MUST:** Never push, create pull requests, change Git identity, bypass hooks/signing, stash, reset, clean, or commit failed/blocked work.
- **SHOULD:** Explicitly state that a checkpoint is local and does not mean reviewed, merged, or remotely accepted.
- **Acceptance conditions:** Documentation and output consistently describe the local-only boundary.

## User Experience

- **Discovery:** The generated/example configuration and configuration guide explain that `auto_commit` is opt-in, default-off, local-only, and runs only after verified task completion. Setup does not ask users to enable it interactively.
- **Run start:** The effective checkpoint mode is visible in run-oriented documentation or output.
- **Running:** No checkpoint is created while implementation or report work is incomplete.
- **Success:** The completed task is accompanied by a clear local checkpoint result and identifier.
- **Refusal:** The operator sees a plain-text reason, the task is checkpoint-blocked, downstream tasks do not begin, and unrelated work remains untouched.
- **Recovery:** After the operator resolves the Git condition, the verified task can be continued without rerunning its implementation solely because checkpoint delivery failed.
- **Default/disabled:** Omitted or false configuration produces current no-commit behavior without warnings that imply failure.
- **Accessibility and clarity:** Meaning must not depend on color alone. Future graphical controls must expose an accurate label, enabled state, and textual refusal/status feedback consistent with [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## High-Level Constraints

- Default-off and explicit opt-in.
- Local repository history only; no remote operations.
- Preserve native hooks, signing, authorship, and branch protections.
- Fail closed when unrelated or ambiguous state could be included.
- Preserve unrelated dirty work and never blanket-stage it.
- Apply consistently to ACP and manual batch workflows.
- Keep product language distinct between implementation completion and checkpoint delivery.
- Do not imply review, merge, rollback guarantee, or remote acceptance.
- No telemetry or durable analytics are required for MVP; measurement may use run reports and controlled evaluation.

## Non-Goals

- **Pushes, pull requests, or remote synchronization** — requires separate credentials, branch, and review policy.
- **Automatic commits for failed, blocked, or cancelled tasks** — checkpoints represent verified successful delivery only.
- **Dirty-worktree reconciliation or alternate recovery workspaces** — defer until refusal data demonstrates the need.
- **Interactive setup enablement** — documentation-only rollout avoids surprising history mutation.
- **Automatic retries or bypasses after Git refusal** — operators must resolve the condition explicitly.
- **Commit analytics, task-duration reporting, or a general recovery dashboard** — separate product opportunities.
- **A claim that local checkpoints are reviewed or merged** — local traceability is the only MVP promise.

## Phased Rollout Plan

### MVP

- Add documented, default-off `auto_commit`.
- Apply one contract across ACP and manual batch workflows.
- Create one local checkpoint after verified task completion.
- Preserve the complete task record.
- Show checkpoint-blocked refusal and stop before downstream work.
- Entry criteria: approved idea, ADR-001, and ADR-002.
- Exit criteria: controlled scenarios meet 100% safety/lifecycle acceptance and the feature is ready for 30-day recovery measurement.

### Later phases

- Consider dirty-state reconciliation only if checkpoint refusal prevents the 90% resumption target.
- Consider review-before-commit only if operators report insufficient control despite explicit opt-in.
- Consider richer recovery tooling only after evidence shows repeated manual resolution patterns.
- Consider graphical configuration only if a product settings surface is introduced.

## Success Metrics

| ID | Metric | Baseline | Target | Measurement method | Window |
|---|---|---:|---:|---|---|
| M-01 | Eligible stopped runs resumed without rerunning verified tasks | unknown | ≥90% | Run reports and operator recovery review | First 30 days |
| M-02 | Unrelated changes included in checkpoints | 0 known | 0 | Controlled Git fixture audit | Every verification run |
| M-03 | Default-off compatibility | unknown | 100% | Omitted/false configuration scenarios | Every verification run |
| M-04 | Checkpoint refusals that stop downstream work and explain recovery | unknown | 100% | Failure-path evaluation | Every verification run |
| M-05 | Runtime/manual outcome parity | 0 shared product contract today | 100% of defined scenarios | Cross-workflow acceptance matrix | Before release |

## Risks and Mitigations

| Risk | Evidence | Likelihood/impact | Mitigation | Owner/decision trigger |
|---|---|---|---|---|
| Strict refusal reduces practical adoption | Repository and council tension | Medium / High | Measure refusal causes; consider reconciliation only if M-01 misses target | Product owner after 30 days |
| Checkpoint-blocked language confuses operators | Current lifecycle has no equivalent outcome | Medium / High | Use explicit plain-text recovery guidance and controlled usability review | Product + UX review |
| Users mistake local checkpoints for reviewed work | GitHub agent workflows preserve review boundaries | Medium / High | Label local-only and state no push/PR/merge implication | Product documentation |
| Complete task records make history noisy | Approved idea leaves artifact allowlist open | Medium / Medium | Measure reviewer usefulness; keep shared metadata attributable-only | Product review |
| Legacy batch invocation behavior conflicts with config-only policy | Existing manual skill accepts `auto-commit=true|false` | High / Medium | Document or reject legacy token consistently before rollout | Release owner |
| No direct demand evidence | External research limitation | High / Medium | Treat as opt-in experiment and use M-01/M-05 for promotion decisions | Product owner |

## Architecture Decision Records

- [ADR-001: Config-Driven Per-Task Git Checkpoints](adrs/adr-001-config-driven-task-checkpoints.md) — configuration and safety contract.
- [ADR-002: Automatic Local Recovery Checkpoints as the MVP Product Approach](adrs/adr-002-automatic-local-recovery-checkpoints.md) — selected product approach, rollout, and recovery boundary.

## Research Limitations

- No direct market-demand or willingness-to-pay evidence supports automatic per-task local commits.
- Baselines for stopped runs, reruns, refusal rates, and reviewer value are unknown.
- GitHub’s branch/PR agent workflows are comparators, not requirements for Spec Finder.
- WCAG evidence applies only if a graphical settings surface is introduced; MVP is JSON/CLI-oriented.

## Open Questions

- What exact commit-message wording best communicates task identity without implying review or merge?
- Should the legacy manual `auto-commit=true|false` token be rejected or documented as ignored?
- Which shared packet metadata is sufficiently attributable for inclusion?
- What is the clearest operator wording for continuing after a checkpoint-blocked outcome?
