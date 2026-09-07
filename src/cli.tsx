#!/usr/bin/env bun
import { ConfigError } from "./config.ts"
import {
  checkpointCommand,
  configCommand,
  loopCommand,
  runCommand,
  setupCommand,
  upgradeCommand,
  versionCommand,
} from "./commands.ts"

const HELP = `spec-finder — skill-driven specifications with an ACP cockpit

Usage:
  spec-finder setup [--agent claude|codex|cursor|grok|pi] [--model auto|CURATED] [--speed auto|normal|fast] [--local|--global] [--copy]
  spec-finder upgrade
  spec-finder run <task_slug> [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
  spec-finder run --multiple <slug1,slug2,...> [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
  spec-finder loop <task_slug> [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE] [--max-iterations N] [--no-progress-window N] [--dry-run] [--reset-state]
  spec-finder checkpoint begin <task_slug> <task_id>
  spec-finder checkpoint complete <task_slug> <task_id>
  spec-finder config
  spec-finder version

Setup mode:
  setup resolves exactly one provider. Omit --agent to reuse a valid configured provider or default
  a fresh workspace to Codex. --model accepts auto or one curated model for that provider, and
  --speed accepts auto, normal, or fast. Fresh setup defaults to Codex, gpt-5.6-luna, normal speed,
  and local scope; a changed provider uses its newest catalogue model.
  --local and --global independently choose the installation scope; supply at most one. --copy is
  retained compatibility syntax and is the only installation mode. Repeated or duplicate setup
  options, conflicting scopes, and --symlink are rejected before any writes.
  Destinations are .claude/skills for Claude and .agents/skills for Codex, Cursor, Grok Build, or Pi. A valid v3
  rerun preserves omitted provider, model, speed, and scope values, including a saved custom model.
  Migrated v1/v2 configurations require an explicit first --local or --global choice because their
  historic scope is unknown. Setup summaries say requested model and requested speed; runtime ACP feedback remains
  authoritative for applied, defaulted, or unsupported capabilities. Legacy Cursor .cursor/skills
  content is preserved and not migrated.

Batch mode:
  --multiple is opt-in, serial, and fail-fast. Supply exactly one ordered comma-separated slug list.
  It rejects positional slugs, repeated --multiple, empty or duplicate entries, malformed or unknown packets,
  option-like entries, unknown options, and missing flag values before any packet starts.
  Supported runtime flags retain their single-run meanings: --no-ui, --provider NAME, --model ID,
  --reasoning LEVEL, and --speed MODE.
  Outcomes are succeeded (including already complete), failed, cancelled, and not_started.
  A failed task phase retries once. Exhausted failure or cancellation stops later packets; no automatic packet retry occurs.
  Resolve the issue and rerun manually.
  Batch mode adds no persistence, rollback, resume, parallelism, or telemetry.

Loop mode:
  spec-finder loop <task_slug> is the continuous driver for one packet. spec-finder run remains a
  single pass. Loop shares the workspace run-lock and the same runtime flags: --no-ui, --provider NAME,
  --model ID, --reasoning LEVEL, and --speed MODE.
  Loop-only flags: --dry-run, --reset-state, --max-iterations N, --no-progress-window N.
  --dry-run prints pending and recovery actions and writes nothing.
  Defaults are --max-iterations 50 and --no-progress-window 3.
  Named terminals: done, no_op, blocked, failed, exhausted, stalled, and cancelled.
  Exits: 0 done/no_op; 1 blocked/failed/exhausted/stalled; 2 invalid invocation/packet/ledger; 130 cancelled.
  loop does not support --multiple and adds no required loop config key.
  Cockpit iteration meters, a portable loop skill, QA/review/ship, continue-on-error, and multi-packet loop are later.

  Checkpoint mode:
  checkpoint begin|complete uses only .spec-finder/config.json auto_commit: true and the shared local Git service.
  It creates local recovery checkpoints only; it never pushes, opens a PR, or implies review or merge.
  Legacy auto-commit=true|false invocation tokens are rejected; configure auto_commit in JSON and rerun.
`

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...args] = argv
  switch (command) {
    case "setup": return setupCommand(args)
    case "upgrade": return upgradeCommand()
    case "run": return runCommand(args)
    case "loop": return loopCommand(args)
    case "checkpoint": return checkpointCommand(args)
    case "config": return configCommand()
    case "version":
    case "--version":
    case "-v": return versionCommand()
    case "help":
    case "--help":
    case "-h":
    case undefined:
      process.stdout.write(HELP)
      return 0
    default:
      process.stderr.write(`unknown command: ${command}\n\n${HELP}`)
      return 2
  }
}

if (import.meta.main) {
  try {
    process.exitCode = await main()
  } catch (error) {
    if (error instanceof ConfigError && error.issues.length > 0) {
      process.stderr.write(`${error.message}\n${error.issues.map((issue) => `- ${issue}`).join("\n")}\n`)
    } else {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    }
    process.exitCode = 1
  }
}
