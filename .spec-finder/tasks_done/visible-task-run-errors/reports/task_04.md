# Task 04 Final Report: Render Accessible Retained Failure Diagnostics

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: unavailable; deterministic OpenTUI/Bun fixtures only, with no live provider or PTY session exercised

## Changes

- `src/ui/App.tsx` — Renders the retained `FailureReview` with textual run and batch status, qualified task identity, outcome counts, stopping-packet context, the exact store-selected error, an explicit missing-detail notice, a focused word-wrapped scrollbox, one fixed recovery hint, and settled-review dismissal guidance. Settled `Esc`, `Q`, and `Ctrl+C` use `onDismiss`; active-run cancellation remains separate.
- `tests/cockpit.test.tsx` — Covers short and multiline exact details, scroll-to-end visibility, missing details, batch failure context, settled keyboard dismissal without cancellation or renderer destruction, compact/reduced-color readability, and the absence of retry/remediation/workflow controls.
- `.spec-finder/tasks/visible-task-run-errors/memory/MEMORY.md` — Promoted durable retained-review coverage and task-05 PTY handoff facts.
- `.spec-finder/tasks/visible-task-run-errors/memory/task_04.md` — Recorded the missing-handoff correction and exact report-phase verification results.
- `.spec-finder/tasks/visible-task-run-errors/reports/task_04.md` — This evidence report.

The implementation source and focused tests were already integrated in the
current ancestry before this report phase. `src/batch.ts` and `src/events.ts`
remain untouched. The task frontmatter remains runtime-owned with
`status: in_progress` and `handoff.phase: report`; this phase did not change
its lifecycle state.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Render a distinct textual failure review with task identity, applicable batch stopping context, final outcome/counts, and the complete surfaced error. | Satisfied | `FailureReview` renders `RUN.STATUS`/`RUN.STATUS · BATCH SEQUENCE`, qualified `PACKETS` and `STOPPING PACKET` lines, `RUN.FAILURES`, textual outcome counts, and `selectTaskFailureDetail` output. The focused suite asserts the run summary, task identity, surfaced error, and batch recovery frame. |
| 2. Keep long or multiline details word-wrapped and scrollable, with keyboard dismissal and no color-only meaning. | Satisfied | The `failure-detail-scroll` OpenTUI scrollbox uses `scrollY`, `focused`, viewport culling, and `wrapMode="word"`; the frame test proves both first and final diagnostic lines. Text labels and dismissal guidance remain present in compact and reduced-color frames. Esc, Q, and Ctrl+C each call `onDismiss` once, do not call `onCancel`, and do not destroy the renderer. |
| 3. Show exactly one generic hint without retry, remediation, or workflow controls. | Satisfied | The review renders the exact copy `Resolve the listed error, then rerun the task packet.` once. Focused frame assertions verify the copy, while the compact/reduced-color assertions verify no permission, retry, task-edit, or other workflow controls are introduced. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test tests/cockpit.test.tsx` | PASS | Exit 0; 34 tests passed, 0 failed, and 313 `expect()` calls across one file. |
| `rtk bun run verify` | PASS | Exit 0; TypeScript check passed, 318 tests passed with 0 failures and 1,897 `expect()` calls across 29 files, and the Bun build bundled 28 modules into `dist/cli.js` (0.34 MB). |
| `rtk git diff --check` | PASS | Exit 0; no whitespace errors reported. |

## Risks and Follow-ups

- Native macOS PTY and manual terminal-smoke evidence were not run in this task; task 05 owns `rtk bun run test:pty` and the real-terminal release checks. The release bar must not be inferred from deterministic frame tests alone.
- No separate numerical coverage command was run; behavioral frame and mock-input coverage is present, but the 80% target is not independently measured here.
- No live provider session or raw ACP payload path was exercised; exact surfaced diagnostics remain observational and ephemeral by design.
- Downstream work must preserve the integrated batch/event ownership boundary and the separate command-owned dismissal/cancellation lifecycle.

## Final Verdict

Completed. The retained failure review satisfies all three task requirements,
including exact scrollable diagnostics, batch context, explicit missing-detail
handling, accessible keyboard dismissal, and the single approved recovery hint.
The focused cockpit suite, repository verification, build, and diff-integrity
check all passed to terminal exit. PTY/manual release evidence remains
explicitly deferred to task 05, and Spec Finder retains ownership of the task
status transition.
