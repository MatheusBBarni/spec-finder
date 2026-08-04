# Read-Only Progress Navigator with Integrated Task Timer — Technical Specification

## Executive Summary

Implement the approved timer update at the existing cockpit projection seam.

The design adds:

- a pure `src/ui/timer.ts` module for timer transitions and formatting;
- ephemeral per-task timer state in `CockpitStore`;
- an explicit `store.tick()` path driven by the App's existing OpenTUI live lifecycle;
- `performance.now()` as the production monotonic source, injectable for tests;
- task-row rendering for `—`, live/final `MM:SS`, and `unavailable`.

The engine, ACP transport, raw `RunEvent` union, task packet schema, configuration, reports, persistence, and `--no-ui` behavior remain unchanged.

The primary trade-off is additional UI-store state and one timer tick path. This preserves deterministic transitions and avoids widening the runtime event contract.

The existing `_tasks.md` describes the earlier navigator scope and must be regenerated after this TechSpec is approved.

## Technical Evidence

| Kind | Finding/constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository | `CockpitStore` is the current immutable task/transcript presentation boundary. | [`src/ui/store.ts`](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts) | 2026-08-04 | Keep timer state in the store projection. |
| Repository | `App.tsx` already requests live rendering and advances a spinner while tasks run. | [`src/ui/App.tsx`](/Users/matheusbbarni/projects/spec-finder/src/ui/App.tsx) | 2026-08-04 | Reuse the existing live lifecycle for timer ticks. |
| Repository | `task_status` carries task ID and status but no timestamp. | [`src/events.ts`](/Users/matheusbbarni/projects/spec-finder/src/events.ts) | 2026-08-04 | Do not add timestamps to raw events; establish local baselines. |
| Repository | The engine emits `in_progress` before ACP work and terminal status after completion/failure. | [`src/engine.ts`](/Users/matheusbbarni/projects/spec-finder/src/engine.ts) | 2026-08-04 | Use first observed `in_progress` and terminal status as timer boundaries. |
| Repository | Existing renderer evidence covers 80×24, 120×40, 200×60, reduced-color, 70×20 fallback, and 300-entry transcripts. | Packet memory and [`tests/cockpit.test.tsx`](/Users/matheusbbarni/projects/spec-finder/tests/cockpit.test.tsx) | 2026-08-04 | Extend the same deterministic frame boundary for timer layout. |
| Repository | Installed versions are `@opentui/core`/`@opentui/react` 0.4.5 and ACP SDK 1.2.1. | [`package.json`](/Users/matheusbbarni/projects/spec-finder/package.json) | 2026-08-04 | Use installed APIs and add no dependency. |
| Repository | Existing verification is Bun-based and succeeds through `bun run verify`. | [`package.json`](/Users/matheusbbarni/projects/spec-finder/package.json), packet reports | 2026-08-04 | Add focused timer tests and preserve repository gates. |
| Official docs | OpenTUI supports `requestLive()`/`dropLive()` and renderer clock configuration. | [OpenTUI renderer](https://opentui.com/docs/core-concepts/renderer/) | 0.4.5 / 2026-08-04 | Keep continuous rendering scoped to active animation. |
| Official docs | OpenTUI provides focused keyboard routing and canonical key names. | [OpenTUI keyboard](https://opentui.com/docs/core-concepts/keyboard/) | 0.4.5 / 2026-08-04 | Preserve existing task/transcript focus behavior. |
| Official docs | OpenTUI `ScrollBox` supports line/page/Home/End navigation, sticky scrolling, and viewport culling. | [OpenTUI ScrollBox](https://opentui.com/docs/components/scrollbox/) | 0.4.5 / 2026-08-04 | Timer rendering must not disrupt transcript navigation or culling. |
| Official docs | OpenTUI testing supports fixed renderers, frame capture, keyboard drivers, terminal capability fixtures, and `ManualClock`. | [OpenTUI testing](https://opentui.com/docs/core-concepts/testing/) | 0.4.5 / 2026-08-04 | Use deterministic timer and frame evidence without wall-clock sleeps. |
| Official docs | ACP uses `session/update` notifications for progress and keeps permission requests as client responses. | [ACP overview](https://github.com/agentclientprotocol/agent-client-protocol/blob/main/docs/protocol/v1/overview.mdx), [ACP schema](https://github.com/agentclientprotocol/agent-client-protocol/blob/main/docs/protocol/v2/schema.mdx) | Current as of 2026-08-04 | Keep timing outside ACP protocol and preserve the existing fail-closed permission behavior. |
| Inference | A store-local timer with a pure helper module is the smallest design satisfying the approved PRD and ADR-004. | ADR-004, ADR-006 | 2026-08-04 | Avoid App-only timing and runtime event changes. |

## Requirement Traceability

The PRD's unlabeled constraint bullets are assigned technical aliases `C-01` through `C-09` below.

| PRD ID | Technical obligation | Component/interface | Verification | Status/gap |
|---|---|---|---|---|
| `G-01`, `US-01`, `F-01`, `M-01` | Render truthful run identity, phase/outcome, active task, and counts. | `CockpitState`, header selectors, `App.tsx` | Orientation frames at 80×24, 120×40, 200×60 | Existing navigator satisfied; preserve |
| `G-02`, `US-02`, `F-02`, `F-04`, `M-02` | Keep every task reachable with status, identity, and active marker. | `CockpitTask`, task `ScrollBox`, task selectors | Multi-task frame and keyboard selection tests | Existing navigator satisfied; preserve |
| `G-03`, `US-03`, `US-04`, `US-05`, `F-03`, `F-04`, `F-07`, `M-03`, `M-04` | Keep task histories isolated, selectable, followable, and scrollable from start to tail. | `transcripts`, `selectedTaskId`, `followingActiveTask`, transcript `ScrollBox` | Selection, follow, long-history, Home/End/page tests | Existing navigator satisfied; preserve |
| `G-04`, `US-06`, `US-07`, `F-05`, `F-06`, `F-08`, `M-05` | Present ACP categories, streaming content, errors, and blocked reasons clearly. | `src/ui/transcript.ts`, task reasons, `TranscriptEntry` | Projection fixtures and failure/category frame tests | Existing navigator satisfied; preserve |
| `G-05`, `US-08`, `F-09`, `C-01`, `C-02`, `M-06` | Keep the cockpit observational and fail closed for TUI permission prompts. | `App.tsx`, `CockpitStore`, `src/acp-client.ts` | Negative control assertions and ACP permission tests | Existing navigator satisfied; preserve |
| `G-06`, `US-09`, `US-10`, `F-11`, `C-03`, `C-04`, `C-05`, `M-07`, `M-08` | Add ephemeral per-task timer with placeholders, live/final `MM:SS`, and unavailable state. | `src/ui/timer.ts`, `CockpitStore.taskTimers`, `store.tick()` | Pure transition, store, and frame tests | New timer delta |
| `G-07`, `US-11`, `US-12`, `F-10`, `F-11`, `C-08`, `C-09`, `M-09`, `M-10` | Preserve task identity/status/timer/transcript context in compact layouts and explain neutral timing. | Responsive branches, footer/help, task-row formatter | 80×24/120×40/200×60/reduced-color frames and help comprehension fixture | New timer layout/copy delta |
| `C-06` | Preserve task execution order, provider behavior, permission policy, reports, and `--no-ui`. | `src/engine.ts`, `src/events.ts`, `src/commands.ts` | Protected-boundary diff and engine/no-UI regression | No code change intended |
| `C-07` | Keep ACP history task-scoped and chronological during the run. | Transcript projection and store | Existing projection/history tests | Existing behavior preserved |
| `C-08` | Keep runtime identity truthful to effective configuration. | Runtime option selectors/header | Applied/default/unsupported fixtures | Existing behavior preserved |
| `C-09` | Preserve supported terminal behavior and reduced-color meaning. | `App.tsx`, OpenTUI renderer tests | Fixed-size and capability frames | Extend with timer assertions |

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs/outputs | Dependencies |
|---|---|---|---|---|
| Task engine | Existing, unchanged | Executes tasks and emits status/events. | `RunOptions` → `RunEvent` | ACP client, task packet |
| ACP client | Existing, unchanged for timer | Runs ACP turns and handles TUI permission cancellation. | ACP stream → `RunEvent` | ACP SDK 1.2.1 |
| Runtime event protocol | Existing, unchanged | Stable execution-to-observer contract. | `RunEvent` | Task and ACP types |
| `CockpitStore` | Existing, changed | Owns task state, transcripts, selection, reasons, and timer projection. | `RunEvent` + `tick()` → immutable snapshot | Timer helpers, transcript helpers |
| Timer projection | New `src/ui/timer.ts` | Pure timer transitions, validation, and formatting. | Prior timer + status/time → next timer | No OpenTUI or ACP dependency |
| Transcript projection | Existing `src/ui/transcript.ts` | Normalizes ACP updates into readable entries. | ACP update → entries | ACP SDK types only |
| TUI `App` | Existing, changed | Renders task timer, header, task list, transcript, help, and responsive modes. | Store snapshot + keyboard/tick actions → OpenTUI tree | OpenTUI React 0.4.5 |
| Cockpit lifecycle | Existing, unchanged | Creates/destroys renderer and App root. | Store/cancel callback → renderer | OpenTUI |
| Tests | Existing, expanded | Verify timer, store, frames, focus, ACP, and gates. | Fixtures → evidence | Bun test, OpenTUI test renderer |

### Data and Control Flow

Normal run:

1. `runCommand` creates `CockpitStore` and starts the existing cockpit.
2. `run_started` resets the store and creates one empty timer projection per task by omission; no timer value is rendered for pending tasks.
3. The first `task_status: in_progress` calls the timer start transition with the store clock.
4. The App's existing live effect calls `store.tick()` while any task is running.
5. `tick()` advances only running timer entries. A snapshot is published only when the displayed elapsed second changes.
6. Task rows select timer state and task status to render `—`, `MM:SS`, or `unavailable`.
7. The first terminal task status freezes the timer. Duplicate or stale terminal events do not overwrite it.
8. Task selection and transcript scrolling remain view-only and do not affect timer state.

Terminal paths:

- `completed` and `failed` freeze observed elapsed duration.
- `blocked` renders `—`, regardless of any stale timer entry.
- A terminal status without an observed start baseline renders `unavailable`.
- A task that starts with an invalid clock value receives `unavailable` rather than an invented duration.
- `run_finished` updates run outcome but does not create a task duration; normal engine paths emit task terminal status first.

Cancellation and recovery:

- The existing abort controller and renderer cleanup remain unchanged.
- App timer/spinner intervals are cleared when the renderer unmounts or no task remains running.
- A late-attached cockpit cannot reconstruct a baseline and shows `unavailable`.
- Resizing and transcript scrolling preserve timer state.
- A new `run_started` resets all timer state.

## Implementation Design

### Core Interfaces

```ts
export type MonotonicNow = () => number

export type TaskTimer =
  | { kind: "running"; startedAtMs: number; elapsedSeconds: number }
  | { kind: "finished"; elapsedSeconds: number }
  | { kind: "unavailable" }

export const systemNow: MonotonicNow = () => performance.now()
```

```ts
export function beginTaskTimer(
  previous: TaskTimer | undefined,
  nowMs: number,
): TaskTimer

export function advanceTaskTimer(
  previous: TaskTimer,
  nowMs: number,
): TaskTimer

export function finishTaskTimer(
  previous: TaskTimer | undefined,
  nowMs: number,
): TaskTimer
```

```ts
export function formatTaskTimer(
  status: TaskStatus,
  timer: TaskTimer | undefined,
): string
```

Rules:

- `beginTaskTimer` preserves an existing running, finished, or unavailable entry.
- Non-finite or negative baselines produce `unavailable`.
- `advanceTaskTimer` clamps elapsed seconds at zero and returns the same entry when the displayed second has not changed.
- `finishTaskTimer` preserves an existing finished entry, freezes a running entry, and returns `unavailable` without a baseline.
- `formatTaskTimer` returns `—` for pending/blocked, `unavailable` for missing active/terminal baselines, and total-minute `MM:SS` for observed values.

### Store Interface

```ts
export interface CockpitState {
  readonly tasks: readonly CockpitTask[]
  readonly taskTimers: Readonly<Record<string, TaskTimer>>
  readonly activeTaskId: string | null
  readonly selectedTaskId: string | null
  // Existing transcript and view fields remain unchanged.
}

export class CockpitStore {
  constructor(now?: MonotonicNow)
  tick(nowMs?: number): void
}
```

`CockpitStore` responsibilities:

- Own the timer map and include it in immutable snapshots.
- Call timer transitions from `consumeTaskStatus`.
- Use the injected clock when `consumeTaskStatus` starts or finishes a timer.
- Ignore invalid tick values without publishing a corrupt state.
- Notify subscribers only when a timer display or another state field changes.
- Keep timer state separate from transcript entries, run activity, runtime options, and task reasons.

### App Integration

The existing running-task effect remains the lifecycle owner:

- Request OpenTUI live rendering while a task is running.
- Advance the existing spinner interval.
- Call `store.tick()` on a one-second cadence, or call it from the existing interval while the timer helper suppresses unchanged displayed seconds.
- Clear every interval and call `renderer.dropLive()` during cleanup.
- Render `formatTaskTimer(task.status, state.taskTimers[task.id])` in `TaskRow`.
- Keep the timer before title truncation so compact layouts preserve it.
- Add the neutral timer explanation to the existing help overlay.
- Do not add keyboard actions or execution callbacks for timer values.

### Data Models and Lifecycle

- Timer state is keyed by stable task ID.
- Timer state exists only inside one `CockpitStore`.
- `run_started` resets the complete timer map.
- Pending and blocked tasks need no timer entry because status controls the `—` placeholder.
- Running tasks have a start baseline and display seconds.
- Finished tasks have frozen display seconds only.
- Active or terminal tasks without a trustworthy baseline have `unavailable`.
- Timer history is not written to task files, reports, transcript entries, logs, telemetry, clipboard, exports, or configuration.
- JavaScript event handlers and timer ticks are synchronous store transitions; no worker, lock, or cross-thread coordination is required.
- Timer formatting must support durations beyond 59 minutes without hour rollover.
- The store must not derive duration from transcript activity, ACP chunks, or wall-clock timestamps.

## External Interfaces

No new public CLI, network, storage, authentication, or configuration interface is introduced.

Unchanged external contracts:

- `RunEvent` and `RunEventListener`.
- ACP initialization, session, prompt, update, cancellation, and permission response behavior.
- `--no-ui` console event projection.
- Task packet and report schemas.
- Existing provider launch configuration.

New internal interface:

- `CockpitStore.tick(nowMs?)`.
- `CockpitState.taskTimers`.
- Pure timer helpers in `src/ui/timer.ts`.

The timer is not rendered or emitted in `--no-ui` mode.

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility/migration |
|---|---|---|---|---|
| Engine → event listener | Raw `RunEvent` stream | No change | Existing engine outcomes remain authoritative | Fully compatible |
| `task_status` → store | Task ID and status | Store starts/finishes local timer projection | Duplicate/stale transitions are idempotent | No event migration |
| Store → App | Immutable `useSyncExternalStore` snapshot | Add `taskTimers` and `tick()` | Invalid clock values become unavailable/no-op | Internal only |
| App → renderer | OpenTUI React tree and live lifecycle | Render timer and tick during live effect | Cleanup stops interval and live request | Same OpenTUI version |
| Timer module → store | No current boundary | New pure helper calls | Invalid input returns unavailable or unchanged state | No external migration |
| ACP client → listener | ACP updates and permission behavior | No timer change | Existing ACP failure handling | Fully compatible |
| CLI → `--no-ui` listener | Raw activity/status/run-finished console output | No change | Existing console behavior | Fully compatible |
| Packet/config files | Existing schemas | No change | Existing validation errors | No migration |
| Tests → renderer/store | Existing fixtures and test renderer | Add timer fixtures and controlled clock | Failed assertions block verification | No production dependency |

## Failure and Recovery Behavior

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| Duplicate `in_progress` | Existing timer entry is running/finished/unavailable | Preserve first baseline; do not reset | Continue normal tick path | Timer unit test |
| Terminal without baseline | No timer entry at terminal status | Render `unavailable` | No reconstruction attempt | Timer/store test |
| Duplicate terminal status | Existing entry is finished | Preserve first frozen value | No-op | Timer unit test |
| Out-of-order terminal after later start | Existing finished entry | Preserve first terminal value | No-op | Timer transition test |
| Non-finite/negative clock | Clock validation | Mark new baseline unavailable or ignore invalid tick | Next valid observed start can establish baseline if not terminal | Timer unit test |
| Clock moves backward | Computed delta below zero | Clamp displayed duration to zero | Later values advance normally | Controlled-clock test |
| No transcript activity during run | Task remains `in_progress` | Timer continues; no stall label or alert | Operator interprets neutral cue | Frame/help test |
| `run_finished` without task terminal | Run-level completion lacks task ID | Do not invent task final duration; renderer closes normally | Reopen shows no prior timer baseline | Store lifecycle test |
| Renderer unmount | React effect cleanup | Stop timer interval and drop live request | No background tick remains | Renderer cleanup/PTY test |
| Narrow terminal | Dimension branch | Preserve task identity/status/timer/transcript context; collapse secondary metadata | Resize restores expanded layout | Fixed-size frame tests |
| Long task history | High entry count | Timer remains O(task count); transcript culling remains unchanged | Persistence/spill remains out of scope | 300-entry renderer test |
| TUI permission request | Existing ACP permission branch | Cancel with stable read-only notice; timer remains observational | Configure permissions and rerun | Existing ACP integration test |

## Security and Privacy

- Timer state is presentation-only and remains in process memory.
- No timer value is added to raw events, transcripts, reports, logs, telemetry, clipboard, export, or persistence.
- Timer values cannot trigger commands, permissions, retries, cancellation, or status changes.
- The timer module has no filesystem, network, ACP, or credential access.
- The existing TUI permission boundary remains fail closed.
- No new sensitive data is introduced beyond transient elapsed runtime in the UI process.
- No audit or telemetry event is emitted for timer ticks.
- Provider output continues to follow the existing in-session handling and workspace constraints.

## Compatibility, Migration, and Rollback

- No package, lockfile, packet, configuration, task-frontmatter, event-schema, or report migration is required.
- Existing OpenTUI 0.4.5 and Bun `>=1.3.0` remain sufficient.
- Existing `--no-ui` execution remains unchanged.
- Existing store fixtures must initialize `taskTimers` as an empty map.
- Rollback removes `src/ui/timer.ts`, timer state/selectors, App tick/render wiring, and timer tests.
- No cleanup of persisted data is required because no timer data is persisted.
- The existing navigator task graph must be regenerated after this TechSpec is approved; implementation tasks must not rely on the stale four-task graph.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|
| `src/ui/timer.ts` | New pure timer state, transitions, formatting, and clock helpers | Boundary/format errors | Add focused deterministic tests |
| `src/ui/store.ts` | Add `taskTimers`, clock injection, status transitions, `tick()`, and selectors | Snapshot and idempotence regressions | Preserve immutable updates and existing view behavior |
| `src/ui/App.tsx` | Render timer, call `tick()`, add help copy, preserve compact width | Layout and lifecycle regressions | Add timer frames and cleanup evidence |
| `src/ui/cockpit.tsx` | No intended production change | Renderer lifecycle drift | Confirm protected diff remains clean |
| `src/events.ts` | No intended change | Accidental protocol expansion | Protected-boundary diff check |
| `src/engine.ts` | No intended change | Timer coupling to execution | Engine regression gate |
| `src/commands.ts` | No intended change | `--no-ui` timer leakage | Console/no-UI regression |
| `tests/timer.test.ts` | New pure helper suite | Incomplete boundary coverage | Add all M-07 cases |
| `tests/store.test.ts` | Add timer state, clock, status, tick, and lifecycle assertions | Interaction with existing state | Preserve all current tests |
| `tests/cockpit.test.tsx` | Add timer row/frame/help and cleanup assertions | OpenTUI timing flakiness | Use controlled store ticks and frame fixtures |
| `tests/acp-client.test.ts` | No timer-specific production change | Regression from broader gate | Keep existing permission coverage |
| `README.md` | Optional concise cockpit timer/help wording | Documentation drift | Update only if implementation changes user-facing CLI guidance |
| `_tasks.md` | Regenerated after approval | Stale task graph | Run `sf-create-tasks` before implementation |

## Testing and Evidence

### Unit Tests

Create `tests/timer.test.ts` covering:

- pending and blocked formatting as `—`;
- active/terminal missing baseline as `unavailable`;
- first `in_progress` starts at zero;
- duplicate `in_progress` preserves the first baseline;
- `advanceTaskTimer` changes only when the displayed second changes;
- total-minute formatting at `00:00`, `00:01`, `01:00`, `59:59`, `60:00`, and multi-hour values;
- first terminal freezes the observed value;
- duplicate/stale terminal events preserve the frozen value;
- invalid and regressing clock values never produce negative elapsed time;
- pure helpers do not mutate prior entries.

Extend `tests/store.test.ts` to cover:

- timer map reset on `run_started`;
- status transitions establish and freeze task timers;
- `tick()` updates only running tasks;
- no snapshot notification when formatted seconds are unchanged;
- terminal without baseline becomes unavailable;
- timer state remains separate from transcript and run activity;
- `run_finished` does not invent a task terminal duration.

### Integration Tests

Extend `tests/cockpit.test.tsx` to cover:

- running row displays `MM:SS`;
- completed/failed rows retain final value;
- pending/blocked rows display `—`;
- unavailable rows display the documented fallback;
- timer values remain visible at 80×24, 120×40, 200×60, reduced-color, and compact fallback sizes;
- help contains the neutral-timer explanation;
- timer updates do not change selected task, focus, transcript scroll, or follow state;
- renderer cleanup stops timer updates and drops live mode.

Preserve existing integration tests for task selection/following, transcript scrolling, failure/blocked reasons, permission cancellation, `--no-ui`, and runtime-option truthfulness.

### End-to-End or Platform Evidence

- Real OpenTUI PTY smoke test with a running fixture verifies the timer appears and advances.
- Real PTY `q` and Ctrl+C checks verify interval cleanup and terminal restoration.
- Manual checks at 80×24, 120×40, and 200×60 verify timer/title truncation.
- Reduced-color frame capture verifies status and timer meaning without color dependence.
- Controlled long-duration fixture verifies formatting beyond 59 minutes without waiting in real time.
- No live third-party provider is required for timer correctness; existing deterministic ACP fixtures remain the provider-variance boundary.

### Verification Gates

Focused:

```bash
bun test ./tests/timer.test.ts ./tests/store.test.ts ./tests/cockpit.test.tsx
```

Repository:

```bash
bun run check
bun test
bun run build
bun run verify
git diff --check
```

Protected-boundary check:

```bash
git diff -- src/events.ts src/engine.ts src/commands.ts package.json bun.lock
```

No test result is evidence until the command exits successfully.

## Observability

- No external metrics, telemetry, or timer logs are added.
- Existing header state, task status, transcript chronology, runtime-option outcomes, and failure reasons remain the diagnostic surfaces.
- Timer ticks must not emit `RunEvent`, ACP messages, console output, or persistent logs.
- Tests should expose timer state through snapshots and rendered frames only.
- No alert or operational threshold is introduced.

## Development Sequencing

1. Add `src/ui/timer.ts` with pure transitions, formatting, clock validation, and focused tests. No dependencies.
2. Extend `CockpitStore` with timer state, injected clock, status transitions, `tick()`, and selectors. Depends on step 1.
3. Render timer values in `TaskRow`, add App tick wiring and neutral help copy, and preserve existing live-render cleanup. Depends on step 2.
4. Add timer-aware renderer frames, compact-layout assertions, reduced-color checks, and cleanup/PTY evidence. Depends on step 3.
5. Run focused tests, protected-boundary checks, TypeScript, full Bun verification, and build; update user-facing documentation if required. Depends on step 4.
6. Regenerate the implementation task graph from the approved PRD and TechSpec. Depends on TechSpec approval and completion of the design review; it is a Spec Finder handoff rather than a code prerequisite.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|
| Timer tick cadence | Product format is `MM:SS`; OpenTUI live rendering is already active for the spinner. | Excessive store snapshots could affect renderer churn. | Tick at one-second display precision or suppress unchanged displayed seconds; verify frame behavior in timer/store tests. |
| `performance.now()` process lifetime | The timer is intentionally local and non-persistent. | Late attachment/restart cannot reconstruct prior duration. | Render `unavailable`; verify lifecycle reset tests. |
| Run completion without task terminal | Raw `run_finished` is run-level and carries no task ID. | No trustworthy task final duration exists in that synthetic sequence. | Do not invent a duration; renderer closes after run completion. |
| Timer row width | Existing task rows already truncate titles at compact widths. | Timer could clip or obscure task identity. | Reserve timer/status width before title truncation; verify M-09. |
| Existing task graph is stale | `_tasks.md` still describes the earlier navigator-only implementation. | Implementation could omit timer work or duplicate completed tasks. | Regenerate with `sf-create-tasks` after TechSpec approval. |
| OpenTUI clock coupling | OpenTUI exposes `ManualClock`, but the selected timer module remains OpenTUI-independent. | Renderer tests and store tests use different time seams. | Store tests inject a simple monotonic function; renderer tests drive store ticks explicitly. |
| Provider variance | Timer boundaries depend on Spec Finder task status, not ACP update categories. | Timer correctness does not require a live third-party provider. | Retain deterministic provider fixtures and existing live-provider gap. |

## Architecture Decision Records

- [ADR-001: Read-Only Progress Cockpit](adrs/adr-001-read-only-progress-cockpit.md) — observation-only master-detail boundary.
- [ADR-002: Guided Live Transcript Product Shape](adrs/adr-002-guided-live-transcript.md) — header, two-column layout, task following, and readable transcript.
- [ADR-003: Current-Seam Transcript Projection](adrs/adr-003-current-seam-transcript-projection.md) — existing store/App projection architecture.
- [ADR-004: Ephemeral Task Duration Signal](adrs/adr-004-ephemeral-task-duration.md) — timer semantics, placeholders, final retention, and non-persistence.
- [ADR-005: Integrated Neutral Task Timer Product Scope](adrs/adr-005-integrated-neutral-task-timer.md) — timer included in the navigator MVP.
- [ADR-006: Store-Local Task Timer Projection](adrs/adr-006-store-local-task-timer-projection.md) — pure timer module, store ownership, explicit ticks, and monotonic clock injection.
