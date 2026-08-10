import { PROVIDERS, type ProviderName } from "./config.ts"
import type {
  AuthMethodPreference,
  ProviderStderrPolicy,
  SessionConfigAdvertisement,
  SessionConfigNormalizer,
} from "./acp-turn.ts"
import type { SessionConfigOption, SessionConfigSelectOption } from "@agentclientprotocol/sdk"

/** The two product contexts have deliberately different provider prompts. */
export type ProviderLaunchMode = "packet" | "exec"

export interface ProviderLaunchOptions {
  mode?: ProviderLaunchMode
  /**
   * A deterministic process launch supplied by an integration test. Fixture
   * launches are not entries in the production certification registry.
   */
  fixture?: ProviderLaunch
}

export type ProviderLaunchConfig = Pick<{
  provider: ProviderName
  model: string
}, "provider" | "model">

export interface ProviderLaunch {
  /** Product context used when this launch was resolved; fixture launches may omit it. */
  mode?: ProviderLaunchMode
  command: string
  args: string[]
  env: Record<string, string>
  authMethod: string | null
  authPreference?: AuthMethodPreference
  sessionConfigNormalizer?: SessionConfigNormalizer
  stderrPolicy?: ProviderStderrPolicy
}

/**
 * Provider commands are source-owned. `exec` certification is intentionally
 * empty until task_09 records terminal live-provider evidence; packet launches
 * continue to use these entries immediately.
 */
const PROVIDER_LAUNCHES: Readonly<Record<ProviderName, Readonly<ProviderLaunch>>> = {
  claude: {
    command: "npx",
    args: ["--yes", "@agentclientprotocol/claude-agent-acp"],
    env: {},
    authMethod: null,
  },
  codex: {
    command: "npx",
    args: ["--yes", "@agentclientprotocol/codex-acp"],
    env: {},
    authMethod: null,
  },
  cursor: {
    command: "cursor-agent",
    args: ["acp"],
    env: {},
    authMethod: null,
  },
  grok: {
    command: "grok",
    args: ["--no-auto-update", "agent", "stdio"],
    env: {},
    authMethod: null,
    sessionConfigNormalizer: normalizeGrokSessionConfigOptions,
    stderrPolicy: "redact",
  },
}

export interface ProviderCertification {
  readonly exec: boolean
}

export const EXEC_PROVIDER_CERTIFICATION: Readonly<Record<ProviderName, ProviderCertification>> =
  Object.freeze({
    claude: Object.freeze({ exec: false }),
    codex: Object.freeze({ exec: false }),
    cursor: Object.freeze({ exec: false }),
    grok: Object.freeze({ exec: false }),
  })

export class ProviderCertificationError extends Error {
  readonly provider: string
  readonly mode: ProviderLaunchMode

  constructor(provider: string, mode: ProviderLaunchMode = "exec") {
    super(`${provider} is not certified for ${mode} provider launches`)
    this.name = "ProviderCertificationError"
    this.provider = provider
    this.mode = mode
  }
}

/** Alias with the exec-specific name used by configuration adapters. */
export const ExecProviderCertificationError = ProviderCertificationError

export function isProviderName(value: unknown): value is ProviderName {
  return typeof value === "string" && (PROVIDERS as readonly string[]).includes(value)
}

export function isExecProviderCertified(provider: unknown): provider is ProviderName {
  return isProviderName(provider) && EXEC_PROVIDER_CERTIFICATION[provider].exec
}

/** The packet path is not certification-gated; only exec is release-gated. */
export function assertExecProviderCertified(provider: unknown): asserts provider is ProviderName {
  if (!isExecProviderCertified(provider)) throw new ProviderCertificationError(String(provider), "exec")
}

/** Read a source-owned certification decision without exposing mutable state. */
export function getProviderCertification(provider: unknown): ProviderCertification | undefined {
  if (!isProviderName(provider)) return undefined
  return { ...EXEC_PROVIDER_CERTIFICATION[provider] }
}

/**
 * Resolve a provider launch for either product context.
 *
 * The string overload keeps the call site compact (`"packet"` or `"exec"`),
 * while the options overload gives the packet-free command an explicit seam
 * for injected fixture processes. This pure resolver does not start a process;
 * `resolveExecProviderLaunch` applies the source-owned certification gate before
 * a real exec launch. With no mode, packet behavior is preserved.
 */
export function resolveProviderLaunch(
  config: ProviderLaunchConfig,
  mode?: ProviderLaunchMode,
): ProviderLaunch
export function resolveProviderLaunch(
  config: ProviderLaunchConfig,
  options?: ProviderLaunchOptions,
): ProviderLaunch
export function resolveProviderLaunch(
  config: ProviderLaunchConfig,
  modeOrOptions: ProviderLaunchMode | ProviderLaunchOptions = "packet",
): ProviderLaunch {
  const options = typeof modeOrOptions === "string"
    ? { mode: modeOrOptions }
    : modeOrOptions
  const mode = options.mode ?? "packet"

  if (options.fixture !== undefined) {
    return { ...cloneProviderLaunch(options.fixture), mode }
  }
  if (!isProviderName(config.provider)) throw new ProviderCertificationError(String(config.provider), mode)

  const provider = config.provider
  const entry = PROVIDER_LAUNCHES[provider]
  const args = [...entry.args]
  const env = { ...entry.env }
  if (provider === "claude" && config.model !== "auto") env.ANTHROPIC_MODEL = config.model
  if (provider === "cursor" && config.model !== "auto" && !args.includes("--model")) {
    args.push("--model", config.model)
  }
  if (provider === "codex" && mode === "packet") {
    const existing = env.CODEX_CONFIG ? JSON.parse(env.CODEX_CONFIG) as Record<string, unknown> : {}
    env.CODEX_CONFIG = JSON.stringify({ developer_instructions: "Follow the active Spec Finder task and its report contract.", ...existing })
  }
  const authPreference = provider === "grok"
    ? createGrokAuthMethodPreference(process.env.XAI_API_KEY !== undefined)
    : entry.authPreference
  return {
    mode,
    command: entry.command,
    args,
    env,
    authMethod: entry.authMethod,
    ...(authPreference === undefined ? {} : { authPreference }),
    ...(entry.sessionConfigNormalizer === undefined ? {} : { sessionConfigNormalizer: entry.sessionConfigNormalizer }),
    ...(entry.stderrPolicy === undefined ? {} : { stderrPolicy: entry.stderrPolicy }),
  }
}

/** Grok chooses only advertised methods; the key itself remains inherited. */
export function createGrokAuthMethodPreference(hasXaiApiKey: boolean): AuthMethodPreference {
  return {
    methodIds: hasXaiApiKey ? ["xai.api_key", "cached_token"] : ["cached_token"],
    unavailableMessage: "Grok authentication unavailable. Run `grok login` or set XAI_API_KEY, then rerun.",
  }
}

/**
 * Grok Build 1.0.0 advertises packet session choices through its own ACP
 * extension metadata. Normalize only that documented extension boundary into
 * neutral options; all cockpit and engine consumers remain provider-agnostic.
 */
export function normalizeGrokSessionConfigOptions(
  advertisement: SessionConfigAdvertisement,
): readonly SessionConfigOption[] {
  if ((advertisement.configOptions?.length ?? 0) > 0) return advertisement.configOptions ?? []
  const metadata = asRecord(advertisement.metadata)
  const sessionConfig = asRecord(metadata?.["x.ai/sessionConfig"])
  const rawOptions = sessionConfig?.options
  if (!Array.isArray(rawOptions)) return []
  const choicesByCategory = new Map<string, GrokSessionConfigChoice[]>()
  for (const rawOption of rawOptions) {
    const choice = normalizeGrokSessionConfigChoice(rawOption)
    if (choice === undefined) continue
    const choices = choicesByCategory.get(choice.category) ?? []
    choices.push(choice)
    choicesByCategory.set(choice.category, choices)
  }
  return [...choicesByCategory.entries()].flatMap(([category, choices]) =>
    normalizeGrokSessionConfigChoiceGroup(category, choices),
  )
}

interface GrokSessionConfigChoice {
  readonly category: string
  readonly id: string
  readonly label: string
  readonly selected: boolean
}

function normalizeGrokSessionConfigChoice(value: unknown): GrokSessionConfigChoice | undefined {
  const option = asRecord(value)
  if (option === undefined) return undefined
  const category = stringValue(option.category)
  const id = stringValue(option.id)
  if (category === undefined || id === undefined || grokOptionCategory(category) === undefined) return undefined
  if (typeof option.selected !== "boolean") return undefined
  return {
    category,
    id,
    label: stringValue(option.label) ?? id,
    selected: option.selected,
  }
}

function normalizeGrokSessionConfigChoiceGroup(
  id: string,
  choices: readonly GrokSessionConfigChoice[],
): SessionConfigOption[] {
  const category = grokOptionCategory(id)
  const selected = choices.filter((choice) => choice.selected)
  if (category === undefined || selected.length !== 1) return []
  const options: SessionConfigSelectOption[] = choices.map((choice) => ({
    value: choice.id,
    name: choice.label,
  }))
  return [{
    type: "select",
    id,
    name: id === "model" ? "Model" : "Reasoning",
    currentValue: selected[0]!.id,
    options,
    category,
  }]
}

function grokOptionCategory(category: string): "model" | "thought_level" | undefined {
  if (category === "model") return "model"
  if (category === "mode" || category === "reasoning" || category === "reasoning_effort") {
    return "thought_level"
  }
  return undefined
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

/** Clone an injected or resolved launch so callers cannot mutate registry data. */
export function cloneProviderLaunch(launch: ProviderLaunch): ProviderLaunch {
  return {
    ...(launch.mode === undefined ? {} : { mode: launch.mode }),
    command: launch.command,
    args: [...launch.args],
    env: { ...launch.env },
    authMethod: launch.authMethod,
    ...(launch.authPreference === undefined
      ? {}
      : {
          authPreference: {
            methodIds: [...launch.authPreference.methodIds],
            unavailableMessage: launch.authPreference.unavailableMessage,
          },
        }),
    ...(launch.sessionConfigNormalizer === undefined ? {} : { sessionConfigNormalizer: launch.sessionConfigNormalizer }),
    ...(launch.stderrPolicy === undefined ? {} : { stderrPolicy: launch.stderrPolicy }),
  }
}

/** Explicit aliases keep the launch intent visible at packet/exec call sites. */
export function resolvePacketProviderLaunch(config: ProviderLaunchConfig): ProviderLaunch {
  return resolveProviderLaunch(config, "packet")
}

export function resolveExecProviderLaunch(
  config: ProviderLaunchConfig,
  fixture?: ProviderLaunch,
): ProviderLaunch {
  if (fixture !== undefined) return resolveProviderLaunch(config, { mode: "exec", fixture })
  assertExecProviderCertified(config.provider)
  return resolveProviderLaunch(config, "exec")
}

export function providerLabel(provider: ProviderName): string {
  if (provider === "claude") return "Claude"
  if (provider === "codex") return "Codex"
  if (provider === "cursor") return "Cursor"
  return "Grok Build"
}
