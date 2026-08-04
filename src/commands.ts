import { spawn } from "node:child_process"
import type { Writable } from "node:stream"
import { loadConfig, parseConfig, type SpecFinderConfig } from "./config.ts"
import { runTaskPacket } from "./engine.ts"
import { type RunEventListener } from "./events.ts"
import { findWorkspaceRoot } from "./paths.ts"
import {
  isSkillTarget,
  setupWorkspace,
  type SkillInstallMode,
  type SkillTarget,
  type SetupScope,
} from "./setup.ts"
import { CockpitStore } from "./ui/store.ts"
import { startCockpit } from "./ui/cockpit.tsx"
import {
  setupMultiSelect,
  setupSelect,
  type SetupPickerInput,
} from "./ui/setup-picker.ts"
import { PACKAGE_NAME, VERSION } from "./version.ts"

const ALL_SKILL_TARGETS = ["claude", "codex", "cursor"] as const

export interface SetupOptions {
  targets: SkillTarget[]
  scope: SetupScope
  mode: SkillInstallMode
}

export interface SetupResolutionOptions {
  interactive?: boolean
  input?: SetupPickerInput
  output?: Writable
}

export async function setupCommand(args: string[]): Promise<number> {
  const root = process.cwd()
  const options = await resolveSetupOptions(args)
  const result = await setupWorkspace(root, options.targets, { scope: options.scope, mode: options.mode })
  process.stdout.write(`${result.configCreated ? "created" : "validated"} ${result.configPath}\n`)
  process.stdout.write(`setup scope: ${result.scope}\n`)
  process.stdout.write(`canonical provider: ${result.canonical ?? "none (copy mode)"}\n`)
  process.stdout.write(`copied skill entries: ${result.copied.length}\n`)
  process.stdout.write(`linked skill entries: ${result.linked.length}\n`)
  return 0
}

export async function resolveSetupOptions(
  args: readonly string[],
  resolutionOptions: SetupResolutionOptions = {},
): Promise<SetupOptions> {
  const provided = parseSetupArguments(args)
  const interactive = resolutionOptions.interactive ?? isInteractiveTerminal()
  const input = resolutionOptions.input ?? process.stdin
  const output = resolutionOptions.output ?? process.stdout
  const targets = provided.targets ?? (interactive ? await promptForTargets(input, output) : [...ALL_SKILL_TARGETS])
  const scope = provided.scope ?? (interactive ? await promptForScope(input, output) : "local")
  const mode = provided.mode ?? (interactive ? await promptForMode(input, output) : "copy")
  if (targets.length === 0) throw new Error("select at least one setup provider")
  return { targets, scope, mode }
}

interface ParsedSetupArguments {
  targets?: SkillTarget[]
  scope?: SetupScope
  mode?: SkillInstallMode
}

function parseSetupArguments(args: readonly string[]): ParsedSetupArguments {
  const targets: SkillTarget[] = []
  let requestedTargets = false
  let scope: SetupScope | undefined
  let mode: SkillInstallMode | undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!
    if (argument === "--agent") {
      requestedTargets = true
      const target = args[index + 1]
      if (!target || target.startsWith("--")) throw new Error("setup requires a provider after --agent")
      addSkillTarget(targets, target)
      index += 1
      continue
    }
    if (argument.startsWith("--agent=")) {
      requestedTargets = true
      const target = argument.slice("--agent=".length)
      if (!target) throw new Error("setup requires a provider after --agent")
      addSkillTarget(targets, target)
      continue
    }
    if (argument === "--global") {
      scope = setSetupScope(scope, "global")
      continue
    }
    if (argument === "--local") {
      scope = setSetupScope(scope, "local")
      continue
    }
    if (argument === "--symlink") {
      mode = setInstallMode(mode, "symlink")
      continue
    }
    if (argument === "--copy") {
      mode = setInstallMode(mode, "copy")
      continue
    }
    throw new Error(`unsupported setup option: ${argument}`)
  }

  if (requestedTargets && targets.length === 0) throw new Error("select at least one setup provider")
  return {
    ...(requestedTargets ? { targets } : {}),
    ...(scope ? { scope } : {}),
    ...(mode ? { mode } : {}),
  }
}

function addSkillTarget(targets: SkillTarget[], value: string): void {
  if (!isSkillTarget(value)) throw new Error(`unsupported setup agent: ${value}`)
  targets.push(value)
}

function setSetupScope(current: SetupScope | undefined, next: SetupScope): SetupScope {
  if (current && current !== next) throw new Error("setup accepts either --global or --local, not both")
  return next
}

function setInstallMode(current: SkillInstallMode | undefined, next: SkillInstallMode): SkillInstallMode {
  if (current && current !== next) throw new Error("setup accepts either --symlink or --copy, not both")
  return next
}

function isInteractiveTerminal(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true
}

async function promptForTargets(input: SetupPickerInput, output: Writable): Promise<SkillTarget[]> {
  return setupMultiSelect({
    message: "Select providers",
    items: [
      { label: "Claude", value: "claude" },
      { label: "Codex", value: "codex" },
      { label: "Cursor", value: "cursor" },
    ],
    initialSelected: [...ALL_SKILL_TARGETS],
    required: true,
    input,
    output,
  })
}

async function promptForScope(input: SetupPickerInput, output: Writable): Promise<SetupScope> {
  return setupSelect({
    message: "Choose installation scope",
    items: [
      { label: "Local", value: "local", hint: "current project" },
      { label: "Global", value: "global", hint: "home directory" },
    ],
    input,
    output,
  })
}

async function promptForMode(input: SetupPickerInput, output: Writable): Promise<SkillInstallMode> {
  return setupSelect({
    message: "Choose skill installation mode",
    items: [
      { label: "Copy", value: "copy", hint: "independent provider copies" },
      { label: "Symlink", value: "symlink", hint: "one canonical copy" },
    ],
    input,
    output,
  })
}

export async function configCommand(): Promise<number> {
  const root = await findWorkspaceRoot()
  const config = await loadConfig(root)
  process.stdout.write(`valid ${root}/.spec-finder/config.json\n`)
  process.stdout.write(`${JSON.stringify(config, null, 2)}\n`)
  return 0
}

export async function runCommand(args: string[]): Promise<number> {
  const slug = args.find((arg) => !arg.startsWith("-"))
  if (!slug) throw new Error("usage: spec-finder run <task_slug> [--no-ui]")
  const root = await findWorkspaceRoot()
  let config = await loadConfig(root)
  config = applyRunOverrides(config, args)
  const noUi = args.includes("--no-ui") || !process.stdout.isTTY
  const controller = new AbortController()
  const store = new CockpitStore()
  const consoleListener: RunEventListener = (event) => {
    if (event.type === "activity") process.stdout.write(`${event.taskId ? `${event.taskId}: ` : ""}${event.message.trim()}\n`)
    if (event.type === "task_status") process.stdout.write(`${event.taskId}: ${event.status}\n`)
    if (event.type === "run_finished") process.stdout.write(`${event.ok ? "ok" : "failed"}: ${event.message}\n`)
  }
  const emit: RunEventListener = noUi ? consoleListener : store.listener
  const cockpit = noUi ? null : await startCockpit(store, () => controller.abort())
  try {
    const result = await runTaskPacket({
      root,
      slug,
      config,
      signal: controller.signal,
      emit,
      interactivePermissions: !noUi,
    })
    return result.ok ? 0 : 1
  } finally {
    cockpit?.close()
  }
}

export async function upgradeCommand(): Promise<number> {
  const command = process.platform === "win32" ? "npm.cmd" : "npm"
  const child = spawn(command, ["install", "--global", `${PACKAGE_NAME}@latest`], { stdio: "inherit" })
  const code = await new Promise<number>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (value) => resolve(value ?? 1))
  })
  return code
}

export function versionCommand(): number {
  process.stdout.write(`${VERSION}\n`)
  return 0
}

function valuesFor(args: string[], flag: string): string[] {
  const values: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) values.push(args[index + 1]!)
  }
  return values
}

function valueFor(args: string[], flag: string): string | undefined {
  return valuesFor(args, flag).at(-1)
}

function applyRunOverrides(config: SpecFinderConfig, args: string[]): SpecFinderConfig {
  const provider = valueFor(args, "--provider")
  const model = valueFor(args, "--model")
  const reasoning = valueFor(args, "--reasoning")
  const speed = valueFor(args, "--speed")
  return parseConfig({
    ...config,
    ...(provider ? { provider: provider as SpecFinderConfig["provider"] } : {}),
    ...(model ? { model } : {}),
    ...(reasoning ? { reasoning: reasoning as SpecFinderConfig["reasoning"] } : {}),
    ...(speed ? { speed: speed as SpecFinderConfig["speed"] } : {}),
  })
}
