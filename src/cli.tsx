#!/usr/bin/env bun
import { ConfigError } from "./config.ts"
import { configCommand, runCommand, setupCommand, upgradeCommand, versionCommand } from "./commands.ts"

const HELP = `spec-finder — skill-driven specifications with an ACP cockpit

Usage:
  spec-finder setup [--agent claude|codex|cursor]
  spec-finder upgrade
  spec-finder run <task_slug> [--no-ui] [--provider NAME] [--model ID]
  spec-finder config
  spec-finder version
`

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...args] = argv
  switch (command) {
    case "setup": return setupCommand(args)
    case "upgrade": return upgradeCommand()
    case "run": return runCommand(args)
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

