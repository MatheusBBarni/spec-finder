import { mkdir, writeFile } from "node:fs/promises"
import { relative } from "node:path"
import type { SpecFinderConfig } from "./config.ts"
import { runTaskPacket, type RunOptions, type RunResult } from "./engine.ts"
import type { LoopPhase, RunEventListener } from "./events.ts"
import {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_NO_PROGRESS_WINDOW,
  LoopStateError,
  MAX_LOOP_ITERATION_HISTORY,
  MAX_LOOP_TEXT_CHARS,
  createBootstrapLoopState,
  describeLoopPaths,
  initLoopState,
  loadLoopState,
  loopIterationSummaryPath,
  parseLoopState,
  resetLoopState,
  writeLoopState,
  type LoopProgress,
  type LoopState,
  type LoopTerminal,
} from "./loop-state.ts"
import { loadTddOptIn } from "./tdd-opt-in.ts"
import {
  hasPendingCheckpointDelivery,
  isCompletedStatus,
  loadTaskPacket,
  validateTasks,
  type TaskFile,
} from "./tasks.ts"

export type LoopContinueAction = "recover_handoff" | "recover_checkpoint" | "execute"

export type LoopDetectAction = LoopContinueAction | LoopTerminal

export interface LoopDetectResult {
  action: LoopDetectAction
  terminal: LoopTerminal | null
  reason: string
  taskId?: string
}

export function detectLoopAction(tasks: readonly TaskFile[], ledger: LoopState): LoopDetectResult {
  const failed = tasks.filter((task) => task.frontmatter.status === "failed")
  if (failed.length > 0) {
    const ids = failed.map((task) => task.id).join(", ")
    return stop("failed", `unrecoverable task failure: ${ids}`)
  }

  const handoff = tasks.find((task) => task.frontmatter.handoff?.phase === "report")
  const checkpoint = tasks.find((task) => hasPendingCheckpointDelivery(task))
  const incomplete = tasks.filter((task) => !isCompletedStatus(task.frontmatter.status))
  const remaining = handoff !== undefined || checkpoint !== undefined || incomplete.length > 0

  if (!remaining) {
    if (ledger.blocker) {
      return stop("blocked", blockerReason(ledger))
    }
    if (hasPriorLoopWork(ledger)) {
      return stop("done", "all tasks completed with no pending checkpoint delivery or report handoff")
    }
    return stop("no_op", "nothing pending at start; packet already complete")
  }

  if (ledger.iteration >= ledger.max_iterations) {
    return stop(
      "exhausted",
      `iteration cap reached (${ledger.iteration}/${ledger.max_iterations})`,
    )
  }
  if (ledger.no_progress_streak >= ledger.no_progress_window) {
    return stop(
      "stalled",
      `no progress for ${ledger.no_progress_streak} consecutive iterations (window ${ledger.no_progress_window})`,
    )
  }
  if (handoff) {
    return {
      action: "recover_handoff",
      terminal: null,
      reason: `recover report handoff for ${handoff.id}`,
      taskId: handoff.id,
    }
  }
  if (checkpoint) {
    return {
      action: "recover_checkpoint",
      terminal: null,
      reason: `recover pending checkpoint delivery for ${checkpoint.id}`,
      taskId: checkpoint.id,
    }
  }
  if (incomplete.length > 0) {
    return {
      action: "execute",
      terminal: null,
      reason: "execute remaining work",
    }
  }
  if (ledger.blocker) {
    return stop("blocked", blockerReason(ledger))
  }
  return stop("no_op", "nothing pending at start; packet already complete")
}

export function loopProgressFromTasks(tasks: readonly TaskFile[]): LoopProgress {
  const completed: string[] = []
  const failed: string[] = []
  const blocked: string[] = []
  const pending: string[] = []
  for (const task of tasks) {
    const status = task.frontmatter.status
    if (isCompletedStatus(status)) completed.push(task.id)
    else if (status === "failed") failed.push(task.id)
    else if (status === "blocked") blocked.push(task.id)
    else pending.push(task.id)
  }
  return { completed, failed, blocked, pending }
}

export function progressIdentityKey(progress: LoopProgress): string {
  return JSON.stringify({
    completed: [...progress.completed].sort(),
    failed: [...progress.failed].sort(),
    blocked: [...progress.blocked].sort(),
  })
}

function hasPriorLoopWork(ledger: LoopState): boolean {
  return ledger.iteration > 0 || ledger.iterations.length > 0
}

function blockerReason(ledger: LoopState): string {
  const blocker = ledger.blocker
  if (!blocker) return "blocked"
  return `blocked: ${blocker.code}: ${blocker.message}`
}

function stop(terminal: LoopTerminal, reason: string): LoopDetectResult {
  return { action: terminal, terminal, reason }
}

export type LoopPacketRunner = (options: RunOptions) => Promise<RunResult>

export type LoopRunOptions = {
  root: string
  slug: string
  config: SpecFinderConfig
  signal: AbortSignal
  emit: RunEventListener
  interactivePermissions: boolean
  dryRun?: boolean
  resetState?: boolean
  maxIterations?: number
  noProgressWindow?: number
  runTaskPacket?: LoopPacketRunner
}

export type LoopResult = {
  terminal: LoopTerminal
  reason: string
  iteration: number
  slug: string
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

export async function runLoop(options: LoopRunOptions): Promise<LoopResult> {
  const packet = await loadTaskPacket(options.root, options.slug)
  const issues = validateTasks(packet.tasks)
  if (issues.length > 0) {
    throw new Error(`task packet is invalid:\n${issues.map((issue) => `- ${relative(options.root, issue.path)}: ${issue.message}`).join("\n")}`)
  }
  await loadTddOptIn(packet.directory, packet.tasks.map((task) => task.id))

  const bootstrapInput = {
    slug: options.slug,
    maxIterations: options.maxIterations ?? DEFAULT_MAX_ITERATIONS,
    noProgressWindow: options.noProgressWindow ?? DEFAULT_NO_PROGRESS_WINDOW,
  }

  if (options.dryRun) {
    return dryRunLoop(options, packet.directory, packet.tasks, bootstrapInput)
  }

  let ledger = options.resetState
    ? await resetLoopState(packet.directory, bootstrapInput)
    : await initLoopState(packet.directory, bootstrapInput)
  ledger = withInvocationCaps(ledger, options)
  await writeLoopState(packet.directory, ledger)
  emitLoopStarted(options, ledger)

  const runner = options.runTaskPacket ?? runTaskPacket
  for (;;) {
    if (options.signal.aborted) {
      return persistTerminal(packet.directory, options, ledger, "cancelled", "operator or ACP abort")
    }

    const current = await loadTaskPacket(options.root, options.slug)
    const detected = detectLoopAction(current.tasks, ledger)
    if (detected.terminal) {
      return persistTerminal(packet.directory, options, ledger, detected.terminal, detected.reason)
    }

    const passNumber = ledger.iteration + 1
    options.emit({
      type: "loop_progress",
      slug: options.slug,
      iteration: passNumber,
      maxIterations: ledger.max_iterations,
      noProgressWindow: ledger.no_progress_window,
      phase: loopPhase(detected.action),
    })
    options.emit({
      type: "activity",
      message: `loop: iteration ${passNumber}/${ledger.max_iterations} ${detected.action}`,
    })
    options.emit({
      type: "activity",
      message: activityForAction(detected.action),
    })

    const beforeKey = progressIdentityKey(loopProgressFromTasks(current.tasks))
    const feedback = assembleLoopFeedback(ledger)
    const runOptions: RunOptions = {
      root: options.root,
      slug: options.slug,
      config: options.config,
      signal: options.signal,
      emit: options.emit,
      interactivePermissions: options.interactivePermissions,
    }
    if (feedback) runOptions.loopFeedback = feedback

    try {
      await runner(runOptions)
      if (options.signal.aborted) {
        return persistTerminal(packet.directory, options, ledger, "cancelled", "operator or ACP abort")
      }
    } catch (error) {
      if (options.signal.aborted || isAbortError(error)) {
        return persistTerminal(packet.directory, options, ledger, "cancelled", "operator or ACP abort")
      }
      const message = boundedText(error instanceof Error ? error.message : String(error))
      ledger = parseLoopState({
        ...ledger,
        blocker: { code: "engine_error", message: message.length > 0 ? message : "engine pass failed" },
        updated_at: nowIso(),
      })
      return persistTerminal(
        packet.directory,
        options,
        ledger,
        "blocked",
        `blocked: engine_error: ${ledger.blocker?.message ?? "engine pass failed"}`,
      )
    }

    const after = await loadTaskPacket(options.root, options.slug)
    const progress = loopProgressFromTasks(after.tasks)
    const afterKey = progressIdentityKey(progress)
    const record = {
      n: passNumber,
      at: nowIso(),
      action: detected.action,
      outcome: "continue",
      summary: boundedText(detected.reason),
    }
    ledger = parseLoopState({
      ...ledger,
      iteration: ledger.iteration + 1,
      no_progress_streak: afterKey === beforeKey ? ledger.no_progress_streak + 1 : 0,
      progress,
      feedback: {
        previous_outcome: boundedText(detected.reason),
        route_causes: [boundedText(detected.action)],
        last_failed_task_ids: progress.failed,
      },
      iterations: [...ledger.iterations, record].slice(-MAX_LOOP_ITERATION_HISTORY),
      updated_at: record.at,
    })
    await writeLoopState(packet.directory, ledger)
    await writeIterationSummary(packet.directory, record.n, record.action, record.outcome, record.summary)
  }
}

async function dryRunLoop(
  options: LoopRunOptions,
  packetDirectory: string,
  tasks: TaskFile[],
  bootstrapInput: { slug: string; maxIterations: number; noProgressWindow: number },
): Promise<LoopResult> {
  options.emit({ type: "activity", message: "loop: dry-run" })
  let ledger: LoopState
  try {
    ledger = withInvocationCaps(await loadLoopState(packetDirectory), options)
  } catch (error) {
    if (error instanceof LoopStateError && error.message.startsWith("missing loop ledger")) {
      ledger = createBootstrapLoopState(bootstrapInput)
    } else {
      throw error
    }
  }
  const detected = detectLoopAction(tasks, ledger)
  options.emit({ type: "activity", message: `loop: ${detected.action}${detected.taskId ? ` ${detected.taskId}` : ""}` })
  options.emit({ type: "activity", message: "loop: would-write nothing" })
  return {
    terminal: detected.terminal ?? "no_op",
    reason: detected.terminal ? detected.reason : `dry-run: would ${detected.action}; writes nothing`,
    iteration: ledger.iteration,
    slug: options.slug,
  }
}

async function persistTerminal(
  packetDirectory: string,
  options: LoopRunOptions,
  ledger: LoopState,
  terminal: LoopTerminal,
  reason: string,
): Promise<LoopResult> {
  const packet = await loadTaskPacket(options.root, options.slug)
  const next = parseLoopState({
    ...ledger,
    terminal,
    progress: loopProgressFromTasks(packet.tasks),
    updated_at: nowIso(),
  })
  await writeLoopState(packetDirectory, next)
  options.emit({ type: "activity", message: `loop: terminal ${terminal}: ${reason}` })
  emitLoopFinished(options, next, terminal, reason)
  return {
    terminal,
    reason,
    iteration: next.iteration,
    slug: options.slug,
  }
}

function withInvocationCaps(ledger: LoopState, options: LoopRunOptions): LoopState {
  return parseLoopState({
    ...ledger,
    max_iterations: options.maxIterations ?? ledger.max_iterations,
    no_progress_window: options.noProgressWindow ?? ledger.no_progress_window,
  })
}

function assembleLoopFeedback(ledger: LoopState): string | undefined {
  const parts = [ledger.feedback.previous_outcome, ...ledger.feedback.route_causes]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  return parts.length > 0 ? parts.join("\n") : undefined
}

function activityForAction(action: LoopDetectAction): string {
  if (action === "recover_handoff") return "loop: recovering report handoff"
  if (action === "recover_checkpoint") return "loop: recovering checkpoint delivery"
  if (action === "execute") return "loop: executing remaining work"
  return `loop: ${action}`
}

function loopPhase(action: LoopDetectAction): LoopPhase {
  return action === "execute" ? "execute" : "recover"
}

function emitLoopStarted(options: LoopRunOptions, ledger: LoopState): void {
  options.emit({
    type: "loop_started",
    slug: options.slug,
    iteration: 0,
    maxIterations: ledger.max_iterations,
    noProgressWindow: ledger.no_progress_window,
  })
}

function emitLoopFinished(
  options: LoopRunOptions,
  ledger: LoopState,
  terminal: LoopTerminal,
  reason: string,
): void {
  options.emit({
    type: "loop_finished",
    slug: options.slug,
    terminal,
    reason: boundedText(reason),
    iteration: ledger.iteration,
    maxIterations: ledger.max_iterations,
    noProgressWindow: ledger.no_progress_window,
  })
}

async function writeIterationSummary(
  packetDirectory: string,
  n: number,
  action: string,
  outcome: string,
  summary: string,
): Promise<void> {
  try {
    const path = loopIterationSummaryPath(packetDirectory, n)
    await mkdir(describeLoopPaths(packetDirectory).iterationsDirectory, { recursive: true })
    await writeFile(path, `# Iteration ${String(n).padStart(3, "0")}\n\n- action: ${action}\n- outcome: ${outcome}\n- summary: ${summary}\n`)
  } catch {
    // Markdown is leftover evidence; the ledger remains authoritative.
  }
}

function boundedText(value: string): string {
  const stripped = value.replace(CONTROL_CHARS, "")
  return stripped.length <= MAX_LOOP_TEXT_CHARS ? stripped : stripped.slice(0, MAX_LOOP_TEXT_CHARS)
}

function nowIso(): string {
  return new Date().toISOString()
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.message === "run cancelled")
}
