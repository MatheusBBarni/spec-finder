import { spawn } from "node:child_process"
import { loadConfig, parseConfig, type SpecFinderConfig } from "./config.ts"
import { runTaskPacket } from "./engine.ts"
import { type RunEventListener } from "./events.ts"
import { findWorkspaceRoot } from "./paths.ts"
import { setupWorkspace, type SkillTarget } from "./setup.ts"
import { CockpitStore } from "./ui/store.ts"
import { startCockpit } from "./ui/cockpit.tsx"
import { PACKAGE_NAME, VERSION } from "./version.ts"

export async function setupCommand(args: string[]): Promise<number> {
  const root = process.cwd()
  const requested = valuesFor(args, "--agent")
  const targets = (requested.length > 0 ? requested : ["claude", "codex", "cursor"]) as SkillTarget[]
  for (const target of targets) {
    if (!(["claude", "codex", "cursor"] as string[]).includes(target)) throw new Error(`unsupported setup agent: ${target}`)
  }
  const result = await setupWorkspace(root, targets)
  process.stdout.write(`${result.configCreated ? "created" : "validated"} ${result.configPath}\n`)
  process.stdout.write(`installed ${result.installed.length} skill copies\n`)
  return 0
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
