import { access, mkdir, readFile } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import type { SpecFinderConfig } from "./config.ts"
import type { NoWorkReason, RunEventListener } from "./events.ts"
export type { NoWorkReason } from "./events.ts"
import { resolveWorkspaceRelativeReference } from "./paths.ts"
import type { ProviderLaunch } from "./providers.ts"
import { AcpProcessExitError, withAcpSession } from "./acp-client.ts"
import {
  createCheckpointService,
  digestStatusEntries,
  isUnstagedTrackedResidue,
  parsePorcelainStatus,
  runGit,
  type CheckpointInput,
  type CheckpointOutcome,
  type CheckpointServiceContract,
  type PorcelainStatusEntry,
} from "./checkpoints.ts"
import { ensurePacketMemory, taskMemoryPaths } from "./memory.ts"
import {
  clearTaskCheckpoint,
  clearTaskHandoff,
  executionOrder,
  hasPendingCheckpointDelivery,
  isCheckpointBlocked,
  loadTaskPacket,
  parseTask,
  updateTaskHandoff,
  updateTaskStatus,
  validateTasks,
  type TaskFile,
} from "./tasks.ts"

const REPORT_DIRECTORY = "reports"
const TASK_PHASE_ATTEMPTS = 2

type TaskPhase = "implementation" | "final report"
type TaskPhaseAttempts = Record<TaskPhase, number>

export interface RunOptions {
  root: string
  slug: string
  config: SpecFinderConfig
  signal: AbortSignal
  emit: RunEventListener
  interactivePermissions: boolean
  providerLaunch?: ProviderLaunch
  /** Injectable runtime seam for deterministic checkpoint lifecycle tests. */
  checkpointService?: CheckpointServiceContract
}

export interface RunResult {
  ok: boolean
  completed: number
  failed: number
  blocked: number
  outcome?: "no_work"
  reason?: NoWorkReason
}

export async function runTaskPacket(options: RunOptions): Promise<RunResult> {
  const packet = await loadTaskPacket(options.root, options.slug)
  const issues = validateTasks(packet.tasks)
  if (issues.length > 0) {
    throw new Error(`task packet is invalid:\n${issues.map((issue) => `- ${relative(options.root, issue.path)}: ${issue.message}`).join("\n")}`)
  }

  const checkpointEnabled = options.config.auto_commit
  let checkpointService: CheckpointServiceContract | undefined = options.checkpointService
  let checkpointPreparationError: string | undefined
  let preMemorySnapshot: GitSnapshot | undefined
  if (checkpointEnabled && checkpointService === undefined) {
    try {
      preMemorySnapshot = await captureGitSnapshot(options.root)
      validatePreMemorySnapshot(preMemorySnapshot.entries, packet.tasks, options.root, packet.directory)
    } catch (error) {
      checkpointPreparationError = boundedCheckpointMessage(`checkpoint pre-memory baseline blocked: ${errorMessage(error)}`)
    }
  }
  await ensurePacketMemory(packet.directory, packet.tasks)
  if (checkpointEnabled && checkpointService === undefined && checkpointPreparationError === undefined) {
    try {
      const postMemorySnapshot = await captureGitSnapshot(options.root)
      if (preMemorySnapshot === undefined) throw new Error("pre-memory baseline is unavailable")
      validatePostMemorySnapshot(
        preMemorySnapshot,
        postMemorySnapshot,
        packet.tasks,
        options.root,
        packet.directory,
      )
      checkpointService = createCheckpointService({
        config: options.config,
        allowedBaselinePaths: [...postMemorySnapshot.entries.flatMap((entry) => entry.paths)],
      })
    } catch (error) {
      checkpointPreparationError = boundedCheckpointMessage(`checkpoint post-memory baseline blocked: ${errorMessage(error)}`)
    }
  }
  const ordered = executionOrder(packet.tasks)
  options.emit({ type: "run_started", slug: options.slug, config: options.config, tasks: packet.tasks })

  if (ordered.length === 0 && !options.signal.aborted) {
    const result = {
      ok: true,
      completed: 0,
      failed: 0,
      blocked: 0,
      outcome: "no_work" as const,
      reason: "all_tasks_complete" as const,
    }
    options.emit({
      type: "run_finished",
      ok: true,
      message: "No executable tasks: all tasks are already complete",
      outcome: result.outcome,
      reason: result.reason,
    })
    return result
  }

  const failedIds = new Set<string>()
  let completed = 0
  let failed = 0
  let blocked = 0
  let cancelled = false

  for (let current of ordered) {
    if (options.signal.aborted) throw new Error("run cancelled")
    if (checkpointPreparationError !== undefined) {
      emitCheckpointBlocked(options.emit, current.id, checkpointPreparationError)
      blocked += 1
      break
    }
    const dependencyFailed = current.frontmatter.dependencies.some((dependency) => failedIds.has(dependency.replace(/\.md$/, "")))
    if (dependencyFailed) {
      current = await updateTaskStatus(current, "blocked")
      failedIds.add(current.id)
      blocked += 1
      options.emit({ type: "task_status", taskId: current.id, status: "blocked" })
      continue
    }

    if (hasPendingCheckpointDelivery(current)) {
      if (!checkpointEnabled || checkpointService === undefined) {
        emitCheckpointBlocked(
          options.emit,
          current.id,
          "checkpoint delivery is pending; enable auto_commit to recover without rerunning implementation",
        )
        blocked += 1
        break
      }
      const operation = isCheckpointBlocked(current) ? "retry" : "complete"
      const recovery = await callCheckpoint(checkpointService, operation, checkpointInput(options, current))
      if (recovery.state === "blocked") {
        emitCheckpointOutcome(options.emit, current.id, recovery)
        blocked += 1
        break
      }
      if (recovery.state === "created") {
        emitCheckpointOutcome(options.emit, current.id, recovery)
        completed += 1
      }
      continue
    }

    const resumingReportHandoff = current.frontmatter.handoff?.phase === "report"
    const resumingActiveCheckpoint = resumingReportHandoff
      && current.frontmatter.checkpoint?.state === "active"
    if (checkpointEnabled && checkpointService !== undefined && !resumingActiveCheckpoint) {
      const begin = await callCheckpoint(checkpointService, "begin", checkpointInput(options, current))
      if (begin.state === "blocked") {
        emitCheckpointOutcome(options.emit, current.id, begin)
        blocked += 1
        break
      }
      if (begin.state === "created") current = await reloadTask(current)
    }

    current = await updateTaskStatus(current, "in_progress")
    options.emit({ type: "task_status", taskId: current.id, status: "in_progress" })
    options.emit({
      type: "activity",
      taskId: current.id,
      message: resumingReportHandoff
        ? "resuming final report handoff; verified implementation will not rerun"
        : "implementation session starting",
    })

    let phase: "implementation" | "report" = resumingReportHandoff ? "report" : "implementation"
    let implementationComplete = resumingReportHandoff
    const attempts: TaskPhaseAttempts = { implementation: 0, "final report": 0 }
    const reportDirectory = join(packet.directory, REPORT_DIRECTORY)
    const reportPath = join(reportDirectory, `${current.id}.md`)
    try {
      for (;;) {
        const attemptsBeforeSession = { ...attempts }
        try {
          await withAcpSession({
            root: options.root,
            config: options.config,
            taskId: current.id,
            phase,
            signal: options.signal,
            emit: options.emit,
            interactivePermissions: options.interactivePermissions,
            ...(options.providerLaunch ? { providerLaunch: options.providerLaunch } : {}),
          }, async (session) => {
            if (!implementationComplete) {
              await runTaskPhase({
                phase: "implementation",
                attempts,
                taskId: current.id,
                signal: options.signal,
                emit: options.emit,
                run: async (attempt) => {
                  const implementation = await session.runTurn(
                    implementationPrompt(options.root, packet.directory, current, attempt),
                    "implementation",
                  )
                  assertSuccessfulStop("implementation", implementation.stopReason)
                },
              })
              implementationComplete = true
              phase = "report"
              current = await updateTaskHandoff(current, { phase: "report" })
            }

            phase = "report"
            await mkdir(reportDirectory, { recursive: true })
            options.emit({
              type: "activity",
              taskId: current.id,
              message: resumingReportHandoff || attempts["final report"] > 0
                ? "final report recovery session starting"
                : "final report handoff starting in active ACP session",
            })
            await runTaskPhase({
              phase: "final report",
              attempts,
              taskId: current.id,
              signal: options.signal,
              emit: options.emit,
              run: async (attempt) => {
                const report = await session.runTurn(
                  reportPrompt(
                    options.root,
                    packet.directory,
                    current,
                    reportPath,
                    attempt,
                    resumingReportHandoff || attempts["final report"] > 1,
                  ),
                  "report",
                )
                assertSuccessfulStop("report", report.stopReason)
                await assertReport(reportPath)
              },
            })
          })
          break
        } catch (error) {
          if (!(error instanceof AcpProcessExitError) || isCancellation(error, options.signal)) throw error
          const taskPhase = phase === "report" ? "final report" : "implementation"
          const phaseAttemptedInSession = attempts[taskPhase] > attemptsBeforeSession[taskPhase]
          if (!phaseAttemptedInSession) attempts[taskPhase] += 1
          if (attempts[taskPhase] >= TASK_PHASE_ATTEMPTS) throw error
          emitPhaseRetry(options.emit, current.id, taskPhase, attempts[taskPhase], error)
        }
      }

      const reportReference = await resolveWorkspaceRelativeReference(options.root, reportPath)
      current = await clearTaskHandoff(current)
      current = await updateTaskStatus(current, "completed")
      completed += 1
      options.emit({
        type: "task_status",
        taskId: current.id,
        status: "completed",
        ...(reportReference === undefined ? {} : { reportReference }),
      })

      if (checkpointEnabled && checkpointService !== undefined) {
        const completion = await callCheckpoint(checkpointService, "complete", checkpointInput(options, current))
        if (completion.state === "blocked") {
          emitCheckpointOutcome(options.emit, current.id, completion)
          blocked += 1
          break
        }
        if (completion.state === "created") emitCheckpointOutcome(options.emit, current.id, completion)
      }
    } catch (error) {
      const message = errorMessage(error)
      if (phase === "report"
        && checkpointEnabled
        && checkpointService !== undefined
        && current.frontmatter.checkpoint?.state === "active") {
        const preservation = await callCheckpoint(checkpointService, "preserve", checkpointInput(options, current))
        if (preservation.state === "created") current = await reloadTask(current)
        if (preservation.state === "blocked") {
          options.emit({
            type: "activity",
            taskId: current.id,
            message: preservation.message ?? "checkpoint recovery state could not be preserved",
          })
        }
      } else if (checkpointEnabled && current.frontmatter.checkpoint !== undefined) {
        try {
          current = await clearTaskCheckpoint(current)
        } catch (cleanupError) {
          options.emit({
            type: "activity",
            taskId: current.id,
            message: `checkpoint metadata cleanup failed: ${boundedCheckpointMessage(errorMessage(cleanupError))}`,
          })
        }
      }
      if (isCancellation(error, options.signal)) {
        cancelled = true
        options.emit({ type: "activity", taskId: current.id, message })
      } else if (phase === "report") {
        current = await updateTaskHandoff(current, { phase: "report", error: message.slice(0, 4096) })
        current = await updateTaskStatus(current, "blocked")
        blocked += 1
        options.emit({ type: "task_status", taskId: current.id, status: "blocked" })
        options.emit({
          type: "activity",
          taskId: current.id,
          message: `final report handoff blocked: ${message}; rerun retries the report without rerunning implementation`,
        })
      } else {
        current = await updateTaskStatus(current, "failed")
        failedIds.add(current.id)
        failed += 1
        options.emit({ type: "task_status", taskId: current.id, status: "failed" })
        options.emit({ type: "activity", taskId: current.id, message })
      }
      break
    }
  }

  const ok = failed === 0 && blocked === 0 && !cancelled && !options.signal.aborted
  options.emit({
    type: "run_finished",
    ok,
    message: cancelled || options.signal.aborted
      ? "run cancelled"
      : ok
        ? `${completed} task${completed === 1 ? "" : "s"} completed`
        : `${failed} failed · ${blocked} blocked`,
  })
  return { ok, completed, failed, blocked }
}

interface GitSnapshot {
  head: string
  entries: PorcelainStatusEntry[]
  digest: string
}

async function captureGitSnapshot(root: string): Promise<GitSnapshot> {
  const status = await runGit(["status", "--porcelain=v1", "-z", "-uall"], root)
  if (status.exitCode !== 0) {
    throw new Error(`Git status failed${status.stderr.trim() ? `: ${status.stderr.trim()}` : ` (exit ${status.exitCode})`}`)
  }
  const entries = parsePorcelainStatus(status.stdout)
  const head = await runGit(["rev-parse", "HEAD"], root)
  if (head.exitCode !== 0) {
    throw new Error(`could not read Git HEAD${head.stderr.trim() ? `: ${head.stderr.trim()}` : ` (exit ${head.exitCode})`}`)
  }
  const oid = head.stdout.trim()
  if (oid.length === 0) throw new Error("Git HEAD is empty")
  return { head: oid, entries, digest: digestStatusEntries(entries) }
}

function validatePreMemorySnapshot(
  entries: readonly PorcelainStatusEntry[],
  tasks: readonly TaskFile[],
  root: string,
  packetDirectory: string,
): void {
  const recoveryPaths = checkpointPaths(tasks)
  const memoryPaths = packetMemoryPathsRelative(root, packetDirectory, tasks)
  const taskPaths = packetTaskPathsRelative(root, tasks)
  const hasRecoveryState = recoveryPaths.size > 0
  for (const entry of entries) {
    if (entry.ambiguous) throw new Error("pre-memory Git state is ambiguous or unmerged")
    const paths = entry.paths.map(normalizeRepositoryPath)
    const isRecoveryState = paths.every((path) => recoveryPaths.has(path))
    const isPacketTask = paths.every((path) => taskPaths.has(path))
    const isBootstrapResidue = hasRecoveryState && entry.status === "??" && paths.every((path) => memoryPaths.has(path))
    if (!isRecoveryState && !isPacketTask && !isBootstrapResidue && !isUnstagedTrackedResidue(entry)) {
      throw new Error("pre-existing Git changes make checkpoint attribution unsafe")
    }
  }
}

function validatePostMemorySnapshot(
  pre: GitSnapshot,
  post: GitSnapshot,
  tasks: readonly TaskFile[],
  root: string,
  packetDirectory: string,
): void {
  if (pre.head !== post.head) throw new Error("Git HEAD changed during memory initialization")
  const recoveryPaths = checkpointPaths(tasks)
  const memoryPaths = packetMemoryPathsRelative(root, packetDirectory, tasks)
  const prePaths = new Set(pre.entries.flatMap((entry) => entry.paths.map(normalizeRepositoryPath)))
  const preserved = post.entries.filter((entry) => entry.paths.every((path) => prePaths.has(normalizeRepositoryPath(path))))
  if (digestStatusEntries(preserved) !== pre.digest) {
    throw new Error("pre-memory Git state changed during memory initialization")
  }
  for (const entry of post.entries) {
    const paths = entry.paths.map(normalizeRepositoryPath)
    const isPreExisting = paths.every((path) => prePaths.has(path))
    const isRecoveryState = paths.every((path) => recoveryPaths.has(path))
    const isMemoryBootstrap = paths.every((path) => memoryPaths.has(path))
    if (entry.ambiguous || (!isPreExisting && !isRecoveryState && !isMemoryBootstrap)) {
      throw new Error("unexpected changes appeared during memory initialization")
    }
  }
}

function checkpointPaths(tasks: readonly TaskFile[]): Set<string> {
  return new Set(tasks.flatMap((task) => task.frontmatter.checkpoint?.paths ?? []).map(normalizeRepositoryPath))
}

function packetTaskPathsRelative(root: string, tasks: readonly TaskFile[]): Set<string> {
  return new Set(tasks.map((task) => normalizeRepositoryPath(relative(root, task.path))))
}

function packetMemoryPathsRelative(root: string, packetDirectory: string, tasks: readonly TaskFile[]): Set<string> {
  const absolutePaths = new Set<string>()
  for (const task of tasks) {
    const paths = taskMemoryPaths(packetDirectory, task.id)
    absolutePaths.add(paths.shared)
    absolutePaths.add(paths.task)
  }
  return new Set([...absolutePaths].map((path) => normalizeRepositoryPath(relative(root, path))))
}

function normalizeRepositoryPath(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/")
}

function checkpointInput(options: RunOptions, task: TaskFile): CheckpointInput {
  return { root: options.root, slug: options.slug, task, config: options.config }
}

async function callCheckpoint(
  service: CheckpointServiceContract,
  operation: "begin" | "preserve" | "complete" | "retry",
  input: CheckpointInput,
): Promise<CheckpointOutcome> {
  try {
    if (operation === "begin") return await service.begin(input)
    if (operation === "preserve") return await service.preserve(input)
    if (operation === "complete") return await service.complete(input)
    return await service.retry(input)
  } catch (error) {
    return { state: "blocked", message: boundedCheckpointMessage(`checkpoint ${operation} failed: ${errorMessage(error)}`) }
  }
}

function emitCheckpointOutcome(emit: RunEventListener, taskId: string, outcome: CheckpointOutcome): void {
  if (outcome.state === "disabled") return
  if (outcome.state === "created") {
    const commit = outcome.commit
    emit(commit === undefined
      ? { type: "checkpoint", taskId, state: "created" }
      : { type: "checkpoint", taskId, state: "created", commit })
    emit({ type: "activity", taskId, message: commit === undefined ? "checkpoint created" : `checkpoint created: ${commit}` })
    return
  }
  emitCheckpointBlocked(emit, taskId, outcome.message ?? "checkpoint delivery was blocked")
}

function emitCheckpointBlocked(emit: RunEventListener, taskId: string, reason: string): void {
  const bounded = boundedCheckpointMessage(reason)
  emit({ type: "checkpoint", taskId, state: "blocked", reason: bounded })
  emit({ type: "activity", taskId, message: `checkpoint blocked: ${bounded}` })
}

function boundedCheckpointMessage(message: string): string {
  const normalized = message.replace(/[\r\n]+/g, " ").trim()
  return normalized.length <= 1024 ? normalized : `${normalized.slice(0, 1023)}…`
}

async function reloadTask(task: TaskFile): Promise<TaskFile> {
  return parseTask(task.path, await readFile(task.path, "utf8"))
}

function implementationPrompt(root: string, packetDirectory: string, task: TaskFile, attempt: number): string {
  const prd = join(packetDirectory, "_prd.md")
  const techspec = join(packetDirectory, "_techspec.md")
  const memory = taskMemoryPaths(packetDirectory, task.id)
  const continuation = attempt > 1
    ? `
This is continuation attempt ${attempt}/${TASK_PHASE_ATTEMPTS}. Preserve and inspect the task-owned edits, test output, and memory from the preceding attempt. Resume only incomplete requirements; do not restart the task or treat those edits as unrelated work.
`
    : ""
  return `You are executing a Spec Finder implementation task in ${root}.

Use the sf-execute-task skill to execute ${task.path}. Follow the skill's hard gates and lifecycle contract. If the skill is unavailable, stop and report that blocker instead of silently substituting a generic workflow.

Read the complete task at ${task.path}. Read ${prd} and ${techspec} when they exist, plus every ADR referenced by the task. Treat the task requirements and repository instructions as authoritative.

Use the sf-memory skill before editing. Read shared memory at ${memory.shared} and current task memory at ${memory.task}. Keep task memory current during execution and update it before finishing. Promote only durable cross-task context to shared memory.

Implement only this task. Preserve unrelated work. Run the task's required focused tests and the repository's relevant verification gate. Do not mark task frontmatter complete and do not write the final report; Spec Finder owns both lifecycle phases.
${continuation}

Task:
${task.source}`
}

function reportPrompt(
  root: string,
  packetDirectory: string,
  task: TaskFile,
  reportPath: string,
  attempt: number,
  resumed: boolean,
): string {
  const memory = taskMemoryPaths(packetDirectory, task.id)
  const retry = attempt > 1
    ? `This is report handoff retry ${attempt}/${TASK_PHASE_ATTEMPTS}. Continue from the existing report and memory evidence left by the preceding report attempt. Do not rerun implementation or repeat verification that already has an exact terminal result unless the evidence is missing or contradicted by a newer file change.`
    : resumed
      ? "A prior ACP run completed the implementation phase and persisted this report handoff. Use the task memory, current diff, and exact terminal results as evidence. Do not rerun implementation or verification that is already fresh and complete."
      : "The implementation phase completed immediately before this prompt in the same ACP session. Treat its task memory and exact terminal results as the handoff evidence. Do not repeat implementation or rerun verification that is already fresh and complete."
  return `You are the final-report phase for ${task.id} in ${root}.

${retry}

Read ${task.path}, ${join(packetDirectory, "_prd.md")}, ${join(packetDirectory, "_techspec.md")}, relevant ADRs, shared memory at ${memory.shared}, current task memory at ${memory.task}, the current git diff, and all verification evidence produced for this task. Re-run focused verification if the evidence is incomplete or stale. Use sf-memory to make any final factual memory update before writing the report.

Write the final report to ${reportPath}. The report MUST include: task and outcome; files changed; requirements satisfied; tests and exact results; unresolved risks or follow-ups; and a final verdict of completed, failed, or blocked. Be factual and never claim a test passed without terminal evidence. Do not change the task frontmatter status; Spec Finder owns it.

Use the sf-task-report skill if it is installed.`
}

function successfulStop(reason: string): boolean {
  return !["cancelled", "refusal", "max_tokens"].includes(reason)
}

class TaskPhaseStopError extends Error {
  constructor(
    phase: "implementation" | "report",
    readonly stopReason: string,
  ) {
    super(`${phase} stopped: ${stopReason}`)
    this.name = "TaskPhaseStopError"
  }
}

function assertSuccessfulStop(phase: "implementation" | "report", stopReason: string): void {
  if (!successfulStop(stopReason)) throw new TaskPhaseStopError(phase, stopReason)
}

async function runTaskPhase(options: {
  phase: TaskPhase
  attempts: TaskPhaseAttempts
  taskId: string
  signal: AbortSignal
  emit: RunEventListener
  run: (attempt: number) => Promise<void>
}): Promise<void> {
  while (options.attempts[options.phase] < TASK_PHASE_ATTEMPTS) {
    const attempt = options.attempts[options.phase] + 1
    options.attempts[options.phase] = attempt
    if (options.signal.aborted) throw new Error("run cancelled")
    try {
      await options.run(attempt)
      if (attempt > 1) {
        options.emit({
          type: "activity",
          taskId: options.taskId,
          message: `${options.phase} retry succeeded (attempt ${attempt}/${TASK_PHASE_ATTEMPTS})`,
        })
      }
      return
    } catch (error) {
      const terminal = options.signal.aborted
        || (error instanceof TaskPhaseStopError && error.stopReason === "cancelled")
        || error instanceof AcpProcessExitError
        || attempt === TASK_PHASE_ATTEMPTS
      if (terminal) throw error
      emitPhaseRetry(options.emit, options.taskId, options.phase, attempt, error)
    }
  }
}

function emitPhaseRetry(
  emit: RunEventListener,
  taskId: string,
  phase: TaskPhase,
  attempt: number,
  error: unknown,
): void {
  emit({
    type: "activity",
    taskId,
    message: `${phase} attempt ${attempt} failed: ${errorMessage(error)}; retrying attempt ${attempt + 1}/${TASK_PHASE_ATTEMPTS}`,
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isCancellation(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof TaskPhaseStopError && error.stopReason === "cancelled")
}

async function assertReport(path: string): Promise<void> {
  await access(path)
  const report = await readFile(path, "utf8")
  if (report.trim().length < 120) throw new Error(`final report is missing or incomplete: ${path}`)
}
