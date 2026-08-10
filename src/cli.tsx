#!/usr/bin/env bun
import { ConfigError } from "./config.ts"
import {
  checkpointCommand,
  configCommand,
  execCommand,
  runCommand,
  setupCommand,
  upgradeCommand,
  versionCommand,
} from "./commands.ts"

const HELP = `spec-finder — skill-driven specifications with an ACP cockpit

Usage:
  spec-finder setup [--agent claude|codex|cursor] [--model auto|CURATED] [--speed auto|normal|fast] [--local|--global] [--copy]
  spec-finder upgrade
  spec-finder run <task_slug> [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
  spec-finder run --multiple <slug1,slug2,...> [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
  spec-finder exec "<prompt>" [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
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
  Destinations are .claude/skills for Claude and .agents/skills for Codex or Cursor. A valid v3
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

  Checkpoint mode:
  checkpoint begin|complete uses only .spec-finder/config.json auto_commit: true and the shared local Git service.
  It creates local recovery checkpoints only; it never pushes, opens a PR, or implies review or merge.
  Legacy auto-commit=true|false invocation tokens are rejected; configure auto_commit in JSON and rerun.

Exec mode:
  Executes exactly one fresh ACP turn without packet, task, report, memory, cockpit, or history state.
  Grammar: spec-finder exec "<prompt>" [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
  Accepts exactly one non-empty positional prompt; flags may appear before or after it, stdin is not prompt input.
  Unknown options, extra positionals, option-like or missing values fail before spawn. Repeated flags use the last value.
  --provider is one of claude, codex, or cursor; --model is non-empty; --reasoning is auto|low|medium|high|xhigh|max|ultra;
  --speed is auto|normal|fast. CLI flags > nearest repository .spec-finder/config.json > ~/.spec-finder/config.json.
  The nearest complete repository profile wins before the complete user profile; fields are not merged.
  Repository and user files are complete fallback profiles, not field-by-field merges. Existing invalid profiles fail before spawn.
  Workspace is the canonical nearest non-symlink .spec-finder ancestor, or the canonical current directory when absent.
  Permission policy comes only from the user profile (prompt|approve-all|deny, otherwise prompt); it is approval policy, not an OS sandbox.
  Host callbacks use direct canonical host access under that policy. The current exec path is read-only: all real providers
  and write-capable access remain unavailable because task 09 certification is blocked; packet providers are separate.
  Progress and terminal status go to stderr; only a successful final answer goes to stdout (after end_turn and confirmed cleanup).
  Exits: 0 completed; 1 permission/refusal/limit/provider/cleanup failure; 2 invalid invocation/configuration/certification;
  130 cancelled. Ctrl-C requests semantic cancellation and returns exit 130, settles pending permissions, and performs bounded cleanup.
  Exec creates no packet, task, report, memory, checkpoint, transcript, history, trust, telemetry, or usage state.
`

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...args] = argv
  switch (command) {
    case "setup": return setupCommand(args)
    case "upgrade": return upgradeCommand()
    case "run": return runCommand(args)
    case "checkpoint": return checkpointCommand(args)
    case "exec": return execCommand(args)
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
