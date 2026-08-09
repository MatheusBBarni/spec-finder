import type { ProviderName } from "./config.ts"

/** Logical skill destinations owned by the reviewed setup policy. */
export const SETUP_DESTINATIONS = [".agents/skills", ".claude/skills"] as const
export type SetupDestination = (typeof SETUP_DESTINATIONS)[number]

/** Static, source-controlled setup choices; `auto` is universal and implicit. */
export interface SetupProviderProfile {
  provider: ProviderName
  label: string
  destination: SetupDestination
  models: readonly string[]
  defaultModel: string
}

const PROFILE_BY_PROVIDER: Readonly<Record<ProviderName, SetupProviderProfile>> = Object.freeze({
  claude: Object.freeze({
    provider: "claude",
    label: "Claude",
    destination: ".claude/skills",
    models: Object.freeze(["fable", "opus", "sonnet", "haiku"]),
    defaultModel: "fable",
  }),
  codex: Object.freeze({
    provider: "codex",
    label: "Codex",
    destination: ".agents/skills",
    models: Object.freeze(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]),
    defaultModel: "gpt-5.6-luna",
  }),
  cursor: Object.freeze({
    provider: "cursor",
    label: "Cursor",
    destination: ".agents/skills",
    models: Object.freeze([]),
    defaultModel: "auto",
  }),
})

/** Alias kept explicit for consumers that want to inspect the whole policy. */
export const SETUP_PROVIDER_PROFILES = PROFILE_BY_PROVIDER
export const SETUP_PROFILES = PROFILE_BY_PROVIDER

export function getSetupProfile(provider: ProviderName): SetupProviderProfile {
  return PROFILE_BY_PROVIDER[provider]
}

/** Return the universal `auto` choice followed by provider-curated values. */
export function getSetupModelChoices(provider: ProviderName): readonly string[] {
  return ["auto", ...getSetupProfile(provider).models]
}

export function isCuratedSetupModel(provider: ProviderName, model: string): boolean {
  return model === "auto" || getSetupProfile(provider).models.includes(model)
}

export function isSetupDestination(value: unknown): value is SetupDestination {
  return typeof value === "string" && (SETUP_DESTINATIONS as readonly string[]).includes(value)
}
