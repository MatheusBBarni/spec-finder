# Repository Guidelines

## Project Structure & Module Organization

`src/` contains the Bun/TypeScript CLI and runtime. Keep CLI parsing in `cli.tsx`/`commands.ts`, task and ACP lifecycle behavior in `engine.ts`, `tasks.ts`, and `acp-client.ts`, and terminal UI code in `src/ui/`. Tests in `tests/` mirror their source surface.

Portable workflow skills belong in `skills/sf-*/`; `.spec-finder/` contains repository configuration and task packets. Packet artifacts follow fixed names such as `_idea.md`, `_prd.md`, `_techspec.md`, `task_01.md`, `memory/MEMORY.md`, and `reports/task_01.md`.

## Build, Test, and Development Commands

```bash
bun install          # install locked dependencies
bun run check        # strict TypeScript check
bun test             # run the Bun test suite
bun run build        # bundle src/cli.tsx to dist/cli.js
bun run verify       # full gate: check, tests, and build
```

Run `bun run verify` before review or publishing. Use `spec-finder run <task-slug> --no-ui` to exercise a packet without the cockpit.

## Coding Style & Naming Conventions

Use TypeScript with ESM imports, two-space indentation, double quotes, and no semicolons. Prefer focused modules and explicit types at runtime boundaries. Use `camelCase` for values and functions, `PascalCase` for React components and types, and kebab-case filenames such as `acp-client.ts`. Keep task IDs zero-padded: `task_01`, `task_02`.

No separate formatter or linter is configured; preserve the surrounding style and let `bun run check` catch type regressions.

## Testing Guidelines

Use Bun's `describe`, `test`, and `expect` APIs. Name tests after observable behavior, such as `"rejects unknown keys and invalid runtime values"`. Add focused tests to the matching suite; visible cockpit changes need rendered OpenTUI frame coverage. Run the affected file while iterating, then `bun run verify`.

## Agent Rule Files

Read the applicable rules before changing a surface. [Architecture](.agents/rules/architecture.md) defines ownership boundaries; [coding style](.agents/rules/coding-style.md) covers implementation discipline; [testing](.agents/rules/testing.md) defines evidence expectations; and [workflow](.agents/rules/workflow.md) protects task packets, configuration, and the existing worktree. These rules supplement this guide; follow the more specific rule when they differ.

## Commits and Pull Requests

Follow the concise Conventional Commit style: `fix: scope transcript turns` or `chore: add task plan`. Keep commits coherent and avoid staging unrelated work. PRs should explain the outcome, link the issue, list verification results, and include terminal screenshots for cockpit changes. Only the repository owner merges PRs into `main`.

## Security & Configuration

Treat `.spec-finder/config.json` as strict user configuration: validate changes and never weaken workspace-path protections. Do not commit credentials, provider tokens, or private task data. ACP behavior must fail safely with actionable errors.
