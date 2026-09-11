import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import type { Writable } from "node:stream"
import {
  parseMultipleArgs,
  runBatch,
  type BatchArguments,
  type BatchResult,
  type BatchRunOptions,
  type PacketSummary,
} from "./batch.ts"
import {
  ConfigError,
  PROVIDERS,
  SPEED_VALUES,
  applyRuntimeConfigOverrides,
  loadConfig,
  type ProviderName,
  type SpecFinderConfig,
} from "./config.ts"
import {
  createCheckpointService,
  type CheckpointOutcome,
  type CheckpointServiceContract,
} from "./checkpoints.ts"
import { runTaskPacket, type RunOptions, type RunResult } from "./engine.ts"
import { type RunEvent, type RunEventListener } from "./events.ts"
import {
  runLoop,
  type LoopResult,
  type LoopRunOptions,
} from "./loop.ts"
import { LoopStateError, type LoopTerminal } from "./loop-state.ts"
import { runExec, type ExecRunOptions } from "./exec.ts"
import {
  type ExecRuntimeOverrides,
} from "./exec-config.ts"
import { CONFIG_FILE, SPEC_DIR, findWorkspaceRoot } from "./paths.ts"
import { inspectPacket, listActivePackets } from "./packet-inspect.ts"
import { acquireRunLock } from "./run-lock.ts"
import {
  refreshManagedSkills,
  resolveSetupSkills,
  setupWorkspace,
  SPEC_FINDER_SKILLS,
  type SetupScope,
  type SetupInputOrigin,
  type SetupRequest,
  type SetupResult,
  type SetupSpeed,
  type SpecFinderSkill,
} from "./setup.ts"
import {
  defaultsRuntimeToAutoOnProviderSwitch,
  getSetupModelChoices,
  getSetupProfile,
  isCuratedSetupModel,
} from "./setup-profile.ts"
import { isValidTaskSlug, loadTaskPacket, validateTasks, type TaskFile } from "./tasks.ts"
import { CockpitStore } from "./ui/store.ts"
import { startCockpit, type CockpitSession } from "./ui/cockpit.tsx"
import {
  setupMultiSelect,
  setupSelect,
  type SetupPickerInput,
} from "./ui/setup-picker.ts"
import { PACKAGE_NAME, VERSION } from "./version.ts"

const TASK_ID_PATTERN = /^task_\d+$/
const LEGACY_AUTO_COMMIT_PATTERN = /^-{0,2}auto-commit=(?:true|false)$/
const EXEC_VALUE_OPTIONS = new Set(["--provider", "--model", "--reasoning", "--speed"])

export type ExecParseErrorCode =
  | "missing_prompt"
  | "blank_prompt"
  | "missing_value"
  | "option_like_value"
  | "unknown_option"
  | "extra_positional"

export interface ExecParseError {
  code: ExecParseErrorCode
  message: string
  argument?: string
  index?: number
}

export interface ParsedExecArguments {
  mode: "exec"
  prompt: string
  overrides: ExecRuntimeOverrides
}

export interface ExecParseFailure {
  mode: "error"
  error: ExecParseError
}

export type ExecArguments = ParsedExecArguments | ExecParseFailure

export type LoopParseErrorCode =
  | "missing_slug"
  | "invalid_slug"
  | "extra_positional"
  | "unknown_option"
  | "missing_value"
  | "option_like_value"
  | "multiple_unsupported"
  | "invalid_integer"

export interface LoopParseError {
  code: LoopParseErrorCode
  message: string
  argument?: string
  index?: number
}

export interface ParsedLoopArguments {
  mode: "loop"
  slug: string
  dryRun: boolean
  resetState: boolean
  maxIterations?: number
  noProgressWindow?: number
}

export interface LoopParseFailure {
  mode: "error"
  error: LoopParseError
}

export type LoopArguments = ParsedLoopArguments | LoopParseFailure

export const LOOP_USAGE = "usage: spec-finder loop <task_slug> [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE] [--max-iterations N] [--no-progress-window N] [--dry-run] [--reset-state]"

const LOOP_VALUE_OPTIONS = new Set([
  "--provider",
  "--model",
  "--reasoning",
  "--speed",
  "--max-iterations",
  "--no-progress-window",
])
const LOOP_BOOLEAN_OPTIONS = new Set(["--no-ui", "--dry-run", "--reset-state"])
const POSITIVE_INTEGER = /^[1-9]\d*$/

export class ExecInvocationError extends Error {
  readonly code: ExecParseErrorCode
  readonly argument: string | undefined
  readonly index: number | undefined

  constructor(error: ExecParseError) {
    super(error.message)
    this.name = "ExecInvocationError"
    this.code = error.code
    this.argument = error.argument
    this.index = error.index
  }
}

export type SetupOptions = SetupRequest

export interface SetupResolutionOptions {
  interactive?: boolean
  input?: SetupPickerInput
  output?: Writable
  root?: string
  loadConfig?: (root: string) => Promise<SpecFinderConfig>
}

export interface SetupCommandOptions extends SetupResolutionOptions {
  setupWorkspace?: (root: string, request: SetupRequest) => Promise<SetupResult>
}

export interface RunCommandOptions {
  /** Test and embedding seam; the normal CLI resolves the workspace from cwd. */
  root?: string
  /** Test and embedding seam; defaults to process.stdout. */
  output?: Writable & { isTTY?: boolean }
  /** Test and embedding seam; defaults to process.stdin. */
  input?: { isTTY?: boolean }
  /** Override the normal config loader for deterministic command tests. */
  loadConfig?: (root: string) => Promise<SpecFinderConfig>
  /** Override the coordinator while preserving the command lifecycle contract. */
  runBatch?: (options: BatchRunOptions) => Promise<BatchResult>
  /** Override the packet engine while preserving the single-run branch. */
  runTaskPacket?: (options: RunOptions) => Promise<RunResult>
  /** Override cockpit startup for renderer lifecycle tests. */
  startCockpit?: typeof startCockpit
  /** Force no-UI mode in tests; otherwise flags or non-TTY streams select it. */
  noUi?: boolean
}

export interface LoopCommandOptions extends RunCommandOptions {
  /** Override the loop coordinator while preserving lock and exit mapping. */
  runLoop?: (options: LoopRunOptions) => Promise<LoopResult>
}

export interface CheckpointCommandOptions {
  /** Test and embedding seam; the normal CLI resolves the workspace from cwd. */
  root?: string
  /** Test and embedding seam; defaults to process.stdout. */
  output?: Writable
  /** Override the normal config loader for deterministic command tests. */
  loadConfig?: (root: string) => Promise<SpecFinderConfig>
  /** Override packet loading while preserving packet/task validation. */
  loadTaskPacket?: (root: string, slug: string) => Promise<{ directory: string; tasks: TaskFile[] }>
  /** Override the shared service while preserving the CLI bridge contract. */
  checkpointService?: CheckpointServiceContract
}

export type ExecCommandOptions = ExecRunOptions

type CheckpointPhase = "begin" | "complete"

export async function setupCommand(args: string[], commandOptions: SetupCommandOptions = {}): Promise<number> {
  const root = commandOptions.root ?? process.cwd()
  const output = commandOptions.output ?? process.stdout
  const request = await resolveSetupOptions(args, {
    ...commandOptions,
    root,
  })
  const install = commandOptions.setupWorkspace ?? setupWorkspace
  const result = await install(root, request)
  output.write(`configured ${result.configPath}\n`)
  output.write(`provider: ${result.provider}\n`)
  output.write(`requested model: ${result.model}\n`)
  output.write(`requested speed: ${result.speed}\n`)
  output.write(`destination: ${result.destination}\n`)
  output.write(`skill root: ${result.skillRoot}\n`)
  output.write(`scope: ${result.scope}\n`)
  output.write(`installed managed skills: ${result.installed.length}\n`)
  output.write(`legacy Cursor skills: ${result.legacyCursor === "preserved" ? "preserved (not migrated)" : "absent (not migrated)"}\n`)
  output.write(`packet gitignore: ${result.gitignoreStatus}\n`)
  return 0
}

export async function resolveSetupOptions(
  args: readonly string[],
  resolutionOptions: SetupResolutionOptions = {},
): Promise<SetupOptions> {
  const provided = parseSetupArguments(args)
  const root = resolutionOptions.root ?? process.cwd()
  const interactive = resolutionOptions.interactive ?? isInteractiveTerminal()
  const input = resolutionOptions.input ?? process.stdin
  const output = resolutionOptions.output ?? process.stdout
  const saved = await loadSavedSetup(root, resolutionOptions.loadConfig ?? loadConfig)
  const savedIntent = saved.config !== undefined && (saved.legacy || saved.config.setup.status === "configured")
  const savedProvider = savedIntent ? saved.config?.provider : undefined
  const defaultProvider = savedProvider ?? "codex"

  let provider: ProviderName
  let providerOrigin: SetupInputOrigin
  if (provided.provider !== undefined) {
    provider = provided.provider
    providerOrigin = "flag"
  } else if (interactive) {
    provider = await promptForProvider(input, output, defaultProvider)
    providerOrigin = savedProvider !== undefined && provider === savedProvider ? "saved" : "default"
  } else {
    provider = defaultProvider
    providerOrigin = savedProvider !== undefined ? "saved" : "default"
  }

  const scope = provided.scope ?? (interactive
    ? await promptForScope(input, output, saved.config?.setup.status === "configured" ? saved.config.setup.scope : saved.legacy ? undefined : "local")
    : saved.config?.setup.status === "configured"
      ? saved.config.setup.scope
      : saved.legacy
        ? await requireLegacyScope()
        : "local")

  const providerChanged = savedProvider !== undefined && provider !== savedProvider
  const hasSavedProvider = savedProvider !== undefined && provider === savedProvider
  const profile = getSetupProfile(provider)
  let model: string
  let modelOrigin: SetupInputOrigin
  if (provided.model !== undefined) {
    model = validateSetupModel(provider, provided.model)
    modelOrigin = "flag"
  } else if (interactive) {
    const savedModel = hasSavedProvider ? saved.config?.model : undefined
    model = await promptForModel(input, output, provider, savedModel, providerChanged || !savedIntent)
    modelOrigin = hasSavedProvider && model === savedModel ? "saved" : "default"
  } else if (hasSavedProvider && saved.config !== undefined && !providerChanged) {
    model = saved.config.model
    modelOrigin = "saved"
  } else {
    model = profile.defaultModel
    modelOrigin = "default"
  }

  let speed: SetupSpeed
  let speedOrigin: SetupInputOrigin
  if (provided.speed !== undefined) {
    speed = provided.speed
    speedOrigin = "flag"
  } else if (interactive) {
    const savedSpeed = savedIntent ? saved.config?.speed : undefined
    speed = await promptForSpeed(input, output, savedSpeed, !savedIntent)
    speedOrigin = savedIntent && speed === savedSpeed ? "saved" : "default"
  } else if (saved.config !== undefined && savedIntent) {
    speed = saved.config.speed
    speedOrigin = "saved"
  } else {
    speed = "normal"
    speedOrigin = "default"
  }

  const skills = interactive
    ? await promptForSkills(input, output, savedSetupSkills(saved.config))
    : savedSetupSkills(saved.config)


  return {
    provider,
    model,
    speed,
    scope,
    skills,
    origin: {
      provider: providerOrigin,
      model: modelOrigin,
      speed: speedOrigin,
    },
  }

}

/**
 * Parse the public one-turn exec grammar without resolving configuration or
 * starting a provider. The returned error branch deliberately contains no
 * prompt or executable context.
 */
export function parseExecArguments(args: readonly string[]): ExecArguments {
  let prompt: string | undefined
  const overrides: ExecRuntimeOverrides = {}

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!

    if (EXEC_VALUE_OPTIONS.has(argument)) {
      const value = args[index + 1]
      if (value === undefined || value.length === 0) {
        return execParseFailure(
          "missing_value",
          `${argument} requires a non-empty value`,
          argument,
          index,
        )
      }
      if (value.startsWith("-")) {
        return execParseFailure(
          "option_like_value",
          `${argument} value cannot be option-like: ${value}`,
          value,
          index + 1,
        )
      }
      setExecOverride(overrides, argument, value)
      index += 1
      continue
    }

    if (argument.startsWith("-")) {
      return execParseFailure(
        "unknown_option",
        `unsupported exec option: ${argument}`,
        argument,
        index,
      )
    }

    if (argument.trim().length === 0) {
      return execParseFailure(
        "blank_prompt",
        "exec requires one non-empty prompt",
        argument,
        index,
      )
    }
    if (prompt !== undefined) {
      return execParseFailure(
        "extra_positional",
        `exec accepts exactly one prompt; unexpected positional argument: ${argument}`,
        argument,
        index,
      )
    }
    prompt = argument
  }

  if (prompt === undefined) {
    return execParseFailure("missing_prompt", "exec requires one non-empty prompt", undefined, args.length)
  }
  return { mode: "exec", prompt, overrides }
}

/** Common aliases for embedding callers and future command routing. */
export const parseExecArgs = parseExecArguments
export const parseExecInvocation = parseExecArguments

/** Throwing adapter for command layers that use exception-based preflight. */
export function parseExecArgumentsOrThrow(args: readonly string[]): ParsedExecArguments {
  const parsed = parseExecArguments(args)
  if (parsed.mode === "error") throw new ExecInvocationError(parsed.error)
  return parsed
}

export const parseExecArgsOrThrow = parseExecArgumentsOrThrow

export function parseLoopArgs(args: readonly string[]): LoopArguments {
  let slug: string | undefined
  let dryRun = false
  let resetState = false
  let maxIterations: number | undefined
  let noProgressWindow: number | undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!

    if (argument === "--multiple") {
      return loopParseFailure("multiple_unsupported", "loop does not support --multiple; drive one packet per invocation", argument, index)
    }
    if (LOOP_BOOLEAN_OPTIONS.has(argument)) {
      if (argument === "--dry-run") dryRun = true
      if (argument === "--reset-state") resetState = true
      continue
    }
    if (LOOP_VALUE_OPTIONS.has(argument)) {
      const value = args[index + 1]
      if (value === undefined || value.length === 0) {
        return loopParseFailure("missing_value", `${argument} requires a non-empty value`, argument, index)
      }
      if (value.startsWith("-")) {
        return loopParseFailure("option_like_value", `${argument} value cannot be option-like: ${value}`, value, index + 1)
      }
      if (argument === "--max-iterations" || argument === "--no-progress-window") {
        if (!POSITIVE_INTEGER.test(value)) {
          return loopParseFailure("invalid_integer", `${argument} must be a positive integer`, value, index + 1)
        }
        const parsed = Number.parseInt(value, 10)
        if (argument === "--max-iterations") maxIterations = parsed
        else noProgressWindow = parsed
      }
      index += 1
      continue
    }
    if (argument.startsWith("-")) {
      return loopParseFailure("unknown_option", `unsupported loop option: ${argument}`, argument, index)
    }
    if (slug !== undefined) {
      return loopParseFailure("extra_positional", `loop accepts exactly one packet slug; unexpected positional argument: ${argument}`, argument, index)
    }
    if (!isValidTaskSlug(argument)) {
      return loopParseFailure("invalid_slug", `invalid task slug: ${argument}`, argument, index)
    }
    slug = argument
  }

  if (slug === undefined) {
    return loopParseFailure("missing_slug", "loop requires exactly one packet slug", undefined, args.length)
  }
  return {
    mode: "loop",
    slug,
    dryRun,
    resetState,
    ...(maxIterations === undefined ? {} : { maxIterations }),
    ...(noProgressWindow === undefined ? {} : { noProgressWindow }),
  }
}

function loopParseFailure(
  code: LoopParseErrorCode,
  message: string,
  argument: string | undefined,
  index: number,
): LoopParseFailure {
  return {
    mode: "error",
    error: {
      code,
      message,
      index,
      ...(argument === undefined ? {} : { argument }),
    },
  }
}

/**
 * Route one packet-free turn through the signal and stream boundary. The
 * command owns the process listener; the neutral ACP core owns semantic
 * cancellation and bounded provider cleanup after the signal is observed.
 */
export async function execCommand(
  args: readonly string[],
  options: ExecCommandOptions = {},
): Promise<number> {
  const controller = options.controller ?? new AbortController()
  const forceController = options.forceController ?? new AbortController()
  const signal = options.signal ?? controller.signal
  const forceSignal = options.forceSignal ?? forceController.signal
  let interruptCount = 0
  const onInterrupt = () => {
    interruptCount += 1
    if (interruptCount === 1) {
      if (!signal.aborted) controller.abort()
      return
    }
    if (!forceSignal.aborted) forceController.abort()
  }
  process.on("SIGINT", onInterrupt)
  try {
    return await runExec(args, { ...options, controller, signal, forceController, forceSignal })
  } finally {
    process.off("SIGINT", onInterrupt)
  }
}

export const runExecCommand = execCommand
export const executeExecCommand = execCommand

function setExecOverride(overrides: ExecRuntimeOverrides, argument: string, value: string): void {
  if (argument === "--provider") overrides.provider = value
  if (argument === "--model") overrides.model = value
  if (argument === "--reasoning") overrides.reasoning = value
  if (argument === "--speed") overrides.speed = value
}

function execParseFailure(
  code: ExecParseErrorCode,
  message: string,
  argument?: string,
  index?: number,
): ExecParseFailure {
  return {
    mode: "error",
    error: {
      code,
      message,
      ...(argument === undefined ? {} : { argument }),
      ...(index === undefined ? {} : { index }),
    },
  }
}

interface ParsedSetupArguments {
  provider?: ProviderName
  model?: string
  speed?: SetupSpeed
  scope?: SetupScope
}

export function parseSetupArguments(args: readonly string[]): ParsedSetupArguments {
  let provider: ProviderName | undefined
  let model: string | undefined
  let speed: SetupSpeed | undefined
  let scope: SetupScope | undefined
  let copySeen = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!
    if (argument === "--agent" || argument === "--model" || argument === "--speed") {
      const value = args[index + 1]
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`)
      index += 1
      if (argument === "--agent") provider = setProvider(provider, value)
      else if (argument === "--model") model = setSingularValue(model, value, "model")
      else speed = parseSetupSpeed(setSingularValue(speed, value, "speed"))
      continue
    }
    if (argument.startsWith("--agent=")) {
      provider = setProvider(provider, argument.slice("--agent=".length))
      continue
    }
    if (argument.startsWith("--model=")) {
      model = setSingularValue(model, argument.slice("--model=".length), "model")
      continue
    }
    if (argument.startsWith("--speed=")) {
      speed = parseSetupSpeed(setSingularValue(speed, argument.slice("--speed=".length), "speed"))
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
      throw new Error("setup no longer supports --symlink; use --copy (copy is the only installation mode)")
    }
    if (argument === "--copy") {
      if (copySeen) throw new Error("duplicate setup option: --copy")
      copySeen = true
      continue
    }
    throw new Error(`unsupported setup option: ${argument}`)
  }

  return {
    ...(provider === undefined ? {} : { provider }),
    ...(model === undefined ? {} : { model }),
    ...(speed === undefined ? {} : { speed }),
    ...(scope === undefined ? {} : { scope }),
  }
}

function setProvider(current: ProviderName | undefined, value: string): ProviderName {
  if (current !== undefined) throw new Error("setup accepts exactly one --agent provider; repeated --agent is not allowed")
  if (!(PROVIDERS as readonly string[]).includes(value)) throw new Error(`unsupported setup agent: ${value}`)
  return value as ProviderName
}

function setSingularValue<T>(current: T | undefined, value: string, label: string): string {
  if (current !== undefined) throw new Error(`duplicate setup option: --${label}`)
  if (value.trim().length === 0) throw new Error(`--${label} requires a non-empty value`)
  return value
}

function parseSetupSpeed(value: string): SetupSpeed {
  if (!(SPEED_VALUES as readonly string[]).includes(value)) {
    throw new Error(`unsupported setup speed: ${value}; choose auto, normal, or fast`)
  }
  return value as SetupSpeed
}

function setSetupScope(current: SetupScope | undefined, next: SetupScope): SetupScope {
  if (current === next) throw new Error(`duplicate setup scope: --${next}`)
  if (current !== undefined) throw new Error("setup accepts either --global or --local, not both")
  return next
}

function isInteractiveTerminal(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true
}

async function promptForProvider(
  input: SetupPickerInput,
  output: Writable,
  initialValue: ProviderName,
): Promise<ProviderName> {
  return setupSelect({
    message: "Choose provider",
    items: [
      { label: "Claude", value: "claude", hint: "skills in .claude/skills" },
      { label: "Codex", value: "codex", hint: "skills in .agents/skills" },
      { label: "Cursor", value: "cursor", hint: "skills in .agents/skills" },
      { label: "Grok Build", value: "grok", hint: "skills in .agents/skills" },
      { label: "Pi", value: "pi", hint: "skills in .agents/skills" },
    ],
    initialValue,
    required: true,
    requiredMessage: "Choose one provider before continuing",
    input,
    output,
  })
}

async function promptForScope(input: SetupPickerInput, output: Writable, initialValue?: SetupScope): Promise<SetupScope> {
  return setupSelect({
    message: "Choose installation scope",
    items: [
      { label: "Local", value: "local", hint: "current project" },
      { label: "Global", value: "global", hint: "home directory" },
    ],
    ...(initialValue === undefined ? {} : { initialValue }),
    required: true,
    requiredMessage: "Choose a scope before continuing",
    input,
    output,
  })
}

async function promptForModel(
  input: SetupPickerInput,
  output: Writable,
  provider: ProviderName,
  savedModel: string | undefined,
  useFreshDefault: boolean,
): Promise<string> {
  const items = getSetupModelChoices(provider).map((value) => ({
    label: value,
    value,
    ...(value === "auto"
      ? { hint: "provider-directed" }
      : value === getSetupProfile(provider).defaultModel
        ? { hint: "catalogue default" }
        : {}),
  }))
  const keepCustom = savedModel !== undefined && !isCuratedSetupModel(provider, savedModel)
  if (keepCustom) items.unshift({ label: `Keep existing custom model (${savedModel})`, value: savedModel, hint: "saved runtime value" })
  const initialValue = useFreshDefault
    ? getSetupProfile(provider).defaultModel
    : savedModel ?? getSetupProfile(provider).defaultModel
  return setupSelect({
    message: "Choose model",
    items,
    initialValue,
    required: true,
    requiredMessage: "Choose a model before continuing",
    input,
    output,
  })
}

async function promptForSpeed(
  input: SetupPickerInput,
  output: Writable,
  savedSpeed: SetupSpeed | undefined,
  useFreshDefault: boolean,
): Promise<SetupSpeed> {
  return setupSelect({
    message: "Choose speed",
    items: [
      { label: "Auto", value: "auto", hint: "provider-directed" },
      { label: "Normal", value: "normal", hint: "balanced" },
      { label: "Fast", value: "fast", hint: "lower latency when available" },
    ],
    initialValue: useFreshDefault ? "normal" : savedSpeed ?? "normal",
    required: true,
    requiredMessage: "Choose a speed before continuing",
    input,
    output,
  })
}

const SKILL_HINTS: Record<SpecFinderSkill, string> = {
  "sf-idea-factory": "idea discovery",
  "sf-create-prd": "product requirements",
  "sf-create-techspec": "technical design",
  "sf-create-tasks": "task plan",
  "sf-write-spec": "one-shot spec",
  "sf-memory": "packet memory",
  "sf-execute-task": "implement a task",
  "sf-task-report": "evidence report",
  "sf-batch-tasks": "run a task range",
  "sf-tdd-plan": "TDD plan",
  "sf-tdd-execute": "red-green execute",
  "sf-tdd-report": "TDD report",
  "sf-tdd-batch": "TDD range",
  "sf-archive-tasks": "archive completed packets",
}

async function promptForSkills(
  input: SetupPickerInput,
  output: Writable,
  initialSelected: readonly SpecFinderSkill[],
): Promise<SpecFinderSkill[]> {
  const selected = await setupMultiSelect({
    message: "Choose skills to install",
    items: SPEC_FINDER_SKILLS.map((value) => ({
      label: value,
      value,
      hint: SKILL_HINTS[value],
    })),
    initialSelected: [...initialSelected],
    required: true,
    requiredMessage: "Select at least one skill before continuing",
    input,
    output,
  })
  return resolveSetupSkills(selected)
}

function savedSetupSkills(config: SpecFinderConfig | undefined): SpecFinderSkill[] {
  if (config?.setup.status === "configured") return resolveSetupSkills(config.setup.skills)
  return resolveSetupSkills()
}


function validateSetupModel(provider: ProviderName, model: string): string {
  const normalized = model.trim()
  if (!isCuratedSetupModel(provider, normalized)) {
    throw new Error(`unsupported setup model for ${provider}: ${model}; choose auto or a curated ${provider} model`)
  }
  return normalized
}

async function requireLegacyScope(): Promise<never> {
  throw new Error("migrated v1/v2 setup has no saved scope; rerun with --local or --global")
}

interface SavedSetup {
  config?: SpecFinderConfig
  legacy: boolean
}

async function loadSavedSetup(
  root: string,
  load: (root: string) => Promise<SpecFinderConfig>,
): Promise<SavedSetup> {
  let config: SpecFinderConfig | undefined
  try {
    config = await load(root)
  } catch (error) {
    if (!isMissingConfigError(error)) throw error
  }
  return {
    ...(config === undefined ? {} : { config }),
    legacy: await isLegacyConfigFile(root),
  }
}

async function isLegacyConfigFile(root: string): Promise<boolean> {
  try {
    const raw = await readFile(join(root, SPEC_DIR, CONFIG_FILE), "utf8")
    const parsed = JSON.parse(raw) as { version?: unknown }
    return parsed.version === 1 || parsed.version === 2
  } catch (error) {
    if (isMissingConfigError(error)) return false
    return false
  }
}

function isMissingConfigError(error: unknown): boolean {
  return error instanceof ConfigError
    ? error.message.startsWith("cannot read")
    : error instanceof Error && error.message.startsWith("cannot read")
}

export async function configCommand(): Promise<number> {
  const root = await findWorkspaceRoot()
  const config = await loadConfig(root)
  process.stdout.write(`valid ${root}/.spec-finder/config.json\n`)
  process.stdout.write(`${JSON.stringify(config, null, 2)}\n`)
  return 0
}

export async function checkpointCommand(
  args: readonly string[],
  options: CheckpointCommandOptions = {},
): Promise<number> {
  rejectLegacyAutoCommitTokens(args)
  const parsed = parseCheckpointArguments(args)
  const root = options.root ?? await findWorkspaceRoot()
  const output = options.output ?? process.stdout
  const load = options.loadConfig ?? loadConfig
  const config = await load(root)

  if (!config.auto_commit) {
    output.write(
      `checkpoint ${parsed.phase} requires auto_commit: true in .spec-finder/config.json; `
      + "no Git changes were made\n",
    )
    return 1
  }

  const loadPacket = options.loadTaskPacket ?? loadTaskPacket
  const packet = await loadPacket(root, parsed.slug)
  const issues = validateTasks(packet.tasks)
  if (issues.length > 0) {
    throw new Error(`task packet is invalid:\n${issues.map((issue) => `- ${relative(root, issue.path)}: ${issue.message}`).join("\n")}`)
  }
  const task = packet.tasks.find((candidate) => candidate.id === parsed.taskId)
  if (task === undefined) throw new Error(`task not found: ${parsed.taskId} in packet ${parsed.slug}`)

  const service = options.checkpointService ?? createCheckpointService({ config })
  let outcome: CheckpointOutcome
  try {
    outcome = parsed.phase === "begin"
      ? await service.begin({ root, slug: parsed.slug, task, config })
      : await service.complete({ root, slug: parsed.slug, task, config })
  } catch (error) {
    output.write(`checkpoint ${parsed.phase} blocked for ${parsed.slug}/${parsed.taskId}: ${errorMessage(error)}\n`)
    return 1
  }

  return reportCheckpointOutcome(output, parsed.phase, parsed.slug, parsed.taskId, outcome)
}

export async function runCommand(args: string[], options: RunCommandOptions = {}): Promise<number> {
  rejectLegacyAutoCommitTokens(args)
  const parsed = parseMultipleArgs(args)
  if (parsed.mode === "error") throw new Error(parsed.error.message)
  if (parsed.mode === "batch") return runBatchCommand(parsed, options)
  return runSingleCommand(parsed.args, options)
}

export async function loopCommand(args: readonly string[], options: LoopCommandOptions = {}): Promise<number> {
  const output = options.output ?? process.stdout
  const parsed = parseLoopArgs(args)
  if (parsed.mode === "error") {
    output.write(`${parsed.error.message}\n${LOOP_USAGE}\n`)
    return 2
  }

  const input = options.input ?? process.stdin
  const root = options.root ?? await findWorkspaceRoot()
  const lease = await acquireRunLock(root)
  const load = options.loadConfig ?? loadConfig
  const lifecycle = createCommandLifecycle(args, options, input, output)
  try {
    let config = await load(root)
    config = applyRunOverrides(config, args)
    const store = new CockpitStore()
    const consoleListener = createSingleConsoleListener(output)
    const emit = wrapLoopEmit(lifecycle.noUi ? consoleListener : store.listener)
    await lifecycle.startCockpit(store)
    const run = options.runLoop ?? runLoop
    const result = await run({
      root,
      slug: parsed.slug,
      config,
      signal: lifecycle.controller.signal,
      emit,
      interactivePermissions: !lifecycle.noUi,
      dryRun: parsed.dryRun,
      resetState: parsed.resetState,
      ...(parsed.maxIterations === undefined ? {} : { maxIterations: parsed.maxIterations }),
      ...(parsed.noProgressWindow === undefined ? {} : { noProgressWindow: parsed.noProgressWindow }),
    })
    if (parsed.dryRun) return 0
    if (result.terminal === "no_op") await lifecycle.waitForNoWork()
    await lifecycle.waitForDismissal(result.terminal !== "done" && result.terminal !== "no_op" && result.terminal !== "cancelled")
    return loopExitCode(result.terminal)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    output.write(`${message}\n`)
    if (error instanceof ConfigError) return 2
    if (
      error instanceof LoopStateError
      || message.includes("task packet is invalid")
      || message.includes("no task_XX.md")
      || message.includes("invalid task slug")
    ) {
      return 2
    }
    return 1
  } finally {
    lifecycle.close()
    await lease.release()
  }
}

function wrapLoopEmit(listener: RunEventListener): RunEventListener {
  let seenRunStarted = false
  return (event: RunEvent) => {
    if (event.type === "run_started") {
      if (seenRunStarted) return
      seenRunStarted = true
    }
    listener(event)
  }
}

function loopExitCode(terminal: LoopTerminal): number {
  if (terminal === "done" || terminal === "no_op") return 0
  if (terminal === "cancelled") return 130
  return 1
}

function parseCheckpointArguments(args: readonly string[]): { phase: CheckpointPhase; slug: string; taskId: string } {
  if (args.length !== 3) throw new Error("usage: spec-finder checkpoint <begin|complete> <task_slug> <task_id>")
  const phase = args[0]
  if (phase !== "begin" && phase !== "complete") {
    throw new Error(`invalid checkpoint phase: ${phase}; expected begin or complete`)
  }
  const slug = args[1]
  if (!slug || !isValidTaskSlug(slug)) throw new Error(`invalid task slug: ${slug ?? ""}`)
  const taskId = args[2]
  if (!taskId || !TASK_ID_PATTERN.test(taskId)) throw new Error(`invalid task ID: ${taskId ?? ""}`)
  return { phase, slug, taskId }
}

function rejectLegacyAutoCommitTokens(args: readonly string[]): void {
  const token = args.find((argument) => LEGACY_AUTO_COMMIT_PATTERN.test(argument))
  if (token !== undefined) {
    throw new Error(
      `legacy ${token} invocation token is unsupported; set auto_commit in .spec-finder/config.json instead`,
    )
  }
}

function reportCheckpointOutcome(
  output: Writable,
  phase: CheckpointPhase,
  slug: string,
  taskId: string,
  outcome: CheckpointOutcome,
): number {
  if (outcome.state === "disabled") {
    output.write(
      `checkpoint ${phase} requires auto_commit: true in .spec-finder/config.json; `
      + "no Git changes were made\n",
    )
    return 1
  }
  if (outcome.state === "blocked") {
    output.write(`checkpoint ${phase} blocked for ${slug}/${taskId}: ${outcome.message ?? "delivery refused"}\n`)
    return 1
  }
  if (outcome.state === "skipped") {
    output.write(`checkpoint ${phase} skipped for ${slug}/${taskId}: ${outcome.message ?? "continuing without checkpoints"}\n`)
    return 0
  }

  if (phase === "begin") {
    output.write(`checkpoint begin: ${slug}/${taskId}: ${outcome.message ?? "baseline captured"}\n`)
  } else {
    const commit = outcome.commit === undefined ? "" : ` (${outcome.commit})`
    output.write(`checkpoint complete: ${slug}/${taskId}: local checkpoint created${commit}\n`)
  }
  return 0
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface CommandLifecycle {
  readonly controller: AbortController
  readonly noUi: boolean
  readonly startCockpit: (store: CockpitStore) => Promise<void>
  readonly waitForDismissal: (reviewableFailure: boolean) => Promise<void>
  readonly waitForNoWork: () => Promise<void>
  readonly close: () => void
}

function isInteractiveRun(
  args: readonly string[],
  input: { isTTY?: boolean },
  output: { isTTY?: boolean },
  noUi?: boolean,
): boolean {
  return noUi !== true
    && !args.includes("--no-ui")
    && input.isTTY === true
    && output.isTTY === true
}

function createCommandLifecycle(
  args: readonly string[],
  options: RunCommandOptions,
  input: { isTTY?: boolean },
  output: { isTTY?: boolean },
): CommandLifecycle {
  const noUi = !isInteractiveRun(args, input, output, options.noUi)
  const controller = new AbortController()
  const start = options.startCockpit ?? startCockpit
  let cockpit: CockpitSession | null = null
  let closeRequested = false

  const close = () => {
    closeRequested = true
    const session = cockpit
    if (session === null) return
    cockpit = null
    session.close()
  }

  const cancel = () => {
    if (!controller.signal.aborted) controller.abort()
    close()
  }

  return {
    controller,
    noUi,
    startCockpit: async (store) => {
      if (noUi) return
      const session = await start(store, cancel)
      cockpit = session
      if (closeRequested) {
        cockpit = null
        session.close()
      }
    },
    waitForDismissal: async (reviewableFailure) => {
      if (!reviewableFailure || noUi || controller.signal.aborted) return
      await cockpit?.waitForDismissal()
    },
    waitForNoWork: async () => {
      if (noUi || controller.signal.aborted) return
      await cockpit?.waitForExit?.()
    },
    close,
  }
}

async function runSingleCommand(args: readonly string[], options: RunCommandOptions): Promise<number> {
  const slug = args.find((arg) => !arg.startsWith("-"))
  if (!slug) throw new Error("usage: spec-finder run <task_slug> [--no-ui]")
  const output = options.output ?? process.stdout
  const input = options.input ?? process.stdin
  const root = options.root ?? await findWorkspaceRoot()
  const lease = await acquireRunLock(root)
  const load = options.loadConfig ?? loadConfig
  const lifecycle = createCommandLifecycle(args, options, input, output)
  try {
    let config = await load(root)
    config = applyRunOverrides(config, args)
    const store = new CockpitStore()
    const consoleListener = createSingleConsoleListener(output)
    const emit: RunEventListener = lifecycle.noUi ? consoleListener : store.listener
    await lifecycle.startCockpit(store)
    const run = options.runTaskPacket ?? runTaskPacket
    const result = await run({
      root,
      slug,
      config,
      signal: lifecycle.controller.signal,
      emit,
      interactivePermissions: !lifecycle.noUi,
    })
    if (result.ok && result.outcome === "no_work") await lifecycle.waitForNoWork()
    await lifecycle.waitForDismissal(!result.ok)
    return result.ok ? 0 : 1
  } finally {
    lifecycle.close()
    await lease.release()
  }
}

async function runBatchCommand(args: BatchArguments, options: RunCommandOptions): Promise<number> {
  const output = options.output ?? process.stdout
  const input = options.input ?? process.stdin
  const root = options.root ?? await findWorkspaceRoot()
  const lease = await acquireRunLock(root)
  const load = options.loadConfig ?? loadConfig
  const lifecycle = createCommandLifecycle(args.runtimeArgs, options, input, output)

  try {
    let config = await load(root)
    config = applyRunOverrides(config, args.runtimeArgs)
    const store = new CockpitStore()
    const consoleListener = createBatchConsoleListener(output)
    const emit: RunEventListener = lifecycle.noUi ? consoleListener : store.listener
    await lifecycle.startCockpit(store)
    const coordinate = options.runBatch ?? runBatch
    const result = await coordinate({
      root,
      slugs: args.slugs,
      config,
      signal: lifecycle.controller.signal,
      onEvent: emit,
      interactivePermissions: !lifecycle.noUi,
    })
    await lifecycle.waitForDismissal(result.status === "failed")
    return batchExitCode(result)
  } finally {
    lifecycle.close()
    await lease.release()
  }
}

function createSingleConsoleListener(output: Writable): RunEventListener {
  return (event) => {
    if (event.type === "activity") output.write(`${event.taskId ? `${event.taskId}: ` : ""}${event.message.trim()}\n`)
    if (event.type === "task_status") output.write(`${event.taskId}: ${event.status}\n`)
    if (event.type === "run_finished") {
      if (event.ok && event.outcome === "no_work" && event.reason === "all_tasks_complete") {
        output.write("ok: no executable tasks; all tasks are already complete\n")
        return
      }
      output.write(`${event.ok ? "ok" : "failed"}: ${event.message}\n`)
    }
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
          const retry = status === "failed" ? "task retry exhausted; " : ""
          output.write(`batch: ${retry}no automatic packet retry; resolve the issue and rerun manually\n`)
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

export function npmCliCommand(platform = process.platform): string {
  return platform === "win32" ? "npm.cmd" : "npm"
}

export async function upgradeCommand(): Promise<number> {
  const child = spawn(npmCliCommand(), ["install", "--global", `${PACKAGE_NAME}@latest`], { stdio: "inherit" })
  const code = await new Promise<number>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (value) => resolve(value ?? 1))
  })
  return code
}

export const REFRESH_USAGE = "usage: spec-finder refresh"

export interface RefreshCommandOptions {
  root?: string
  output?: Writable
  error?: Writable
  homeDirectory?: string
  viewLatest?: () => Promise<string>
}

export async function refreshCommand(
  args: readonly string[],
  options: RefreshCommandOptions = {},
): Promise<number> {
  const output = options.output ?? process.stdout
  const stderr = options.error ?? process.stderr
  if (args.length > 0) {
    const argument = args[0]!
    const message = argument.startsWith("-")
      ? `unsupported refresh option: ${argument}`
      : `refresh accepts no arguments; unexpected positional argument: ${argument}`
    stderr.write(`${message}\n${REFRESH_USAGE}\n`)
    return 2
  }

  const root = options.root ?? process.cwd()
  let config: SpecFinderConfig
  try {
    config = await loadConfig(root)
  } catch (caught) {
    if (isMissingConfigError(caught)) {
      stderr.write("workspace is not configured; run spec-finder setup\n")
      return 1
    }
    if (caught instanceof ConfigError) {
      stderr.write(`${caught.message}\n`)
      if (caught.issues.length > 0) {
        stderr.write(`${caught.issues.map((issue) => `- ${issue}`).join("\n")}\n`)
      }
      return 2
    }
    throw caught
  }

  if (config.setup.status !== "configured") {
    stderr.write("workspace is not configured; run spec-finder setup\n")
    return 1
  }

  const viewLatest = options.viewLatest ?? defaultViewLatest
  let latest: string
  try {
    latest = await viewLatest()
  } catch {
    stderr.write("installed package is not latest; run spec-finder upgrade\n")
    return 1
  }
  const version = parseSingleLineVersion(latest)
  if (version === undefined || version !== VERSION) {
    stderr.write("installed package is not latest; run spec-finder upgrade\n")
    return 1
  }

  try {
    const result = await refreshManagedSkills(root, {
      provider: config.provider,
      scope: config.setup.scope,
      ...(config.setup.skills === undefined ? {} : { skills: config.setup.skills }),
    }, options.homeDirectory === undefined ? undefined : { homeDirectory: options.homeDirectory })


    output.write(`destination: ${result.destination}\n`)
    output.write(`skill root: ${result.skillRoot}\n`)
    output.write(`scope: ${result.scope}\n`)
    output.write(`refreshed managed skills: ${result.installed.length}\n`)
    output.write(`legacy Cursor skills: ${result.legacyCursor === "preserved" ? "preserved (not migrated)" : "absent (not migrated)"}\n`)
    return 0
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught)
    stderr.write(`${message}\n`)
    return 1
  }
}

async function defaultViewLatest(): Promise<string> {
  const child = spawn(npmCliCommand(), ["view", PACKAGE_NAME, "version"], {
    stdio: ["ignore", "pipe", "pipe"],
  })
  const chunks: Buffer[] = []
  child.stdout?.on("data", (chunk: Buffer) => {
    chunks.push(chunk)
  })
  const code = await new Promise<number>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (value) => resolve(value ?? 1))
  })
  if (code !== 0) throw new Error(`npm view ${PACKAGE_NAME} version failed`)
  return Buffer.concat(chunks).toString("utf8")
}

function parseSingleLineVersion(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.includes("\n") || trimmed.includes("\r")) return undefined
  return trimmed
}

export function versionCommand(): number {
  process.stdout.write(`${VERSION}\n`)
  return 0
}

export const LS_USAGE = "usage: spec-finder ls"
function writeJson(output: Writable, value: unknown): void {
  output.write(`${JSON.stringify(value)}\n`)
}

export interface LsCommandOptions {
  root?: string
  output?: Writable
  error?: Writable
}

export async function lsCommand(args: readonly string[], options: LsCommandOptions = {}): Promise<number> {
  const output = options.output ?? process.stdout
  const error = options.error ?? process.stderr
  const json = args.includes("--json")
  const invalidArgument = args.find((argument) => argument !== "--json")
  if (args.length > 0 && (args.length !== 1 || !json)) {
    const argument = invalidArgument ?? args[0]!
    const message = argument.startsWith("-")
      ? `unsupported ls option: ${argument}`
      : `ls accepts no arguments; unexpected positional argument: ${argument}`
    if (json) {
      writeJson(error, { ok: false, code: "invalid_invocation", message })
    } else {
      error.write(`${message}\n${LS_USAGE}\n`)
    }
    return 2
  }

  const root = options.root ?? await findWorkspaceRoot()
  const result = await listActivePackets(root)
  if (!result.ok) {
    if (json) writeJson(error, result)
    else error.write(`${result.message}\n`)
    return 2
  }
  if (json) {
    writeJson(output, result)
    return 0
  }
  if (result.rows.length === 0) {
    output.write("no active packets\n")
    return 0
  }
  for (const row of result.rows) {
    const detail = row.kind === "invalid" && row.detail !== undefined ? ` ${row.detail}` : ""
    output.write(`${row.slug} ${row.kind} ${row.completed}/${row.total}${detail}\n`)
  }
  return 0
}

export const INSPECT_USAGE = "usage: spec-finder inspect <task_slug>"

export interface InspectCommandOptions {
  root?: string
  output?: Writable
  error?: Writable
}

export async function inspectCommand(args: readonly string[], options: InspectCommandOptions = {}): Promise<number> {
  const output = options.output ?? process.stdout
  const error = options.error ?? process.stderr
  const jsonCount = args.filter((argument) => argument === "--json").length
  const json = jsonCount > 0
  const positional = args.filter((argument) => argument !== "--json")
  const invalidOption = positional.find((argument) => argument.startsWith("-"))
  let invocationMessage: string | undefined
  if (invalidOption !== undefined) {
    invocationMessage = `unsupported inspect option: ${invalidOption}`
  } else if (positional.length === 0) {
    invocationMessage = "inspect requires exactly one packet slug"
  } else if (positional.length > 1) {
    invocationMessage = `inspect accepts exactly one packet slug; unexpected positional argument: ${positional[1]}`
  } else if (jsonCount > 1) {
    invocationMessage = "inspect accepts --json at most once"
  }
  if (invocationMessage !== undefined) {
    if (json) {
      writeJson(error, { ok: false, code: "invalid_invocation", message: invocationMessage })
    } else {
      error.write(`${invocationMessage}\n${INSPECT_USAGE}\n`)
    }
    return 2
  }

  const argument = positional[0]!
  if (!isValidTaskSlug(argument)) {
    const result = { ok: false as const, code: "invalid_slug" as const, message: `invalid task slug: ${argument}` }
    if (json) writeJson(error, result)
    else error.write(`${result.message}\n${INSPECT_USAGE}\n`)
    return 2
  }

  const root = options.root ?? await findWorkspaceRoot()
  const result = await inspectPacket(root, argument)
  if (!result.ok) {
    if (json) writeJson(error, result)
    else {
      const issues = result.issues?.map((issue) => `- ${issue}`).join("\n")
      error.write(issues === undefined ? `${result.message}\n` : `${result.message}\n${issues}\n`)
    }
    return 2
  }
  if (json) {
    writeJson(output, result)
    return 0
  }

  const remaining = result.remaining.map((task) => task.id).join(" ")
  output.write(`${result.slug} ${result.kind} ${result.completed}/${result.total}\n`)
  output.write(`remaining: ${remaining}\n`)
  for (const blocker of result.blockers) {
    output.write(`${blocker.taskId} ${blocker.kind}: ${blocker.message}\n`)
  }
  if (result.loop.state === "absent") output.write("loop: absent\n")
  else if (result.loop.state === "none") output.write("loop: none\n")
  else if (result.loop.state === "terminal") output.write(`loop: terminal ${result.loop.terminal}\n`)
  else output.write(`loop: ledger invalid: ${result.loop.message}\n`)
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
  const selectedProvider = provider !== undefined && (PROVIDERS as readonly string[]).includes(provider)
    ? provider as ProviderName
    : undefined
  const switchesToAuto = selectedProvider !== undefined
    && defaultsRuntimeToAutoOnProviderSwitch(selectedProvider)
    && config.provider !== selectedProvider
  const selectedModel = model ?? (switchesToAuto ? "auto" : undefined)
  const selectedReasoning = reasoning ?? (switchesToAuto ? "auto" : undefined)
  return applyRuntimeConfigOverrides(config, {
    ...(provider ? { provider: provider as SpecFinderConfig["provider"] } : {}),
    ...(selectedModel === undefined ? {} : { model: selectedModel }),
    ...(selectedReasoning === undefined
      ? {}
      : { reasoning: selectedReasoning as SpecFinderConfig["reasoning"] }),
    ...(speed ? { speed: speed as SpecFinderConfig["speed"] } : {}),
  })
}
