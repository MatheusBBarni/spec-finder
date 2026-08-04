# Read-Only Progress Navigator Technical Specification

## Executive Summary

Implement the selected current-seam projection design from [ADR-003](adrs/adr-003-current-seam-transcript-projection.md).

The existing execution engine, ACP transport, task packet format, configuration schema, and `--no-ui` event contract remain unchanged. The cockpit store becomes a task-aware view model, a new `src/ui/transcript.ts` module normalizes ACP updates, and `App.tsx` renders explicit task selection, active-task following, transcript scrolling, responsive hierarchy, and contextual help.

The primary trade-off is a richer UI-specific store retaining complete run-scoped transcript history in memory. This avoids a broader runtime protocol refactor and requires no migration or new dependency.

The approved PRD predates stable requirement IDs. This TechSpec assigns local IDs such as `PRD-G-01` and maps them to the exact approved goals, stories, features, constraints, and metrics below.

## Technical Evidence

| Kind | Finding/constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository | The engine is sequential and emits task status, activity, session updates, and run completion events. | `src/engine.ts`, `src/events.ts` | 2026-08-04 | Preserve execution semantics; improve only the viewing projection. |
| Repository | Events already include task IDs for task status, activity, and ACP updates. | `src/events.ts` | 2026-08-04 | Per-task transcript history can be built without changing the event protocol. |
| Repository | The store owns an external immutable snapshot but currently stores one global activity list capped at 250 entries. | `src/ui/store.ts` | 2026-08-04 | Add per-task normalized history and remove the presentation cap. |
| Repository | The UI already has a header, two main columns, and an OpenTUI `ScrollBox`, but no selected task or pane focus. | `src/ui/App.tsx` | 2026-08-04 | Evolve the current layout instead of introducing a new UI framework. |
| Repository | TUI mode currently enables an interactive permission promise. | `src/commands.ts`, `src/acp-client.ts` | 2026-08-04 | Cancel prompt requests in TUI mode and emit a read-only reason. |
| Repository | Current tests cover only basic frame rendering, status projection, and permission selection. | `tests/cockpit.test.tsx`, `tests/store.test.ts` | 2026-08-04 | Add pure projection, selection, scrolling, responsive, and read-only regression tests. |
| Dependency | Installed versions are `@opentui/core` 0.4.5, `@opentui/react` 0.4.5, and ACP SDK 1.2.1. | `package.json`, installed modules | 2026-08-04 | Use currently installed APIs; do not add dependencies. |
| Official docs | OpenTUI supports `useKeyboard`, focus routing, resize handling, focused `ScrollBox`, sticky scrolling, viewport culling, and renderer test utilities. | [keyboard](https://opentui.com/docs/core-concepts/keyboard/), [ScrollBox](https://opentui.com/docs/components/scrollbox/), [testing](https://opentui.com/docs/core-concepts/testing/) | 0.4.5 / 2026-08-04 | Use native focus and scrolling primitives, with frame-level tests. |
| Official docs | ACP streams agent message chunks and tool-call updates; permission requests require a response. | [ACP lifecycle](https://github.com/agentclientprotocol/agent-client-protocol/blob/main/docs/protocol/v1/overview.mdx), [ACP updates](https://github.com/agentclientprotocol/agent-client-protocol/blob/main/docs/protocol/v2/schema.mdx) | SDK 1.2.1 / 2026-08-04 | Coalesce by ACP identity and fail closed when the read-only cockpit cannot answer a permission request. |
| Inference | Kitten’s reducer/projection separation is a useful pattern, but this repository already has a suitable external-store seam. | Kitten `sessionReducer.ts`, `transcriptProjection.ts` | 2026-08-04 | Adopt pure projection helpers without introducing a second domain package. |

## Requirement Traceability

The PRD predates stable IDs. The IDs below are local aliases to its exact approved rows.

| PRD IDs | Technical obligation | Component/interface | Verification | Status/gap |
|---|---|---|---|---|
| `PRD-G-01`, `PRD-US-01`, `PRD-F-01`, `PRD-M-01` | Header shows slug, effective runtime identity, active task, phase/outcome, and counts. | `CockpitState`, header selectors, `App.tsx` | 80×24 frame and orientation evaluation | Satisfied |
| `PRD-G-02`, `PRD-US-02`, `PRD-F-02` | Every task remains visible or reachable with status symbols, labels, and active marker. | Task navigator `ScrollBox`, task selectors | Multi-task frame and selection tests | Satisfied |
| `PRD-G-03`, `PRD-US-03`, `PRD-US-05`, `PRD-F-03`, `PRD-F-07`, `PRD-M-02`, `PRD-M-03`, `PRD-M-04` | Selecting a task shows only its complete chronological history; start, tail, and navigation are reachable. | Per-task transcript map, transcript `ScrollBox` | Two-task selection, long-history, Home/End/page tests | Satisfied |
| `PRD-G-04`, `PRD-US-06`, `PRD-F-05`, `PRD-F-06` | Messages, thoughts, plans, tools, updates, errors, and outcomes have readable labels; streamed chunks coalesce. | `src/ui/transcript.ts` | Pure normalization fixtures | Satisfied |
| `PRD-G-05`, `PRD-US-08`, `PRD-F-09`, `PRD-C-01`, `PRD-M-06` | No permission controls or workflow mutation controls appear. | `acp-client.ts`, `App.tsx`, store actions | Permission-request regression and frame assertions | Satisfied |
| `PRD-US-04`, `PRD-F-04` | Selected task follows the active task until manual inspection begins. | `activeTaskId`, `selectedTaskId`, `followingActiveTask` | Status-transition and manual-selection tests | Satisfied |
| `PRD-US-07`, `PRD-F-08`, `PRD-C-05`, `PRD-M-05` | Failed/blocked tasks show a concise reason immediately, while retaining detail in the transcript. | Task summary reason selectors and transcript entries | Failure, blocked dependency, and permission-cancel fixtures | Satisfied |
| `PRD-F-10` | Footer exposes essential bindings and `?` opens complete help. | Keymap constants and help view | Help/frame test; keymap table test | Satisfied |
| `PRD-F-11`, `PRD-C-09`, `PRD-M-07` | Responsive layout remains understandable at 80×24 and degrades below the minimum. | Dimension selectors and responsive layout branches | 80×24, 120×40, 200×60, reduced-color frames | Satisfied |
| `PRD-C-02`, `PRD-C-03` | Full run-scoped history is retained in memory with event categories and chronology intact. | Normalized per-task transcript state | Synthetic history above 250 entries; ordering fixtures | Satisfied; replaces current cap |
| `PRD-C-04` | Header distinguishes requested, applied, default, and unsupported runtime options. | Runtime-option projection | Applied/default/unsupported fixtures | Satisfied |
| `PRD-C-06` | Execution order, provider behavior, report requirements, and approve-all/deny policy remain unchanged; TUI `prompt` requests are explicitly cancelled per approved clarification. | Engine unchanged; TUI permission branch isolated in ACP client | Engine and `--no-ui` regression suite | Approved exception recorded |
| `PRD-C-07` | No cross-run transcript persistence or telemetry is added. | In-memory store lifecycle | Fresh-store and filesystem-diff checks | Satisfied |
| `PRD-C-08` | Status meaning never depends on color alone. | Symbols, labels, semantic colors | Reduced-color frame assertions | Satisfied |

The PRD’s non-goals remain excluded: search, filtering, event tabs, copying/export, cross-run history, configurable themes/keymaps, analytics, retries, edits, reordering, and status mutation.

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs/outputs | Dependencies |
|---|---|---|---|---|
| Task engine | Existing, unchanged | Executes tasks sequentially, writes reports, emits runtime events. | `RunOptions` → `RunEvent` | ACP client, task packet |
| ACP client | Existing, narrowly changed | Runs ACP turns, emits raw updates, cancels TUI permission prompts. | ACP stream → `RunEvent` | ACP SDK 1.2.1 |
| Runtime event protocol | Existing, unchanged | Stable execution-to-observer contract. | `RunEvent` | Task and ACP types |
| `CockpitStore` | Existing, changed | Owns run snapshot, task status, normalized histories, selection, focus, follow mode, and help state. | `RunEvent` → immutable snapshot | Transcript helpers |
| Transcript projection | New `src/ui/transcript.ts` | Purely normalizes and merges ACP/task events into readable entries. | Event/update + prior entries → next entries | ACP types only |
| TUI `App` | Existing, changed | Renders header, task navigator, selected transcript, footer, help, and responsive layout. | Store snapshot + view actions → OpenTUI tree | OpenTUI React 0.4.5 |
| Cockpit lifecycle | Existing, unchanged | Creates and destroys the renderer. | Store/cancel callback | OpenTUI renderer |
| Tests | Existing, expanded | Verify projection, store actions, frames, input, ACP behavior, and gates. | Fixtures → evidence | Bun test, OpenTUI test renderer |

### Data and Control Flow

Normal run:

1. `runCommand` loads config and creates the store.
2. `runTaskPacket` emits `run_started`; the store initializes tasks, run metadata, empty per-task histories, and default view state.
3. `task_status: in_progress` updates `activeTaskId`. While follow mode is enabled, it also updates `selectedTaskId`.
4. Task-scoped activity and ACP updates enter `src/ui/transcript.ts`.
5. The projection appends new entries or merges message/tool updates by stable ACP identity.
6. `App.tsx` renders the selected task’s entries. The selected transcript remains at the live tail until the user scrolls away.
7. Task selection changes only view state and never calls the engine or ACP client.

Failure and blocked paths:

- A failed task receives an immediate generic reason such as `Task failed; see latest activity`, then replaces it with the first-line task error activity.
- A blocked task receives `Blocked because dependency <id> failed` based on the task graph already present in `run_started`.
- `run_finished` updates the header outcome and freezes the final summary while leaving all history visible.

Permission path:

- When TUI mode receives `permissions: "prompt"`, `resolvePermission` does not emit an interactive permission event.
- It emits task-scoped activity explaining that the request was cancelled because the cockpit is read-only.
- It returns ACP’s cancelled response.
- The existing engine stop/error handling marks the task and run according to current behavior.

Cancellation and recovery:

- `q`/`Ctrl+C` invokes the existing abort controller and destroys the renderer.
- ACP child termination remains unchanged.
- Resize events recompute layout only; transcript and task state are preserved.
- Unknown ACP update types become visible generic transcript entries instead of being silently dropped.

## Implementation Design

### Core Interfaces

```ts
export type TranscriptKind =
  | "message" | "thought" | "plan" | "tool"
  | "tool_update" | "activity" | "error" | "outcome" | "unknown"

export interface TranscriptEntry {
  id: string
  sequence: number
  kind: TranscriptKind
  label: string
  text: string
  sourceId?: string
  status?: string
  streaming?: boolean
}
```

```ts
export interface CockpitViewState {
  selectedTaskId: string | null
  focusedPane: "tasks" | "transcript"
  followingActiveTask: boolean
  helpOpen: boolean
}

export interface CockpitState extends CockpitViewState {
  transcripts: Readonly<Record<string, readonly TranscriptEntry[]>>
  taskReasons: Readonly<Record<string, string>>
}
```

```ts
export function applySessionUpdate(
  entries: readonly TranscriptEntry[],
  update: SessionUpdate,
  sequence: number,
): readonly TranscriptEntry[]

export function formatTaskReason(
  status: TaskStatus,
  activity: string | undefined,
  failedDependencyIds: readonly string[],
): string | undefined
```

Rules:

- `agent_message_chunk` merges by `messageId` when present.
- Thought chunks merge by message identity when available; otherwise they append.
- `tool_call` creates a tool entry keyed by `toolCallId`.
- `tool_call_update` merges into the existing tool entry; an update without a prior call creates a readable fallback entry.
- `plan` appends a chronological plan update rather than silently replacing prior plan history.
- Unknown update variants retain their `sessionUpdate` discriminator in a generic label.
- Task activity is split into meaningful lines and retained in order.
- Run-level activity and runtime-option outcomes are retained separately from task transcripts and rendered in the header/status summary.

### Data Models and Lifecycle

- History is owned by one `CockpitStore` instance and discarded when the cockpit closes.
- There is no disk persistence, packet mutation, cross-run cache, or telemetry.
- Per-task arrays are immutable from the consumer’s perspective; each event produces a new snapshot.
- Stable entry IDs must not depend only on array indexes.
- No retention cap is applied to task histories. OpenTUI’s `viewportCulling` limits rendered work, not retained history.
- The task list itself is scrollable so every task remains reachable when it exceeds viewport height.
- Manual selection sets `followingActiveTask` to `false`; selecting the current active task re-enables following.
- The transcript starts at the live tail for a newly selected task. Manual scrolling disables sticky follow until the user returns to `End`.

### Header and Responsive Layout

Header priority:

1. Task slug.
2. Plain-language phase/outcome.
3. Active task.
4. Task counts.
5. Provider/model.
6. Reasoning.
7. Speed.

For runtime options:

- `applied`: show the requested value as effective.
- `default`: show `auto` or `provider default`.
- `unsupported`: show the requested value with an `unsupported` label; never claim it was applied.

Layout behavior:

- At 120 columns and above, use the full two-column layout with expanded metadata.
- From 80–119 columns, retain two columns, wrap the header to two rows, and shorten task titles before hiding identity fields.
- Below 80 columns or 24 rows, use a compact stacked fallback that preserves slug, phase/outcome, active task, task status, and selected transcript context. This is below the supported KPI boundary and must show a compact-size notice if content cannot fit.
- Status uses symbols and text in addition to semantic colors.
- Light, dark, and reduced-color terminals must retain meaning.

### Keyboard and Focus

- `Tab` / `Shift+Tab`: switch between task and transcript panes.
- Task pane: arrows and `j`/`k` move selection; selected row is scrolled into view.
- Transcript pane: focused `ScrollBox` handles arrows, `PageUp`, `PageDown`, `Home`, and `End`.
- `?`: toggle help.
- `q` / `Ctrl+C`: preserve the terminal escape hatch.
- No key performs permission approval, retry, editing, reordering, or status mutation.

## External Interfaces

No new public CLI, network, storage, authentication, or configuration interface is introduced.

The existing ACP interface remains responsible for initialization and session creation, prompt and cancellation, file access, provider configuration options, and task execution.

The only ACP behavior change is the approved TUI-specific handling of `permissions: "prompt"`: return cancellation rather than exposing a permission UI. `approve-all`, `deny`, and `--no-ui` behavior remain unchanged.

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility/migration |
|---|---|---|---|---|
| Engine → event listener | Raw `RunEvent` stream | No change | Existing engine outcomes remain authoritative | Fully compatible |
| ACP client → event listener | Raw `SessionUpdate` events | TUI prompt requests become cancellation + activity notice | Existing stop/error path handles failure | Internal behavior explicitly approved |
| Store → App | `useSyncExternalStore` snapshot | Snapshot gains view/transcript fields | Invalid task selection falls back to active/first task | No external migration |
| App → renderer | OpenTUI React tree | Adds focused task/transcript controls and responsive branches | Compact fallback on small terminal | Same OpenTUI versions |
| CLI → `--no-ui` listener | Activity/status/run-finished console output | No change | Existing console behavior | Fully compatible |
| Packet/config files | Existing schemas | No change | Existing validation errors | No migration |

## Failure and Recovery Behavior

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| ACP permission request in TUI | `resolvePermission` sees `permissions: "prompt"` and TUI mode | Cancel request; display read-only reason; engine marks outcome | Configure permissions before rerun | Approved user decision; ACP permission contract |
| Provider spawn/connect/init failure | ACP client exception | Task failure reason appears in transcript and header | Existing engine failure path | `acp-client.ts` tests |
| Unsupported model/reasoning/speed | Existing `runtime_option` outcome | Header shows default/unsupported truthfully; task continues unless existing required-option error occurs | Existing configuration behavior | Runtime-option events |
| Unknown ACP update | Projection default branch | Generic labeled entry remains visible | No protocol change | Transcript unit test |
| Tool update before tool call | Missing `toolCallId` entry | Create fallback tool entry and merge later updates | No data loss | Transcript unit test |
| Task failure | Failed status + task activity | Status symbol, plain-language reason, full detail | Existing run stop behavior | Engine/store integration test |
| Blocked dependency | Blocked status + failed dependency set | Dependency-specific blocked reason | Existing dependency handling | Store test |
| User abort | Abort signal / child termination | Renderer closes; no cockpit action is sent | Existing cancellation behavior | ACP/engine regression |
| Resize or narrow terminal | OpenTUI resize event | Reflow or compact fallback; state remains intact | Resize back restores full layout | Renderer resize tests |
| Very long history | Synthetic high-volume stream | All entries retained; viewport culling limits render work | Future spill-to-disk remains out of scope | Memory spike evidence |

## Security and Privacy

- The cockpit is display-only except for navigation, scrolling, help, and terminal cancellation.
- Permission options are never rendered or selected.
- No new command execution, file mutation, retry, task edit, reorder, or status mutation path is introduced.
- ACP output may contain source code, paths, prompts, or provider-sensitive text; it remains in process memory and terminal output only.
- No transcript files, analytics, telemetry, or cross-run cache are added.
- Existing workspace-constrained ACP file operations remain unchanged.
- Provider errors are shown in the transcript but are not duplicated into new persistent logs.
- The permission path fails closed by cancelling rather than implicitly approving.

## Compatibility, Migration, and Rollback

- No configuration, packet, task-frontmatter, or event-schema migration is needed.
- Existing `--no-ui` execution remains supported.
- Existing providers remain selected through the current provider-launch mechanism.
- The feature requires the already-installed OpenTUI 0.4.5 and ACP SDK 1.2.1 ranges.
- Rollback consists of reverting the UI/store/projection changes and the TUI permission branch.
- No cleanup of persisted data is required because no new persistent data exists.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|
| `src/ui/transcript.ts` | New pure normalized transcript model and helpers | ACP variant coverage | Add exhaustive fixtures and generic fallback |
| `src/ui/store.ts` | Add per-task history, view state, selectors, actions, reasons | State complexity and follow confusion | Refactor with immutable snapshots and focused unit tests |
| `src/ui/App.tsx` | Replace global activity view with task/transcript panels, header, help, responsive modes | Layout regressions at small sizes | Add frame and keyboard tests |
| `src/acp-client.ts` | Cancel TUI prompt permissions and emit notice | Provider-specific cancellation differences | Add mocked ACP permission tests |
| `src/commands.ts` | Preserve existing mode wiring; remove assumptions about permission modal if needed | TUI/no-UI behavior drift | Add command integration regression |
| `src/events.ts` | No intended change | Accidental protocol expansion | Keep raw event union stable |
| `src/engine.ts` | No intended change | Hidden execution coupling | Run existing engine tests |
| `tests/store.test.ts` | Expand state/action coverage | Incomplete view-state assertions | Add selection, follow, reason, history tests |
| `tests/cockpit.test.tsx` | Expand renderer coverage | OpenTUI frame/focus flakiness | Add deterministic test-renderer fixtures |
| `tests/acp-client.test.ts` | Add permission cancellation and unknown-update cases | Mock mismatch with ACP SDK | Preserve existing mock agent style |
| `tests/transcript.test.ts` | New pure projection suite | Missing event variants | Cover all supported and fallback types |
| `README.md` | Update cockpit behavior and remove permission-modal claim | User documentation drift | Update after implementation |

## Testing and Evidence

### Unit Tests

- `applySessionUpdate` merges message chunks by `messageId`.
- Tool-call updates merge by `toolCallId` and preserve initial order.
- Thoughts, plans, activity, errors, outcomes, and unknown updates remain labeled.
- Different task IDs never share transcript entries.
- Histories longer than 250 entries remain complete.
- Task selection clamps at both ends and maps to the correct transcript.
- Active-task following stops after manual selection and resumes when selecting the active task.
- Blocked reasons identify failed dependencies.
- Failed status receives a fallback reason before detailed failure activity arrives.
- Runtime option outcomes display applied/default/unsupported truthfully.
- Permission events never create a selectable permission state in the cockpit.

### Integration Tests

- A mocked multi-task run produces independent histories and correct active/selected divergence.
- A mocked ACP permission request in TUI mode returns cancellation and emits the read-only activity notice.
- `--no-ui` retains its existing console event output and permission behavior.
- Engine failure and blocked dependency outcomes still produce the existing final result.
- A tool update received before its initial tool call remains visible and later merges correctly.

### End-to-End or Platform Evidence

- Renderer frames at 80×24, 120×40, and 200×60.
- Task navigation with arrows and `j`/`k`.
- Pane switching with `Tab` and `Shift+Tab`.
- Transcript line, page, start, and end scrolling.
- Live tail behavior before and after manual scroll.
- `?` help rendering and escape behavior.
- Light, dark, and reduced-color terminal output.
- Synthetic long-running transcript memory/render test.
- Manual TTY check with a provider that emits message, thought, plan, tool, tool-update, error, and completion events.

### Verification Gates

Focused:

```bash
bun test tests/transcript.test.ts tests/store.test.ts tests/cockpit.test.tsx tests/acp-client.test.ts
```

Repository gates:

```bash
bun run check
bun test
bun run build
bun run verify
```

No test result is considered evidence until the command exits successfully.

## Observability

- No external metrics, telemetry, or transcript persistence is added.
- The header exposes run phase/outcome, active task, counts, and effective runtime-option outcomes.
- The selected transcript exposes detailed event chronology and failure context.
- Read-only permission cancellation uses a stable, user-facing activity string suitable for tests and support diagnosis.
- No new logs should include credentials, environment secrets, or duplicated raw ACP payloads.

## Development Sequencing

1. Add transcript types, normalization rules, fallback labels, and pure unit tests. No dependencies.
2. Extend `CockpitStore` with per-task histories, selection/follow/focus/help state, reason derivation, and actions. Depends on step 1.
3. Implement task and transcript selectors, stable entry keys, and task-list/transcript `ScrollBox` behavior. Depends on step 2.
4. Implement the responsive header, two-column layout, semantic status presentation, footer, and help view. Depends on steps 2 and 3.
5. Change TUI permission handling to fail closed and add ACP integration coverage. Depends on step 2; can run in parallel with step 3.
6. Add renderer interaction tests, responsive frames, reduced-color checks, and long-history evidence. Depends on steps 4 and 5.
7. Run focused tests and the complete verification gate, then update README behavior documentation. Depends on step 6.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|
| PRD stable-ID gap | Approved PRD predates the current template’s stable-ID convention. | Future task generation must use the aliases consistently. | This matrix is the canonical alias map; packet owner verifies before `sf-create-tasks`. |
| Provider-specific ACP updates | ACP allows evolving/provider-specific update variants. | Some entries may use generic labels. | Every unrecognized update remains visible with its discriminator and test fixture. |
| In-memory history growth | Complete history is required and persistence is prohibited. | Long runs increase memory use. | Synthetic high-volume test records memory/render behavior; spill-to-disk requires a later PRD. |
| OpenTUI renderer behavior | Frame and focus behavior is version-sensitive. | Interaction tests may expose implementation-specific differences. | Validate against installed 0.4.5 test renderer before implementation sign-off. |
| Below-minimum terminal size | PRD guarantees 80×24, not smaller terminals. | Compact mode may omit secondary metadata. | Preserve slug, active task, phase/outcome, task status, and transcript context; show a size notice when necessary. |
| Permission prompt cancellation | Explicitly approved behavior differs from the current modal. | Prompt-configured runs may fail when an ACP tool requests permission. | Notice must be visible before the existing failure outcome; approve-all/deny remain unchanged. |

## Architecture Decision Records

- [ADR-001: Read-Only Progress Cockpit](adrs/adr-001-read-only-progress-cockpit.md) — establishes the observation-only master-detail boundary.
- [ADR-002: Guided Live Transcript Product Shape](adrs/adr-002-guided-live-transcript.md) — establishes the header, two-column layout, task following, and readable transcript.
- [ADR-003: Current-Seam Transcript Projection](adrs/adr-003-current-seam-transcript-projection.md) — records the selected implementation architecture.
