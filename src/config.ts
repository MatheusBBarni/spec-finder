import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import { CONFIG_FILE, SPEC_DIR } from "./paths.ts"
import {
  getSetupProfile,
  SETUP_DESTINATIONS,
} from "./setup-profile.ts"
export type { SetupDestination } from "./setup-profile.ts"

export const PROVIDERS = ["claude", "codex", "cursor", "grok"] as const
export type ProviderName = (typeof PROVIDERS)[number]

export const REASONING_VALUES = ["auto", "low", "medium", "high", "xhigh", "max", "ultra"] as const
export const SPEED_VALUES = ["auto", "normal", "fast"] as const
export const SETUP_SCOPES = ["local", "global"] as const
export type SetupScope = (typeof SETUP_SCOPES)[number]

const setupStateSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("unconfigured"),
  }).strict(),
  z.object({
    status: z.literal("configured"),
    scope: z.enum(SETUP_SCOPES),
    destination: z.enum(SETUP_DESTINATIONS),
  }).strict(),
])

const runtimeFieldsSchema = z.object({
  provider: z.enum(PROVIDERS),
  model: z.string().trim().min(1),
  reasoning: z.enum(REASONING_VALUES),
  speed: z.enum(SPEED_VALUES),
  permissions: z.enum(["prompt", "approve-all", "deny"]),
  auto_commit: z.boolean().default(false),
})

const runtimeOverrideSchema = z.object({
  provider: z.enum(PROVIDERS).optional(),
  model: z.string().trim().min(1).optional(),
  reasoning: z.enum(REASONING_VALUES).optional(),
  speed: z.enum(SPEED_VALUES).optional(),
}).strict()

export const configSchema = z.object({
  version: z.literal(3),
  ...runtimeFieldsSchema.shape,
  setup: setupStateSchema,
}).strict().superRefine((config, context) => {
  if (config.setup.status !== "configured") return
  const expectedDestination = getSetupProfile(config.provider).destination
  if (config.setup.destination !== expectedDestination) {
    context.addIssue({
      code: "custom",
      path: ["setup", "destination"],
      message: `must match ${config.provider} provider destination ${expectedDestination}`,
    })
  }
})

export type SpecFinderConfig = z.infer<typeof configSchema>
export type ConfigV3 = SpecFinderConfig
export type SetupState = SpecFinderConfig["setup"]
export type RuntimeConfigFields = z.infer<typeof runtimeFieldsSchema>
export type RuntimeConfigOverrides = z.infer<typeof runtimeOverrideSchema>

export const DEFAULT_SETUP_STATE: SetupState = { status: "unconfigured" }

export const DEFAULT_CONFIG: SpecFinderConfig = {
  version: 3,
  provider: "codex",
  model: "auto",
  reasoning: "high",
  speed: "normal",
  permissions: "prompt",
  auto_commit: false,
  setup: DEFAULT_SETUP_STATE,
}

export class ConfigError extends Error {
  constructor(message: string, readonly issues: string[] = []) {
    super(message)
    this.name = "ConfigError"
  }
}

export function parseConfig(value: unknown): SpecFinderConfig {
  const result = configSchema.safeParse(migrateLegacyConfig(value))
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "config"
      return `${path}: ${issue.message}`
    })
    throw new ConfigError("invalid .spec-finder/config.json", issues)
  }
  return result.data
}

/**
 * Apply ephemeral runtime flags without re-validating persisted setup
 * metadata. The returned config keeps the stored setup object unchanged.
 */
export function applyRuntimeConfigOverrides(
  config: SpecFinderConfig,
  overrides: RuntimeConfigOverrides,
): SpecFinderConfig {
  const overrideResult = runtimeOverrideSchema.safeParse(overrides)
  if (!overrideResult.success) throw configError("invalid runtime overrides", overrideResult.error)

  const runtimeResult = runtimeFieldsSchema.safeParse({
    provider: config.provider,
    model: config.model,
    reasoning: config.reasoning,
    speed: config.speed,
    permissions: config.permissions,
    auto_commit: config.auto_commit,
    ...overrideResult.data,
  })
  if (!runtimeResult.success) throw configError("invalid runtime configuration", runtimeResult.error)
  return {
    ...config,
    ...runtimeResult.data,
  }
}

/** Serialize a validated v3 document for staged or direct config writes. */
export function serializeConfig(config: SpecFinderConfig): string {
  return `${JSON.stringify(parseConfig(config), null, 2)}\n`
}

/** Explicit name for transaction callers that stage a config candidate. */
export const serializeConfigCandidate = serializeConfig

function migrateLegacyConfig(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  const legacy = value as Record<string, unknown>
  if (legacy.version === 1) return migrateVersionOneConfig(legacy)
  if (legacy.version === 2) return migrateVersionTwoConfig(legacy)
  return value
}

const legacyVersionTwoSchema = z.object({
  version: z.literal(2),
  ...runtimeFieldsSchema.shape,
}).strict()

function migrateVersionOneConfig(legacy: Record<string, unknown>): unknown {
  return {
    version: 3,
    provider: legacy.provider,
    model: legacy.model,
    reasoning: legacy.reasoning,
    speed: legacy.speed,
    permissions: legacy.permissions,
    auto_commit: false,
    setup: DEFAULT_SETUP_STATE,
  }
}

function migrateVersionTwoConfig(legacy: Record<string, unknown>): unknown {
  const result = legacyVersionTwoSchema.safeParse(legacy)
  if (!result.success) return legacy
  return {
    ...result.data,
    version: 3,
    setup: DEFAULT_SETUP_STATE,
  }
}

export async function loadConfig(root: string): Promise<SpecFinderConfig> {
  const path = join(root, SPEC_DIR, CONFIG_FILE)
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch (error) {
    throw new ConfigError(`cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    return parseConfig(JSON.parse(raw))
  } catch (error) {
    if (error instanceof ConfigError) throw error
    throw new ConfigError(`invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function writeDefaultConfig(root: string): Promise<string> {
  const path = join(root, SPEC_DIR, CONFIG_FILE)
  await writeFile(path, serializeConfig(DEFAULT_CONFIG), { flag: "wx" })
  return path
}

export async function writeConfig(root: string, config: SpecFinderConfig): Promise<string> {
  const path = join(root, SPEC_DIR, CONFIG_FILE)
  await writeFile(path, serializeConfig(config))
  return path
}

function configError(message: string, error: z.ZodError): ConfigError {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "config"
    return `${path}: ${issue.message}`
  })
  return new ConfigError(message, issues)
}
