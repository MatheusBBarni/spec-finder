import type { SpecFinderConfig, ProviderName } from "./config.ts"

export interface ProviderLaunch {
  command: string
  args: string[]
  env: Record<string, string>
  authMethod: string | null
}

export function resolveProviderLaunch(config: SpecFinderConfig): ProviderLaunch {
  const provider = config.provider
  const entry = config.providers[provider]
  const args = [...entry.args]
  const env = { ...entry.env }
  if (provider === "claude" && config.model !== "auto") env.ANTHROPIC_MODEL = config.model
  if (provider === "cursor" && config.model !== "auto" && !args.includes("--model")) {
    args.push("--model", config.model)
  }
  if (provider === "codex") {
    const existing = env.CODEX_CONFIG ? JSON.parse(env.CODEX_CONFIG) as Record<string, unknown> : {}
    env.CODEX_CONFIG = JSON.stringify({ developer_instructions: "Follow the active Spec Finder task and its report contract.", ...existing })
  }
  return { command: entry.command, args, env, authMethod: entry.authMethod }
}

export function providerLabel(provider: ProviderName): string {
  return provider === "claude" ? "Claude" : provider === "codex" ? "Codex" : "Cursor"
}

