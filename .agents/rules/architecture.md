# Architecture Rules

- Keep command parsing in `src/cli.tsx` and `src/commands.ts`; put workflow orchestration in the engine layer, not the CLI.
- Preserve the boundary between provider transport (`src/acp-client.ts`, `src/providers.ts`), task lifecycle (`src/engine.ts`, `src/tasks.ts`), and the read-only cockpit (`src/ui/`).
- Model cross-layer behavior with typed events and public interfaces. Do not make UI components parse provider payloads or mutate task files.
- Keep configuration validation centralized in `src/config.ts`; add new settings as explicit, strict schema changes with defaults and migration behavior when needed.
- Treat task packets and their report/memory artifacts as runtime-owned contracts. Do not change lifecycle status or report content outside the responsible workflow.
