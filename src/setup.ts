import { randomUUID } from "node:crypto"
import { cp, lstat, mkdir, open, readFile, realpath, rename, rm, writeFile } from "node:fs/promises"
import type { FileHandle } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import {
  ConfigError,
  DEFAULT_CONFIG,
  SETUP_SCOPES as CONFIG_SETUP_SCOPES,
  SPEED_VALUES,
  loadConfig,
  serializeConfig,
  type ProviderName,
  type SetupScope as ConfigSetupScope,
  type SpecFinderConfig,
} from "./config.ts"
import {
  defaultsRuntimeToAutoOnProviderSwitch,
  getSetupProfile,
  isCuratedSetupModel,
  type SetupDestination,
} from "./setup-profile.ts"
import {
  GITIGNORE_FILE,
  mergeWorkspaceGitignore,
  type GitignoreStatus,
} from "./gitignore.ts"
import { CONFIG_FILE, SPEC_DIR, SPECS_DIR, TASKS_DIR, bundledSkillsPath } from "./paths.ts"

export const SKILL_TARGETS = {
  claude: getSetupProfile("claude").destination,
  codex: getSetupProfile("codex").destination,
  cursor: getSetupProfile("cursor").destination,
  grok: getSetupProfile("grok").destination,
  pi: getSetupProfile("pi").destination,
} as const

export type SkillTarget = keyof typeof SKILL_TARGETS
export type SetupScope = ConfigSetupScope
export const SETUP_SCOPES = CONFIG_SETUP_SCOPES

/** Copy is the only supported installation mode; the flag remains CLI-compatible. */
export const SKILL_INSTALL_MODES = ["copy"] as const
export type SkillInstallMode = (typeof SKILL_INSTALL_MODES)[number]

export const SPEC_FINDER_SKILLS = [
  "sf-idea-factory",
  "sf-create-prd",
  "sf-create-techspec",
  "sf-create-tasks",
  "sf-write-spec",
  "sf-memory",
  "sf-execute-task",
  "sf-task-report",
  "sf-batch-tasks",
  "sf-tdd-plan",
  "sf-tdd-execute",
  "sf-tdd-report",
  "sf-tdd-batch",
  "sf-archive-tasks",
] as const

export type SetupSpeed = (typeof SPEED_VALUES)[number]
export type SetupInputOrigin = "flag" | "saved" | "default"

export interface SetupRequest {
  provider: ProviderName
  model: string
  speed: SetupSpeed
  scope: SetupScope
  origin: {
    provider: SetupInputOrigin
    model: SetupInputOrigin
    speed: SetupInputOrigin
  }
}

export interface SetupResult {
  configPath: string
  provider: ProviderName
  model: string
  speed: SetupSpeed
  destination: SetupDestination
  skillRoot: string
  scope: SetupScope
  installed: string[]
  legacyCursor: "preserved" | "absent"
  gitignorePath: string
  gitignoreStatus: GitignoreStatus
}

export interface RefreshSkillsResult {
  destination: SetupDestination
  skillRoot: string
  scope: SetupScope
  installed: string[]
  legacyCursor: "preserved" | "absent"
}

export type SetupFailurePhase =
  | "stage"
  | "backup"
  | "promote"
  | "config"
  | "config-commit"
  | "gitignore"
  | "rollback"
  | "cleanup"

export interface SetupFailureInjection {
  phase: SetupFailurePhase
  /** Fail on this occurrence of the phase; defaults to the first. */
  occurrence?: number
  message?: string
}

export type SetupFailureHook = (phase: SetupFailurePhase, detail: string) => void | Promise<void>

export interface SetupWorkspaceOptions {
  /** Test-only provider home seam; no arbitrary destination is accepted. */
  homeDirectory?: string
  /** Narrow deterministic failure seam used by transaction tests. */
  failure?: SetupFailureInjection | SetupFailureHook
  /** Convenience alias for tests that need to fail one named phase. */
  failAt?: SetupFailurePhase
  /** Descriptive alias for `failAt`. */
  failurePoint?: SetupFailurePhase
}

export class SetupTransactionError extends Error {
  readonly phase: SetupFailurePhase | "lock" | "preflight" | "commit"
  readonly recoveryPaths: readonly string[]

  constructor(
    message: string,
    phase: SetupTransactionError["phase"],
    recoveryPaths: readonly string[] = [],
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "SetupTransactionError"
    this.phase = phase
    this.recoveryPaths = recoveryPaths
  }
}

interface TransactionPaths {
  targetRoot: string
  targetParent: string
  stageRoot: string
  backupRoot: string
  configPath: string
  configStagePath: string
  configBackupPath: string
  gitignorePath: string
  gitignoreStagePath: string
  gitignoreBackupPath: string
  lockPath: string
}

interface TransactionState {
  backedUp: string[]
  promoted: string[]
  configBackedUp: boolean
  configPromoted: boolean
  gitignoreBackedUp: boolean
  gitignorePromoted: boolean
}

export function isSkillTarget(value: string): value is SkillTarget {
  return Object.hasOwn(SKILL_TARGETS, value)
}

export function skillTargetPath(
  root: string,
  target: SkillTarget,
  scope: SetupScope = "local",
  homeDirectory = homedir(),
): string {
  const base = scope === "global" ? homeDirectory : root
  return join(base, SKILL_TARGETS[target])
}

/** Stable workspace lock shared by every setup provider and scope. */
export function setupLockPath(root: string): string {
  return join(resolve(root), SPEC_DIR, ".setup.lock")
}

export async function refreshManagedSkills(
  workspace: string,
  input: { provider: ProviderName; scope: SetupScope },
  options: Pick<SetupWorkspaceOptions, "homeDirectory" | "failure" | "failAt" | "failurePoint"> = {},
): Promise<RefreshSkillsResult> {
  if (!isSkillTarget(input.provider)) throw new Error(`unsupported setup agent: ${String(input.provider)}`)
  if (!SETUP_SCOPES.includes(input.scope)) throw new Error(`unsupported setup scope: ${String(input.scope)}`)
  const root = resolve(workspace)
  const homeDirectory = resolve(options.homeDirectory ?? homedir())
  const profile = getSetupProfile(input.provider)
  const base = input.scope === "global" ? homeDirectory : root
  const configPath = join(root, SPEC_DIR, CONFIG_FILE)
  let targetRoot: string
  try {
    targetRoot = await resolveSkillTargetRoot(
      base,
      join(base, profile.destination),
      `${input.scope} skill path`,
    )
  } catch (error) {
    throw new SetupTransactionError(errorMessage(error), "preflight")
  }
  try {
    await assertManagedEntries(targetRoot, base, `${input.scope} skill path`)
  } catch (error) {
    if (error instanceof SetupTransactionError) throw error
    throw new SetupTransactionError(errorMessage(error), "preflight")
  }
  const legacyCursor = await readLegacyStatus(base)
  return createTransaction({
    workspace: root,
    targetRoot,
    configPath,
    candidate: DEFAULT_CONFIG,
    configExisted: false,
    request: {
      provider: input.provider,
      model: profile.defaultModel,
      speed: "normal",
      scope: input.scope,
      origin: { provider: "default", model: "default", speed: "default" },
    },
    legacyCursor,
    options,
    persistConfig: false,
  }).runSkills()
}

export async function setupWorkspace(
  root: string,
  request: SetupRequest,
  options: SetupWorkspaceOptions = {},
): Promise<SetupResult> {
  validateSetupRequest(request)
  const workspace = resolve(root)
  const homeDirectory = resolve(options.homeDirectory ?? homedir())
  const profile = getSetupProfile(request.provider)
  const base = request.scope === "global" ? homeDirectory : workspace
  const configPath = join(workspace, SPEC_DIR, CONFIG_FILE)
  const gitignorePath = join(workspace, SPEC_DIR, GITIGNORE_FILE)
  let targetRoot: string
  try {
    targetRoot = await resolveSkillTargetRoot(
      base,
      join(base, profile.destination),
      `${request.scope} skill path`,
    )
  } catch (error) {
    throw new SetupTransactionError(errorMessage(error), "preflight")
  }
  await preflightPaths(workspace, base, targetRoot, configPath, gitignorePath, request.scope)
  const previousConfig = await loadPreviousConfig(workspace)
  const candidate = createConfigCandidate(previousConfig.config, request, profile.destination)
  const legacyCursor = await readLegacyStatus(base)
  const transaction = createTransaction({
    workspace,
    targetRoot,
    configPath,
    candidate,
    configExisted: previousConfig.existed,
    request,
    legacyCursor,
    options,
  })
  return transaction.run()
}

function validateSetupRequest(request: SetupRequest): void {
  if (!request || typeof request !== "object") throw new Error("setup requires one resolved provider request")
  if (!isSkillTarget(request.provider)) throw new Error(`unsupported setup agent: ${String(request.provider)}`)
  if (!request.origin || !isOrigin(request.origin.provider) || !isOrigin(request.origin.model) || !isOrigin(request.origin.speed)) {
    throw new Error("setup request is missing input origins")
  }
  if (typeof request.model !== "string" || request.model.trim().length === 0) {
    throw new Error("setup requires a non-empty model")
  }
  if (!isCuratedSetupModel(request.provider, request.model) && request.origin.model !== "saved") {
    throw new Error(`unsupported setup model for ${request.provider}: ${request.model}`)
  }
  if (!SETUP_SCOPES.includes(request.scope)) throw new Error(`unsupported setup scope: ${String(request.scope)}`)
  if (request.speed !== "auto" && request.speed !== "normal" && request.speed !== "fast") {
    throw new Error(`unsupported setup speed: ${String(request.speed)}`)
  }
}

function isOrigin(value: unknown): value is SetupInputOrigin {
  return value === "flag" || value === "saved" || value === "default"
}

async function loadPreviousConfig(root: string): Promise<{ config: SpecFinderConfig; existed: boolean }> {
  try {
    return { config: await loadConfig(root), existed: true }
  } catch (error) {
    if (error instanceof ConfigError && error.message.startsWith("cannot read")) {
      return { config: DEFAULT_CONFIG, existed: false }
    }
    throw error
  }
}

function createConfigCandidate(
  previous: SpecFinderConfig,
  request: SetupRequest,
  destination: SetupDestination,
): SpecFinderConfig {
  const reasoning = defaultsRuntimeToAutoOnProviderSwitch(request.provider)
    && previous.provider !== request.provider
    ? "auto"
    : previous.reasoning
  return {
    ...previous,
    version: 3,
    provider: request.provider,
    model: request.model,
    reasoning,
    speed: request.speed,
    setup: {
      status: "configured",
      scope: request.scope,
      destination,
    },
  }
}

async function preflightPaths(
  workspace: string,
  base: string,
  targetRoot: string,
  configPath: string,
  gitignorePath: string,
  scope: SetupScope,
): Promise<void> {
  try {
    await assertPathAncestors(workspace, configPath, "workspace config path")
    await assertExistingPathNotSymlink(configPath, "workspace config path")
    await assertPathAncestors(workspace, gitignorePath, "packet gitignore path")
    await assertExistingPathNotSymlink(gitignorePath, "packet gitignore path")
    await assertExistingPathNotDirectory(gitignorePath, "packet gitignore path")
    await assertManagedEntries(targetRoot, base, `${scope} skill path`)
  } catch (error) {
    if (error instanceof SetupTransactionError) throw error
    throw new SetupTransactionError(errorMessage(error), "preflight")
  }
}

function pathEscapesRoot(root: string, candidate: string): boolean {
  const offset = relative(root, candidate)
  return offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)
}

/** Follow in-root destination/ancestor symlinks; reject anything that leaves the allowed root. */
async function resolveSkillTargetRoot(base: string, targetRoot: string, label: string): Promise<string> {
  const basePath = resolve(base)
  const candidatePath = resolve(targetRoot)
  if (pathEscapesRoot(basePath, candidatePath)) {
    throw new Error(`${label} escapes allowed root: ${targetRoot}`)
  }

  let canonicalBase: string
  try {
    canonicalBase = await realpath(basePath)
  } catch (error) {
    if (isMissingPath(error)) throw new Error(`${label} allowed root is missing: ${basePath}`)
    throw error
  }

  const components = relative(basePath, candidatePath).split(sep).filter(Boolean)
  let cursor = canonicalBase
  for (let index = 0; index < components.length; index += 1) {
    const next = join(cursor, components[index]!)
    const isFinal = index === components.length - 1
    try {
      const status = await lstat(next)
      if (status.isSymbolicLink() || status.isDirectory()) {
        let canonical: string
        try {
          canonical = await realpath(next)
        } catch (error) {
          throw new Error(`${label} contains a broken symlink: ${next}`, { cause: error })
        }
        if (pathEscapesRoot(canonicalBase, canonical)) {
          throw new Error(`${label} escapes allowed root: ${next}`)
        }
        const resolved = await lstat(canonical)
        if (!resolved.isDirectory()) {
          throw new Error(isFinal ? `${label} is not a directory: ${next}` : `${label} ancestor is not a directory: ${next}`)
        }
        cursor = canonical
        continue
      }
      throw new Error(isFinal ? `${label} is not a directory: ${next}` : `${label} ancestor is not a directory: ${next}`)
    } catch (error) {
      if (isMissingPath(error)) return join(cursor, ...components.slice(index))
      throw error
    }
  }
  return cursor
}

async function assertPathAncestors(base: string, candidate: string, label: string): Promise<void> {
  const basePath = resolve(base)
  const candidatePath = resolve(candidate)
  const offset = relative(basePath, candidatePath)
  if (offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
    throw new Error(`${label} escapes allowed root: ${candidate}`)
  }

  await assertExistingPathNotSymlink(basePath, label)
  let cursor = basePath
  for (const component of offset.split(sep).filter(Boolean)) {
    cursor = join(cursor, component)
    try {
      const status = await lstat(cursor)
      if (status.isSymbolicLink()) throw new Error(`${label} contains a symlink: ${cursor}`)
      if (!status.isDirectory() && cursor !== candidatePath) throw new Error(`${label} ancestor is not a directory: ${cursor}`)
      if (status.isDirectory()) {
        const canonicalBase = await realpath(basePath)
        const canonicalCursor = await realpath(cursor)
        const canonicalOffset = relative(canonicalBase, canonicalCursor)
        if (canonicalOffset === ".." || canonicalOffset.startsWith(`..${sep}`) || isAbsolute(canonicalOffset)) {
          throw new Error(`${label} escapes allowed root: ${cursor}`)
        }
      }
    } catch (error) {
      if (isMissingPath(error)) break
      throw error
    }
  }
}

async function assertExistingPathNotSymlink(path: string, label: string): Promise<void> {
  try {
    const status = await lstat(path)
    if (status.isSymbolicLink()) throw new Error(`${label} contains a symlink: ${path}`)
  } catch (error) {
    if (isMissingPath(error)) return
    throw error
  }
}

async function assertExistingPathNotDirectory(path: string, label: string): Promise<void> {
  try {
    const status = await lstat(path)
    if (status.isDirectory()) throw new Error(`${label} is a directory: ${path}`)
  } catch (error) {
    if (isMissingPath(error)) return
    throw error
  }
}

async function assertManagedEntries(targetRoot: string, allowedRoot: string, label: string): Promise<void> {
  let canonicalBase: string
  try {
    canonicalBase = await realpath(resolve(allowedRoot))
  } catch (error) {
    if (isMissingPath(error)) throw new Error(`${label} allowed root is missing: ${allowedRoot}`)
    throw error
  }

  try {
    const rootStatus = await lstat(targetRoot)
    if (rootStatus.isSymbolicLink() || rootStatus.isDirectory()) {
      const canonical = await realpath(targetRoot)
      if (pathEscapesRoot(canonicalBase, canonical)) {
        throw new Error(`${label} escapes allowed root: ${targetRoot}`)
      }
      const resolved = await lstat(canonical)
      if (!resolved.isDirectory()) throw new Error(`${label} is not a directory: ${targetRoot}`)
    } else {
      throw new Error(`${label} is not a directory: ${targetRoot}`)
    }
  } catch (error) {
    if (isMissingPath(error)) return
    throw error
  }

  for (const skill of SPEC_FINDER_SKILLS) {
    const entry = join(targetRoot, skill)
    try {
      const status = await lstat(entry)
      if (!status.isSymbolicLink()) continue
      const canonical = await realpath(entry)
      if (pathEscapesRoot(canonicalBase, canonical)) {
        throw new Error(`${label} managed entry escapes allowed root: ${entry}`)
      }
    } catch (error) {
      if (isMissingPath(error)) continue
      throw error
    }
  }
}

async function readLegacyStatus(base: string): Promise<"preserved" | "absent"> {
  const cursorRoot = join(base, ".cursor")
  try {
    const parent = await lstat(cursorRoot)
    if (parent.isSymbolicLink()) return "preserved"
    const legacy = await lstat(join(cursorRoot, "skills"))
    return legacy ? "preserved" : "absent"
  } catch (error) {
    if (isMissingPath(error)) return "absent"
    throw error
  }
}

function createTransaction(input: {
  workspace: string
  targetRoot: string
  configPath: string
  candidate: SpecFinderConfig
  configExisted: boolean
  request: SetupRequest
  legacyCursor: "preserved" | "absent"
  options: SetupWorkspaceOptions
  persistConfig?: boolean
}): SetupTransaction {
  return new SetupTransaction(input)
}

class SetupTransaction {
  private readonly id = randomUUID()
  private readonly persistConfig: boolean
  private readonly paths: TransactionPaths
  private readonly state: TransactionState = {
    backedUp: [],
    promoted: [],
    configBackedUp: false,
    configPromoted: false,
    gitignoreBackedUp: false,
    gitignorePromoted: false,
  }
  private readonly failure: SetupFailureInjection | SetupFailureHook | undefined
  private readonly phaseCounts = new Map<SetupFailurePhase, number>()
  private lock: FileHandle | undefined
  private gitignoreChanged = false
  private gitignoreExisted = false

  constructor(private readonly input: {
    workspace: string
    targetRoot: string
    configPath: string
    candidate: SpecFinderConfig
    configExisted: boolean
    request: SetupRequest
    legacyCursor: "preserved" | "absent"
    options: SetupWorkspaceOptions
    persistConfig?: boolean
  }) {
    const { targetRoot, configPath } = input
    const gitignorePath = join(input.workspace, SPEC_DIR, GITIGNORE_FILE)
    this.persistConfig = input.persistConfig ?? true
    this.paths = {
      targetRoot,
      targetParent: dirname(targetRoot),
      stageRoot: `${targetRoot}.sf-stage-${this.id}`,
      backupRoot: `${targetRoot}.sf-backup-${this.id}`,
      configPath,
      configStagePath: `${configPath}.sf-stage-${this.id}`,
      configBackupPath: `${configPath}.sf-backup-${this.id}`,
      gitignorePath,
      gitignoreStagePath: `${gitignorePath}.sf-stage-${this.id}`,
      gitignoreBackupPath: `${gitignorePath}.sf-backup-${this.id}`,
      lockPath: setupLockPath(input.workspace),
    }
    this.failure = input.options.failure
      ?? (input.options.failAt ? { phase: input.options.failAt } : undefined)
      ?? (input.options.failurePoint ? { phase: input.options.failurePoint } : undefined)
  }

  async run(): Promise<SetupResult> {
    const copied = await this.execute()
    return {
      ...copied,
      configPath: this.paths.configPath,
      provider: this.input.request.provider,
      model: this.input.request.model,
      speed: this.input.request.speed,
      gitignorePath: this.paths.gitignorePath,
      gitignoreStatus: this.gitignoreChanged
        ? (this.gitignoreExisted ? "updated" : "created")
        : "unchanged",
    }
  }

  async runSkills(): Promise<RefreshSkillsResult> {
    return this.execute()
  }

  private async execute(): Promise<RefreshSkillsResult> {
    await this.acquireLock()
    try {
      try {
        await this.stage()
      } catch (error) {
        try {
          await this.cleanup()
        } catch (cleanupError) {
          throw await this.recoveryError("cleanup", cleanupError, error)
        }
        throw new SetupTransactionError(`setup failed during stage: ${errorMessage(error)}`, "stage")
      }
      try {
        await this.commit()
      } catch (error) {
        await this.rollback(error)
        throw new SetupTransactionError(`setup failed during commit: ${errorMessage(error)}`, "commit")
      }

      try {
        await this.cleanup()
      } catch (error) {
        throw await this.recoveryError("cleanup", error)
      }
      await this.releaseLock()
      const destination = getSetupProfile(this.input.request.provider).destination
      return {
        destination,
        skillRoot: this.paths.targetRoot,
        scope: this.input.request.scope,
        installed: SPEC_FINDER_SKILLS.map((skill) => join(destination, skill)),
        legacyCursor: this.input.legacyCursor,
      }
    } catch (error) {
      if (error instanceof SetupTransactionError && error.recoveryPaths.length > 0) {
        await this.closeLockHandle()
        throw error
      }
      try {
        await this.releaseLock()
      } catch (releaseError) {
        throw await this.recoveryError("cleanup", releaseError)
      }
      throw error
    }
  }

  private async acquireLock(): Promise<void> {
    try {
      await mkdir(dirname(this.paths.lockPath), { recursive: true })
      this.lock = await open(this.paths.lockPath, "wx")
      await this.lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))
    } catch (error) {
      if (this.lock) await this.lock.close().catch(() => undefined)
      this.lock = undefined
      if (isAlreadyExists(error)) {
        throw new SetupTransactionError(
          `setup transaction already locked at ${this.paths.lockPath}; verify no setup is active, then remove that lock if stale`,
          "lock",
          [this.paths.lockPath],
        )
      }
      throw new SetupTransactionError(`unable to acquire setup transaction lock at ${this.paths.lockPath}: ${errorMessage(error)}`, "lock")
    }
  }

  private async stage(): Promise<void> {
    await this.maybeFail("stage", this.paths.stageRoot)
    if (this.persistConfig) {
      await mkdir(dirname(this.paths.configPath), { recursive: true })
      await mkdir(join(this.input.workspace, SPEC_DIR, TASKS_DIR), { recursive: true })
      await mkdir(join(this.input.workspace, SPEC_DIR, SPECS_DIR), { recursive: true })
    }
    await mkdir(this.paths.targetParent, { recursive: true })
    await mkdir(this.paths.stageRoot, { recursive: true })
    const sourceRoot = bundledSkillsPath()
    for (const skill of SPEC_FINDER_SKILLS) {
      const from = join(sourceRoot, skill)
      try {
        await cp(from, join(this.paths.stageRoot, skill), { recursive: true })
      } catch (error) {
        throw new Error(`bundled skill ${skill} is missing from ${sourceRoot}: ${errorMessage(error)}`)
      }
    }
    if (!this.persistConfig) return
    await writeFile(this.paths.configStagePath, serializeConfig(this.input.candidate), { flag: "wx" })
    const existingGitignore = await readTextIfPresent(this.paths.gitignorePath)
    this.gitignoreExisted = existingGitignore !== undefined
    const mergedGitignore = mergeWorkspaceGitignore(existingGitignore)
    this.gitignoreChanged = mergedGitignore.changed
    if (mergedGitignore.changed) {
      await writeFile(this.paths.gitignoreStagePath, mergedGitignore.content, { flag: "wx" })
    }
  }

  private async commit(): Promise<void> {
    await mkdir(this.paths.targetRoot, { recursive: true })
    for (const skill of SPEC_FINDER_SKILLS) {
      const destination = join(this.paths.targetRoot, skill)
      if (await pathExists(destination)) {
        await this.maybeFail("backup", destination)
        await mkdir(this.paths.backupRoot, { recursive: true })
        const backup = join(this.paths.backupRoot, skill)
        await rename(destination, backup)
        this.state.backedUp.push(skill)
      }

      await this.maybeFail("promote", destination)
      await rename(join(this.paths.stageRoot, skill), destination)
      this.state.promoted.push(skill)
    }

    if (!this.persistConfig) return

    await this.maybeFail("config", this.paths.configPath)
    if (this.input.configExisted && await pathExists(this.paths.configPath)) {
      await rename(this.paths.configPath, this.paths.configBackupPath)
      this.state.configBackedUp = true
    }
    await rename(this.paths.configStagePath, this.paths.configPath)
    this.state.configPromoted = true

    if (this.gitignoreChanged) {
      await this.maybeFail("gitignore", this.paths.gitignorePath)
      if (await pathExists(this.paths.gitignorePath)) {
        await rename(this.paths.gitignorePath, this.paths.gitignoreBackupPath)
        this.state.gitignoreBackedUp = true
      }
      await rename(this.paths.gitignoreStagePath, this.paths.gitignorePath)
      this.state.gitignorePromoted = true
    }
  }

  private async rollback(cause: unknown): Promise<void> {
    try {
      await this.maybeFail("rollback", errorMessage(cause))
      if (this.state.gitignorePromoted) {
        await rm(this.paths.gitignorePath, { force: true })
        this.state.gitignorePromoted = false
      }
      if (this.state.gitignoreBackedUp && await pathExists(this.paths.gitignoreBackupPath)) {
        await rename(this.paths.gitignoreBackupPath, this.paths.gitignorePath)
        this.state.gitignoreBackedUp = false
      }
      if (this.state.configPromoted) {
        await rm(this.paths.configPath, { recursive: true, force: true })
        this.state.configPromoted = false
      }
      if (this.state.configBackedUp && await pathExists(this.paths.configBackupPath)) {
        await rename(this.paths.configBackupPath, this.paths.configPath)
        this.state.configBackedUp = false
      }

      for (const skill of [...this.state.promoted].reverse()) {
        await rm(join(this.paths.targetRoot, skill), { recursive: true, force: true })
      }
      for (const skill of [...this.state.backedUp].reverse()) {
        const backup = join(this.paths.backupRoot, skill)
        if (await pathExists(backup)) await rename(backup, join(this.paths.targetRoot, skill))
      }
      await this.cleanup()
    } catch (error) {
      throw await this.recoveryError("rollback", error, cause)
    }
  }

  private async cleanup(): Promise<void> {
    await this.maybeFail("cleanup", this.paths.stageRoot)
    await rm(this.paths.stageRoot, { recursive: true, force: true })
    await rm(this.paths.backupRoot, { recursive: true, force: true })
    await rm(this.paths.configStagePath, { force: true })
    await rm(this.paths.configBackupPath, { force: true })
    await rm(this.paths.gitignoreStagePath, { force: true })
    await rm(this.paths.gitignoreBackupPath, { force: true })
  }

  private async closeLockHandle(): Promise<void> {
    if (!this.lock) return
    await this.lock.close().catch(() => undefined)
    this.lock = undefined
  }

  private async releaseLock(): Promise<void> {
    if (!this.lock) return
    const lock = this.lock
    this.lock = undefined
    await lock.close()
    try {
      await rm(this.paths.lockPath, { force: true })
    } catch (error) {
      throw await this.recoveryError("cleanup", error)
    }
  }

  private async maybeFail(phase: SetupFailurePhase, detail: string): Promise<void> {
    const count = (this.phaseCounts.get(phase) ?? 0) + 1
    this.phaseCounts.set(phase, count)
    if (typeof this.failure === "function") {
      await this.failure(phase, detail)
      return
    }
    if (!this.failure || !phaseMatches(this.failure.phase, phase)) return
    if (count !== (this.failure.occurrence ?? 1)) return
    throw new Error(this.failure.message ?? `injected setup ${phase} failure`)
  }

  private async recoveryError(phase: "rollback" | "cleanup", cause: unknown, original?: unknown): Promise<SetupTransactionError> {
    const paths = [
      this.paths.lockPath,
      this.paths.stageRoot,
      this.paths.backupRoot,
      this.paths.configStagePath,
      this.paths.configBackupPath,
      this.paths.gitignoreStagePath,
      this.paths.gitignoreBackupPath,
    ]
    const retained: string[] = []
    for (const path of paths) {
      try {
        if (await pathExists(path)) retained.push(path)
      } catch {
        retained.push(path)
      }
    }
    const reported = retained.length > 0 ? retained : paths
    const detail = `; recovery artifacts retained: ${reported.join(", ")}`
    const originalMessage = original ? ` after ${errorMessage(original)}` : ""
    return new SetupTransactionError(
      `setup ${phase} failed${originalMessage}: ${errorMessage(cause)}${detail}`,
      phase,
      reported,
      { cause },
    )
  }
}

function phaseMatches(configured: SetupFailurePhase, actual: SetupFailurePhase): boolean {
  if (configured === actual) return true
  return (configured === "config-commit" && actual === "config") || (configured === "config" && actual === "config-commit")
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (isMissingPath(error)) return false
    throw error
  }
}

async function readTextIfPresent(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8")
  } catch (error) {
    if (isMissingPath(error)) return undefined
    throw error
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isMissingPath(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "ENOENT"
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "EEXIST"
}
