# Spec Finder

Spec Finder is a skill-driven specification framework with a local ACP cockpit, heavily inspired by Compozy. It brings back the compact workflow that made pre-0.3 Compozy useful—idea → PRD → TechSpec → executable tasks—without adding a daemon or a second source of truth.

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

`--copy` copies the seven bundled `sf-*` skills into every selected provider. `--symlink` copies them once to a canonical provider—Codex when selected, otherwise the first selected provider—and creates a per-skill symlink for every other selected provider. Rerunning setup replaces only those seven `sf-*` entries; unrelated skills in the target directories are preserved.

## Specification pipeline

| Skill | Artifact |
|---|---|
| `sf-idea-factory` | `.spec-finder/tasks/<slug>/_idea.md` |
| `sf-create-prd` | `.spec-finder/tasks/<slug>/_prd.md` |
| `sf-create-techspec` | `.spec-finder/tasks/<slug>/_techspec.md` |
| `sf-create-tasks` | `_tasks.md` and `task_NN.md` |
| `sf-memory` | `memory/MEMORY.md` and `memory/task_NN.md` |
| `sf-execute-task` | bounded implementation and verification |
| `sf-task-report` | `reports/task_NN.md` |
| `sf-batch-tasks` | dependency-safe manual range execution |
| `sf-archive-tasks` | completed-packet archival and reports |

Every stage keeps the approval gates from the original Compozy skills. Research and interactive decisions happen before artifacts are saved. Tasks form an acyclic dependency graph and carry their own tests.

## Run tasks

```bash
spec-finder run my-feature
```

The read-only cockpit shows the effective provider configuration, task graph, ACP activity, and tool calls. It executes dependency-safe tasks sequentially. Each implementation task is followed by a fresh report session. Spec Finder marks a task `completed` only after the required report exists and contains substantive evidence.

For logs without the cockpit:

```bash
spec-finder run my-feature --no-ui
```

### Ordered batch runs

Batch mode is an opt-in command for a declared sequence. Use exactly one comma-separated list with
`--multiple`; packets run serially in the order supplied and the first failure or cancellation stops the sequence:

```bash
spec-finder run --multiple first-packet,second-packet,third-packet
spec-finder run --multiple first-packet,second-packet,third-packet --no-ui \
  --provider codex --model gpt-5.6-sol --reasoning xhigh --speed fast
```

The batch branch supports the same runtime flags shown above: `--no-ui`, `--provider NAME`, `--model ID`,
`--reasoning LEVEL`, and `--speed MODE`. It rejects positional slugs, a second `--multiple`, empty or duplicate
entries, malformed or unknown packet slugs, option-like entries, unknown options, and missing flag values before
any packet starts.

Every declared packet receives one outcome:

| Outcome | Meaning and recovery |
|---|---|
| `succeeded` | The packet completed. `already complete` means no tasks remained and still counts as success. |
| `failed` | The packet stopped on a task, provider, permission, or report failure; later packets are `not_started`. Resolve the issue and rerun manually. |
| `cancelled` | The operator or ACP cancelled the packet; later packets are `not_started`. Rerun manually when ready. |
| `not_started` | The packet was declared after the stopping packet and was never launched. |

An all-success (including already-complete) sequence exits 0. Preflight rejection, failure, and cancellation exit 1.
Batch mode is serial and fail-fast: it performs no automatic retry, continue-on-error, parallel execution, or resume,
and introduces no persistence or durable batch history, rollback, or telemetry. Earlier successful packets remain
completed when a later packet stops.

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
- `permissions`: `prompt` cancels permission requests in the read-only cockpit with a visible notice; with `--no-ui`, it prompts in an interactive terminal and cancels when input is unavailable. `approve-all` automatically chooses an allow option; `deny` automatically chooses a reject option.

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
spec-finder run <task_slug> [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
spec-finder run --multiple <slug1,slug2,...> [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
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

Each packet has workflow-scoped memory:

```text
.spec-finder/tasks/<slug>/memory/
├── MEMORY.md
└── task_NN.md
```

`MEMORY.md` contains durable context shared across the packet. Each `task_NN.md` contains only operational context for that task. Spec Finder initializes missing memory files before execution and never overwrites existing memory during initialization.

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
