import { createHash } from "node:crypto"
import { readFile, realpath } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { parseTask, clearTaskCheckpoint, isCompletedStatus, isValidTaskSlug, updateTaskCheckpoint, type CheckpointRecord, type TaskFile } from "./tasks.ts"

const OBJECT_ID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i
const TASK_ID_PATTERN = /^task_\d+$/
const DEFAULT_DIAGNOSTIC_LIMIT = 1024
const EMPTY_STATUS_DIGEST = createHash("sha256").update("").digest("hex")

/** The result of one argument-array Git invocation. */
export interface GitResult {
  exitCode: number
  stdout: string
  stderr: string
}

/** The process boundary is injectable so safety and command tests need no shell. */
export type GitRunner = (args: readonly string[], cwd: string) => Promise<GitResult>

export type PorcelainEntryKind = "ordinary" | "untracked" | "rename" | "copy" | "ignored" | "unknown"

export interface PorcelainStatusEntry {
  status: string
  indexStatus: string
  worktreeStatus: string
  path: string
  originalPath?: string
  paths: string[]
  kind: PorcelainEntryKind
  ambiguous: boolean
}

export interface CachedDiffEntry {
  status: string
  paths: string[]
  ambiguous: boolean
}

export type CheckpointOutcomeState = "disabled" | "created" | "blocked"

export interface CheckpointOutcome {
  state: CheckpointOutcomeState
  commit?: string
  message?: string
}

export interface CheckpointInput {
  root: string
  slug: string
  task: TaskFile
  /** Optional per-call config bridge used by the runtime and CLI consumers. */
  config?: { auto_commit: boolean; [key: string]: unknown }
  enabled?: boolean
  autoCommit?: boolean
  auto_commit?: boolean
}

export interface CheckpointServiceOptions {
  enabled?: boolean
  autoCommit?: boolean
  auto_commit?: boolean
  config?: { auto_commit: boolean; [key: string]: unknown }
  maxDiagnosticLength?: number
  /** Known changes created by packet-memory bootstrap may be retained in a baseline. */
  allowedBaselinePaths?: readonly string[]
  git?: GitRunner
}

export interface CheckpointServiceContract {
  begin(input: CheckpointInput): Promise<CheckpointOutcome>
  preserve(input: CheckpointInput): Promise<CheckpointOutcome>
  complete(input: CheckpointInput): Promise<CheckpointOutcome>
  retry(input: CheckpointInput): Promise<CheckpointOutcome>
}

interface Snapshot {
  head: string
  entries: PorcelainStatusEntry[]
  digest: string
}

interface Baseline extends Snapshot {
  paths: Set<string>
}

interface RepositoryContext {
  root: string
  slug: string
  taskPath: string
  taskRelativePath: string
  key: string
}

interface CandidatePlan {
  context: RepositoryContext
  task: TaskFile
  record: CheckpointRecord
  candidatePaths: string[]
  baseline: Baseline
  staged: boolean
  restorationError?: string
}

class CheckpointFailure extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CheckpointFailure"
  }
}

/**
 * Parse `git status --porcelain=v1 -z` without interpreting shell quoting.
 * Rename/copy entries consume the following NUL-delimited path as well.
 */
export function parsePorcelainStatus(input: string | Uint8Array): PorcelainStatusEntry[] {
  const value = decodeGitOutput(input)
  if (value.length === 0) return []
  if (!value.endsWith("\0")) throw new Error("malformed NUL-delimited Git status output")

  const fields = value.slice(0, -1).split("\0")
  const entries: PorcelainStatusEntry[] = []
  for (let index = 0; index < fields.length;) {
    const field = fields[index++]
    if (field === undefined || field.length < 4 || field[2] !== " ") {
      throw new Error("malformed Git porcelain status entry")
    }
    const status = field.slice(0, 2)
    const path = field.slice(3)
    if (path.length === 0) throw new Error("Git porcelain status entry is missing a path")

    const isRename = status[0] === "R" || status[1] === "R"
    const isCopy = status[0] === "C" || status[1] === "C"
    let originalPath: string | undefined
    if (isRename || isCopy) {
      originalPath = fields[index++]
      if (originalPath === undefined || originalPath.length === 0) {
        throw new Error("Git rename/copy status entry is missing its second path")
      }
    }

    const paths = originalPath === undefined ? [path] : [path, originalPath]
    const kind: PorcelainEntryKind = status === "??"
      ? "untracked"
      : status === "!!"
        ? "ignored"
        : isRename
          ? "rename"
          : isCopy
            ? "copy"
            : "ordinary"
    const ambiguous = !isKnownPorcelainStatus(status)
      || status.includes("U")
      || (status.includes("?") && status !== "??")
      || (status.includes("!") && status !== "!!")
      || status === "!!"
    const entry: PorcelainStatusEntry = {
      status,
      indexStatus: status[0] ?? "",
      worktreeStatus: status[1] ?? "",
      path,
      paths,
      kind,
      ambiguous,
    }
    if (originalPath !== undefined) entry.originalPath = originalPath
    entries.push(entry)
  }
  return entries
}

/** Alias kept for callers that name the Git format rather than the command. */
export const parseGitStatus = parsePorcelainStatus
export const parseStatusPorcelain = parsePorcelainStatus

/** Parse `git diff --cached --name-status -z` into a path-bounded representation. */
export function parseCachedDiff(input: string | Uint8Array): CachedDiffEntry[] {
  const value = decodeGitOutput(input)
  if (value.length === 0) return []
  if (!value.endsWith("\0")) throw new Error("malformed NUL-delimited cached diff output")

  const fields = value.slice(0, -1).split("\0")
  const entries: CachedDiffEntry[] = []
  for (let index = 0; index < fields.length;) {
    const field = fields[index++]
    if (field === undefined || field.length === 0) throw new Error("malformed cached diff entry")
    const separator = field.indexOf("\t")
    const status = separator >= 0 ? field.slice(0, separator) : field
    let path = separator >= 0 ? field.slice(separator + 1) : fields[index++]
    if (path === undefined || path.length === 0) throw new Error("cached diff entry is missing a path")

    const isRename = status[0] === "R"
    const isCopy = status[0] === "C"
    let originalPath: string | undefined
    if (isRename || isCopy) {
      originalPath = fields[index++]
      if (originalPath === undefined || originalPath.length === 0) {
        throw new Error("cached rename/copy entry is missing its second path")
      }
    }
    const paths = originalPath === undefined ? [path] : [path, originalPath]
    entries.push({
      status,
      paths,
      ambiguous: !/^[A-Z][0-9]*$/.test(status) || status.startsWith("U"),
    })
  }
  return entries
}

export const parseCachedNameStatus = parseCachedDiff

/** Stable digest for a set of parsed status entries. */
export function digestStatusEntries(entries: readonly PorcelainStatusEntry[]): string {
  const canonical = entries
    .map((entry) => `${entry.status}\0${entry.paths.join("\0")}`)
    .sort()
    .join("\0")
  return createHash("sha256").update(canonical).digest("hex")
}

export const computeBaselineDigest = digestStatusEntries

export function checkpointCommitMessage(slug: string, taskName: string, taskType: string): string {
  if (!isValidTaskSlug(slug)) throw new Error(`invalid task slug: ${slug}`)
  const normalizedTaskName = taskName.trim().replace(/\s+/g, " ")
  if (!normalizedTaskName) throw new Error("task name must not be empty")
  const normalizedTaskType = taskType.trim().toLowerCase()
  const commitType = normalizedTaskType === "fix"
    ? "fix"
    : normalizedTaskType === "docs"
      ? "chore"
      : "feat"
  return `${commitType}: ${slug} ${normalizedTaskName}`
}

export const deterministicCommitMessage = checkpointCommitMessage

/**
 * Shared, local-only Git checkpoint service. It never invokes a shell and does
 * not expose remote, identity, stash, reset, clean, or hook-bypass controls.
 */
export class CheckpointService implements CheckpointServiceContract {
  private readonly git: GitRunner
  private readonly diagnosticLimit: number
  private readonly allowedBaselinePaths: Set<string>
  private readonly baselines = new Map<string, Baseline>()
  private readonly configuredEnabled: boolean

  constructor(options: CheckpointServiceOptions = {}) {
    this.git = options.git ?? runGit
    this.diagnosticLimit = Math.max(128, Math.min(options.maxDiagnosticLength ?? DEFAULT_DIAGNOSTIC_LIMIT, 4096))
    this.allowedBaselinePaths = new Set((options.allowedBaselinePaths ?? []).map((path) => normalizeSafePath(path)))
    this.configuredEnabled = options.config?.auto_commit
      ?? options.auto_commit
      ?? options.autoCommit
      ?? options.enabled
      ?? false
  }

  async begin(input: CheckpointInput): Promise<CheckpointOutcome> {
    if (!this.isEnabled(input)) return disabledOutcome()

    let context: RepositoryContext | undefined
    let currentTask: TaskFile | undefined
    try {
      const repository = await this.repositoryContext(input)
      context = repository
      currentTask = await loadFreshTask({ ...input.task, path: repository.taskPath })
      const snapshot = await this.captureSnapshot(repository.root)
      this.validateBaseline(snapshot.entries, repository.taskRelativePath)

      const record: CheckpointRecord = {
        state: "active",
        base_head: snapshot.head,
        baseline_digest: snapshot.digest,
        paths: [repository.taskRelativePath],
      }
      currentTask = await updateTaskCheckpoint(currentTask, record)

      const after = await this.captureSnapshot(repository.root)
      const changed = pathSet(after.entries.flatMap((entry) => entry.paths))
      if (!changed.has(repository.taskRelativePath) || [...changed].some((path) => !this.allowedBaselinePaths.has(path) && path !== repository.taskRelativePath)) {
        try {
          await clearTaskCheckpoint(currentTask)
        } catch (cleanupError) {
          throw new CheckpointFailure(this.diagnostic("repository changed while capturing the checkpoint baseline; active metadata cleanup failed", cleanupError))
        }
        throw new CheckpointFailure("repository changed while capturing the checkpoint baseline")
      }

      this.baselines.set(repository.key, {
        ...snapshot,
        paths: new Set(snapshot.entries.flatMap((entry) => entry.paths)),
      })
      return createdOutcome("checkpoint baseline captured")
    } catch (error) {
      return blockedOutcome(this.diagnostic("unable to begin checkpoint", error))
    }
  }

  async complete(input: CheckpointInput): Promise<CheckpointOutcome> {
    if (!this.isEnabled(input)) return disabledOutcome()
    return this.deliver(input, false)
  }

  async preserve(input: CheckpointInput): Promise<CheckpointOutcome> {
    if (!this.isEnabled(input)) return disabledOutcome()

    try {
      const context = await this.repositoryContext(input)
      const currentTask = await loadFreshTask({ ...input.task, path: context.taskPath })
      const record = currentTask.frontmatter.checkpoint
      if (record?.state !== "active") {
        throw new CheckpointFailure("checkpoint recovery preservation requires active metadata")
      }

      const snapshot = await this.captureSnapshot(context.root)
      this.assertBaseHead(record, snapshot)
      const baseline = this.resolveBaseline(context, record, snapshot)
      this.assertBaselineUnchanged(record, snapshot, baseline)
      const candidatePaths = validateCandidatePaths(flattenEntryPaths(this.candidateEntries(snapshot.entries, baseline)))
      if (!candidatePaths.includes(context.taskRelativePath)) {
        throw new CheckpointFailure("task metadata path is missing from the temporal candidate delta")
      }

      await updateTaskCheckpoint(currentTask, {
        state: "active",
        base_head: record.base_head,
        baseline_digest: record.baseline_digest,
        paths: candidatePaths,
      })
      return createdOutcome("checkpoint recovery state preserved")
    } catch (error) {
      return blockedOutcome(this.diagnostic("unable to preserve checkpoint recovery state", error))
    }
  }

  async retry(input: CheckpointInput): Promise<CheckpointOutcome> {
    if (!this.isEnabled(input)) return disabledOutcome()
    return this.deliver(input, true)
  }

  private async deliver(input: CheckpointInput, retryOnly: boolean): Promise<CheckpointOutcome> {
    let context: RepositoryContext | undefined
    let currentTask: TaskFile | undefined
    let record: CheckpointRecord | undefined
    let plan: CandidatePlan | undefined

    try {
      const repository = await this.repositoryContext(input)
      context = repository
      currentTask = await loadFreshTask({ ...input.task, path: repository.taskPath })
      if (!isCompletedStatus(currentTask.frontmatter.status)) {
        throw new CheckpointFailure("task must be completed before checkpoint delivery")
      }
      record = currentTask.frontmatter.checkpoint
      if (record === undefined) throw new CheckpointFailure("task has no checkpoint baseline to deliver")
      if (retryOnly && record.state !== "blocked") {
        throw new CheckpointFailure("checkpoint retry requires blocked delivery metadata")
      }
      if (!retryOnly && record.state === "blocked") return this.deliver(input, true)
      if (record.state !== "active" && record.state !== "blocked") {
        throw new CheckpointFailure("task checkpoint metadata is not deliverable")
      }

      const before = await this.captureSnapshot(context.root)
      this.assertBaseHead(record, before)
      const baseline = this.resolveBaseline(context, record, before)
      this.assertBaselineUnchanged(record, before, baseline)

      if (record.state === "blocked") {
        const expected = validateCandidatePaths(record.paths)
        const currentCandidates = this.candidateEntries(before.entries, baseline)
        const currentPaths = flattenEntryPaths(currentCandidates)
        assertSamePathSet(currentPaths, expected, "stored candidate paths do not match current Git state")
      }

      currentTask = await clearTaskCheckpoint(currentTask)
      const snapshot = await this.captureSnapshot(context.root)
      this.assertBaseHead(record, snapshot)
      this.assertBaselineUnchanged(record, snapshot, baseline)

      const candidateEntries = this.candidateEntries(snapshot.entries, baseline)
      const candidatePaths = record.state === "blocked"
        ? validateCandidatePaths(record.paths)
        : validateCandidatePaths(flattenEntryPaths(candidateEntries))
      if (candidatePaths.length === 0) throw new CheckpointFailure("no task changes were found for checkpoint delivery")
      if (record.state === "active" && !candidatePaths.includes(context.taskRelativePath)) {
        throw new CheckpointFailure("task metadata path is missing from the temporal candidate delta")
      }
      if (record.state === "blocked") {
        assertSamePathSet(flattenEntryPaths(candidateEntries), candidatePaths, "candidate path drift detected before retry")
      }

      plan = { context, task: currentTask, record, candidatePaths, baseline, staged: false }
      await this.stageAndCommit(plan)
      this.baselines.delete(context.key)
      return createdCommitOutcome(await this.commitReference(context.root))
    } catch (error) {
      if (plan?.staged) await this.restoreCandidateStaging(plan)
      const baseMessage = this.diagnostic("checkpoint blocked", error)
      const message = plan?.restorationError === undefined
        ? baseMessage
        : this.bound(`${baseMessage}; ${plan.restorationError}`)
      if (currentTask !== undefined && record !== undefined && plan?.candidatePaths !== undefined) {
        return await this.persistBlocked(plan, message)
      }
      if (currentTask !== undefined && record !== undefined && context !== undefined) {
        const fallbackPaths = validateCandidatePaths(record.paths)
        try {
          await updateTaskCheckpoint(currentTask, {
            state: "blocked",
            base_head: record.base_head,
            baseline_digest: record.baseline_digest,
            paths: fallbackPaths,
            error: message,
          })
        } catch (persistError) {
          return blockedOutcome(this.diagnostic(`${message}; could not persist blocked state`, persistError))
        }
      }
      return blockedOutcome(message)
    }
  }

  private async stageAndCommit(plan: CandidatePlan): Promise<void> {
    plan.staged = true
    const add = await this.invoke(plan.context.root, ["add", "--", ...plan.candidatePaths])
    if (add.exitCode !== 0) throw new CheckpointFailure(this.gitFailure("git add failed", add))

    const afterStage = await this.captureSnapshot(plan.context.root)
    this.assertBaseHead(plan.record, afterStage)
    this.assertBaselineUnchanged(plan.record, afterStage, plan.baseline)
    const stagedWorktree = this.candidateEntries(afterStage.entries, plan.baseline)
    assertSamePathSet(flattenEntryPaths(stagedWorktree), plan.candidatePaths, "repository changed while staging candidate paths")
    if (stagedWorktree.some((entry) => entry.worktreeStatus !== " ")) {
      throw new CheckpointFailure("candidate content changed while it was being staged")
    }

    const check = await this.invoke(plan.context.root, ["diff", "--cached", "--check"])
    if (check.exitCode !== 0) throw new CheckpointFailure(this.gitFailure("cached diff check failed", check))

    const cached = await this.invoke(plan.context.root, ["diff", "--cached", "--name-status", "-z"])
    if (cached.exitCode !== 0) throw new CheckpointFailure(this.gitFailure("cached path inspection failed", cached))
    const cachedEntries = parseCachedDiff(cached.stdout)
    if (cachedEntries.some((entry) => entry.ambiguous)) throw new CheckpointFailure("cached diff contains an ambiguous path or status")
    assertSamePathSet(flattenCachedPaths(cachedEntries), plan.candidatePaths, "cached paths differ from the temporal candidate set")

    const commit = await this.invoke(plan.context.root, [
      "commit",
      "-m",
      checkpointCommitMessage(plan.context.slug, plan.task.frontmatter.title, plan.task.frontmatter.type),
    ])
    if (commit.exitCode !== 0) throw new CheckpointFailure(this.gitFailure("Git commit was refused", commit))
  }

  private async restoreCandidateStaging(plan: CandidatePlan): Promise<void> {
    try {
      const cached = await this.invoke(plan.context.root, ["diff", "--cached", "--name-status", "-z"])
      if (cached.exitCode !== 0) {
        plan.restorationError = this.gitFailure("could not inspect candidate staging", cached)
        return
      }
      const stagedPaths = flattenCachedPaths(parseCachedDiff(cached.stdout))
        .filter((path) => plan.candidatePaths.includes(path))
      if (stagedPaths.length === 0) return
      const restored = await this.invoke(plan.context.root, ["restore", "--staged", "--", ...stagedPaths])
      if (restored.exitCode !== 0) plan.restorationError = this.gitFailure("candidate staging could not be restored", restored)
    } catch (error) {
      plan.restorationError = this.diagnostic("candidate staging could not be restored", error)
    }
  }

  private async persistBlocked(plan: CandidatePlan, message: string): Promise<CheckpointOutcome> {
    try {
      await updateTaskCheckpoint(plan.task, {
        state: "blocked",
        base_head: plan.record.base_head,
        baseline_digest: plan.record.baseline_digest,
        paths: plan.candidatePaths,
        error: message,
      })
      return blockedOutcome(message)
    } catch (error) {
      return blockedOutcome(this.diagnostic(`${message}; could not persist blocked state`, error))
    }
  }

  private async repositoryContext(input: CheckpointInput): Promise<RepositoryContext> {
    if (!isValidTaskSlug(input.slug)) throw new CheckpointFailure(`invalid task slug: ${input.slug}`)
    if (!TASK_ID_PATTERN.test(input.task.id)) throw new CheckpointFailure(`invalid task ID: ${input.task.id}`)
    const requestedRoot = await realpath(resolve(input.root))
    const rootResult = await this.invoke(requestedRoot, ["rev-parse", "--show-toplevel"])
    if (rootResult.exitCode !== 0) throw new CheckpointFailure(this.gitFailure("not a Git repository", rootResult))
    const discoveredRoot = await realpath(resolve(requestedRoot, rootResult.stdout.trim()))
    if (discoveredRoot !== requestedRoot) throw new CheckpointFailure("checkpoint root must be the Git repository root")

    const taskPath = await realpath(resolve(requestedRoot, input.task.path))
    const expectedPath = resolve(requestedRoot, ".spec-finder", "tasks", input.slug, `${input.task.id}.md`)
    if (taskPath !== expectedPath) throw new CheckpointFailure("task path is outside its packet")
    const taskRelativePath = toSafeRelativePath(requestedRoot, taskPath)
    return {
      root: requestedRoot,
      slug: input.slug,
      taskPath,
      taskRelativePath,
      key: `${requestedRoot}:${input.slug}:${input.task.id}`,
    }
  }

  private async captureSnapshot(root: string): Promise<Snapshot> {
    const status = await this.invoke(root, ["status", "--porcelain=v1", "-z", "-uall"])
    if (status.exitCode !== 0) throw new CheckpointFailure(this.gitFailure("Git status failed", status))
    let entries: PorcelainStatusEntry[]
    try {
      entries = parsePorcelainStatus(status.stdout)
    } catch (error) {
      throw new CheckpointFailure(this.diagnostic("could not parse Git status", error))
    }
    const headResult = await this.invoke(root, ["rev-parse", "HEAD"])
    if (headResult.exitCode !== 0) throw new CheckpointFailure(this.gitFailure("could not read Git HEAD", headResult))
    const head = headResult.stdout.trim()
    if (!OBJECT_ID_PATTERN.test(head)) throw new CheckpointFailure("Git HEAD is not a valid object ID")
    return { head, entries, digest: digestStatusEntries(entries) }
  }

  private validateBaseline(entries: readonly PorcelainStatusEntry[], taskRelativePath: string): void {
    for (const entry of entries) {
      this.validateEntry(entry)
      const paths = entry.paths.map((path) => normalizeSafePath(path))
      const allowed = paths.every((path) => this.allowedBaselinePaths.has(path))
      if (!allowed) throw new CheckpointFailure("pre-existing Git changes make checkpoint attribution unsafe")
      if (paths.includes(taskRelativePath)) throw new CheckpointFailure("task path is already dirty at checkpoint begin")
    }
  }

  private validateEntry(entry: PorcelainStatusEntry): void {
    if (entry.ambiguous) throw new CheckpointFailure("Git status contains an ambiguous or unmerged entry")
    for (const path of entry.paths) {
      if (!isSafeRelativePath(path)) throw new CheckpointFailure(`unsafe Git path: ${JSON.stringify(path)}`)
    }
  }

  private resolveBaseline(context: RepositoryContext, record: CheckpointRecord, snapshot: Snapshot): Baseline {
    const known = this.baselines.get(context.key)
    if (known !== undefined && known.head === record.base_head && known.digest === record.baseline_digest) return known
    if (record.baseline_digest === EMPTY_STATUS_DIGEST) {
      return { head: record.base_head, entries: [], digest: EMPTY_STATUS_DIGEST, paths: new Set() }
    }
    const candidatePaths = new Set(record.paths)
    let entries = snapshot.entries.filter((entry) => entry.paths.every((path) => !candidatePaths.has(path)))
    if (digestStatusEntries(entries) !== record.baseline_digest) {
      entries = snapshot.entries.filter((entry) => entry.paths.every((path) => (
        !candidatePaths.has(path) && this.allowedBaselinePaths.has(path)
      )))
    }
    if (digestStatusEntries(entries) !== record.baseline_digest) {
      throw new CheckpointFailure("checkpoint baseline snapshot is unavailable or has drifted")
    }
    return {
      head: record.base_head,
      entries,
      digest: record.baseline_digest,
      paths: new Set(entries.flatMap((entry) => entry.paths)),
    }
  }

  private candidateEntries(entries: readonly PorcelainStatusEntry[], baseline: Baseline): PorcelainStatusEntry[] {
    const result: PorcelainStatusEntry[] = []
    for (const entry of entries) {
      this.validateEntry(entry)
      const isBaseline = entry.paths.every((path) => baseline.paths.has(path))
      const overlapsBaseline = entry.paths.some((path) => baseline.paths.has(path))
      if (isBaseline) continue
      if (overlapsBaseline) throw new CheckpointFailure("Git rename/copy crosses the baseline and candidate boundary")
      result.push(entry)
    }
    return result
  }

  private assertBaseHead(record: CheckpointRecord, snapshot: Snapshot): void {
    if (snapshot.head !== record.base_head) throw new CheckpointFailure("Git HEAD changed since checkpoint baseline")
  }

  private assertBaselineUnchanged(record: CheckpointRecord, snapshot: Snapshot, baseline: Baseline): void {
    const baselineEntries = snapshot.entries.filter((entry) => entry.paths.every((path) => baseline.paths.has(path)))
    if (digestStatusEntries(baselineEntries) !== record.baseline_digest) {
      throw new CheckpointFailure("pre-existing Git state changed since checkpoint baseline")
    }
  }

  private isEnabled(input: CheckpointInput): boolean {
    return input.config?.auto_commit
      ?? input.auto_commit
      ?? input.autoCommit
      ?? input.enabled
      ?? this.configuredEnabled
  }

  private async invoke(cwd: string, args: readonly string[]): Promise<GitResult> {
    try {
      return await this.git(args, cwd)
    } catch (error) {
      throw new CheckpointFailure(this.diagnostic(`Git process failed (${args[0] ?? "unknown"})`, error))
    }
  }

  private gitFailure(prefix: string, result: GitResult): string {
    const detail = [result.stderr, result.stdout].map((value) => value.trim()).filter(Boolean).join(" ")
    return this.bound(`${prefix}${detail.length > 0 ? `: ${detail}` : ` (exit ${result.exitCode})`}`)
  }

  private diagnostic(prefix: string, error: unknown): string {
    const detail = error instanceof CheckpointFailure ? error.message : error instanceof Error ? error.message : String(error)
    return this.bound(`${prefix}: ${detail}`)
  }

  private bound(value: string): string {
    const cleaned = value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim()
    return cleaned.length <= this.diagnosticLimit ? cleaned : `${cleaned.slice(0, this.diagnosticLimit - 1)}…`
  }

  private async commitReference(root: string): Promise<string> {
    try {
      const head = await this.invoke(root, ["rev-parse", "HEAD"])
      if (head.exitCode !== 0 || !OBJECT_ID_PATTERN.test(head.stdout.trim())) return "unknown"
      return head.stdout.trim()
    } catch {
      return "unknown"
    }
  }
}

export function createCheckpointService(options: CheckpointServiceOptions = {}): CheckpointService {
  return new CheckpointService(options)
}

export const createGitCheckpointService = createCheckpointService

export async function runGit(args: readonly string[], cwd: string): Promise<GitResult> {
  const child = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { exitCode, stdout, stderr }
}

function loadFreshTask(task: TaskFile): Promise<TaskFile> {
  return readFile(task.path, "utf8").then((source) => parseTask(task.path, source))
}

function decodeGitOutput(input: string | Uint8Array): string {
  return typeof input === "string" ? input : new TextDecoder().decode(input)
}

function isKnownPorcelainStatus(status: string): boolean {
  if (status === "??" || status === "!!") return true
  if (status.length !== 2) return false
  const valid = new Set([" ", "M", "A", "D", "R", "C", "T", "U", "?", "!"])
  return valid.has(status[0] ?? "") && valid.has(status[1] ?? "")
}

function flattenEntryPaths(entries: readonly PorcelainStatusEntry[]): string[] {
  return [...pathSet(entries.flatMap((entry) => entry.paths))].sort()
}

function flattenCachedPaths(entries: readonly CachedDiffEntry[]): string[] {
  return [...pathSet(entries.flatMap((entry) => entry.paths))].sort()
}

function pathSet(paths: readonly string[]): Set<string> {
  return new Set(paths)
}

function validateCandidatePaths(paths: readonly string[]): string[] {
  const normalized = [...pathSet(paths.map((path) => normalizeSafePath(path)))]
  if (normalized.length === 0) throw new CheckpointFailure("checkpoint candidate path set is empty")
  if (normalized.some((path) => !isSafeRelativePath(path))) throw new CheckpointFailure("checkpoint candidate path set contains an unsafe path")
  return normalized.sort()
}

function assertSamePathSet(actual: readonly string[], expected: readonly string[], message: string): void {
  const left = validateCandidatePaths(actual)
  const right = validateCandidatePaths(expected)
  if (left.length !== right.length || left.some((path, index) => path !== right[index])) throw new CheckpointFailure(message)
}

function normalizeSafePath(path: string): string {
  return path.replaceAll("\\", "/")
}

function isSafeRelativePath(path: string): boolean {
  const normalized = normalizeSafePath(path)
  if (normalized.length === 0 || normalized.includes("\0") || normalized !== path) return false
  if (isAbsolute(path) || /^[a-z]:/i.test(path)) return false
  return path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
}

function toSafeRelativePath(root: string, target: string): string {
  const value = relative(root, target)
  const normalized = sep === "/" ? value : value.split(sep).join("/")
  if (!isSafeRelativePath(normalized)) throw new CheckpointFailure("task path is not a safe repository-relative path")
  return normalized
}

function disabledOutcome(): CheckpointOutcome {
  return { state: "disabled", message: "checkpointing disabled (auto_commit is false)" }
}

function createdOutcome(message: string): CheckpointOutcome {
  return { state: "created", message }
}

function createdCommitOutcome(commit: string): CheckpointOutcome {
  return { state: "created", commit }
}

function blockedOutcome(message: string): CheckpointOutcome {
  return { state: "blocked", message }
}
