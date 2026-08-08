# Workflow Memory

## Current State

- Approved PRD and TechSpec define an opt-in ordered multi-packet run above the unchanged packet engine.
- The approved execution graph contains `task_01` through `task_06`; no task files existed before this plan.
- Baseline verification after the TechSpec was saved: 59 Bun tests passed, TypeScript check passed, and the Bun build passed.

## Shared Decisions

- Use one strict `--multiple <comma-separated-list>` grammar; reject positional slugs, duplicates, empty entries, malformed slugs, and repeated batch options.
- Preflight all packets before mutation/provider launch; execute serially and stop on the first failure or cancellation.
- Normalize abort/ACP cancellation to batch `cancelled`; preserve permission/provider/report failures as `failed`.
- Retain compact packet outcomes and active-packet detail only; do not add persistence, retries, parallelism, resume, rollback, or telemetry.
- Preserve the existing single-slug command, event payloads, packet engine, task-file status ownership, and renderer lifecycle.

## Shared Learnings

- `runCommand` currently extracts the first non-flag token and invokes one packet; batch parsing must replace that behavior only on the batch branch.
- `run_started` resets the store and task IDs/transcripts are bare, so nested packet lifecycle events cannot be forwarded directly.
- Existing OpenTUI tests use fixed frames, keyboard actions, compact sizes, and reduced-color assertions.
- `src/batch.ts` now owns the shared `PacketOutcome`, `PacketSummary`, `BatchResult`, `BatchRunOptions`, and `PacketRunner` contracts plus the `parseMultipleArgs` boundary; downstream coordination should extend these contracts rather than redefine them.
- Batch parsing delegates slug syntax to the exported `isValidTaskSlug` helper in `src/tasks.ts`, which remains the single slug grammar used by packet loading.
- `runBatch`/`preflightBatch` now load and validate the complete slug sequence before invoking any runner; the coordinator retains read-only execution-order snapshots, runs serially with the supplied signal/config, and returns `not_started` summaries after the first stop.
- Coordinator cancellation classification covers shared aborts, cancellation-shaped runner errors/results, and ACP stop activity while ordinary runner failures remain `failed`; empty execution orders map to successful `already_complete` summaries.

## Open Risks

- Filesystem state can change after preflight; runtime failure is the documented behavior and there is no rollback.
- Existing engine cancellation timing differs before a task versus during ACP; coordinator classification needs deterministic tests.
- Current worktree contains unrelated dirty UI and task files; all execution tasks must preserve them.

## Handoffs

- Execute tasks in numeric order. `task_04` and `task_05` are parallelizable after `task_03`, but both must complete before `task_06`.
- Every task requires a focused test run, repository gate, memory update, and later `reports/task_NN.md` evidence.
- `task_02` can consume the parsed `mode: "batch"` slugs and ordered runtime passthrough tokens without changing the existing single-run engine/result contract.
- `task_03` can consume `runBatch` summaries and the forwarded packet event listener; command integration may supply `root`, interactive permission mode, and an optional provider-launch seam through the additive batch options.
