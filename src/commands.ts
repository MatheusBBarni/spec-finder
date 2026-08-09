import { spawn } from "node:child_process"
import type { Writable } from "node:stream"
import {
  parseMultipleArgs,
  runBatch,
  type BatchArguments,
  type BatchResult,
  type BatchRunOptions,
  type PacketSummary,
} from "./batch.ts"
import { loadConfig, parseConfig, type SpecFinderConfig } from "./config.ts"
import { runTaskPacket, type RunOptions, type RunResult } from "./engine.ts"
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

export interface RunCommandOptions {
  /** Test and embedding seam; the normal CLI resolves the workspace from cwd. */
  root?: string
  /** Test and embedding seam; defaults to process.stdout. */
  output?: Writable & { isTTY?: boolean }
  /** Override the normal config loader for deterministic command tests. */
  loadConfig?: (root: string) => Promise<SpecFinderConfig>
  /** Override the coordinator while preserving the command lifecycle contract. */
  runBatch?: (options: BatchRunOptions) => Promise<BatchResult>
  /** Override the packet engine while preserving the single-run branch. */
  runTaskPacket?: (options: RunOptions) => Promise<RunResult>
  /** Override cockpit startup for renderer lifecycle tests. */
  startCockpit?: typeof startCockpit
  /** Force terminal mode in tests; otherwise --no-ui or a non-TTY selects it. */
  noUi?: boolean
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

export async function runCommand(args: string[], options: RunCommandOptions = {}): Promise<number> {
  const parsed = parseMultipleArgs(args)
  if (parsed.mode === "error") throw new Error(parsed.error.message)
  if (parsed.mode === "batch") return runBatchCommand(parsed, options)
  return runSingleCommand(parsed.args, options)
}

async function runSingleCommand(args: readonly string[], options: RunCommandOptions): Promise<number> {
  const slug = args.find((arg) => !arg.startsWith("-"))
  if (!slug) throw new Error("usage: spec-finder run <task_slug> [--no-ui]")
  const output = options.output ?? process.stdout
  const root = options.root ?? await findWorkspaceRoot()
  const load = options.loadConfig ?? loadConfig
  let config = await load(root)
  config = applyRunOverrides(config, args)
  const noUi = options.noUi ?? (args.includes("--no-ui") || output.isTTY !== true)
  const controller = new AbortController()
  const store = new CockpitStore()
  const consoleListener = createSingleConsoleListener(output)
  const emit: RunEventListener = noUi ? consoleListener : store.listener
  const start = options.startCockpit ?? startCockpit
  let cockpit: { close: () => void } | null = null
  try {
    if (!noUi) cockpit = await start(store, () => controller.abort())
    const run = options.runTaskPacket ?? runTaskPacket
    const result = await run({
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

async function runBatchCommand(args: BatchArguments, options: RunCommandOptions): Promise<number> {
  const output = options.output ?? process.stdout
  const root = options.root ?? await findWorkspaceRoot()
  const load = options.loadConfig ?? loadConfig
  let config = await load(root)
  config = applyRunOverrides(config, args.runtimeArgs)
  const noUi = options.noUi ?? (args.runtimeArgs.includes("--no-ui") || output.isTTY !== true)
  const controller = new AbortController()
  const store = new CockpitStore()
  const consoleListener = createBatchConsoleListener(output)
  const emit: RunEventListener = noUi ? consoleListener : store.listener
  const start = options.startCockpit ?? startCockpit
  let cockpit: { close: () => void } | null = null

  try {
    if (!noUi) cockpit = await start(store, () => controller.abort())
    const coordinate = options.runBatch ?? runBatch
    const result = await coordinate({
      root,
      slugs: args.slugs,
      config,
      signal: controller.signal,
      onEvent: emit,
      interactivePermissions: !noUi,
    })
    return batchExitCode(result)
  } finally {
    cockpit?.close()
  }
}

function createSingleConsoleListener(output: Writable): RunEventListener {
  return (event) => {
    if (event.type === "activity") output.write(`${event.taskId ? `${event.taskId}: ` : ""}${event.message.trim()}\n`)
    if (event.type === "task_status") output.write(`${event.taskId}: ${event.status}\n`)
    if (event.type === "run_finished") output.write(`${event.ok ? "ok" : "failed"}: ${event.message}\n`)
  }
}

function createBatchConsoleListener(output: Writable): RunEventListener {
  const reportedPackets = new Set<string>()

  return (event) => {
    switch (event.type) {
      case "batch_started": {
        const total = event.total ?? event.slugs?.length ?? event.packetSlugs?.length ?? event.packets?.length ?? 0
        output.write(`batch: starting ${total} packet${total === 1 ? "" : "s"}\n`)
        break
      }
      case "batch_packet_started": {
        const total = event.total ?? event.packet?.total ?? 0
        const position = event.index + 1
        const progress = total > 0 ? ` ${position}/${total}` : ""
        output.write(`batch: packet${progress} started: ${event.slug}\n`)
        break
      }
      case "batch_packet_finished": {
        reportedPackets.add(packetEventKey(event.index, event.slug))
        const summary = event.summary ?? event.result
        const outcome = event.outcome ?? summary?.outcome ?? "not_started"
        const detail = event.detail ?? summary?.detail
        output.write(`batch: packet outcome: ${event.slug} ${formatPacketOutcome(outcome, detail)}\n`)
        break
      }
      case "batch_finished": {
        const summaries = event.packets ?? event.summaries ?? event.result?.packets ?? []
        for (const [index, summary] of summaries.entries()) {
          const key = packetEventKey(index, summary.slug)
          if (reportedPackets.has(key)) continue
          reportedPackets.add(key)
          output.write(`batch: packet outcome: ${summary.slug} ${formatPacketOutcome(summary.outcome, summary.detail)}\n`)
        }

        const status = event.status ?? event.outcome ?? event.result?.status ?? (event.ok ? "completed" : "failed")
        const stoppingSlug = event.stoppingSlug ?? event.stoppingPacket?.slug ?? event.result?.stoppingSlug
        if (status === "preflight_failed") {
          output.write("batch: preflight failed; no packets started\n")
          if (event.message) output.write(`${event.message.trim()}\n`)
        } else if (status === "failed" || status === "cancelled") {
          if (stoppingSlug) output.write(`batch: stopping packet: ${stoppingSlug} (${status})\n`)
          output.write("batch: no automatic retry; resolve the issue and rerun manually\n")
        }
        output.write(`batch: aggregate ${status === "completed" ? "succeeded" : status} (exit ${event.ok && status === "completed" ? "0" : "1"})\n`)
        break
      }
      // Nested packet lifecycle events are intentionally not forwarded as
      // singular batch output. The additive batch envelope above is the
      // stable terminal presentation for this mode.
      default:
        break
    }
  }
}

function packetEventKey(index: number, slug: string): string {
  return `${index}:${slug}`
}

function formatPacketOutcome(
  outcome: PacketSummary["outcome"],
  detail: PacketSummary["detail"] | undefined,
): string {
  if (detail === "already_complete") return `${outcome} (already complete)`
  return outcome
}

function batchExitCode(result: BatchResult): number {
  const allSucceeded = result.packets.length > 0 && result.packets.every((packet) => packet.outcome === "succeeded")
  return result.ok && result.status === "completed" && allSucceeded ? 0 : 1
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

function valuesFor(args: readonly string[], flag: string): string[] {
  const values: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) values.push(args[index + 1]!)
  }
  return values
}

function valueFor(args: readonly string[], flag: string): string | undefined {
  return valuesFor(args, flag).at(-1)
}

function applyRunOverrides(config: SpecFinderConfig, args: readonly string[]): SpecFinderConfig {
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
