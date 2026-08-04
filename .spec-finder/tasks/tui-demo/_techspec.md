# TUI Demo TechSpec

## Status

Approved mock specification.

## Execution design

The existing task engine loads `task_01.md`, starts one ACP implementation session, and then starts the mandatory final-report session. The implementation session performs read-only inspection and runs `bun run check`; it does not edit product files.

Spec Finder owns the permitted lifecycle writes:

- `task_01.md` frontmatter status transitions.
- `memory/MEMORY.md` and `memory/task_01.md` workflow context.
- `reports/task_01.md` final evidence report.

## Verification

- Confirm `.spec-finder/config.json` parses successfully.
- Run `bun run check` and record the terminal result.
- Confirm no application source, test, dependency, or configuration file was changed by the implementation session.
