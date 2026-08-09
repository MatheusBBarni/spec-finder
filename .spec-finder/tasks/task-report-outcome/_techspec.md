# Task-Report Outcomes Technical Specification

## Executive Summary

Implement the approved narrow, additive report-presentation seam for issue #6.
The engine will label each ACP update with its authoritative turn phase and
will attach a report reference only after it has validated the completed report
artifact. The cockpit will suppress report-session metadata, retain a safe
bounded fallback for other unknown updates, and render a text-labelled outcome
with a relative report reference when one is safe.

The design preserves the existing engine authority for task status, ACP v1
protocol use, no-UI output behavior, implementation-failure behavior, and
batch task qualification. Its primary trade-off is a small cross-layer event
contract change in exchange for a reliable phase boundary and a report path the
UI does not have to infer. There is no approved traceability gap.

## Technical Evidence

| Kind | Finding/constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository | A report turn follows only successful implementation; completion follows successful stop and `assertReport`. | [`src/engine.ts`](../../../src/engine.ts) | 2026-08-08 | The engine alone issues completed/failed status and any report reference. |
| Repository | ACP updates contain no turn phase and unrecognized updates become unbounded JSON. | [`src/events.ts`](../../../src/events.ts), [`src/acp-client.ts`](../../../src/acp-client.ts), [`src/ui/transcript.ts`](../../../src/ui/transcript.ts) | 2026-08-08 | Carry an additive phase and establish a bounded presentation boundary. |
| Repository | The test provider reuses `test-session` across sessions. | [`tests/fixtures/mock-agent.ts`](../../../tests/fixtures/mock-agent.ts) | 2026-08-08 | Do not use session ID as phase identity. |
| Repository | Batch state uses packet-qualified task keys; no-UI ignores `session_update`. | [`src/ui/store.ts`](../../../src/ui/store.ts), [`src/batch.ts`](../../../src/batch.ts), [`src/commands.ts`](../../../src/commands.ts) | 2026-08-08 | Preserve existing active-packet fencing and no-UI behavior. |
| Official docs | `session_info_update` is optional ACP v1 session metadata, not a task outcome. | [ACP Session Info Update](https://agentclientprotocol.com/rfds/session-info-update) | SDK 1.2.1 / protocol v1 | Never use title, `_meta`, or metadata prose as outcome authority. |
| Official docs | ACP v2 is a draft with a different prompt lifecycle. | [ACP v1 overview](https://agentclientprotocol.com/protocol/v1/overview), [ACP v2 draft](https://agentclientprotocol.com/announcements/acp-v2-draft) | 2026-08-08 | Remain on the installed v1 SDK; do not introduce v2 lifecycle rules. |
| Official docs | OpenTUI React supports deterministic test rendering and frame capture. | [OpenTUI React testing](https://opentui.com/docs/bindings/react/) | OpenTUI 0.4.5 | Use rendered terminal-frame acceptance tests. |
| User decision | Selected the additive phase/reference contract, safe fallback, deterministic fixture, and narrow approach. | TechSpec clarification turns | 2026-08-08 | No new event hierarchy, live-provider release gate, or broad lifecycle framework. |

## Requirement Traceability

| PRD ID | Technical obligation | Component/interface | Verification | Status/gap |
|---|---|---|---|---|
| G-01 | Preserve one concise report-running signal and emit an explicit terminal outcome. | `engine.ts`, `store.ts`, `App.tsx` | Engine/store/frame scenarios for running, completed, and failed report turns. | Covered. |
| G-02 | Prevent raw report prompt, metadata, and absolute path rendering. | `events.ts`, `acp-client.ts`, `transcript.ts`, `store.ts` | Adversarial report-session-info fixture and rendered-frame absence assertions. | Covered. |
| G-03 | Supply a concise safe reason and only a validated relative reference. | `engine.ts`, `paths.ts` helper, `store.ts`, `App.tsx` | Valid, unavailable, traversal, absolute, and symlink-containment cases. | Covered. |
| G-04 | Keep implementation failures and no-UI behavior unchanged. | `engine.ts`, `commands.ts`, `store.ts` | Existing implementation-failure and command tests plus focused regression cases. | Covered. |
| US-01 / F-01 | Show final-report activity after successful implementation and engine-owned outcome after report validation. | Existing report-start activity; `task_status` projection | Engine event ordering and cockpit frame. | Covered. |
| US-02 / F-02 | Report failure never claims completion and has a concise recovery reason. | `engine.ts`, task status/activity projection | Refusal, cancellation, missing/incomplete report cases. | Covered. |
| US-03 / F-03 | Display an actionable workspace-relative reference only when safe. | `task_status.reportReference`, completed task presentation | Engine path tests, store display-safety tests, cockpit frame. | Covered. |
| US-04 / F-04 | Retain a readable bounded control-safe fallback for unrelated unknown updates. | `transcript.ts` | Unknown update fixture with paths, controls, `_meta`, and oversized payload. | Covered. |
| US-05 | Preserve pre-report implementation failure. | `engine.ts`, `store.ts` | Existing failed implementation/permission test. | Covered. |
| F-05 | Pair status meaning with text, not color alone. | Existing `TranscriptRow`/summary presentation | Reduced-color cockpit frame assertions. | Covered. |
| M-01 | Zero raw metadata exposures in recognized report cases. | Report metadata projection | Negative transcript/frame assertions every verification run. | Covered. |
| M-02 | All recognized report scenarios show lifecycle and outcome. | Engine/store/cockpit scenarios | Scenario matrix in focused suite. | Covered. |
| M-03 | Outcome matches validated lifecycle, never provider metadata/prose. | Engine status emission | Success/refusal/missing-report scenarios. | Covered. |
| M-04 | Valid references are relative; unsafe/unavailable ones are absent. | Canonical path/reference helper | Path validation and frame absence tests. | Covered. |
| M-05 | Running/completed/failed status remains text-labelled. | `App.tsx` | Captured normal and reduced-color frames. | Covered. |
| High-level constraints | No ACP upgrade/config change, no new no-UI feature, controls, persistence, telemetry, or broad redesign. | All affected modules | Diff review and full gate. | Covered. |
| Non-goals | No generalized lifecycle model, inferred report-blocked state, or unified failure flow. | Event/status design | Type and behavior review. | Covered. |

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs/outputs | Dependencies |
|---|---|---|---|---|
| `src/events.ts` | Existing, extended | Define internal run event contract. | Optional `phase` on session updates; optional `reportReference` on task status. | ACP SDK `SessionUpdate`, `TaskStatus`. |
| `src/acp-client.ts` | Existing, extended | Forward each ACP update with engine-provided turn phase. | Required `AcpTurnOptions.phase` → `RunEvent.session_update.phase`. | ACP SDK v1.2.1. |
| `src/engine.ts` | Existing, extended | Run turns, validate report artifact, issue authoritative status/reference. | Root, packet, report path → validated status/reference. | `runAcpTurn`, Node filesystem/path APIs. |
| `src/paths.ts` or a small engine-local helper | Existing/new helper only | Canonical containment and safe relative report-reference conversion. | Root + report path → `string | undefined`. | `realpath`, `relative`, `isAbsolute`. |
| `src/ui/transcript.ts` | Existing, extended | Project trusted presentation entries from session updates. | Update + phase → transcript entries. | Existing transcript utilities only. |
| `src/ui/store.ts` | Existing, extended | Preserve per-task reference and task/batch scoping. | Status/reference + phased update → immutable state. | Existing selectors/qualification. |
| `src/ui/App.tsx` | Existing, extended | Render completed reference in transcript and terminal summary. | Cockpit state → text-labelled terminal UI. | OpenTUI React. |
| Tests and mock agent | Existing, extended | Provide deterministic end-to-end malicious metadata and failure inputs. | Environment-controlled fixture → events/frame assertions. | Bun, ACP SDK, OpenTUI test utilities. |

### Data and Control Flow

1. `runTaskPacket` calls `runAcpTurn` for implementation with phase
   `"implementation"`.
2. After a successful implementation stop, the engine emits its existing
   report-start activity, then calls `runAcpTurn` with phase `"report"`.
3. `runAcpTurn` copies the required option onto every `session_update`; this is
   local Spec Finder event data, not an ACP wire-protocol field.
4. The store passes update, session ID, and phase to `applySessionUpdate` while
   retaining its existing active-packet task-key qualification.
5. Report `session_info_update` produces no transcript entry. Implementation or
   phase-missing session-info produces a fixed payload-free label; other
   unrecognized updates use the safe fallback.
6. After report stop and `assertReport` succeed, the engine performs canonical
   reference validation. It emits `task_status: completed` with
   `reportReference` only if that validation succeeds.
7. Store accepts an already-safe-looking relative reference as defense in depth,
   attaches it to the completed task, and App renders it in the outcome and
   terminal summary. Missing references do not render a placeholder.
8. Report failure stays a failed task. The interactive store derives a concise
   safe display reason from existing task activity; no provider title, stderr,
   report prose, or raw absolute validation path can become the cockpit failure
   reason. Engine activity emission and no-UI output are unchanged.

Cancellation follows existing abort/child-cleanup behavior. Dependency blocking
remains pre-execution engine behavior. A provider’s report prose saying
`blocked` cannot change current `completed` or `failed` state.

## Implementation Design

### Core Interfaces

`src/events.ts` defines the additive local contract. Existing producers and
consumers that do not use the fields remain valid. `phase` is optional on the
event only for compatibility with preexisting test/adaptor construction; the
ACP-turn API is strict so new runtime code cannot omit it.

```ts
export type AcpTurnPhase = "implementation" | "report"

export type RunEvent =
  | {
      type: "session_update"
      taskId: string
      sessionId: string
      phase?: AcpTurnPhase
      update: SessionUpdate
    }
  | {
      type: "task_status"
      taskId: string
      status: TaskStatus
      reportReference?: string
    }
  // every existing variant remains unchanged
```

```ts
export interface AcpTurnOptions {
  root: string
  config: SpecFinderConfig
  prompt: string
  taskId: string
  phase: AcpTurnPhase
  signal: AbortSignal
  emit: RunEventListener
  interactivePermissions: boolean
}
```

`runAcpTurn` must emit `phase: options.phase` with every session update. It
does not infer phase from `sessionId`, prompt text, title, `_meta`, stop reason,
or activity wording.

The engine helper has a failure-omitting interface:

```ts
async function safeReportReference(
  root: string,
  reportPath: string,
): Promise<string | undefined> {
  // Resolve both paths, reject external/traversal/control results,
  // normalize a workspace-relative reference, or return undefined.
}
```

It runs only after `assertReport`. A validation failure must not fail an
otherwise validated task; it only omits the optional reference. The engine
emits `reportReference` only together with a completed status.

### Data Models and Lifecycle

- `AcpTurnPhase` exists only for a live run event; it is neither persisted nor
  sent back to the ACP provider.
- Add optional `reportReference?: string` to `CockpitTask`. Store assigns it
  only on completed status after a display-safety check. It is cleared when a
  task snapshot is replaced for a new packet.
- App receives the reference through existing immutable store snapshots and
  displays `Report: <reference>` beneath `Task completed` and in the terminal
  summary for completed tasks that have one.
- The batch view continues to own only active packet detail. The change must
  not add cross-packet report-history persistence or alter packet summaries.
- No database, packet markdown, config, migration, retention rule, cache, or
  telemetry is introduced.

### External Interfaces

ACP stays at local `@agentclientprotocol/sdk` 1.2.1 / protocol v1:

- The client keeps its existing `initialize`, session, prompt, cancellation,
  permission, and filesystem request behavior.
- `session_info_update` remains provider-issued metadata. Its optional title,
  timestamp, and `_meta` are not trusted display or outcome fields.
- ACP v1 parser behavior may reject unknown wire discriminators. The fallback
  is retained for adapter/test-level unknown values and future supported
  extensions; this issue must not claim generic wire-forward compatibility.
- No authentication, authorization, retry, idempotency, provider launch, or
  ACP configuration changes are required.

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility/migration |
|---|---|---|---|---|
| Engine → ACP adapter | Turn has task ID, prompt, signal. | Required local phase argument. | Compile-time failure for omitted runtime phase. | Internal TypeScript-only change. |
| ACP adapter → event listener | Raw session update with task/session IDs. | Add optional phase. | Missing phase fails closed for session-info payloads. | Legacy event literals still type-check. |
| Engine → store | Status only. | Completed status may include validated reference. | Unsafe/absent value omitted. | Consumers can ignore optional field. |
| Store → transcript | Update/session ID. | Pass phase. | Report metadata dropped; other unknowns safe-formatted. | Existing known transcript forms unchanged. |
| Store → App | Task status/reason/transcript. | Optional task reference. | No placeholder on absence. | Existing layout/state semantics retained. |
| Batch adapter → store | Nested events and qualified task IDs. | Forwards additive fields unchanged. | Inactive/unqualified event fence remains. | No packet schema change. |
| Commands no-UI listener | Ignores session updates. | No consumer change. | Continues current console lifecycle. | No new no-UI reference surface. |

## Failure and Recovery Behavior

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| Provider sends report session-info containing prompt/path | `phase === "report"` and discriminator match. | Drop update; no raw entry. | Engine activity/status remains authoritative. | Transcript/frame fixture. |
| Session-info phase missing/invalid | No recognized phase. | Fixed payload-free metadata entry, never raw fallback. | Event producer can be corrected independently. | Transcript compatibility test. |
| Unrelated unknown update contains controls/path/large payload | Safe formatter. | Label plus redacted, neutralized, capped text. | Keep diagnosis without unsafe content. | Adversarial transcript test. |
| Report stop is refusal/cancelled/max tokens | Existing stop validation. | Failed task and concise report-specific reason; no reference. | Rerun existing task workflow. | Engine/provider fixture. |
| Report absent, incomplete, outside root, or symlink-resolved outside root | Existing assertion then canonical reference validation. | Fail for absent/incomplete report; omit reference when only safe-reference proof fails. | Inspect/recreate report; no state migration. | Engine path tests. |
| Provider error during report | Existing engine activity plus interactive display formatter. | Safe concise cockpit reason, without raw exception/path; no-UI activity stays unchanged. | Existing rerun workflow. | Engine/store test. |
| Implementation failure | Existing implementation error path. | No report turn; current failed-task behavior. | Existing recovery. | Existing regression test. |
| Dependency failure | Existing dependency scan. | Existing blocked task behavior. | Resolve dependency. | Existing regression test. |
| Late event from inactive batch packet | Existing `localTaskId` qualification. | Ignore event. | No state mutation. | Existing batch test. |

## Security and Privacy

- Treat all provider-controlled session metadata, report prose, and provider
  diagnostic text as untrusted. They cannot establish completion, failure,
  blocked state, or report location.
- Report session-info is a fail-closed suppression case. The cockpit must not
  serialize its title, timestamp, `_meta`, arbitrary keys, raw prompt, or path.
- The generic fallback excludes `_meta`, walks values deterministically,
  neutralizes C0/DEL/escape controls, redacts common absolute POSIX,
  drive-letter, and UNC path substrings, and truncates after 1,024 display
  characters with a visible truncation marker.
- Apply the same narrow path/control/length formatter to interactive task
  activity before it becomes a cockpit error reason. This preserves existing
  engine activity and no-UI behavior while protecting the cockpit from the
  report-validation error's absolute path.
- Canonical reference validation uses `realpath` on root and target before
  `relative`; reject empty, absolute, traversal, or control-containing results.
  Store repeats syntactic display validation before rendering.
- Do not log, persist, or add telemetry for raw metadata. Existing user-granted
  permission behavior and read-only cockpit policy remain unchanged.
- This is a targeted display boundary, not a general secret-scanning or
  cross-phase sanitization framework.

## Compatibility, Migration, and Rollback

- New RunEvent fields are additive and optional at the event boundary. Existing
  listeners, batch forwarding, and synthetic test literals need no migration.
- `AcpTurnOptions.phase` is deliberately required to make every new runtime turn
  explicit. Update all in-repository calls in the same change.
- No config, task packet, report format, persisted state, or ACP negotiated
  schema changes occur.
- No rollout flag or live-provider prerequisite is required. The release gate
  is the full automated acceptance suite.
- Rollback removes phase/reference fields and UI projection branches; it does
  not require cleanup or data conversion.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|
| `src/events.ts` | Add phase/reference fields. | Medium: broad internal union consumer. | Update discriminated-event tests and consumers. |
| `src/acp-client.ts` | Require/forward phase. | Medium: every call must supply phase. | Update calls and ACP client tests. |
| `src/engine.ts` | Supply phases and safe reference. | High: lifecycle authority. | Keep completion predicate and existing activity emission unchanged except additive reference. |
| `src/paths.ts` or local helper | Canonical relative reference validation. | High: privacy/path handling. | Unit-test traversal/symlink/absolute cases. |
| `src/ui/transcript.ts` | Session-info special handling and safe fallback. | High: display leak boundary. | Add adversarial fixture coverage. |
| `src/ui/store.ts` | Pass phase, keep safe reference, and safely format interactive task activity. | Medium: task/batch isolation. | Preserve qualified-key and selector behavior; do not alter no-UI emission. |
| `src/ui/App.tsx` | Reference in outcome/summary. | Low: terminal layout. | Add normal/reduced-color frame assertions. |
| `src/commands.ts` / `src/batch.ts` | Direct consumers. | Medium: accidental surface change. | Assert no-UI ignores additive data and batch fences remain. |
| `tests/fixtures/mock-agent.ts` | New deterministic fixtures. | Medium: test protocol behavior. | Support repeated IDs, report metadata, and failure controls. |
| Focused tests | Expand acceptance coverage. | Low. | Add specified contract scenarios. |

## Testing and Evidence

### Unit Tests

- Transcript: suppress a report-phase `session_info_update` that contains the
  actual root, final-report prompt, `_meta`, ANSI escape sequence, and oversized
  content; assert none of that appears.
- Transcript: implementation and phase-missing session-info produce no raw
  payload; known message/thought/tool/plan behavior remains unchanged.
- Transcript: unrelated unknown update retains its label and a stable fallback,
  excluding `_meta`, redacting POSIX/Windows/UNC paths, neutralizing terminal
  controls, and ending with truncation at the fixed limit.
- Path helper: valid canonical internal file returns slash-normalized relative
  reference; missing/absolute/traversal/control/external or external-symlink
  target returns `undefined`.
- Store: valid completed reference is retained; malformed direct event reference
  is omitted; failed, blocked, and implementation-failure projections remain.

### Integration Tests

- ACP client: `runAcpTurn` forwards the requested phase on all emitted session
  updates.
- Engine: deterministic mock provider uses the same `sessionId` for both turns,
  emits report session-info with a malicious prompt/path title, writes a valid
  report, and yields completed status with a relative reference only.
- Engine failures: report refusal/cancellation/incomplete report yields failed
  status, no reference, no completed outcome, and a safe report reason.
- Command/batch: no-UI still consumes no session updates; active-packet key
  qualification discards stale batch events with additive fields.

### End-to-End or Platform Evidence

- OpenTUI `testRender` frames verify report-running text, labelled completion,
  safe relative reference, labelled report failure, absence of raw prompt/root
  path/control sequence, and reduced-color readability.
- No live provider, native packaging, or external platform validation is a
  release prerequisite. The deterministic ACP fixture is the approved
  end-to-end evidence boundary.

### Verification Gates

```sh
rtk bun test tests/acp-client.test.ts tests/engine.test.ts tests/transcript.test.ts tests/store.test.ts tests/cockpit.test.tsx tests/commands.test.ts
rtk bun run check
rtk bun run verify
rtk git diff --check
```

Record exact outputs in the implementation task report. Do not claim a gate
passed from this planning artifact.

## Observability

- Existing `run_started`, task status, activity, and `run_finished` events stay
  the run-level operational signal; no new telemetry or persistence is added.
- The optional phase/reference fields are transient, in-process diagnostic
  context. They must not be logged as raw metadata or forwarded to no-UI output.
- Release-candidate observability is test-based: M-01 through M-05 are measured
  by controlled acceptance scenarios in every automated verification run.
- Post-release provider variance is an observation trigger only. Make live
  validation a gate only after evidence of meaningful provider-specific drift.

## Development Sequencing

1. Define `AcpTurnPhase`, additive RunEvent fields, and pure reference/display
   validation helpers — no dependency on later work.
2. Require/pass phase in `runAcpTurn` and both engine turn calls; calculate the
   reference after `assertReport` — depends on step 1.
3. Add report-phase transcript suppression, safe unknown formatting, per-task
   reference state, and App rendering — depends on steps 1 and 2.
4. Extend the mock agent and write unit, integration, command/batch, and
   OpenTUI frame cases — depends on steps 1 through 3.
5. Run focused tests and full verification; inspect the diff for unrelated
   changes — depends on step 4.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|
| `realpath` cannot prove containment | Canonical path lookup may fail or leave the workspace. | Reference omitted while task completion remains valid. | Implementation owner; tests prove omission. |
| ACP v1 rejects unknown wire update discriminators | Generated v1 parser validates known variants. | Generic fallback is not a wire-compatibility promise. | Future ACP upgrade task if protocol support changes. |
| Report prose claims `blocked` | Current engine only owns completed/failed report outcome. | No inferred report blocked state. | Product/engine owner when a typed runtime result exists. |
| Live providers differ from fixture | MVP deliberately has no live release gate. | Possible post-release variance. | Product owner promotes gate only with recurring evidence. |
| Exact copy may need refinement | PRD leaves wording open. | Presentation text could change without semantic change. | Implementation owner, preserve labelled state and safety rules. |

## Architecture Decision Records

- [ADR-001: Phase-Aware Report Outcomes](adrs/adr-001-phase-aware-report-outcomes.md) — product and authority boundary.
- [ADR-002: Verified Report Completion Rollout](adrs/adr-002-verified-report-completion-rollout.md) — scope and automated-gate rollout.
- [ADR-003: Additive Report Presentation Contract](adrs/adr-003-additive-report-presentation-contract.md) — selected phase, safe-reference, compatibility, and fallback contract.
