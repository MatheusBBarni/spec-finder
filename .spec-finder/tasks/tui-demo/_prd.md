# TUI Demo PRD

## Status

Approved mock packet.

## Objective

Provide a harmless task that exercises the Spec Finder cockpit, ACP activity stream, task lifecycle, permission UI, and mandatory final-report phase.

## Requirements

1. The task MUST inspect the repository without changing application source code.
2. The task MUST run the TypeScript validation command `bun run check`.
3. Spec Finder MUST manage task status, packet memory under `memory/`, and the final report under `reports/`.

## Non-goals

- Implementing product functionality.
- Modifying dependencies, configuration, source code, or tests.
- Publishing or committing changes.

## Success metric

Running `spec-finder-dev run tui-demo` displays the cockpit and completes both ACP phases with truthful verification evidence.
