# Task Memory: task_04

## Objective Snapshot

- Deliver and verify the final read-only two-column progress cockpit after state, transcript, and permission prerequisites are complete.

## Important Decisions

- Use explicit task/transcript pane focus: `Tab`/`Shift+Tab`, arrows/`j`/`k`, ScrollBox line/page/Home/End, `?`, and `q`/`Ctrl+C`.
- Keep status meaning available through symbols and labels, not color alone.
- Preserve the active/selected distinction and remove all permission controls from the final UI.

## Learnings

## Files / Surfaces

- `src/ui/App.tsx` — final rendering and keyboard behavior.
- `src/ui/store.ts` — remove legacy permission state/actions after UI migration.
- `tests/cockpit.test.tsx` and `tests/store.test.ts` — final frame and interaction evidence.
- `src/ui/cockpit.tsx` — verify renderer lifecycle without changing it unnecessarily.

## Errors / Corrections

## Ready for Next Run

- Validate 80×24, 120×40, 200×60, reduced-color, long-history, selection, follow, scroll, and help behavior before reporting completion.
