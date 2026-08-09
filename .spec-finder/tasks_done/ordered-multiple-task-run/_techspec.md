# Ordered Multi-Packet Run Technical Specification

## Executive Summary

Implement an opt-in `--multiple <slug1,slug2,...>` path using a new sequential coordinator above the existing `runTaskPacket` engine. The coordinator preflights every packet before mutation or provider launch, executes packets serially, stops on the first failure or cancellation, and emits an additive batch envelope while preserving the single-run event contract.

The cockpit retains compact outcomes for every declared packet and projects detailed tasks/transcripts only for the active packet. The primary trade-off is a small expansion of the event and store models in exchange for preserving the stable packet engine and single-slug behavior. No dependency, persistence, configuration, or migration change is required.

## Technical Evidence

| Kind | Finding/constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository | `runCommand` creates one store/renderer and invokes one `runTaskPacket`. | [`src/commands.ts`](/Users/matheusbbarni/projects/spec-finder/src/commands.ts:186) | 2026-08-08 | Add a dedicated batch branch and keep the existing branch behaviorally unchanged. |
| Repository | `run_started` resets the store and transcripts use bare task IDs. | [`src/ui/store.ts`](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts:36) | 2026-08-08 | Do not forward nested packet lifecycle events directly; qualify batch projection keys internally. |
| Repository | `ensurePacketMemory` writes files after validation. | [`src/engine.ts`](/Users/matheusbbarni/projects/spec-finder/src/engine.ts:29) | 2026-08-08 | Full preflight uses read-only load/validate operations only. |
| Repository | Packet ordering and completed-task skipping already exist. | [`src/tasks.ts`](/Users/matheusbbarni/projects/spec-finder/src/tasks.ts:54) | 2026-08-08 | Reuse packet semantics and derive already-complete packets from an empty execution order. |
| Repository | Cancellation can throw before a task or be caught as task failure during ACP execution. | [`src/engine.ts`](/Users/matheusbbarni/projects/spec-finder/src/engine.ts:44) | 2026-08-08 | Coordinator classifies shared abort/ACP cancellation as batch `cancelled`; other errors remain `failed`. |
| Official docs | ACP cancellation is represented by a cancelled stop reason and should stop the agent. | [ACP Agent API](https://zed-industries.github.io/agent-client-protocol/interfaces/Agent) | SDK contract reviewed 2026-08-08 | Preserve one shared abort signal and normalize the ACP result at the batch boundary. |
| Official docs | OpenTUI live rendering is reference-counted and renderer destruction releases resources. | [OpenTUI renderer](https://opentui.com/docs/core-concepts/renderer/) | OpenTUI 0.4.5, reviewed 2026-08-08 | Keep one renderer for the invocation and retain the existing live/destroy lifecycle. |
| Official docs | Bun supports focused TypeScript tests and non-zero exits for failures. | [Bun test runner](https://bun.sh/docs/test) | Bun 1.3.13, reviewed 2026-08-08 | Use injected-runner coordinator tests plus the repository-wide Bun gate. |
| User decision | Coordinator ownership, additive events, strict grammar, coordinator cancellation normalization, and injected test seam were selected. | Technical clarification decisions and [ADR-003](adrs/adr-003-coordinator-batch-envelope-active-projection.md) | 2026-08-08 | These decisions are implementation constraints. |

## Requirement Traceability

| PRD ID | Technical obligation | Component/interface | Verification | Status/gap |
|---|---|---|---|---|
| G-01 | One invocation accepts an ordered packet list. | CLI parser, batch coordinator | Ordered success test | Covered |
| G-02 | Every packet has a visible outcome. | `PacketSummary`, store/App, no-UI formatter | Summary rendering tests | Covered |
| G-03 | First failure/cancellation prevents later starts. | Coordinator fail-fast loop | Failure/cancel tests | Covered |
| G-04 | Batch is opt-in and single-run compatible. | `runCommand` branch split | Single-run regression tests | Covered |
| G-05 | Users identify the stopping packet. | Compact summary and active packet UI | Three-packet usability scenario | Requires release evaluation |
| US-01 | Preserve declared order. | Parser and coordinator | Ordered runner spy | Covered |
| US-02 | Active packet has detail; prior packets retain compact outcomes. | Batch store projection | Store/App tests | Covered |
| US-03 | Stopping packet and later `not_started` packets are visible. | Aggregate result and UI formatter | Failure/cancel tests | Covered |
| US-04 | Explain stop and manual recovery; no retry. | Terminal/cockpit copy | Output assertions | Covered |
| US-05 | Return one aggregate success/non-success result. | `BatchResult`, command exit mapping | Command tests | Covered |
| US-06 | Existing single slug remains valid. | Existing command path and events | Existing suite plus regression | Covered |
| F-01 | Strict comma-list validation before any start. | `parseMultipleArgs`, `preflightBatch` | Invalid-input/preflight tests | Covered |
| F-02 | Serial fail-safe execution. | Coordinator loop | Order and stop tests | Covered |
| F-03 | Compact outcomes plus active detail. | Store/App and event adapter | Store/cockpit tests | Covered |
| F-04 | Distinct failure/cancellation and manual guidance. | Outcome formatter | No-UI/UI tests | Covered |
| F-05 | Empty work is succeeded with already-complete detail. | Coordinator result mapping | Already-complete test | Covered |
| F-06 | Cockpit and `--no-ui` support with help/docs. | Commands, App, README, help | Focused tests and docs review | Covered |
| C-01 | Opt-in local feature; no single-run change. | Dedicated parser branch | Regression test | Covered |
| C-02 | Sequential fail-fast only. | Coordinator | Stop/order tests | Covered |
| C-03 | No retries, parallelism, resume, history, rollback, or cross-packet graph. | Scope guard in coordinator/store | Review checklist | Covered by design |
| C-04 | Compact outcomes in both workflows. | Store and terminal formatter | Cockpit/no-UI tests | Covered |
| C-05 | No transcript retention or telemetry added. | Store lifecycle and observability | Code review | Covered |
| C-06 | Earlier successes remain completed. | No rollback in coordinator | Failure scenario | Covered |
| M-01 | 100% declared order correctness. | Coordinator | Ordered fixtures | Release gate |
| M-02 | 100% fail-safe stopping. | Coordinator | Failure/cancel fixtures | Release gate |
| M-03 | 4/5 stopping-packet comprehension. | Cockpit/no-UI UX | Usability evaluation | Release gate |
| M-04 | Median one command per sequence. | CLI workflow | Usage diary/script comparison | Post-release measurement |
| M-05 | 100% existing single-run cases remain valid. | Existing engine/command tests | `bun run verify` | Release gate |
| M-06 | 100% invalid sequences start zero packets. | Preflight | Preflight tests | Release gate |

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs/outputs | Dependencies |
|---|---|---|---|---|
| CLI argument parser | Existing, extended | Distinguish single slug from exclusive batch grammar | `argv` -> validated mode | No new dependency |
| Batch coordinator | New `src/batch.ts` | Preflight, ordered execution, aggregation, cancellation classification | slugs/config/signal -> `BatchResult` and events | `loadTaskPacket`, `validateTasks`, injected packet runner |
| Packet engine | Existing | Execute one packet with current task, ACP, report, and status semantics | packet options -> existing result/events | ACP client, providers, task files |
| Event adapter | New/extended | Convert packet lifecycle into additive batch events and active projection | packet events -> `RunEvent` batch envelope | Event types, store |
| Cockpit store | Existing, extended | Retain packet summaries and active packet detail | additive events -> state | React/OpenTUI consumers |
| Cockpit/terminal presenters | Existing, extended | Display progress, outcomes, and recovery guidance | store/events -> user output | OpenTUI and stdout |

### Data and Control Flow

Normal flow: parse -> preflight all packets -> emit `batch_started` -> run packet 1 -> emit packet outcome -> continue in declared order -> emit `batch_finished`.

Failure flow: the first provider, permission, task, or report failure becomes `failed`; the coordinator does not invoke later packets and marks them `not_started`.

Cancellation flow: a shared abort signal or ACP cancelled stop reason becomes `cancelled`; later packets are `not_started`. Existing engine task-file mutations remain unchanged; no new persisted cancelled task status is introduced.

Recovery flow: the aggregate result identifies the stopping packet and later not-started packets, states that no retry occurred, and recommends manual rerun after the cause is resolved.

Preflight failure flow: all packet slugs are loaded and validated before `ensurePacketMemory`, status writes, or ACP launch. Any invalid/unknown/duplicate entry yields `preflight_failed` and starts zero packets.

## Implementation Design

### Core Interfaces

```ts
type PacketOutcome = "succeeded" | "failed" | "cancelled" | "not_started";

type PacketSummary = {
  slug: string;
  outcome: PacketOutcome;
  detail?: "already_complete" | "completed" | "stopped";
};

type BatchResult = {
  ok: boolean;
  status: "completed" | "failed" | "cancelled" | "preflight_failed";
  packets: PacketSummary[];
  stoppingSlug?: string;
};
```

```ts
type PacketRunner = (options: RunTaskPacketOptions) => Promise<RunTaskPacketResult>;

type BatchRunOptions = {
  slugs: string[];
  config: RuntimeConfig;
  signal: AbortSignal;
  packetRunner?: PacketRunner;
  onEvent?: (event: RunEvent) => void;
};
```

The default runner is the existing `runTaskPacket`. Tests inject a deterministic runner. The coordinator owns aggregation; the packet engine owns packet-local task-file mutation.

Additive event variants should carry batch identity, slug, sequence index, and summary data. Existing `run_started`, `task_status`, and `run_finished` payloads remain compatible on the single-run path.

### Data Models and Lifecycle

- Parser output is ephemeral and validated before coordinator invocation.
- Preflight packet objects are read-only snapshots; the engine reloads its packet at execution time.
- Batch summaries live only in process memory and are discarded when the command exits.
- Active task/transcript keys are qualified internally as `${slug}/${taskId}`.
- Only one packet is active at a time, so active task projection is serialized.
- One shared `AbortController` and effective runtime configuration are used for all packets.
- A filesystem change after preflight is handled as a runtime packet failure; no transactional rollback is attempted.

### External Interfaces

CLI:

```text
spec-finder run --multiple <slug1,slug2,...> [runtime flags]
```

Reject positional slugs, repeated `--multiple`, empty entries, duplicate entries, invalid slugs, and unknown packets. Existing provider/model/reasoning/speed flags retain their current meanings.

ACP remains unchanged. The existing client receives the shared cancellation signal; provider errors and permission refusals retain current semantics. No new network, authentication, or retry protocol is introduced.

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility/migration |
|---|---|---|---|---|
| CLI -> command | One positional slug | Add exclusive `--multiple` branch | Parse/preflight error exits 1 | Single-slug branch unchanged |
| Coordinator -> engine | One packet invocation | Repeated serial invocation via injected/default runner | Stop on first failed/cancelled result | Engine contract unchanged |
| Engine -> events | Singular run lifecycle | Adapt packet lifecycle to additive batch envelope | Batch still emits terminal aggregate | Legacy events preserved for single run |
| Events -> store | `run_started` resets state | Batch events update summary and active projection | Invalid transition leaves diagnostics and terminal result | No persisted schema migration |
| Store -> App | Packet-local state | Add sequence summary and active packet context | UI shows text-labelled terminal statuses | Existing packet detail remains usable |
| Command -> terminal | Task activity and final result | Add packet summaries and recovery guidance | Non-success aggregate exits 1 | Existing no-UI single output preserved |

## Failure and Recovery Behavior

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| Empty/malformed list | Parser | Explain invalid input; start nothing | Correct command and retry | F-01/M-06 |
| Unknown/invalid packet | Preflight load/validation | `preflight_failed`; zero packets start | Fix packet slug/content | `src/tasks.ts` |
| Task/provider/report error | Engine result/exception | Packet `failed`; later packets `not_started` | Manual remediation; no retry | Existing engine behavior |
| Permission refusal | Existing refusal result | Packet `failed`; later packets `not_started` | Resolve permission manually | Existing ACP tests |
| Operator abort | Shared signal | Packet/batch `cancelled`; later packets `not_started` | Manual rerun if desired | ACP cancellation contract |
| Already-complete packet | Empty execution order | `succeeded` with `already_complete` detail | No action required | F-05 |
| Renderer/output error | Presenter boundary | Preserve coordinator result; terminate renderer cleanly | No task rollback | OpenTUI lifecycle docs |

## Security and Privacy

- Reuse the existing slug regex and workspace-boundary checks; reject path traversal through validation.
- Do not interpolate unvalidated input into shell commands or filesystem paths.
- Preserve existing ACP permission prompts and provider isolation.
- Do not add credentials, secrets, telemetry, or external reporting.
- Compact summaries contain slugs and statuses, not inactive packet transcripts or provider content.
- Cancellation is fail-closed for sequencing: once the shared signal is observed, no later packet starts.

## Compatibility, Migration, and Rollback

- No database, task-file schema, config, lockfile, or dependency migration.
- Batch behavior is opt-in and can be disabled by removing the parser branch and coordinator wiring.
- Existing single-slug CLI, event payloads, task statuses, renderer lifecycle, and provider flags remain supported.
- Rollback trigger: regression in single-run behavior, incorrect fail-safe stopping, or transcript/state leakage.
- Rollback is source-level removal of batch parser/coordinator/event/store additions; no data cleanup is required.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|
| `src/batch.ts` | New coordinator/parser helpers | Medium | Implement contracts and injected runner |
| `src/commands.ts` | Batch routing and exit mapping | High | Preserve single-run branch and shared lifecycle |
| `src/cli.tsx` | Help text | Low | Document grammar and examples |
| `src/events.ts` | Additive event union | Medium | Keep legacy variants unchanged |
| `src/ui/store.ts` | Batch state/projection | High | Prevent resets and task-ID collisions |
| `src/ui/App.tsx` | Summary, active packet, status copy | Medium | Preserve accessibility and compact layout |
| `tests/batch.test.ts` | New deterministic coverage | Medium | Inject packet runner |
| `tests/commands.test.ts` | Parser/exit coverage | Medium | Cover flags and invalid grammar |
| `tests/store.test.ts` | State isolation | High | Cover repeated task IDs and transitions |
| `tests/cockpit.test.tsx` | UI states | Medium | Cover no-color textual semantics |
| `tests/engine.test.ts` / ACP fixtures | Boundary regression | Medium | Cover cancellation classification |
| `README.md` | User documentation | Low | Add batch examples and recovery guidance |

## Testing and Evidence

### Unit Tests

- Parser accepts one valid ordered list and rejects positional, duplicate, empty, malformed, and unknown entries.
- Coordinator preserves order and invokes each runner once on success.
- Coordinator stops after failure or cancellation and marks later packets `not_started`.
- Preflight invokes zero runners when any packet is invalid.
- Already-complete results are successful with explicit detail.
- Aggregate exit mapping is deterministic.

### Integration Tests

- `runCommand` routes batch and single-slug invocations correctly.
- Store retains compact outcomes while projecting only the active packet.
- Repeated task IDs from different packets do not collide.
- Cockpit and `--no-ui` expose equivalent essential outcomes.
- ACP cancellation remains distinct from permission refusal/provider failure.

### End-to-End or Platform Evidence

- Run a three-packet success sequence and a failure/cancellation sequence manually.
- Confirm reduced-color and no-color text labels identify statuses without color.
- Perform the PRD usability check with five evaluators; at least four must identify the stopping packet and later not-started packets.
- No Windows-specific or packaged-runtime evidence is required by this local CLI feature; platform evidence remains limited to the supported Bun/OpenTUI environment.

### Verification Gates

```text
rtk bun test ./tests/batch.test.ts ./tests/commands.test.ts
rtk bun test ./tests/store.test.ts ./tests/cockpit.test.tsx
rtk bun run verify
```

Baseline before implementation: 58 tests passed, TypeScript check passed, and build passed.

## Observability

- Use additive in-process batch events for progress and diagnostics.
- `--no-ui` prints packet start/outcome, stopping packet, not-started packets, and aggregate status.
- Cockpit displays the same state through the store.
- No metrics backend or telemetry is added.
- Diagnostic context includes batch status, slug, sequence index, and outcome; provider/task content remains subject to existing redaction/output rules.
- Terminal success/failure is signaled through the process exit code.

## Development Sequencing

1. Define parser, batch result, event, and store contracts; no implementation dependency.
2. Implement read-only preflight and injected-runner coordinator tests; depends on step 1 for contracts.
3. Implement the coordinator and cancellation/outcome normalization; depends on step 2 tests.
4. Add additive events and store active projection; depends on step 3 lifecycle events.
5. Integrate command routing and exit mapping; depends on steps 3-4.
6. Update cockpit, terminal formatting, help, and README; depends on the stable store and command contracts.
7. Add ACP boundary fixtures and single-run regressions; depends on integrated routing and event projection.
8. Run focused tests, `rtk bun run verify`, and the three-packet usability scenario; depends on all implementation steps.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|
| Filesystem changes after preflight | Preflight cannot be transactional | A later packet can fail despite valid preflight | Treat as runtime failure; document no rollback |
| Cancellation timing around permission prompts | Engine has timing-dependent paths | Incorrect failure/cancel classification is possible | Add signal-aware ACP fixture and assert batch classification |
| Long sequence readability | Existing cockpit is packet-local | Compact summary may become hard to scan | Validate representative long sequence before release |
| Summary wording | No existing batch UX baseline | Users may confuse `failed`, `cancelled`, and `not_started` | Usability target M-03; product owner reviews copy |
| Task-file status after cancellation | Existing engine owns mutations | Active task may reflect existing engine semantics | Preserve current mutation semantics; batch outcome is authoritative for sequence status |

## Architecture Decision Records

- [ADR-001: Ordered Multi-Packet Run Coordinator](adrs/adr-001-ordered-multiple-task-run.md) — Ordered preflight, serial fail-fast execution, outcomes, and active-packet boundaries.
- [ADR-002: Compact Fail-Safe Sequence Product Scope](adrs/adr-002-compact-fail-safe-sequence-product-scope.md) — Compact summaries, manual recovery, already-complete semantics, and rollout scope.
- [ADR-003: Coordinator Batch Envelope and Active Projection](adrs/adr-003-coordinator-batch-envelope-active-projection.md) — Selected technical ownership, additive events, cancellation normalization, and test seam.
