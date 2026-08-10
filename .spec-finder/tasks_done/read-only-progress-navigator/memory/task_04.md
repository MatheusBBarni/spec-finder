# Task Memory: task_04

## Objective Snapshot

- Implementation, verification, and `reports/task_04.md` are complete for the final read-only progress cockpit; Spec Finder still owns the lifecycle transition.

## Important Decisions

- Use explicit task/transcript pane focus: `Tab`/`Shift+Tab`, arrows/`j`/`k`, ScrollBox line/page/Home/End, `?`, and `q`/`Ctrl+C`.
- Keep status meaning available through symbols and labels, not color alone.
- Preserve the active/selected distinction and remove all permission controls from the final UI.
- Use the focused native transcript `ScrollBox` for line/page/Home/End and sticky-tail behavior; task movement stays store-driven and calls `scrollChildIntoView` for the selected row.
- Render applied/default/unsupported runtime-option outcomes explicitly. Before an outcome event exists, label the configured value as requested rather than effective.
- Keep two columns at 80–119 columns, expand metadata at 120+, and stack tasks above transcript below 80 columns or 24 rows.

## Learnings

- OpenTUI 0.4.5 renderer tests support fixed dimensions, capability overrides, input injection, descendant lookup, and direct `ScrollBox.scrollTop` assertions.
- A leading transcript spacer preserves the first semantic label when the bottom-sticky OpenTUI scrollbox performs its initial one-row offset; all later history remains reachable through Home/End.
- The final renderer retains and navigates a 300-entry synthetic transcript while viewport culling limits visible rendering; history remains intentionally run-scoped and uncapped.
- Real PTY smoke checks rendered the contextual help and restored terminal state after `q` and `Ctrl+C`; both exit paths invoked cancellation, and the recorded help/`q` and `Ctrl+C` runs exited 0.

## Files / Surfaces

- `src/ui/App.tsx` — final header, navigator, transcript, focus/keymap, responsive fallback, semantic labels, footer, and help rendering.
- `src/ui/store.ts` — legacy global activity and permission state/actions removed; raw permission events are ignored at the view boundary.
- `tests/cockpit.test.tsx` — 80×24, 120×40, 200×60, 70×20 compact, reduced-color, category, selection, long-list, 300-entry scroll/follow, help, and escape evidence.
- `tests/store.test.ts` — final read-only state assertion replaces interim permission selection coverage.
- `src/ui/cockpit.tsx` — inspected and preserved unchanged; renderer lifecycle and `--no-ui` command wiring remain intact.

## Errors / Corrections

- Initial multi-child transcript rows could overlap under OpenTUI auto layout; each task/transcript row now uses one styled text renderable with explicit line breaks.
- Scrolling a newly selected transcript to `Number.MAX_SAFE_INTEGER` caused an initial one-row offset; scrolling to the measured `scrollHeight` plus the start spacer preserves both first-entry and tail visibility.

## Ready for Next Run

- Final-report refresh on 2026-08-04: `bun test tests/transcript.test.ts tests/store.test.ts tests/cockpit.test.tsx tests/acp-client.test.ts` exited 0 with 27 passing tests, 0 failures, and 204 expectations.
- Final-report refresh on 2026-08-04: `bun run check` exited 0, and `bun run verify` exited 0 with 55 passing tests across 13 files, 0 failures, 286 expectations, and a successful 17-module production build (`dist/cli.js`, 81.87 KB).
- Final-report refresh on 2026-08-04: `git diff --check` exited 0 with no output.
- A temporary in-workspace harness around the real `startCockpit` renderer was driven through `/usr/bin/expect` and removed afterward. The help/`q` run matched `READ-ONLY COCKPIT HELP` and `TTY_SMOKE_CANCELLED`, then reported `HELP_Q_EXIT=0`; the independent Ctrl+C run matched `TTY_SMOKE_CANCELLED` and reported `CTRL_C_EXIT=0`.
- `reports/task_04.md` records the completed verdict; lifecycle status remains Spec Finder-owned. A live third-party provider category smoke run was not performed, so deterministic ACP/category fixtures and the real-PTY navigation/escape checks are the available validation boundary.
