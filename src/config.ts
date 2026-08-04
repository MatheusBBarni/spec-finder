import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import { CONFIG_FILE, SPEC_DIR } from "./paths.ts"

export const PROVIDERS = ["claude", "codex", "cursor"] as const
export type ProviderName = (typeof PROVIDERS)[number]

export const configSchema = z.object({
  version: z.literal(2),
  provider: z.enum(PROVIDERS),
  model: z.string().trim().min(1),
  reasoning: z.enum(["auto", "low", "medium", "high", "xhigh", "max", "ultra"]),
  speed: z.enum(["auto", "normal", "fast"]),
  permissions: z.enum(["prompt", "approve-all", "deny"]),
}).strict()

export type SpecFinderConfig = z.infer<typeof configSchema>

export const DEFAULT_CONFIG: SpecFinderConfig = {
  version: 2,
  provider: "codex",
  model: "auto",
  reasoning: "high",
  speed: "normal",
  permissions: "prompt",
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

function migrateLegacyConfig(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  const legacy = value as Record<string, unknown>
  if (legacy.version !== 1) return value
  return {
    version: 2,
    provider: legacy.provider,
    model: legacy.model,
    reasoning: legacy.reasoning,
    speed: legacy.speed,
    permissions: legacy.permissions,
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
  await writeFile(path, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, { flag: "wx" })
  return path
}

export async function writeConfig(root: string, config: SpecFinderConfig): Promise<string> {
  const path = join(root, SPEC_DIR, CONFIG_FILE)
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`)
  return path
}
