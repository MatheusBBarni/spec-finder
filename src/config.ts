import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import { CONFIG_FILE, SPEC_DIR } from "./paths.ts"

export const PROVIDERS = ["claude", "codex", "cursor"] as const
export type ProviderName = (typeof PROVIDERS)[number]

const commandSchema = z.object({
  command: z.string().trim().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  authMethod: z.string().trim().min(1).nullable().default(null),
}).strict()

const reportDirectorySchema = z.string().trim().min(1).regex(
  /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/,
  "must be a relative directory without parent traversal",
)

export const configSchema = z.object({
  version: z.literal(1),
  provider: z.enum(PROVIDERS),
  model: z.string().trim().min(1),
  reasoning: z.enum(["auto", "low", "medium", "high", "xhigh", "max", "ultra"]),
  speed: z.enum(["auto", "normal", "fast"]),
  mode: z.enum(["default", "read-only", "agent", "agent-full-access"]),
  permissions: z.enum(["prompt", "approve-all", "deny"]),
  report: z.object({
    enabled: z.literal(true),
    directory: reportDirectorySchema,
  }).strict(),
  execution: z.object({
    continueOnError: z.boolean(),
    includeCompleted: z.boolean(),
  }).strict(),
  providers: z.object({
    claude: commandSchema,
    codex: commandSchema,
    cursor: commandSchema,
  }).strict(),
}).strict()

export type SpecFinderConfig = z.infer<typeof configSchema>

export const DEFAULT_CONFIG: SpecFinderConfig = {
  version: 1,
  provider: "codex",
  model: "auto",
  reasoning: "high",
  speed: "normal",
  mode: "agent",
  permissions: "prompt",
  report: { enabled: true, directory: "reports" },
  execution: { continueOnError: false, includeCompleted: false },
  providers: {
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
  },
}

export class ConfigError extends Error {
  constructor(message: string, readonly issues: string[] = []) {
    super(message)
    this.name = "ConfigError"
  }
}

export function parseConfig(value: unknown): SpecFinderConfig {
  const result = configSchema.safeParse(value)
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "config"
      return `${path}: ${issue.message}`
    })
    throw new ConfigError("invalid .spec-finder/config.json", issues)
  }
  return result.data
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
