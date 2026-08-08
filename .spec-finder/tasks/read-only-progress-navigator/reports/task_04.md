# Task 04 Final Report: Render and verify the read-only progress cockpit

## Outcome

- Verdict: completed
- Date: 2026-08-04
- Provider/session: unavailable; this report phase used local deterministic fixtures and the real OpenTUI renderer, not a third-party ACP provider session
- Outcome: Replaced the legacy flat activity and permission presentation with the final read-only task/transcript cockpit. The result provides truthful runtime context, distinct active and selected tasks, complete task-scoped history, two-pane keyboard navigation, responsive and reduced-color semantics, contextual help, and terminal-only cancellation.

## Changes

- `src/ui/App.tsx` — Added the prioritized runtime header, scrollable task navigator, selected-task transcript, explicit task/transcript focus, active-task follow and inspection presentation, semantic event/status labels, failure reasons, contextual footer/help, required responsive layouts, and `q`/`Ctrl+C` cancellation. Removed the permission modal and permission-selection key handling.
- `src/ui/store.ts` — Removed the legacy global activity and permission-control state/actions after integration; retained immutable task transcripts and view-only selection, focus, follow, help, task-reason, run-activity, and runtime-option state. Raw permission events do not create cockpit controls.
- `tests/cockpit.test.tsx` — Added deterministic renderer and interaction coverage for runtime orientation, truthful option outcomes, matching task histories, active/selected divergence, long task-list navigation, 300-entry transcript scrolling and sticky tail, category labels, failed/blocked reasons, 80×24/120×40/200×60 frames, 70×20 fallback, reduced color, help, and escape behavior.
- `tests/store.test.ts` — Replaced interim permission-selection coverage with a final assertion that permission events remain outside the read-only view state.
- `.spec-finder/tasks/read-only-progress-navigator/memory/task_04.md` — Recorded final implementation decisions, corrections, current automated results, and refreshed real-PTY evidence.
- `.spec-finder/tasks/read-only-progress-navigator/memory/MEMORY.md` — Recorded the durable packet-level task 04 handoff, responsive evidence, and remaining run-scoped history/provider-validation risks.
- `.spec-finder/tasks/read-only-progress-navigator/reports/task_04.md` — Added this evidence-backed final report.

The current worktree also contains implementation and report artifacts from tasks 01–03, the task 03-owned README and ACP permission changes, and runtime-owned task frontmatter transitions. This report phase preserved those changes. In particular, `task_04.md` already differed from `HEAD` by `status: pending` to `status: in_progress`; this phase did not edit that frontmatter.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Render the prioritized header, task navigator, selected task transcript, failure/blocked reasons, and truthful runtime-option outcomes. | Satisfied | The focused renderer suite passed its orientation test at 80×24, 120×40, and 200×60 with slug, running phase, active task, counts, provider, applied/default/unsupported option outcomes, status labels, and the selected transcript. Separate passing tests covered failed/blocked summary and transcript reasons plus every normalized ACP category. |
| 2. Implement two-pane focus, task movement, active-task following, transcript line/page/start/end scrolling, contextual footer/help, and the terminal escape hatch. | Satisfied | Focused tests passed for active/selected divergence, `j`/`k` navigation with task-list scrolling, `Tab`/`Shift+Tab`, line/PageUp/PageDown/Home/End transcript movement, live-tail suspension/resumption across a 300-entry history, and help toggling. Fresh real-PTY runs matched the help overlay and proved independent `q` and Ctrl+C cancellation paths exited 0 after terminal restoration. |
| 3. Remove permission controls and legacy permission-selection UI/actions. | Satisfied | `App.tsx` has no permission modal/key path; `CockpitState` has no selectable permission state; and the store ignores raw permission events at the view boundary. The focused cockpit and store tests passed negative assertions for permission, approval, retry, edit, reorder, and status-mutation controls. The focused ACP test also passed the TUI prompt-cancellation boundary. |
| 4. Preserve status meaning without color alone and provide understandable behavior at 80×24, 120×40, 200×60, reduced-color, and below-minimum dimensions. | Satisfied | The renderer suite passed fixed-size frames at all three required supported sizes, a reduced-color capability frame, and a 70×20 compact stacked fallback. Assertions require visible symbols and text labels such as `[RUNNING]`, `[COMPLETED]`, `[FAILED]`, `[BLOCKED]`, and a compact-size notice rather than relying on color. |
| 5. Preserve renderer lifecycle and `--no-ui` behavior while keeping selection view-only. | Satisfied | `src/ui/cockpit.tsx`, `src/commands.ts`, `src/events.ts`, `src/engine.ts`, `package.json`, and `bun.lock` have no current diff. Selection/focus/follow/help actions remain inside `CockpitStore` and do not call execution or ACP surfaces. The exact repository gate passed all command, engine, ACP, store, renderer, and build tests. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test tests/transcript.test.ts tests/store.test.ts tests/cockpit.test.tsx tests/acp-client.test.ts` | Passed, exit 0 | Bun 1.3.13 ran 27 tests across 4 files: 27 passed, 0 failed, 204 expectation calls. The eight cockpit tests included the required size, reduced-color, compact fallback, selection/follow, focus/scroll, category, failure, help, and escape evidence. |
| `rtk bun run check` | Passed, exit 0 | `tsc --noEmit` completed with no TypeScript diagnostics. |
| `rtk bun run verify` | Passed, exit 0 | The exact repository gate ran `bun run check && bun test && bun run build`: 55 tests across 13 files passed, 0 failed, with 286 expectation calls. The production build bundled 17 modules into `dist/cli.js` at 81.87 KB. |
| `rtk git diff --check` | Passed, exit 0 | The command produced no output, so the current diff has no whitespace errors. |
| `rtk git diff -- src/ui/cockpit.tsx src/commands.ts src/events.ts src/engine.ts package.json bun.lock` | Passed, exit 0 | The command produced no output, confirming no current changes to the renderer lifecycle, command/no-UI wiring, raw event protocol, engine, or dependency manifests. |
| `rtk expect -c 'set timeout 10; spawn -noecho bun .task04-tty-smoke.tsx; after 500; send "?"; expect "READ-ONLY COCKPIT HELP"; send "q"; expect "TTY_SMOKE_CANCELLED"; expect eof; set result [wait]; set code [lindex $result 3]; puts "HELP_Q_EXIT=$code"; exit $code'` | Passed, exit 0 | The actual `startCockpit` renderer displayed `READ-ONLY COCKPIT HELP`, restored the alternate screen and terminal modes after `q`, emitted `TTY_SMOKE_CANCELLED`, and printed `HELP_Q_EXIT=0`. |
| `rtk expect -c 'set timeout 10; spawn -noecho bun .task04-tty-smoke.tsx; after 500; send "\003"; expect "TTY_SMOKE_CANCELLED"; expect eof; set result [wait]; set code [lindex $result 3]; puts "CTRL_C_EXIT=$code"; exit $code'` | Passed, exit 0 | The independent real-PTY Ctrl+C run restored the terminal, emitted `TTY_SMOKE_CANCELLED`, and printed `CTRL_C_EXIT=0`. The temporary harness used by both PTY checks was removed afterward and is absent from `git status`. |

## Risks and Follow-ups

- Complete per-task transcript history grows linearly for the lifetime of a run. Current deterministic evidence retains and navigates 300 entries with viewport culling, but it is not a long-duration memory benchmark; persistence or spill-to-disk remains outside this PRD.
- Unknown or provider-specific ACP update variants remain visible through generic readable labels. Presentation can be refined as concrete provider variants are observed.
- No live third-party provider smoke emitted the complete message/thought/plan/tool/tool-update/error/outcome matrix during this report phase. Deterministic ACP fixtures cover the category contract, and real-PTY checks cover renderer/help/cancellation behavior, but live provider variance remains a follow-up validation gap.
- Below 80×24 is intentionally outside the supported KPI. The tested 70×20 fallback preserves primary context and shows compact mode, but secondary metadata may collapse as specified.
- No unresolved risk blocks the scoped task outcome.

## Final Verdict

Completed. All five numbered requirements are satisfied by the scoped implementation and current terminal evidence. The focused suite, TypeScript check, exact repository verification gate, diff hygiene check, protected-boundary diff, and real-PTY help/escape checks all exited successfully. The remaining risks are accepted run-duration and provider-variance follow-ups, not failures of the read-only cockpit contract. Task lifecycle frontmatter remains unchanged by this report phase and under Spec Finder ownership.
