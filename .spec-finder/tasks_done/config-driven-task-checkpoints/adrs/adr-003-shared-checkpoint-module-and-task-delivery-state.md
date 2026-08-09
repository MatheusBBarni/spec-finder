# ADR-003: Shared Checkpoint Module and Task Delivery State

## Status

Accepted

## Date

2026-08-04

## Context

The approved PRD requires identical checkpoint behavior in the ACP runtime and manual batch workflow. The runtime is TypeScript and owns task/report lifecycle; the manual workflow is a skill document that can invoke CLI commands but cannot import runtime modules directly.

Checkpoint delivery must use a clean baseline captured after packet-memory initialization, attribute the temporal delta to one task, preserve the existing `status` lifecycle, and survive a process restart. The current task model, event model, cockpit, execution ordering, and archive classifier have no durable checkpoint-delivery state.

## Decision Drivers

- PRD goals G-01 through G-04 and features F-01 through F-07.
- One implementation contract across ACP and manual execution.
- Normal rerun must retry a blocked checkpoint without rerunning verified implementation.
- Existing task status semantics must remain understandable and backward-compatible.
- Git safety requires baseline, explicit staging, cached-diff inspection, and no mutation bypasses.
- Avoid a second packet-level source of truth or isolated-worktree subsystem in MVP.

## Evidence

| Kind | Finding | Source | Version/date |
|---|---|---|---|
| Repository | Runtime lifecycle is centralized in `src/engine.ts`; manual execution is skill-driven. | `src/engine.ts`, `skills/sf-batch-tasks/SKILL.md` | 2026-08-04 |
| Repository | Current task status consumers cannot represent checkpoint delivery independently. | `src/tasks.ts`, `src/events.ts`, `src/ui/store.ts`, `src/ui/App.tsx`, `skills/sf-archive-tasks/` | 2026-08-04 |
| Repository | Packet memory is initialized before the first task. | `src/memory.ts`, `src/engine.ts` | 2026-08-04 |
| Official docs | Porcelain status is stable for scripts and exposes index/worktree/untracked state. | [git status](https://git-scm.com/docs/git-status) | Git 2.53.0 manual, accessed 2026-08-04 |
| Official docs | Explicit pathspec staging and cached-diff review provide bounded index control. | [git add](https://git-scm.com/docs/git-add), [git diff](https://git-scm.com/docs/git-diff) | Accessed 2026-08-04 |
| Official docs | A normal commit records the current index. | [git commit](https://git-scm.com/docs/git-commit) | Git 2.55.0 manual, accessed 2026-08-04 |
| User decision | The user selected Approach A and normal-rerun recovery. | Technical clarification and approach decision | 2026-08-04 |

## Decision

Implement a shared checkpoint module that owns baseline capture, temporal-delta attribution, explicit staging, cached-diff verification, deterministic local commit, and delivery outcome persistence.

- The ACP runtime calls the module directly around each task.
- The manual batch skill invokes a narrow two-phase CLI surface, `spec-finder checkpoint begin|complete`, using the same module.
- Task frontmatter gains validated checkpoint-delivery metadata while `status` remains the lifecycle field. The metadata records enough baseline and outcome information for a normal rerun to retry a blocked checkpoint without rerunning verified implementation.
- Packet memory is initialized before the baseline is captured. The baseline must be clean and stable; pre-existing staged, modified, untracked, or ambiguous state blocks auto-commit.
- The task delta is temporal: changes observed after the task baseline and before checkpoint completion are the candidate task record. The helper stages only the explicit candidate paths, inspects the cached diff, and commits once.
- On checkpoint failure, the task remains implementation-complete but delivery-blocked, downstream tasks do not start, and a normal rerun retries delivery before continuing.

## Alternatives Considered

### Packet-level checkpoint ledger

- **Benefits:** Avoids changing task frontmatter and can centralize delivery history.
- **Costs/risks:** Creates a second source of truth that must be reconciled with status, execution order, UI, and archive behavior.
- **Why not selected:** The task already owns lifecycle identity and is the most direct durable recovery boundary.

### Isolated Git index/worktree checkpoints

- **Benefits:** Could operate alongside unrelated dirty work.
- **Costs/risks:** Adds cleanup, concurrency, platform, and security complexity beyond MVP.
- **Why not selected:** The approved product contract explicitly prefers fail-closed clean baselines.

### Duplicated Git procedure in the manual skill

- **Benefits:** No new CLI command.
- **Costs/risks:** Runtime and manual behavior can drift; safety fixes must be duplicated.
- **Why not selected:** Cross-workflow consistency is a required product contract.

## Consequences

### Positive

- One implementation enforces Git safety in both execution paths.
- Recovery state survives process restarts without a packet-level ledger.
- Existing task lifecycle status remains distinct from delivery state.
- Normal rerun can retry delivery without rerunning verified implementation.

### Negative and trade-offs

- Task parsing, event reporting, UI, execution ordering, archive classification, and tests all need delivery-state awareness.
- The manual skill gains a two-phase CLI dependency.
- A clean-baseline requirement refuses checkpoints in dirty worktrees even when paths appear disjoint.

### Risks and mitigations

- **Stale or edited delivery metadata** — validate metadata, compare stored baseline to current Git state, and refuse ambiguous recovery.
- **CLI/runtime contract drift** — route both paths through the same module and cross-test equivalent scenarios.
- **Commit hook/signing failure** — preserve delivery-blocked state and surface the original error; never bypass controls.
- **Metadata pollutes task history** — keep fields minimal, documented, and backward-compatible with absent metadata.

## Reversibility and Rollback

The module is additive and only active when `auto_commit` is true. Setting it false disables new checkpoint mutations. Existing metadata can be ignored by older readers because task `status` remains valid; rollback removes the module and metadata handling without rewriting implementation files or Git history.

## Implementation Notes

- Do not use blanket staging, stash/reset/clean, `--no-verify`, synthetic authorship, or push.
- Preserve existing task/report lifecycle ownership; the checkpoint module must not let the agent self-certify completion.
- Keep CLI examples and interface snippets short and repository-language consistent.
- Treat the stored baseline as untrusted input on recovery; revalidate before staging or committing.

## Follow-ups

- Finalize the exact frontmatter metadata shape and validation errors.
- Finalize the two-phase CLI argument contract and deterministic commit-message format.
- Define how archive and UI summaries label delivery-blocked completed tasks.
- Add a bounded spike if Git rename/submodule/path-quoting behavior affects temporal-delta parsing.

## References

- [Approved PRD](/Users/matheusbbarni/projects/spec-finder/.spec-finder/tasks/config-driven-task-checkpoints/_prd.md)
- [ADR-001: Config-Driven Per-Task Git Checkpoints](adr-001-config-driven-task-checkpoints.md)
- [ADR-002: Automatic Local Recovery Checkpoints](adr-002-automatic-local-recovery-checkpoints.md)
