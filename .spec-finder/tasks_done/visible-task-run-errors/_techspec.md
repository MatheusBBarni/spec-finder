# Keep Task-Run Errors Visible in the ACP Cockpit — Technical Specification

## Executive Summary

Implement a default-on, failure-only review lifecycle for eligible interactive
Spec Finder runs. The command layer will own a new idempotent `CockpitSession`:
after a non-cancelled terminal failure it waits for the operator to dismiss the
cockpit, then restores the terminal and returns the original nonzero result.
The React UI requests dismissal or cancellation through callbacks and never
destroys the renderer itself.

The design applies to both `spec-finder run <slug>` and aggregate `--multiple`
batch results with `status: "failed"`. Batch `preflight_failed` has no started
task or surfaced task error, so it deliberately retains its current immediate
nonzero completion. Success, cancellation, `--no-ui`, and a missing stdin or
stdout TTY also remain immediate.

`CockpitStore` will retain the complete surfaced task activity message in a
separate in-memory field while preserving the compact summary reason used by the
live cockpit. This uses the current event sequence and adds no ACP, engine, or
runtime-event contract. The trade-off is a small internal session interface and
extra lifecycle testing in return for deterministic terminal ownership and
reviewable diagnostics.

## Technical Evidence

| Kind | Finding/constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository | Commands create a cockpit before running and unconditionally close it in `finally`; single and batch branches currently duplicate that pattern. | [`src/commands.ts`](../../../src/commands.ts) | inspected 2026-08-08 | Replace close-only handles with a shared command-owned session policy. |
| Repository | A failed engine task emits `task_status: failed`, then task activity containing the surfaced `Error.message`, then `run_finished`. | [`src/engine.ts`](../../../src/engine.ts) | inspected 2026-08-08 | Capture the full detail from existing activity rather than adding an event. |
| Repository | The store currently derives failed-task reasons with `firstMeaningfulLine`, and the summary applies `fit()` to them. | [`src/ui/store.ts`](../../../src/ui/store.ts), [`src/ui/App.tsx`](../../../src/ui/App.tsx) | inspected 2026-08-08 | Add an exact-detail projection and a word-wrapped review surface. |
| Repository | `BatchResult.status` distinguishes `failed`, `cancelled`, and `preflight_failed`; batches stop on the first failed packet. | [`src/batch.ts`](../../../src/batch.ts), [`src/events.ts`](../../../src/events.ts) | inspected 2026-08-08 | Retain only aggregate `failed`; the stopping packet still has the failing task event. |
| Official documentation | OpenTUI supports explicit renderer lifecycle cleanup and React `scrollbox` rendering/focus. | [OpenTUI lifecycle](https://opentui.com/docs/core-concepts/lifecycle/), [ScrollBox documentation](https://github.com/anomalyco/opentui/blob/main/packages/web/src/content/docs/components/scrollbox.mdx) | accessed 2026-08-08 | Renderer teardown stays explicit; full error content is scrollable rather than clipped. |
| User decision | Cancellation must be command-owned, full error data remains store-local, UI requires both terminal streams, and macOS PTY evidence is a release gate. | Technical clarifications | 2026-08-08 | Defines lifecycle ownership, data retention, eligibility, and verification strategy. |

## Requirement Traceability

| PRD ID | Technical obligation | Component/interface | Verification | Status/gap |
|---|---|---|---|---|
| G-01 | Retain every controlled eligible failure until explicit dismissal. | `CockpitSession.waitForDismissal()` in both command paths. | Command lifecycle tests and PTY smoke. | Covered |
| G-02 | Present task identity, exact surfaced error, outcome/counts, and next step together. | `taskFailureDetails`, failure review summary. | Store and rendered-frame tests. | Covered |
| G-03 | Keep success, cancellation, and non-UI completion immediate. | Eligibility helper and outcome policy. | Command matrix tests. | Covered |
| G-04 | Ship default-on only with terminal-path and manual evidence. | `verify`, `test:pty`, release checklist. | Gate commands and manual smoke record. | Covered |
| US-01 | Failed final screen persists until Esc, Q, or Ctrl+C. | UI `onDismiss` callback and session deferred promise. | Component and command tests. | Covered |
| US-02 | Complete surfaced error is readable with its failed task and result. | Word-wrapped focused `scrollbox`; exact detail selector. | Short and multiline frame fixtures. | Covered |
| US-03 | One consistent generic hint is shown. | Static review-screen copy. | Frame assertion. | Covered |
| US-04 | `--no-ui` fails nonzero without waiting. | `isInteractiveRun` and existing console listener. | Injected non-UI command test. | Covered |
| US-05 | Success and cancellation do not acquire a review state. | Result/status guard plus command-owned abort. | Success and cancellation command tests. | Covered |
| F-01 | Failure-only review with failed—not success-oriented—labeling. | `RunSummary` review branch. | Frame and lifecycle tests. | Covered |
| F-02 | Show failed task ID, complete error, and final outcome/counts without color-only meaning. | Failure panels and textual outcome labels. | Multiline frame and accessibility assertions. | Covered |
| F-03 | Use exactly one generic, non-remediation hint. | `Resolve the listed error, then rerun the task packet.` | String assertion in retained-failure frames. | Covered |
| F-04 | Final-state keys dismiss; active-state keys cancel; cleanup follows correct path. | `App` callbacks and `CockpitSession.close()`. | Keyboard and fake-session tests. | Covered |
| Constraint: default-on interactive behavior | No feature flag; both supported eligible run modes use review by default. | `runSingleCommand`, `runBatchCommand`. | Default command tests. | Covered |
| Constraint: unchanged normal behavior | No wait for success, cancel, preflight failure, or ineligible streams. | Outcome/eligibility matrix. | Command matrix tests. | Covered |
| Constraint: exact message without raw payloads/stacks | Store only the emitted message string; do not add event fields or persistence. | `CockpitStore`. | Store regression tests and review inspection. | Covered |
| Constraint: no workflow controls | Review UI exposes only reading, scrolling, and dismissal. | `App` review branch. | Frame and keyboard tests. | Covered |
| Constraint: outcome remains authoritative | Return existing runner/batch exit semantics after review. | Command result guards. | Exit-code tests. | Covered |
| M-01 | Controlled interactive failures remain visible 100% of the time. | Deferred dismissal behavior. | Command and PTY evidence. | Covered |
| M-02 | Short and multiline diagnostic fixtures are complete before dismissal. | Exact detail plus scrollbox. | Rendered-frame tests. | Covered |
| M-03 | Every controlled terminal outcome follows its defined exit behavior. | Outcome matrix. | Command tests and manual terminal smoke. | Covered |
| M-04 | Every retained failure has the same guidance. | Static hint in review branch. | Frame test. | Covered |

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs/outputs | Dependencies |
|---|---|---|---|---|
| Command lifecycle | Existing, changed | Decide eligibility, start/close session, await only reviewable failures, preserve exit code. | CLI args, stdin/stdout, runner result → process result. | `CockpitSession`, engine/batch runner. |
| `CockpitSession` | New internal interface | Own deferred dismissal and idempotent renderer teardown. | Store + cancel callback → `close`, `waitForDismissal`. | OpenTUI renderer/root. |
| `App` review branch | Existing, changed | Render accessible final failure diagnostics; request dismiss or active-run cancellation. | Cockpit state + callbacks → terminal UI. | OpenTUI React, store selectors. |
| `CockpitStore` | Existing, changed | Maintain compact reasons and complete in-memory failure detail, including qualified batch keys. | Existing `RunEvent` stream → immutable state snapshots. | Existing event types. |
| Engine and batch coordinator | Existing, unchanged | Produce task/batch outcomes and current task activity. | ACP/provider results → `RunEvent`, `RunResult`/`BatchResult`. | No new dependency. |
| Console listener | Existing, unchanged | Preserve immediate no-UI diagnostic output. | Events → stdout. | Writable stdout. |
| PTY fixture | New test-only | Exercise real terminal setup, rendering, dismissal, and nonzero exit deterministically. | Fake runner events → PTY transcript/exit. | Bun, `/usr/bin/script`, `/usr/bin/expect`. |

### Data and Control Flow

1. `runCommand` selects its single or batch branch. Each branch computes UI
   eligibility from `--no-ui`, `options.noUi === true`, `stdin.isTTY`, and
   `stdout.isTTY`. Both streams must be TTYs before the UI may start.
2. An eligible branch creates a `CockpitStore`, starts a `CockpitSession`, and
   passes the store listener to its existing runner. Ineligible branches keep
   the existing console listener and never create a session.
3. Existing task events update the store. Once a task is failed, its next
   non-empty task activity is saved verbatim as that task's full failure detail;
   the compact first-line reason remains available for live views.
4. The runner settles. A single `RunResult` with `ok: false`, or a `BatchResult`
   with `status: "failed"`, causes an eligible, non-aborted command to await
   `waitForDismissal()`. The final review renders the stored detail and outcome.
5. Esc, Q, or Ctrl+C on the settled review resolves dismissal. The command then
   exits with its original nonzero status and `finally` closes the renderer.
6. Q or Ctrl+C during an active run invokes the command callback, aborts the
   controller, and closes the session immediately. A later failed-looking
   runner result does not re-enter review because the signal is aborted.
7. Successful, cancelled, `preflight_failed`, non-UI, non-TTY, and unexpected
   thrown-error paths do not wait. Any created session is still closed in
   `finally`.

## Implementation Design

### Core Interfaces

```ts
export interface CockpitSession {
  /** Idempotently restore the renderer and unblock any current waiter. */
  close(): void
  /** Resolves only on review dismissal or session closure. */
  waitForDismissal(): Promise<void>
}

export async function startCockpit(
  store: CockpitStore,
  onCancel: () => void,
): Promise<CockpitSession>
```

```ts
export interface RunCommandOptions {
  input?: Pick<NodeJS.ReadStream, "isTTY">
  output?: Writable & { isTTY?: boolean }
  startCockpit?: typeof startCockpit
  noUi?: boolean
  runTaskPacket?: (options: RunOptions) => Promise<RunResult>
  runBatch?: (options: BatchRunOptions) => Promise<BatchResult>
}
```

```ts
function isInteractiveRun(
  args: readonly string[],
  input: Pick<NodeJS.ReadStream, "isTTY">,
  output: { isTTY?: boolean },
  noUi?: boolean,
): boolean {
  return noUi !== true
    && !args.includes("--no-ui")
    && input.isTTY === true
    && output.isTTY === true
}
```

### Data Models and Lifecycle

Add the following field to `CockpitState` and every initialization/reset path:

```ts
readonly taskFailureDetails: Readonly<Record<string, string>>
```

- Ownership: `CockpitStore`; it is observable only through immutable state
  snapshots and a new `selectTaskFailureDetail(state, taskId)` selector.
- Keying: use the existing transcript/task-reason key. Batch keys stay packet
  qualified, preventing equal task IDs in different packets from colliding.
- Capture: `consumeTaskActivity` writes `message.trim()` to this field only
  when the identified task is already `failed`. It does not reduce the message
  to a line and does not synthesize a stack trace or ACP payload.
- Reset: clear at a new single run, `batch_started`, and
  `batch_packet_started`; remove an individual detail when that task resumes
  or completes.
- Consistency: the engine's current failure-status-then-activity sequence
  supplies the exact diagnostic before the terminal result. If a malformed
  event stream omits that activity, the review explicitly says no surfaced
  error was received rather than fabricating an error detail.
- Retention: memory only for the process/session lifetime; renderer close drops
  the state. There is no disk, telemetry, export, or migration work.

### External Interfaces

The CLI command syntax and event protocol stay compatible. Only terminal
completion timing changes for eligible interactive failure results.

| Invocation/outcome | UI policy | Result compatibility |
|---|---|---|
| `run <slug>` with failure and both TTYs | Retain until dismissal. | Original `1` after dismissal. |
| `run --multiple ...` with batch `failed` and both TTYs | Retain until dismissal. | Original batch `1` after dismissal. |
| `--no-ui`, non-TTY stdin, or non-TTY stdout | No cockpit or wait. | Existing console output and exit code. |
| Success, cancellation, or batch `preflight_failed` | No retained review. | Existing immediate completion. |

`noUi: false` is no longer a test-only bypass for missing TTYs. Tests that need
the UI must inject both TTY-capable streams, matching production safety.

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility/migration |
|---|---|---|---|---|
| `src/commands.ts` → cockpit | `startCockpit` returns `{ close }`; output TTY alone selects UI. | Use `CockpitSession`; require input and output TTY; share review logic across both branches. | Cancellation closes immediately; review waits only on selected failures. | Internal TypeScript interface; update fakes. |
| `src/ui/cockpit.tsx` → `App` | App receives only `onCancel`; cockpit returns close handle. | Cockpit supplies internal `onDismiss`; session owns deferred promise. | `close` is idempotent and resolves waiter. | No external protocol change. |
| `src/ui/App.tsx` → renderer | App destroys renderer on Q/Ctrl+C. | App requests cancellation or dismissal only. | Settled keys dismiss; live keys cancel. | Preserves active-run key semantics. |
| `src/ui/store.ts` → events | Failed activity becomes a compact reason. | Store exact `taskFailureDetails` alongside current reason. | Missing detail is displayed as an explicit event-integrity condition. | No event-type expansion. |
| `src/batch.ts` / `src/events.ts` | Aggregate status and stopping packet already emitted. | Consume existing `status: "failed"` and qualified task events only. | `cancelled`/`preflight_failed` do not wait. | Do not alter task-owned batch orchestration. |
| Console output | No-UI listener writes activity, status, final outcome. | No change. | Always immediate. | Automation-safe. |

## Failure and Recovery Behavior

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| Single task failure | `result.ok === false` and signal not aborted. | Full review remains until dismissal, then exit `1`. | Resolve listed error and rerun packet. | Command and PTY tests. |
| Aggregate batch failure | `result.status === "failed"` and signal not aborted. | Show stopping packet context, task detail, aggregate counts; await dismissal. | Resolve listed error and rerun affected packet/batch. | Batch lifecycle tests. |
| Active cancellation | Command callback aborts controller. | Close renderer immediately; do not wait if runner later settles false. | Rerun when ready. | Keyboard/lifecycle tests. |
| Batch preflight failure | `result.status === "preflight_failed"`. | Immediate close and nonzero result; no task-detail review. | Correct packet/config issue and rerun. | Batch command test. |
| Non-UI/ineligible terminal | Flag or either non-TTY stream. | Existing console diagnostics and immediate exit. | Use terminal output to resolve and rerun. | Non-UI matrix tests. |
| Missing task activity after failure | Store has failed task but no detail at final result. | Visible explicit absence notice; never invent raw data. | Treat as an event-sequence regression. | Store negative test. |
| Renderer startup/runner exception | Promise rejects before normal terminal result. | `finally` closes a created session; error propagates. | Existing command error handling/rollback. | Exception lifecycle test. |

## Security and Privacy

- The terminal operator and existing event producer are the relevant trust
  boundary. The UI displays the same surfaced `Error.message` already intended
  for operator-facing activity; it never accepts arbitrary external input as a
  new protocol.
- Exact details are intentionally local and ephemeral. Do not persist, export,
  log additionally, or emit analytics for them.
- Do not render `Error.stack`, raw ACP messages, provider request/response
  payloads, credentials, or new debugging objects.
- Error text is rendered as OpenTUI text content, not used as a terminal command
  or control path. The existing error message remains authoritative.
- No new permission, retry, remediation, task-editing, or workflow control is
  introduced. Dismissal is the only final-screen action.

## Compatibility, Migration, and Rollback

- The behavior is default-on in the next release for eligible interactive
  single and batch failures. There is no feature flag, schema, or configuration
  migration.
- `--no-ui` remains the explicit automation-compatible path. Requiring both
  TTY streams prevents an unreadable retained screen in redirected/piped runs.
- Successful, cancelled, and preflight-failed outcomes retain immediate terminal
  cleanup. Existing console output and exit codes are unchanged.
- The changed `startCockpit` return type and `RunCommandOptions.input` are
  internal source contracts. Update first-party test fakes in the same change.
- Rollback is an ordinary code/release rollback. No user state or stored data
  requires migration or cleanup.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|
| `src/commands.ts` | Shared session lifecycle and two-stream terminal eligibility. | High: can hang or alter exit timing. | Add outcome guard, idempotent close, and injected stdin tests. |
| `src/ui/cockpit.tsx` | New session/deferred lifecycle. | High: renderer cleanup correctness. | Centralize exactly-once dismissal/close. |
| `src/ui/App.tsx` | Distinct failure review, scrollable diagnostics, revised keyboard behavior. | Medium: accessibility and keyboard regressions. | Avoid direct destroy; test frames and all dismissal keys. |
| `src/ui/store.ts` | Exact error-detail state plus selector/reset logic. | Medium: stale or incorrectly qualified details. | Test single, multiline, reset, and batch qualification. |
| `src/batch.ts`, `src/events.ts` | Existing integration dependency only. | Medium: concurrent task ownership. | Consume contracts; do not overwrite orchestration/event work. |
| `tests/commands.test.ts` | Deterministic lifecycle matrix. | High: false confidence if fake session is weak. | Use controllable pending dismissal and close counts. |
| `tests/cockpit.test.tsx` | Failure-review frames and keyboard callback behavior. | Medium: frame brittleness. | Assert stable labels/content rather than colors alone. |
| `tests/store.test.ts` | Detail capture/reset/qualification behavior. | Low. | Add event-order and missing-detail fixtures. |
| PTY fixture and package script | Real terminal release evidence. | Medium: macOS tool availability. | Fail clearly if `/usr/bin/script` or `/usr/bin/expect` is unavailable. |

## Testing and Evidence

### Unit Tests

- `CockpitStore` captures a complete short and multiline error only after the
  corresponding failed status, retains a compact reason independently, clears
  details on run/packet reset, and uses qualified batch keys.
- The store exposes the explicit missing-detail state when the expected failure
  activity event is absent.
- `App` frame tests show `Run failed`, failed task ID, full multiline detail,
  textual outcome/counts, the exact generic hint, and non-color labels.
- Keyboard tests prove Esc, Q, and Ctrl+C invoke dismissal on a settled failure
  without destroying the renderer; Q/Ctrl+C during an active run invoke cancel.

### Integration Tests

- An injected TTY single-run failure stays pending until the fake session is
  dismissed, returns `1`, and closes once.
- A batch result with `status: "failed"` has the same lifecycle and preserves
  its existing batch exit code.
- Success, cancellation, `preflight_failed`, `--no-ui`, stdin non-TTY, stdout
  non-TTY, and thrown runner errors never wait for dismissal.
- Console-mode failures retain activity, final outcome, and nonzero return
  without starting a cockpit.
- Repeated cancellation, dismissal, and `finally` close calls remain harmless.

### End-to-End or Platform Evidence

- Add a deterministic Bun fixture that calls `runCommand` with a fake runner,
  emits a multiline failed-task event sequence, and uses the real `startCockpit`.
- Add `bun run test:pty`, driven by macOS `/usr/bin/script` and `/usr/bin/expect`.
  It verifies the real terminal frame contains the failure label, task ID, full
  fixture message, and generic hint; sends Esc; then verifies exit `1`.
- Manual release smoke in a real terminal verifies retained review and restored
  terminal state for one single failure and one batch failure, plus immediate
  `--no-ui` completion.

### Verification Gates

```sh
rtk bun test tests/store.test.ts tests/cockpit.test.tsx tests/commands.test.ts
rtk bun run verify
rtk bun run test:pty
```

The first two gates are required on every implementation verification. The PTY
gate and manual smoke are required release evidence on macOS; do not claim the
default-on release bar is met without both.

## Observability

- No telemetry, analytics, persistence, or new runtime event is introduced.
- Existing console events remain the non-interactive diagnostic channel.
- Test failures identify lifecycle state directly: unexpected session start,
  early close, unresolved wait, changed exit code, or missing rendered detail.
- The review UI provides operator-visible context—the task ID, packet context
  for batch, final counts, exact surfaced error, and fixed recovery hint—without
  adding sensitive data collection.

## Development Sequencing

1. Confirm the batch command work is present in the integration target and
   preserve its task-owned orchestration/event behavior before editing shared
   command lifecycle code.
2. Introduce `CockpitSession` in `src/ui/cockpit.tsx`, including an idempotent
   close and deferred dismissal; update `App` to request rather than perform
   teardown.
3. Add shared two-stream eligibility and outcome-aware waiting to single and
   batch command branches; update internal test injection types.
4. Add full failure-detail storage, selector, resets, and failure-review
   rendering with a focused scrollbox and compact-terminal behavior.
5. Add unit, component, and command lifecycle coverage using deterministic
   fake sessions and runners.
6. Add the PTY fixture/script, run all verification gates, and collect the
   manual terminal smoke evidence required for default-on release.

Steps 2 and 4 can begin in parallel once their small callback/data contracts are
agreed; step 3 depends on step 2; steps 5 and 6 depend on the completed paths.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|
| Retained screen waits in automation | Current UI check considers stdout but input may be unavailable. | Hung pipes or CI jobs. | Both-stream gate and non-TTY tests; implementation owner. |
| Cancellation races terminal failure | A runner may settle false after abort. | Accidental review after an operator cancels. | Signal guard plus close-on-cancel test; implementation owner. |
| Long error exceeds terminal viewport | PRD requires complete multiline readability. | Diagnostic could appear clipped. | Focused scrollbox and PTY/manual evidence; implementation owner. |
| Batch code is concurrently task-owned | `runBatchCommand` and batch events are uncommitted integration work. | Conflicting edits or wrong assumptions. | Integrate after its owning task is complete; task planner/implementation owner. |
| Exact error includes sensitive workspace/provider context | PRD intentionally requests surfaced message. | More context visible than compact summary. | Local-only rendering, no stack/raw payload/persistence; release owner review. |
| Generic hint may be insufficient later | PRD research has no recovery-usability data. | Operator confusion for recurring failure classes. | Gather qualitative feedback; product owner decides any later category guidance. |

All current implementation decisions are resolved. Later-phase product questions
about category-specific guidance, localization, and feedback channels remain out
of scope and do not block task decomposition.

## Architecture Decision Records

- [ADR-001: Failure-Only Cockpit Diagnostics](adrs/adr-001-failure-only-cockpit-diagnostics.md) — failure diagnostics are retained only for failed runs.
- [ADR-002: Default-On Failure Review With Generic Recovery Guidance](adrs/adr-002-default-on-failure-review.md) — default-on rollout and fixed recovery guidance.
- [ADR-003: Command-Owned Retained Failure-Review Lifecycle](adrs/adr-003-command-owned-retained-failure-review-lifecycle.md) — commands own session waiting, cancellation, and teardown; UI only requests actions.
