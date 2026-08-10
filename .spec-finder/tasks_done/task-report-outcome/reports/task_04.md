# Task 04 Final Report: Project Safe Report Outcomes in Cockpit State

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: ACP final-report handoff in the same session; provider identity unavailable

## Changes

- `src/ui/store.ts` — Added immutable `CockpitTask.reportReference` projection
  with completed-only relative/control validation, labelled completion and
  report transcript entries, phase forwarding to transcript normalization, and
  safe formatting of interactive task activity before cockpit reasons/details.
- `tests/store.test.ts` — Covered valid and invalid references, failed/blocked
  semantics, phase-scoped transcript identity, safe activity reasons, and
  stale inactive-packet events with repeated task IDs.
- `tests/commands.test.ts` — Verified the no-UI listener ignores session
  updates and does not present a completed report reference or provider path.
- `.spec-finder/tasks/task-report-outcome/memory/MEMORY.md` — Recorded the
  durable store/reference and final verification handoff facts.
- `.spec-finder/tasks/task-report-outcome/memory/task_04.md` — Recorded the
  task-local implementation decisions, exact gate results, and report-phase
  handoff.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Forward session-update phase while retaining active-packet qualification. | Satisfied | `CockpitStore` passes `event.phase` to `applySessionUpdate`; batch tests cover repeated local IDs, active packet routing, and stale inactive-packet session events. |
| 2. Retain references only for completed tasks after defensive validation. | Satisfied | `validateReportReference` rejects empty, absolute, traversal, malformed, control-containing, and Windows-style references; tests cover valid, invalid, failed, and blocked cases. |
| 3. Append labelled completion and safe report detail without provider-driven outcomes. | Satisfied | Completed projection appends `Task completed` and `Report: <relative reference>` only for a safe completed reference; no provider metadata is used for status. |
| 4. Safely format interactive task activity while preserving lifecycle/no-UI behavior. | Satisfied | Task activity uses transcript `formatDisplayText` before transcript, reason, and failure-detail projection; existing failed/blocked semantics remain covered and engine/no-UI emission is unchanged. |
| 5. Add no-UI compatibility regression evidence. | Satisfied | Command regression asserts exact no-UI output contains task status/run result only, with no session metadata, report label, or absolute path. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test tests/store.test.ts tests/commands.test.ts` | PASS | 45 tests passed, 0 failed, 254 expectations. |
| `rtk bun run check` | PASS | `tsc --noEmit` exited 0; also rerun as part of the full verify gate. |
| `rtk bun run verify` | PASS | 310 tests passed, 0 failed, 1,824 expectations; Bun build produced `dist/cli.js` successfully (0.33 MB). |
| `rtk git diff --check` | PASS | No whitespace or patch errors. |

No coverage threshold tool is configured in this repository; the focused
scenario suite covers reference acceptance/omission, phase routing, batch
staleness, safe failure display, lifecycle preservation, and no-UI isolation.

## Risks and Follow-ups

- OpenTUI frame rendering and visual report-outcome acceptance remain deferred
  to task 05, as required by the task boundary; this task proves deterministic
  store/command state only.
- Canonical reference validation may intentionally omit a reference when
  containment cannot be proven; completion remains valid in that case.
- Live-provider and native-platform evidence are not release prerequisites per
  the approved ADRs; provider variance remains a post-release observation.
- Report-level `blocked` remains engine-owned and is not inferred from provider
  metadata or report prose.

## Final Verdict

Completed. The cockpit now projects phase-aware, batch-qualified, display-safe
report outcomes and completed-only relative references without changing engine
activity or no-UI emission. Focused tests, type checking, the full repository
verification/build gate, and diff checks all passed; task frontmatter status
remains runtime-owned.
