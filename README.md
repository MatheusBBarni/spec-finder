# Spec Finder

Spec Finder is a skill-driven specification framework with a local ACP cockpit. It restores the compact workflow that made pre-0.3 Compozy useful—idea → PRD → TechSpec → executable tasks—without adding a daemon or a second source of truth.

Specifications stay in the repository. Skills are portable Agent Skills. Claude, Codex, and Cursor run through their own ACP harnesses while Spec Finder owns task ordering, lifecycle state, permissions, and evidence reports.

## Requirements

- Bun 1.3 or newer
- One supported ACP provider:
  - Claude: `@agentclientprotocol/claude-agent-acp`
  - Codex: `@agentclientprotocol/codex-acp`
  - Cursor: `cursor-agent acp`

The default Claude and Codex profiles use `npx --yes`, so their adapters can be resolved on demand. Cursor requires the Cursor CLI on `PATH`.

## Install

```bash
npm install --global spec-finder
cd /path/to/project
spec-finder setup
```

`setup` creates:

```text
.spec-finder/
├── config.json
└── tasks/
```

In an interactive terminal, `setup` opens keyboard pickers for providers, installation scope, and copy or symlink mode. Use `↑`/`↓` to move, `Space` to toggle providers, `Enter` to confirm, and `Esc` to cancel. All providers start selected; local scope and copied skills are the defaults. Supply any choice as a flag to skip only its corresponding picker. Non-interactive setup defaults to all providers, local scope, and copied skills.

Limit setup to one or more targets when needed; repeat `--agent` to select more than one:

```bash
spec-finder setup --agent codex --agent cursor --global --symlink
```

The `.spec-finder/config.json` and `.spec-finder/tasks/` scaffolding always remain in the current project. Skill destinations depend on scope:

| Provider | Local | Global |
|---|---|---|
| Claude | `.claude/skills` | `~/.claude/skills` |
| Codex | `.agents/skills` | `~/.agents/skills` |
| Cursor | `.cursor/skills` | `~/.cursor/skills` |

`--copy` copies the six bundled `sf-*` skills into every selected provider. `--symlink` copies them once to a canonical provider—Codex when selected, otherwise the first selected provider—and creates a per-skill symlink for every other selected provider. Rerunning setup replaces only those six `sf-*` entries; unrelated skills in the target directories are preserved.

## Specification pipeline

| Skill | Artifact |
|---|---|
| `sf-idea-factory` | `.spec-finder/tasks/<slug>/_idea.md` |
| `sf-create-prd` | `.spec-finder/tasks/<slug>/_prd.md` |
| `sf-create-techspec` | `.spec-finder/tasks/<slug>/_techspec.md` |
| `sf-create-tasks` | `_tasks.md` and `task_NN.md` |
| `sf-execute-task` | bounded implementation and verification |
| `sf-task-report` | `reports/task_NN.md` |

Every stage keeps the approval gates from the original Compozy skills. Research and interactive decisions happen before artifacts are saved. Tasks form an acyclic dependency graph and carry their own tests.

## Run tasks

```bash
spec-finder run my-feature
```

The cockpit shows the effective provider configuration, task graph, ACP activity, tool calls, and permission requests. It executes dependency-safe tasks sequentially. Each implementation task is followed by a fresh report session. Spec Finder marks a task `completed` only after the required report exists and contains substantive evidence.

For logs without the cockpit:

```bash
spec-finder run my-feature --no-ui
```

Runtime overrides are explicit and validated:

```bash
spec-finder run my-feature \
  --provider codex \
  --model gpt-5.6-sol \
  --reasoning xhigh \
  --speed fast
```

## Configuration

`.spec-finder/config.json` is strict: unknown keys and invalid values fail before a provider process starts.

```json
{
  "version": 2,
  "provider": "codex",
  "model": "auto",
  "reasoning": "high",
  "speed": "normal",
  "permissions": "prompt"
}
```

Key behavior:

- `model`: `auto` or a provider model ID. Claude uses `ANTHROPIC_MODEL`; Cursor receives `--model`; Codex uses advertised ACP session options.
- `reasoning`: `auto`, `low`, `medium`, `high`, `xhigh`, `max`, or `ultra`. It is applied only when advertised.
- `speed`: `auto`, `normal`, or `fast`. Unsupported providers continue with a truthful `unsupported` cockpit outcome.
- `permissions`: `prompt` asks through the cockpit whenever the provider requests access; `approve-all` automatically chooses an allow option; `deny` automatically chooses a reject option.

Provider process commands are built into Spec Finder for Claude, Codex, and Cursor. They are implementation details rather than user configuration. Spec Finder also follows each provider's default ACP mode: mode IDs are advertised by the agent and are not portable across providers. Final reports are always required in `reports/`, completed tasks are skipped, and the run stops after a task failure.

Version 1 configuration files are accepted for migration. Rerun `spec-finder setup` to rewrite an existing verbose file to the compact version 2 format.

Validate and inspect the effective file:

```bash
spec-finder config
```

## CLI

```text
spec-finder setup [--agent claude|codex|cursor]... [--local|--global] [--copy|--symlink]
spec-finder upgrade
spec-finder run <task_slug> [--no-ui]
spec-finder config
spec-finder version
```

`upgrade` runs `npm install --global spec-finder@latest`, keeping npm as the package authority.

## Task contract

Task files are named `task_01.md`, `task_02.md`, and so on. Required frontmatter:

```yaml
---
status: pending
title: Implement the runtime
type: backend
complexity: medium
dependencies:
  - task_01
---
```

The first H1 must match `title`. Dependencies use task IDs and must be acyclic. A failed task stops the run; dependent tasks remain incomplete for a later run.

ACP filesystem requests are constrained to the workspace root. Spec Finder sends cancellation through ACP and terminates the provider process when the operator quits.

## Development

```bash
bun install
bun run verify
```

The full gate runs strict TypeScript, Bun tests, an OpenTUI frame test, and the distributable build.

## Design references

- [Compozy](https://github.com/compozy/compozy) and its documented [v0.2 → v0.3 migration](https://github.com/compozy/compozy/blob/main/MIGRATION_GUIDE.md)
- [Agent Client Protocol TypeScript SDK](https://github.com/agentclientprotocol/typescript-sdk)
- [OpenTUI](https://github.com/anomalyco/opentui)
- [Agent Skills ecosystem](https://skills.sh/docs)
