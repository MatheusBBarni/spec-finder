import { PROVIDERS, type ProviderName } from "./config.ts"

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
}

export interface ProviderCertification {
  readonly exec: boolean
}

export const EXEC_PROVIDER_CERTIFICATION: Readonly<Record<ProviderName, ProviderCertification>> =
  Object.freeze({
    claude: Object.freeze({ exec: false }),
    codex: Object.freeze({ exec: false }),
    cursor: Object.freeze({ exec: false }),
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
  return { mode, command: entry.command, args, env, authMethod: entry.authMethod }
}

/** Clone an injected or resolved launch so callers cannot mutate registry data. */
export function cloneProviderLaunch(launch: ProviderLaunch): ProviderLaunch {
  return {
    ...(launch.mode === undefined ? {} : { mode: launch.mode }),
    command: launch.command,
    args: [...launch.args],
    env: { ...launch.env },
    authMethod: launch.authMethod,
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
  return provider === "claude" ? "Claude" : provider === "codex" ? "Codex" : "Cursor"
}
