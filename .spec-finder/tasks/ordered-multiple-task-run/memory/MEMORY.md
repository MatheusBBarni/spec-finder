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
- `RunEvent` now has additive `batch_started`, `batch_packet_started`, `batch_packet_finished`, and `batch_finished` variants; `runBatch` emits them while preserving the nested singular event stream for compatibility.
- `CockpitStore` keeps ordered `packetSummaries`, `batchStatus`, `activePacket`, `stoppingPacket`, and `notStartedPackets`; batch task/transcript/reason maps use `${slug}/${taskId}` keys and only the active packet is projected.
- Nested packet `run_started` and `run_finished` events are ignored while a batch projection is active, preventing singular reset/finish transitions from erasing batch state.
- `runCommand` now dispatches only the validated `parseMultipleArgs` batch mode to `runBatch`; the legacy single-slug branch remains on its prior slug/event path.
- Batch command execution creates one controller, effective config, store, and renderer/listener lifecycle. No-UI output consumes additive batch events only and reports packet outcomes, stop boundaries, not-started packets, manual no-retry guidance, and aggregate exit status.
- Task 04 command integration and the full repository gate are green in the shared checkout; no task status or report was changed by the implementation phase.
- Task 05 cockpit rendering consumes the task-03 batch projection directly: the live view shows sequence position, active packet identity, ordered symbol-plus-text outcomes, and no-retry/manual recovery copy while retaining active-only task/transcript navigation.
- Task 05 fixed-frame coverage verifies normal active projection, already-complete/succeeded, failed stopping packets, cancelled stopping packets, later `not_started` packets, compact dimensions, and reduced-color text semantics; the human evaluator portion of M-03 remains release evidence.
- Task 06 publishes the exact opt-in `--multiple <slug1,slug2,...>` grammar, runtime flags, rejection rules, outcome/exit semantics, manual no-retry recovery, and explicit no-persistence/rollback/resume/parallelism/telemetry scope in CLI help and README while preserving single-slug examples.
- Task 06 adds `tests/cli.test.ts`; focused batch/command/store/cockpit/help coverage passed (67 tests, 401 expectations), and `rtk bun run verify` passed (102 tests, 517 expectations; 18-module build).
- Fresh three-packet release smoke through the real command/coordinator path with an injected runner used `ordered-multiple-task-run`, `read-only-progress-navigator`, and `tui-demo`: all-success exited 0; middle failure and middle cancellation exited 1, stopped at packet 2, marked packet 3 `not_started`, and emitted manual no-retry guidance. The human M-03 evaluator count remains unperformed and must not be claimed.

## Open Risks

- Filesystem state can change after preflight; runtime failure is the documented behavior and there is no rollback.
- Existing engine cancellation timing differs before a task versus during ACP; deterministic coordinator fixtures now cover the classification, while live ACP timing remains an integration risk.
- Current worktree contains unrelated dirty UI and task files; all execution tasks must preserve them.

## Handoffs

- Execute tasks in numeric order. `task_04` and `task_05` are parallelizable after `task_03`, but both must complete before `task_06`.
- Every task requires a focused test run, repository gate, memory update, and later `reports/task_NN.md` evidence.
- `task_02` can consume the parsed `mode: "batch"` slugs and ordered runtime passthrough tokens without changing the existing single-run engine/result contract.
- `task_03` can consume `runBatch` summaries and the forwarded packet event listener; command integration may supply `root`, interactive permission mode, and an optional provider-launch seam through the additive batch options.
- `task_04` routes batch lifecycle events to the store/terminal adapter and separately formats additive terminal events; nested singular events remain filtered in no-UI mode and defensive in the store.
- `task_05` keeps summary auto-open/ESC behavior compatible with the singular cockpit: terminal batch summaries expose the sequence and recovery copy, and ESC returns to detailed active-packet task/transcript inspection without adding controls.
- Task 03 final verification in the current checkout passed the focused store suite (12 tests, 62 expectations), TypeScript check, and full repository gate (90 tests, 414 expectations; 17-module Bun build).
