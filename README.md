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

It also installs all bundled skills for Claude, Codex, and Cursor. Limit setup to one or more targets when needed:

```bash
spec-finder setup --agent codex --agent cursor
```

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
  "version": 1,
  "provider": "codex",
  "model": "auto",
  "reasoning": "high",
  "speed": "normal",
  "mode": "agent",
  "permissions": "prompt",
  "report": {
    "enabled": true,
    "directory": "reports"
  },
  "execution": {
    "continueOnError": false,
    "includeCompleted": false
  },
  "providers": {
    "claude": {
      "command": "npx",
      "args": ["--yes", "@agentclientprotocol/claude-agent-acp"],
      "env": {},
      "authMethod": null
    },
    "codex": {
      "command": "npx",
      "args": ["--yes", "@agentclientprotocol/codex-acp"],
      "env": {},
      "authMethod": null
    },
    "cursor": {
      "command": "cursor-agent",
      "args": ["acp"],
      "env": {},
      "authMethod": null
    }
  }
}
```

Key behavior:

- `model`: `auto` or a provider model ID. Claude uses `ANTHROPIC_MODEL`; Cursor receives `--model`; Codex uses advertised ACP session options.
- `reasoning`: `auto`, `low`, `medium`, `high`, `xhigh`, `max`, or `ultra`. It is applied only when advertised.
- `speed`: `auto`, `normal`, or `fast`. Unsupported providers continue with a truthful `unsupported` cockpit outcome.
- `mode`: `default`, `read-only`, `agent`, or `agent-full-access`. It is applied only when the agent advertises the exact mode.
- `permissions`: `prompt` is the safe default. `approve-all` and `deny` select matching ACP permission options without interaction.
- `report.enabled`: must remain `true`; evidence reports are a completion invariant, not an optional feature.
- `report.directory`: must be a relative, traversal-free directory inside the task packet.
- `authMethod`: optional ACP authentication method ID. Spec Finder refuses it when the adapter did not advertise that ID.

Validate and inspect the effective file:

```bash
spec-finder config
```

## CLI

```text
spec-finder setup [--agent claude|codex|cursor]
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

The first H1 must match `title`. Dependencies use task IDs and must be acyclic. A failed task blocks its dependents. Unrelated branches can continue only when `execution.continueOnError` is enabled.

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
