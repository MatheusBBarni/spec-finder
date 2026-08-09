import { relative } from "node:path"
import type { SpecFinderConfig } from "./config.ts"
import type { RunEvent, RunEventListener } from "./events.ts"
import { runTaskPacket, type RunOptions, type RunResult } from "./engine.ts"
import type { ProviderLaunch } from "./providers.ts"
import {
  executionOrder,
  isValidTaskSlug,
  loadTaskPacket,
  validateTasks,
  type TaskFile,
  type TaskIssue,
} from "./tasks.ts"

export type PacketOutcome = "succeeded" | "failed" | "cancelled" | "not_started"

export type PacketSummary = {
  slug: string
  outcome: PacketOutcome
  detail?: "already_complete" | "completed" | "stopped"
}

export type BatchResult = {
  ok: boolean
  status: "completed" | "failed" | "cancelled" | "preflight_failed"
  packets: PacketSummary[]
  stoppingSlug?: string
}

export type RuntimeConfig = SpecFinderConfig
export type RunTaskPacketOptions = RunOptions
export type RunTaskPacketResult = RunResult
export type PacketRunner = (options: RunTaskPacketOptions) => Promise<RunTaskPacketResult>

export type BatchRunOptions = {
  slugs: string[]
  config: RuntimeConfig
  signal: AbortSignal
  /** Workspace root used by packet preflight and the default packet runner. */
  root?: string
  packetRunner?: PacketRunner
  onEvent?: (event: RunEvent) => void
  /** The command layer supplies this when the cockpit is interactive. */
  interactivePermissions?: boolean
  /** Optional provider launch seam retained for deterministic integration tests. */
  providerLaunch?: ProviderLaunch
}

export type BatchPreflightOptions = {
  slugs: string[]
  root?: string
}

export type PreflightPacket = {
  slug: string
  directory: string
  tasks: TaskFile[]
  orderedTasks: TaskFile[]
}

export type BatchPreflight = {
  packets: PreflightPacket[]
}

/** A read-only packet loading/validation failure. */
export class BatchPreflightError extends Error {
  constructor(readonly issues: string[]) {
    super(`batch preflight failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`)
    this.name = "BatchPreflightError"
  }
}

export type BatchParseErrorCode =
  | "missing_multiple_value"
  | "option_like_value"
  | "empty_slug"
  | "duplicate_slug"
  | "invalid_slug"
  | "repeated_multiple"
  | "positional_slug"
  | "missing_runtime_value"
  | "unknown_option"

export type BatchParseError = {
  code: BatchParseErrorCode
  message: string
  argument?: string
  index?: number
}

export type SingleRunArguments = {
  mode: "single"
  args: string[]
}

export type BatchArguments = {
  mode: "batch"
  slugs: string[]
  runtimeArgs: string[]
}

export type BatchParseFailure = {
  mode: "error"
  error: BatchParseError
}

export type ParsedRunArguments = SingleRunArguments | BatchArguments | BatchParseFailure

const VALUE_OPTIONS = new Set(["--provider", "--model", "--reasoning", "--speed"])
const BOOLEAN_OPTIONS = new Set(["--no-ui"])

/**
 * Parses the opt-in batch branch while leaving non-batch arguments untouched.
 * The returned runtime arguments preserve their original order for command-level
 * handling of provider, model, reasoning, speed, and no-UI options.
 */
export function parseMultipleArgs(args: readonly string[]): ParsedRunArguments {
  const source = [...args]
  const multipleIndex = source.indexOf("--multiple")
  if (multipleIndex === -1) return { mode: "single", args: source }

  const runtimeArgs: string[] = []
  let slugs: string[] | undefined

  for (let index = 0; index < source.length; index += 1) {
    const argument = source[index]!

    if (argument === "--multiple") {
      if (slugs) {
        return parseFailure("repeated_multiple", "--multiple may be provided only once", argument, index)
      }

      const value = source[index + 1]
      if (value === undefined || value.length === 0) {
        return parseFailure(
          "missing_multiple_value",
          "--multiple requires a non-empty comma-separated slug list",
          argument,
          index,
        )
      }
      if (value.startsWith("-")) {
        return parseFailure(
          "option_like_value",
          `--multiple value cannot be option-like: ${value}`,
          value,
          index + 1,
        )
      }

      const parsedSlugs = parseSlugList(value, index + 1)
      if ("error" in parsedSlugs) return { mode: "error", error: parsedSlugs.error }
      slugs = parsedSlugs
      index += 1
      continue
    }

    if (VALUE_OPTIONS.has(argument)) {
      const value = source[index + 1]
      if (value === undefined || value.length === 0 || value.startsWith("-")) {
        return parseFailure(
          "missing_runtime_value",
          `${argument} requires a value`,
          argument,
          index,
        )
      }
      runtimeArgs.push(argument, value)
      index += 1
      continue
    }

    if (BOOLEAN_OPTIONS.has(argument)) {
      runtimeArgs.push(argument)
      continue
    }

    if (argument.startsWith("-")) {
      return parseFailure("unknown_option", `unsupported batch option: ${argument}`, argument, index)
    }

    return parseFailure("positional_slug", `batch mode does not accept positional slug: ${argument}`, argument, index)
  }

  // The scan can only reach this point after consuming --multiple, but keeping
  // this guard makes the invariant explicit if the parser is changed later.
  if (!slugs) {
    return parseFailure(
      "missing_multiple_value",
      "--multiple requires a non-empty comma-separated slug list",
      "--multiple",
      multipleIndex,
    )
  }

  return { mode: "batch", slugs, runtimeArgs }
}

export const parseBatchArgs = parseMultipleArgs
export const parseBatchArguments = parseMultipleArgs

function parseSlugList(value: string, valueIndex: number): string[] | { error: BatchParseError } {
  const entries = value.split(",")
  const seen = new Set<string>()
  const slugs: string[] = []

  for (const slug of entries) {
    const index = valueIndex
    if (slug.length === 0) {
      return {
        error: {
          code: "empty_slug",
          message: "--multiple cannot contain empty slug entries",
          argument: value,
          index,
        },
      }
    }
    if (slug.startsWith("-")) {
      return {
        error: {
          code: "option_like_value",
          message: `--multiple entry cannot be option-like: ${slug}`,
          argument: slug,
          index,
        },
      }
    }
    if (!isValidTaskSlug(slug)) {
      return {
        error: {
          code: "invalid_slug",
          message: `invalid task slug: ${slug}`,
          argument: slug,
          index,
        },
      }
    }
    if (seen.has(slug)) {
      return {
        error: {
          code: "duplicate_slug",
          message: `duplicate task slug: ${slug}`,
          argument: slug,
          index,
        },
      }
    }
    seen.add(slug)
    slugs.push(slug)
  }

  return slugs
}

function parseFailure(
  code: BatchParseErrorCode,
  message: string,
  argument: string,
  index: number,
): BatchParseFailure {
  return { mode: "error", error: { code, message, argument, index } }
}

/**
 * Loads and validates every declared packet without creating memory files,
 * changing task status, or starting a provider process. The returned task
 * objects are point-in-time snapshots; the packet engine reloads its packet
 * when a runner is invoked.
 */
export function preflightBatch(options: BatchPreflightOptions): Promise<BatchPreflight>
export function preflightBatch(root: string, slugs: string[]): Promise<BatchPreflight>
export async function preflightBatch(
  rootOrOptions: string | BatchPreflightOptions,
  slugsArgument?: string[],
): Promise<BatchPreflight> {
  const root = typeof rootOrOptions === "string"
    ? rootOrOptions
    : rootOrOptions.root ?? process.cwd()
  const slugs = typeof rootOrOptions === "string"
    ? slugsArgument ?? []
    : [...rootOrOptions.slugs]

  const issues: string[] = []
  const seen = new Set<string>()
  const packets = new Map<string, PreflightPacket>()

  for (const slug of slugs) {
    if (typeof slug !== "string" || !isValidTaskSlug(slug)) {
      issues.push(`invalid task slug: ${String(slug)}`)
      continue
    }
    if (seen.has(slug)) {
      issues.push(`duplicate task packet slug: ${slug}`)
      continue
    }
    seen.add(slug)

    try {
      const packet = await loadTaskPacket(root, slug)
      const taskIssues = validateTasks(packet.tasks)
      if (taskIssues.length > 0) {
        issues.push(...formatTaskIssues(root, slug, taskIssues))
        continue
      }
      packets.set(slug, {
        slug,
        directory: packet.directory,
        tasks: packet.tasks,
        orderedTasks: executionOrder(packet.tasks),
      })
    } catch (error) {
      issues.push(`packet ${slug}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (slugs.length === 0) issues.push("at least one task packet slug is required")
  if (issues.length > 0) throw new BatchPreflightError(issues)

  return {
    packets: slugs.map((slug) => {
      const packet = packets.get(slug)
      if (!packet) throw new BatchPreflightError([`packet ${slug} was not loaded during preflight`])
      return packet
    }),
  }
}

/**
 * Executes a preflighted packet sequence serially. The coordinator owns the
 * aggregate result while `runTaskPacket` remains responsible for packet-local
 * memory, task status, ACP, and report semantics.
 */
export function runBatch(options: BatchRunOptions): Promise<BatchResult>
export function runBatch(root: string, options: BatchRunOptions): Promise<BatchResult>
export async function runBatch(
  rootOrOptions: string | BatchRunOptions,
  optionsArgument?: BatchRunOptions,
): Promise<BatchResult> {
  const options = typeof rootOrOptions === "string"
    ? { ...optionsArgument!, root: rootOrOptions }
    : rootOrOptions
  const root = options.root ?? process.cwd()
  const slugs = [...options.slugs]

  let preflight: BatchPreflight
  try {
    preflight = await preflightBatch(root, slugs)
  } catch (error) {
    if (!(error instanceof BatchPreflightError)) throw error
    const result: BatchResult = {
      ok: false,
      status: "preflight_failed",
      packets: slugs.map((slug) => ({ slug, outcome: "not_started" })),
    }
    emitBatchFinished(options.onEvent, result, error.message)
    return result
  }

  options.onEvent?.({
    type: "batch_started",
    slugs,
    packets: preflight.packets.map((packet, index) => ({
      slug: packet.slug,
      index,
      outcome: "not_started",
      tasks: packet.tasks,
    })),
    total: slugs.length,
    config: options.config,
  })

  const runner = options.packetRunner ?? runTaskPacket
  let cancellationObserved = false
  const summaries: PacketSummary[] = []

  for (let index = 0; index < preflight.packets.length; index += 1) {
    const packet = preflight.packets[index]!
    const emit: RunEventListener = (event) => {
      if (isCancellationEvent(event)) cancellationObserved = true
      options.onEvent?.(scopePacketTaskEvent(packet.slug, event))
    }
    if (options.signal.aborted) {
      appendNotStarted(summaries, preflight.packets, index)
      const result = cancelledBatchResult(summaries)
      emitBatchFinished(options.onEvent, result)
      return result
    }

    options.onEvent?.({
      type: "batch_packet_started",
      slug: packet.slug,
      index,
      total: preflight.packets.length,
      config: options.config,
      tasks: packet.tasks,
    })

    let result: RunTaskPacketResult
    try {
      result = await runner({
        root,
        slug: packet.slug,
        config: options.config,
        signal: options.signal,
        emit,
        interactivePermissions: options.interactivePermissions ?? false,
        ...(options.providerLaunch ? { providerLaunch: options.providerLaunch } : {}),
      })
    } catch (error) {
      const cancelled = options.signal.aborted || cancellationObserved || isCancellationError(error)
      summaries.push({
        slug: packet.slug,
        outcome: cancelled ? "cancelled" : "failed",
        detail: "stopped",
      })
      options.onEvent?.({
        type: "batch_packet_finished",
        slug: packet.slug,
        index,
        outcome: cancelled ? "cancelled" : "failed",
        detail: "stopped",
      })
      appendNotStarted(summaries, preflight.packets, index + 1)
      const batchResult = cancelled
        ? cancelledBatchResult(summaries, packet.slug)
        : failedBatchResult(summaries, packet.slug)
      emitBatchFinished(options.onEvent, batchResult)
      return batchResult
    }

    const cancelled = options.signal.aborted || cancellationObserved || resultIndicatesCancellation(result)
    if (cancelled) {
      summaries.push({ slug: packet.slug, outcome: "cancelled", detail: "stopped" })
      options.onEvent?.({
        type: "batch_packet_finished",
        slug: packet.slug,
        index,
        outcome: "cancelled",
        detail: "stopped",
      })
      appendNotStarted(summaries, preflight.packets, index + 1)
      const batchResult = cancelledBatchResult(summaries, packet.slug)
      emitBatchFinished(options.onEvent, batchResult)
      return batchResult
    }

    if (!result || !result.ok) {
      summaries.push({ slug: packet.slug, outcome: "failed", detail: "stopped" })
      options.onEvent?.({
        type: "batch_packet_finished",
        slug: packet.slug,
        index,
        outcome: "failed",
        detail: "stopped",
      })
      appendNotStarted(summaries, preflight.packets, index + 1)
      const batchResult = failedBatchResult(summaries, packet.slug)
      emitBatchFinished(options.onEvent, batchResult)
      return batchResult
    }

    const summary = {
      slug: packet.slug,
      outcome: "succeeded",
      detail: packet.orderedTasks.length === 0 ? "already_complete" : "completed",
    } as const
    summaries.push(summary)
    options.onEvent?.({
      type: "batch_packet_finished",
      slug: packet.slug,
      index,
      outcome: "succeeded",
      detail: summary.detail,
    })
  }

  const result = { ok: true, status: "completed", packets: summaries } as const
  emitBatchFinished(options.onEvent, result)
  return result
}

// Descriptive aliases keep the coordinator seam discoverable without creating
// a second implementation or changing the packet engine's public contract.
export const runMultiplePackets = runBatch
export const coordinateBatch = runBatch

function formatTaskIssues(root: string, slug: string, issues: TaskIssue[]): string[] {
  return issues.map((issue) => {
    const path = relative(root, issue.path)
    return `packet ${slug}: ${path || issue.path}: ${issue.message}`
  })
}

function appendNotStarted(summaries: PacketSummary[], packets: PreflightPacket[], start: number): void {
  for (let index = start; index < packets.length; index += 1) {
    summaries.push({ slug: packets[index]!.slug, outcome: "not_started" })
  }
}

function failedBatchResult(summaries: PacketSummary[], stoppingSlug: string): BatchResult {
  return { ok: false, status: "failed", packets: summaries, stoppingSlug }
}

function cancelledBatchResult(summaries: PacketSummary[], stoppingSlug?: string): BatchResult {
  return stoppingSlug
    ? { ok: false, status: "cancelled", packets: summaries, stoppingSlug }
    : { ok: false, status: "cancelled", packets: summaries }
}

function emitBatchFinished(
  listener: RunEventListener | undefined,
  result: BatchResult,
  message?: string,
): void {
  if (!listener) return
  listener({
    type: "batch_finished",
    ok: result.ok,
    status: result.status,
    packets: result.packets,
    ...(result.stoppingSlug ? { stoppingSlug: result.stoppingSlug } : {}),
    ...(message ? { message } : {}),
  })
}

function scopePacketTaskEvent(slug: string, event: RunEvent): RunEvent {
  switch (event.type) {
    case "task_status":
    case "session_update":
      return { ...event, taskId: qualifyTaskId(slug, event.taskId) }
    case "checkpoint":
      return { ...event, taskId: qualifyTaskId(slug, event.taskId) }
    case "activity":
      return event.taskId
        ? { ...event, taskId: qualifyTaskId(slug, event.taskId) }
        : event
    default:
      return event
  }
}

function qualifyTaskId(slug: string, taskId: string): string {
  return taskId.includes("/") ? taskId : `${slug}/${taskId}`
}

function isCancellationEvent(event: RunEvent): boolean {
  if (event.type !== "activity" && event.type !== "run_finished") return false
  if (event.type === "run_finished") return /^(?:(?:batch|run|sequence)\s+)?(?:cancel(?:led|ed)|abort(?:ed|ing)?)(?:\s+by\s+(?:the\s+)?(?:user|operator))?$/i.test(event.message.trim())
  return /(?:run|implementation|report|turn)\s+stopped(?:\s*:\s*|\s+)(?:cancel(?:led|ed)|abort(?:ed|ing)?)/i.test(event.message)
    || /(?:run|turn)\s+(?:cancel(?:led|ed)|abort(?:ed|ing)?)/i.test(event.message)
}

function resultIndicatesCancellation(result: unknown): boolean {
  if (!result || typeof result !== "object") return false
  const record = result as Record<string, unknown>
  if (record.cancelled === true || record.canceled === true) return true
  for (const key of ["status", "outcome", "stopReason", "reason"]) {
    if (typeof record[key] === "string" && isCancellationToken(record[key] as string)) return true
  }
  return false
}

function isCancellationError(error: unknown): boolean {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : undefined
  if (record?.name === "AbortError") return true
  if (record?.cancelled === true || record?.canceled === true) return true
  for (const key of ["status", "outcome", "stopReason", "reason"]) {
    if (typeof record?.[key] === "string" && isCancellationToken(record[key] as string)) return true
  }
  const message = error instanceof Error ? error.message : String(error)
  if (/(?:permission|refus)/i.test(message)) return false
  if (/^(?:cancel(?:led|ed)|abort(?:ed|ing)?)(?:\s+by\s+(?:the\s+)?(?:user|operator))?$/i.test(message.trim())) return true
  return /(?:run|implementation|report|turn|session)\s+(?:cancel(?:led|ed)|abort(?:ed|ing)?)/i.test(message)
    || /(?:run|implementation|report|turn|session)\s+stopped(?:\s*:\s*|\s+)(?:cancel(?:led|ed)|abort(?:ed|ing)?)/i.test(message)
    || /(?:operation|signal)\s+(?:was\s+)?abort(?:ed|ing)?/i.test(message)
    || /\bAbortError\b/i.test(message)
}

function isCancellationToken(value: string): boolean {
  return /^(?:cancel(?:led|ed)|abort(?:ed|ing)?)$/i.test(value.trim())
}
