import type { Writable } from "node:stream"
import type {
  AcpTurnEvent,
  AcpTurnResult,
  ExecOutcome,
  ResolvedExecContext,
} from "./acp-turn.ts"

/** The narrow stream surface keeps redirected and in-memory tests byteable. */
export interface ExecOutputStream {
  write(chunk: string): unknown
}

/** Node Writable streams (including process.stdout/stderr) satisfy this seam. */
export type ExecOutputWritable = Pick<Writable, "write">

export interface ExecOutputStreams {
  stdout: ExecOutputStream
  stderr: ExecOutputStream
}

export interface ExecOutputReporterOptions {
  stdout?: ExecOutputStream
  stderr?: ExecOutputStream
  streams?: ExecOutputStreams
}

export interface ExecOutputPublication {
  outcome: ExecOutputOutcome
  stdoutPublished: boolean
}

/** Terminal labels that extend the neutral outcome with bounded limit detail. */
export type ExecOutputOutcome = ExecOutcome | "limited:max-tokens" | "limited:max-turn-requests"

type CleanupVisibility = "confirmed" | "failed"

const TOOL_KINDS = new Set([
  "read",
  "edit",
  "delete",
  "move",
  "search",
  "execute",
  "fetch",
  "other",
])

const TOOL_STATUSES = new Set(["pending", "in_progress", "completed", "failed"])

const WARNING_LINES = {
  "provider-output": "provider output omitted",
  "unknown-event": "unknown event omitted",
  "unknown-update": "unknown update omitted",
  "cleanup": "cleanup could not be confirmed",
  "runtime-option": "runtime option omitted",
} as const

type WarningKind = keyof typeof WARNING_LINES

/**
 * Human-oriented exec output with a deny-by-default disclosure boundary.
 *
 * Neutral ACP updates are accepted at runtime as unknown values because a
 * provider can send data newer than the SDK type. Only the explicitly safe
 * fields below are rendered. Agent text remains private to the reporter until
 * a terminal result confirms both `end_turn` and cleanup.
 */
export class ExecOutputReporter {
  readonly #stdout: ExecOutputStream
  readonly #stderr: ExecOutputStream
  readonly #warnings = new Set<WarningKind>()
  #preflightWritten = false
  #finalized = false
  #buffer = ""
  #sawAgentText = false
  #stopReason: string | undefined
  #eventCleanup: CleanupVisibility | undefined
  #publication: ExecOutputPublication | undefined

  constructor(streams: ExecOutputStreams)
  constructor(options: ExecOutputReporterOptions)
  constructor(streamsOrOptions: ExecOutputStreams | ExecOutputReporterOptions) {
    const streams = "streams" in streamsOrOptions
      ? streamsOrOptions.streams
      : streamsOrOptions
    this.#stdout = streams?.stdout ?? process.stdout
    this.#stderr = streams?.stderr ?? process.stderr
  }

  /** Emit the fixed preflight contract exactly once, before provider activity. */
  preflight(context: ResolvedExecContext): void {
    if (this.#preflightWritten || this.#finalized) return
    this.#preflightWritten = true
    this.writeStderr(`[exec] workspace: ${safeInline(context.workspace, "unknown")}`)
    this.writeStderr(
      `[exec] runtime: ${safeInline(context.runtime?.provider, "unknown")} `
      + `${safeInline(context.runtime?.model, "unknown")} `
      + `${safeInline(context.runtime?.reasoning, "unknown")} `
      + `${safeInline(context.runtime?.speed, "unknown")} `
      + `(${context.runtimeSource === "repository" ? "repository" : "user"})`,
    )
    this.writeStderr(
      `[exec] permissions: ${normalizePermissionPolicy(context.permission)} `
      + `(${context.permissionSource === "user" ? "user" : "default"})`,
    )
    this.writeStderr(
      `[exec] host-access: ${context.hostAccess === "write-capable" ? "write-capable" : "read-only"}`,
    )
  }

  /** Alias used by composition roots that name the operation explicitly. */
  emitPreflight(context: ResolvedExecContext): void {
    this.preflight(context)
  }

  /**
   * Consume a neutral event. The unknown input boundary is intentional: an
   * unsupported provider update must be omitted rather than stringified.
   */
  consume(event: AcpTurnEvent | unknown): void {
    if (this.#finalized) return
    if (!isRecord(event) || typeof event.type !== "string") {
      this.warn("unknown-event")
      return
    }

    switch (event.type) {
      case "session_update":
        this.consumeSessionUpdate(event.update)
        return
      case "permission_requested":
        this.writeStderr("[exec] permission: requested")
        return
      case "permission_resolved":
        this.writeStderr(`[exec] permission: ${normalizePermissionDecision(event.outcome)}`)
        return
      case "provider_stderr":
        this.warn("provider-output")
        return
      case "cleanup":
        this.consumeCleanup(event.outcome)
        return
      case "turn_stopped":
        if (typeof event.stopReason === "string") this.#stopReason = event.stopReason
        else this.warn("unknown-event")
        return
      case "runtime_option":
        if (event.outcome === "unsupported") this.warn("runtime-option")
        return
      case "initialized":
      case "session_started":
      case "session_configured":
        return
      default:
        this.warn("unknown-event")
    }
  }

  /** Alias for event-oriented callers. */
  handle(event: AcpTurnEvent | unknown): void {
    this.consume(event)
  }

  /**
   * Publish the terminal result. A result is terminal and idempotent: a later
   * success cannot resurrect text discarded after a failure.
   */
  finish(result: AcpTurnResult | ExecOutputCompletion): ExecOutputPublication {
    if (this.#publication !== undefined) return this.#publication
    this.#finalized = true

    const normalized = normalizeCompletion(result, this.#stopReason, this.#eventCleanup)
    this.writeStderr(`[exec] result: ${normalized.outcome}`)

    const canPublish = normalized.outcome === "completed"
      && normalized.stopReason === "end_turn"
      && normalized.cleanup === "confirmed"
    if (canPublish) {
      const text = this.#sawAgentText ? this.#buffer : normalized.finalText
      if (text.length > 0) {
        this.writeStdout(ensureTrailingNewline(text))
      }
    }

    this.#publication = {
      outcome: normalized.outcome,
      stdoutPublished: canPublish && (this.#sawAgentText ? this.#buffer.length > 0 : normalized.finalText.length > 0),
    }
    return this.#publication
  }

  /** Alias for callers that use the report/finalize vocabulary. */
  finalize(result: AcpTurnResult | ExecOutputCompletion): ExecOutputPublication {
    return this.finish(result)
  }

  /** Finish a non-success path without accepting any buffered text. */
  discard(outcome: ExecOutcome = "provider-error"): ExecOutputPublication {
    return this.finish({ outcome, cleanup: "confirmed", finalText: "" })
  }

  get bufferedText(): string {
    return this.#buffer
  }

  get finalized(): boolean {
    return this.#finalized
  }

  private consumeSessionUpdate(update: unknown): void {
    if (!isRecord(update) || typeof update.sessionUpdate !== "string") {
      this.warn("unknown-update")
      return
    }

    switch (update.sessionUpdate) {
      case "agent_message_chunk": {
        const content = update.content
        if (!isRecord(content) || content.type !== "text" || typeof content.text !== "string") {
          this.warn("unknown-update")
          return
        }
        this.#sawAgentText = true
        this.#buffer += content.text
        return
      }
      case "tool_call":
      case "tool_call_update":
        this.consumeToolUpdate(update)
        return
      case "user_message_chunk":
      case "agent_thought_chunk":
      case "plan":
      case "plan_update":
      case "plan_removed":
      case "available_commands_update":
      case "current_mode_update":
      case "config_option_update":
      case "session_info_update":
      case "usage_update":
        return
      default:
        this.warn("unknown-update")
    }
  }

  private consumeToolUpdate(update: Record<string, unknown>): void {
    const rawKind = typeof update.kind === "string" ? update.kind : undefined
    // `think` and `switch_mode` are internal/control activity, not user-safe
    // tool progress. Unknown kinds are represented by the fixed `other` label.
    if (rawKind === "think" || rawKind === "switch_mode") return
    const kind = rawKind !== undefined && TOOL_KINDS.has(rawKind) ? rawKind : "other"
    const rawStatus = typeof update.status === "string" ? update.status : undefined
    const status = rawStatus !== undefined && TOOL_STATUSES.has(rawStatus) ? rawStatus : "other"
    this.writeStderr(`[exec] tool: ${kind} ${status}`)
  }

  private consumeCleanup(outcome: unknown): void {
    if (!isRecord(outcome)) {
      this.#eventCleanup = "failed"
      this.warn("cleanup")
      return
    }
    if (outcome.state === "closed") {
      this.#eventCleanup = "confirmed"
      return
    }
    if (outcome.state === "unconfirmed" || outcome.state === "failed") {
      this.#eventCleanup = "failed"
      this.warn("cleanup")
    }
  }

  private warn(kind: WarningKind): void {
    if (this.#warnings.has(kind)) return
    this.#warnings.add(kind)
    this.writeStderr(`[exec] warning: ${WARNING_LINES[kind]}`)
  }

  private writeStderr(line: string): void {
    this.#stderr.write(`${line}\n`)
  }

  private writeStdout(text: string): void {
    this.#stdout.write(text)
  }
}

export interface ExecOutputCompletion {
  outcome?: ExecOutputOutcome
  finalText?: string
  stopReason?: string
  cleanup?: "confirmed" | "failed"
  permissionDenied?: boolean
  failure?: "protocol" | "provider" | "transport"
}

export function createExecOutputReporter(
  streams: ExecOutputStreams,
): ExecOutputReporter {
  return new ExecOutputReporter(streams)
}

/** Short alias for composition roots and tests. */
export const createExecOutput = createExecOutputReporter

export function ensureTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`
}

export function normalizeToolKind(value: unknown): string {
  if (typeof value !== "string") return "other"
  if (value === "think" || value === "switch_mode") return "other"
  return TOOL_KINDS.has(value) ? value : "other"
}

export function normalizeToolStatus(value: unknown): string {
  return typeof value === "string" && TOOL_STATUSES.has(value) ? value : "other"
}

export function normalizePermissionDecision(value: unknown): "allowed" | "denied" | "cancelled" {
  if (!isRecord(value) || typeof value.decision !== "string") return "cancelled"
  if (value.decision === "allowed" || value.decision === "denied") return value.decision
  return "cancelled"
}

function normalizeCompletion(
  result: AcpTurnResult | ExecOutputCompletion,
  eventStopReason: string | undefined,
  eventCleanup: CleanupVisibility | undefined,
): {
  outcome: ExecOutputOutcome
  finalText: string
  stopReason: string | undefined
  cleanup: CleanupVisibility
} {
  const candidate: Record<string, unknown> = isRecord(result) ? result : {}
  const stopReason = typeof candidate.stopReason === "string"
    ? candidate.stopReason
    : eventStopReason
  const finalText = typeof candidate.finalText === "string" ? candidate.finalText : ""
  const cleanup = candidate.cleanup === "confirmed" && eventCleanup !== "failed"
    ? "confirmed"
    : "failed"
  const cleanupFailed = candidate.cleanup === "failed" || eventCleanup === "failed"
  const lifecycleFailure = candidate.failure === "protocol"
    || candidate.failure === "provider"
    || candidate.failure === "transport"
  const permissionDenied = candidate.permissionDenied === true
  const candidateOutcome = normalizeExecOutcome(candidate.outcome)

  if (cleanupFailed) {
    return { outcome: "cleanup-error", finalText, stopReason, cleanup }
  }
  if (cleanup === "failed" && (candidateOutcome === "completed" || stopReason === "end_turn")) {
    return { outcome: "cleanup-error", finalText, stopReason, cleanup }
  }
  if (lifecycleFailure) return { outcome: "provider-error", finalText, stopReason, cleanup }
  if (permissionDenied) return { outcome: "permission-denied", finalText, stopReason, cleanup }
  if (stopReason === "cancelled" || candidateOutcome === "cancelled") {
    return { outcome: "cancelled", finalText, stopReason, cleanup }
  }
  if (stopReason === "refusal" || candidateOutcome === "refused") {
    return { outcome: "refused", finalText, stopReason, cleanup }
  }
  if (stopReason === "max_turn_requests") {
    return { outcome: "limited:max-turn-requests", finalText, stopReason, cleanup }
  }
  if (stopReason === "max_tokens" || candidateOutcome === "limited") {
    return {
      outcome: stopReason === "max_tokens" ? "limited:max-tokens" : "limited",
      finalText,
      stopReason,
      cleanup,
    }
  }
  if (stopReason === "end_turn"
    && (candidateOutcome === undefined || candidateOutcome === "completed")
    && cleanup === "confirmed") {
    return { outcome: "completed", finalText, stopReason, cleanup }
  }
  if (candidateOutcome !== undefined && candidateOutcome !== "completed") {
    return { outcome: candidateOutcome, finalText, stopReason, cleanup }
  }
  if (candidateOutcome === "completed" && cleanup !== "confirmed") {
    return { outcome: "cleanup-error", finalText, stopReason, cleanup }
  }
  return { outcome: "provider-error", finalText, stopReason, cleanup }
}

function normalizeExecOutcome(value: unknown): ExecOutputOutcome | undefined {
  if (typeof value !== "string") return undefined
  if (value === "limited:max-tokens" || value === "limited:max-turn-requests") return value
  const outcomes: readonly ExecOutputOutcome[] = [
    "completed",
    "cancelled",
    "permission-denied",
    "refused",
    "limited",
    "invalid-invocation",
    "config-error",
    "provider-error",
    "cleanup-error",
    "limited:max-tokens",
    "limited:max-turn-requests",
  ]
  return outcomes.includes(value as ExecOutputOutcome) ? value as ExecOutputOutcome : undefined
}

function normalizePermissionPolicy(value: unknown): "prompt" | "approve-all" | "deny" {
  return value === "approve-all" || value === "deny" ? value : "prompt"
}

function safeInline(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length === 0) return fallback
  return value.replace(/[^\x20-\x7e]/g, "?")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
