import { readFile as readFileFromDisk } from "node:fs/promises"
import { homedir as homeDirectory } from "node:os"
import { join } from "node:path"
import { z } from "zod"
import {
  ConfigError,
  PROVIDERS,
  type ProviderName,
} from "./config.ts"
import {
  type ExecRuntimeProfile,
  type PermissionPolicy,
  type ResolvedExecContext,
} from "./acp-turn.ts"
import { CONFIG_FILE, SPEC_DIR, findExecWorkspace } from "./paths.ts"
import {
  assertExecProviderCertified,
  resolveExecProviderLaunch as resolveCertifiedProviderLaunch,
  type ProviderLaunch,
  type ProviderLaunchConfig,
} from "./providers.ts"

const REASONING_VALUES = ["auto", "low", "medium", "high", "xhigh", "max", "ultra"] as const
const SPEED_VALUES = ["auto", "normal", "fast"] as const

const runtimeSchema = z.object({
  version: z.literal(2),
  provider: z.enum(PROVIDERS),
  model: z.string().trim().min(1),
  reasoning: z.enum(REASONING_VALUES),
  speed: z.enum(SPEED_VALUES),
}).strict()

export type ExecRuntimeOverrides = Partial<ExecRuntimeProfile>

export interface ExecConfigDependencies {
  /** Invocation directory used for canonical workspace discovery. */
  cwd?: string
  /** User home used for the independent permission/runtime projection. */
  home?: string
  /** Injectable config reader; the normal implementation reads UTF-8 files. */
  readFile?: (path: string) => Promise<string>
  /** Injectable workspace discovery for deterministic resolver tests. */
  findWorkspace?: (cwd: string) => Promise<string>
}

export interface ResolveExecConfigOptions extends ExecConfigDependencies {
  overrides?: ExecRuntimeOverrides
}

export type ExecConfigErrorCode =
  | "workspace"
  | "repository-config"
  | "user-config"
  | "runtime-profile"

/** A named configuration failure that occurs before provider startup. */
export class ExecConfigError extends ConfigError {
  readonly code: ExecConfigErrorCode
  readonly source: "repository" | "user" | "workspace"

  constructor(
    code: ExecConfigErrorCode,
    source: "repository" | "user" | "workspace",
    message: string,
    issues: string[] = [],
  ) {
    super(message, issues)
    this.name = "ExecConfigError"
    this.code = code
    this.source = source
  }
}

interface JsonConfigRead {
  exists: boolean
  value?: unknown
  error?: unknown
}

/**
 * Resolve one complete runtime profile and the separate user permission
 * projection for the packet-free exec path.
 *
 * The first argument accepts either the explicit override object or the full
 * dependency/options object. Supporting both forms keeps the pure resolver
 * convenient for command adapters and deterministic tests.
 */
export async function resolveExecConfig(
  overridesOrOptions: ExecRuntimeOverrides | ResolveExecConfigOptions = {},
  dependencies: ExecConfigDependencies = {},
): Promise<ResolvedExecContext> {
  const { overrides, options } = normalizeResolverArguments(overridesOrOptions, dependencies)
  const cwd = options.cwd ?? process.cwd()
  const home = options.home ?? homeDirectory()
  const readFile = options.readFile ?? defaultReadFile
  const discoverWorkspace = options.findWorkspace ?? findExecWorkspace

  let workspace: string
  try {
    workspace = await discoverWorkspace(cwd)
  } catch (error) {
    throw new ExecConfigError(
      "workspace",
      "workspace",
      `unable to resolve exec workspace: ${errorMessage(error)}`,
    )
  }

  const repositoryPath = join(workspace, SPEC_DIR, CONFIG_FILE)
  const userPath = join(home, SPEC_DIR, CONFIG_FILE)
  const repository = await readJsonConfig(repositoryPath, readFile)
  const user = await readJsonConfig(userPath, readFile)

  const permission = projectUserPermission(user)
  const selected = selectRuntimeProfile(repository, user, repositoryPath, userPath)
  const runtime = applyRuntimeOverrides(selected.profile, overrides, selected.source)

  return {
    workspace,
    runtime,
    runtimeSource: selected.source,
    permission: permission.policy,
    permissionSource: permission.source,
    // Write capability is a later release-gated concern. Task 03 resolves
    // the policy and keeps the context explicitly read-only until those gates
    // are certified by the downstream exec tasks.
    hostAccess: "read-only",
  }
}

/** Descriptive aliases used by later exec orchestration and embedding code. */
export const resolveExecContext = resolveExecConfig
export const resolveRuntimeAndPermission = resolveExecConfig

/**
 * Resolve the provider process only after the exec certification gate. A
 * fixture launch is explicitly injectable for deterministic integration tests
 * and is cloned before use; it never changes the source-owned registry.
 */
export function resolveExecLaunch(
  context: ResolvedExecContext | ExecRuntimeProfile,
  fixture?: ProviderLaunch,
): ProviderLaunch {
  const runtime = "runtime" in context ? context.runtime : context
  const config: ProviderLaunchConfig = {
    provider: runtime.provider as ProviderLaunchConfig["provider"],
    model: runtime.model,
  }
  if (fixture !== undefined) return resolveCertifiedProviderLaunch(config, fixture)
  assertExecProviderCertified(config.provider)
  return resolveCertifiedProviderLaunch(config)
}

/** Explicit pre-spawn naming used by the exec composition root. */
export const resolveExecProviderLaunch = resolveExecLaunch

/** Query the source-owned gate without creating a process launch. */
export function assertExecProviderAvailable(runtime: ExecRuntimeProfile): void {
  assertExecProviderCertified(runtime.provider)
}

export function parseExecRuntimeProfile(value: unknown, source: "repository" | "user" = "user"): ExecRuntimeProfile {
  const projected = projectRuntimeFields(value)
  const result = runtimeSchema.safeParse(projected)
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "config"
      return `${path}: ${issue.message}`
    })
    throw new ExecConfigError(
      "runtime-profile",
      source,
      `${source} runtime profile is invalid`,
      issues,
    )
  }
  return {
    provider: result.data.provider,
    model: result.data.model,
    reasoning: result.data.reasoning,
    speed: result.data.speed,
  }
}

export function projectUserPermission(
  config: JsonConfigRead | unknown,
): { policy: PermissionPolicy; source: "user" | "default" } {
  const value = isJsonConfigRead(config) ? config.value : config
  if (!isRecord(value)) return { policy: "prompt", source: "default" }
  const permission = value.permissions
  if (permission === "prompt" || permission === "approve-all" || permission === "deny") {
    return { policy: permission, source: "user" }
  }
  return { policy: "prompt", source: "default" }
}

function selectRuntimeProfile(
  repository: JsonConfigRead,
  user: JsonConfigRead,
  repositoryPath: string,
  userPath: string,
): { source: "repository" | "user"; profile: ExecRuntimeProfile } {
  if (repository.exists) {
    if (repository.error !== undefined) {
      throw new ExecConfigError(
        "repository-config",
        "repository",
        `cannot read repository runtime profile ${repositoryPath}: ${errorMessage(repository.error)}`,
      )
    }
    try {
      return { source: "repository", profile: parseExecRuntimeProfile(repository.value, "repository") }
    } catch (error) {
      if (error instanceof ExecConfigError) throw error
      throw new ExecConfigError("repository-config", "repository", errorMessage(error))
    }
  }

  if (!user.exists) {
    throw new ExecConfigError(
      "user-config",
      "user",
      `user runtime profile is required at ${userPath}`,
    )
  }
  if (user.error !== undefined) {
    throw new ExecConfigError(
      "user-config",
      "user",
      `cannot read user runtime profile ${userPath}: ${errorMessage(user.error)}`,
    )
  }
  try {
    return { source: "user", profile: parseExecRuntimeProfile(user.value, "user") }
  } catch (error) {
    if (error instanceof ExecConfigError) throw error
    throw new ExecConfigError("user-config", "user", errorMessage(error))
  }
}

function applyRuntimeOverrides(
  profile: ExecRuntimeProfile,
  overrides: ExecRuntimeOverrides,
  source: "repository" | "user",
): ExecRuntimeProfile {
  const allowed = new Set(["provider", "model", "reasoning", "speed"])
  const unknown = Object.keys(overrides).filter((key) => !allowed.has(key))
  if (unknown.length > 0) {
    throw new ExecConfigError(
      "runtime-profile",
      source,
      `unsupported exec runtime override: ${unknown[0]}`,
    )
  }
  return parseExecRuntimeProfile({
    version: 2,
    ...profile,
    ...overrides,
  }, source)
}

function projectRuntimeFields(value: unknown): unknown {
  if (!isRecord(value)) return value
  return {
    version: value.version,
    provider: value.provider,
    model: value.model,
    reasoning: value.reasoning,
    speed: value.speed,
  }
}

async function readJsonConfig(path: string, readFile: (path: string) => Promise<string>): Promise<JsonConfigRead> {
  let raw: string
  try {
    raw = await readFile(path)
  } catch (error) {
    if (isMissingPath(error)) return { exists: false }
    return { exists: true, error }
  }
  try {
    return { exists: true, value: JSON.parse(raw) }
  } catch (error) {
    return { exists: true, error: new Error(`invalid JSON: ${errorMessage(error)}`) }
  }
}

function normalizeResolverArguments(
  overridesOrOptions: ExecRuntimeOverrides | ResolveExecConfigOptions,
  dependencies: ExecConfigDependencies,
): { overrides: ExecRuntimeOverrides; options: ResolveExecConfigOptions } {
  if (isResolverOptions(overridesOrOptions)) {
    return {
      overrides: overridesOrOptions.overrides ?? {},
      options: { ...overridesOrOptions, ...dependencies },
    }
  }
  return { overrides: overridesOrOptions, options: dependencies }
}

function isResolverOptions(value: ExecRuntimeOverrides | ResolveExecConfigOptions): value is ResolveExecConfigOptions {
  return Object.prototype.hasOwnProperty.call(value, "cwd")
    || Object.prototype.hasOwnProperty.call(value, "home")
    || Object.prototype.hasOwnProperty.call(value, "readFile")
    || Object.prototype.hasOwnProperty.call(value, "findWorkspace")
    || Object.prototype.hasOwnProperty.call(value, "overrides")
}

function isJsonConfigRead(value: JsonConfigRead | unknown): value is JsonConfigRead {
  return isRecord(value) && typeof value.exists === "boolean" && ("value" in value || "error" in value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isMissingPath(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT"
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function defaultReadFile(path: string): Promise<string> {
  return readFileFromDisk(path, "utf8")
}

export type { ProviderName }
