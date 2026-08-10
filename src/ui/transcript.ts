import type {
  ContentBlock,
  SessionUpdate,
  ToolCallContent,
} from "@agentclientprotocol/sdk"
import type { AcpTurnPhase } from "../events.ts"

export type TranscriptKind =
  | "message"
  | "thought"
  | "plan"
  | "tool"
  | "tool_update"
  | "activity"
  | "error"
  | "outcome"
  | "unknown"

export interface TranscriptEntry {
  id: string
  sequence: number
  kind: TranscriptKind
  label: string
  text: string
  sourceId?: string
  status?: string
  streaming?: boolean
}

export interface TranscriptPresentation {
  label: string
  subtitle: string
}

type TextTranscriptKind = Extract<TranscriptKind, "activity" | "error" | "outcome">

const MAX_DISPLAY_CHARS = 1024
const DISPLAY_TRUNCATION_MARKER = "…"
const SESSION_METADATA_LABEL = "Session metadata"

const TEXT_LABELS: Record<TextTranscriptKind, string> = {
  activity: "Activity",
  error: "Error",
  outcome: "Outcome",
}

export function applySessionUpdate(
  entries: readonly TranscriptEntry[],
  update: SessionUpdate,
  sequence: number,
  sessionId?: string,
  phase?: AcpTurnPhase,
): readonly TranscriptEntry[] {
  const identityScope = phase ?? sessionId

  switch (update.sessionUpdate) {
    case "user_message_chunk":
      return mergeContentChunk(entries, update, sequence, "message", "User", "user", identityScope)
    case "agent_message_chunk":
      return mergeContentChunk(entries, update, sequence, "message", "Agent", "agent", identityScope)
    case "agent_thought_chunk":
      return mergeContentChunk(entries, update, sequence, "thought", "Thought", "thought", identityScope)
    case "tool_call":
    case "tool_call_update":
      return mergeToolUpdate(entries, update, sequence, identityScope)
    case "plan":
      return [
        ...entries,
        {
          id: `plan:${sequence}`,
          sequence,
          kind: "plan",
          label: "Plan",
          text: update.entries.length === 0
            ? "No plan entries"
            : update.entries
                .map((entry) => `${entry.content} (${humanize(entry.status)})`)
                .join("\n"),
        },
      ]
    case "available_commands_update":
    case "current_mode_update":
    case "config_option_update":
      // These updates describe ACP capabilities and session setup rather than
      // task progress. The cockpit already reports ACP initialization as a
      // compact activity, so rendering their full payload only buries useful
      // startup feedback beneath protocol metadata.
      return entries
    case "session_info_update":
      return appendSessionInfoUpdate(entries, sequence, phase)
    default:
      return appendUnknownUpdate(entries, update, sequence)
  }
}

/**
 * Formats untrusted text for cockpit display without exposing raw controls,
 * absolute paths, metadata extensions, or an unbounded payload.
 */
export function formatDisplayText(value: unknown): string {
  const displayValue = typeof value === "string"
    ? value
    : stableStringify(normalizeDisplayValue(value))
  return truncateDisplayText(sanitizeDisplayText(displayValue))
}

export function appendTranscriptLines(
  entries: readonly TranscriptEntry[],
  kind: TextTranscriptKind,
  text: string,
  sequence: number,
): readonly TranscriptEntry[] {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return entries

  return [
    ...entries,
    ...lines.map((line, index): TranscriptEntry => ({
      id: `${kind}:${sequence}:${index}`,
      sequence,
      kind,
      label: TEXT_LABELS[kind],
      text: line,
    })),
  ]
}

export function transcriptPresentation(entry: TranscriptEntry): TranscriptPresentation {
  if (entry.kind === "tool" || entry.kind === "tool_update") {
    return {
      label: "Action",
      subtitle: actionSubtitle(entry),
    }
  }

  if (entry.kind === "unknown") {
    return {
      label: entry.label,
      subtitle: unknownSubtitle(entry.text),
    }
  }

  const compact = compactText(entry.text)
  return {
    label: entry.label,
    subtitle: compact ? conciseLine(compact, entry.kind === "error" ? 160 : 100) : "",
  }
}

function mergeContentChunk(
  entries: readonly TranscriptEntry[],
  update: Extract<SessionUpdate, { sessionUpdate: "user_message_chunk" | "agent_message_chunk" | "agent_thought_chunk" }>,
  sequence: number,
  kind: "message" | "thought",
  label: string,
  identityPrefix: "user" | "agent" | "thought",
  sessionId?: string,
): readonly TranscriptEntry[] {
  const sourceId = update.messageId || undefined
  const id = sourceId
    ? scopedTranscriptId(identityPrefix, sourceId, sessionId)
    : scopedTranscriptId(identityPrefix, String(sequence), sessionId)
  const text = formatContentBlock(update.content)
  const existingIndex = sourceId ? entries.findIndex((entry) => entry.id === id) : -1

  if (existingIndex < 0) {
    return [
      ...entries,
      {
        id,
        sequence,
        kind,
        label,
        text,
        ...(sourceId ? { sourceId } : {}),
        streaming: true,
      },
    ]
  }

  const existing = entries[existingIndex]
  if (!existing) return entries

  return replaceAt(entries, existingIndex, {
    ...existing,
    text: `${existing.text}${text}`,
    streaming: true,
  })
}

function mergeToolUpdate(
  entries: readonly TranscriptEntry[],
  update: Extract<SessionUpdate, { sessionUpdate: "tool_call" | "tool_call_update" }>,
  sequence: number,
  sessionId?: string,
): readonly TranscriptEntry[] {
  const id = scopedTranscriptId("tool", update.toolCallId, sessionId)
  const existingIndex = entries.findIndex((entry) => entry.id === id)
  const existing = existingIndex >= 0 ? entries[existingIndex] : undefined
  const title = update.title?.trim()
  const text = appendMeaningfulText(
    existing?.text ?? "",
    formatToolDetails(update) || (!existing ? `Tool call ${update.toolCallId}` : ""),
  )
  const status = resolveToolStatus(existing?.status, update)
  const streaming = status === "pending" || status === "in_progress"
  const next: TranscriptEntry = {
    id,
    sequence: existing?.sequence ?? sequence,
    kind: update.sessionUpdate === "tool_call" ? "tool" : existing?.kind ?? "tool_update",
    label: title ? `Tool · ${title}` : existing?.label ?? `Tool update · ${update.toolCallId}`,
    text,
    sourceId: update.toolCallId,
    ...(status ? { status } : {}),
    ...(status ? { streaming } : existing?.streaming === undefined ? {} : { streaming: existing.streaming }),
  }

  if (existingIndex < 0) return [...entries, next]
  return replaceAt(entries, existingIndex, next)
}

function scopedTranscriptId(prefix: string, sourceId: string, sessionId?: string): string {
  return sessionId ? `${prefix}:${sessionId}:${sourceId}` : `${prefix}:${sourceId}`
}

function resolveToolStatus(
  existingStatus: string | undefined,
  update: Extract<SessionUpdate, { sessionUpdate: "tool_call" | "tool_call_update" }>,
): string | undefined {
  if (!("status" in update) || update.status === undefined) return existingStatus
  return update.status ?? undefined
}

function formatToolDetails(
  update: Extract<SessionUpdate, { sessionUpdate: "tool_call" | "tool_call_update" }>,
): string {
  const details: string[] = []
  const isExecute = update.kind === "execute"

  if (update.kind && !isExecute) details.push(`Kind: ${humanize(update.kind)}`)
  if (update.content) {
    details.push(...update.content
      .map((content) => formatToolContent(content, { hideTerminal: isExecute }))
      .filter((content): content is string => content.length > 0))
  }
  if (update.locations) {
    details.push(`Locations: ${update.locations.map((location) => `${location.path}${location.line == null ? "" : `:${location.line}`}`).join(", ")}`)
  }
  if (update.rawInput !== undefined) details.push(formatToolInput(update.rawInput, isExecute))
  if (update.rawOutput !== undefined) details.push(formatToolOutput(update.rawOutput, isExecute))

  return details.filter((detail) => detail.length > 0).join("\n")
}

function formatToolInput(input: unknown, isExecute: boolean): string {
  const value = decodeStructuredValue(input)
  if (isExecute && isRecord(value)) {
    const cwd = value.cwd
    return typeof cwd === "string" ? `Working directory: ${cwd}` : ""
  }

  return `Input:\n${formatStructuredValue(value)}`
}

function formatToolOutput(output: unknown, isExecute: boolean): string {
  const value = decodeStructuredValue(output)
  if (isRecord(value)) {
    const formattedOutput = typeof value.formatted_output === "string"
      ? value.formatted_output
      : typeof value.formattedOutput === "string"
        ? value.formattedOutput
        : undefined

    if (formattedOutput !== undefined) {
      const metadata = Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== "formatted_output" && key !== "formattedOutput"),
      )
      const details = formatToolMetadata(metadata)
      const body = formatTerminalOutput(formattedOutput)
      const content = [details, body].filter((part) => part.length > 0).join("\n\n")
      return isExecute ? content : `Output:\n${content}`
    }
  }

  const content = formatStructuredValue(value)
  return isExecute ? content : `Output:\n${content}`
}

function formatToolMetadata(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${humanize(key)}: ${formatStructuredValue(value)}`)
    .join("\n")
}

function formatTerminalOutput(output: string): string {
  return formatStructuredValue(decodeStructuredValue(output))
}

function formatStructuredValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : stableStringify(value)
}

function decodeStructuredValue(value: unknown): unknown {
  if (typeof value !== "string") return value

  const trimmed = value.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value

  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return value
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function formatToolContent(content: ToolCallContent, options: { hideTerminal: boolean }): string {
  switch (content.type) {
    case "content":
      return formatContentBlock(content.content)
    case "diff": {
      const before = content.oldText == null ? "" : `\nBefore:\n${content.oldText}`
      return `Diff: ${content.path}${before}\nAfter:\n${content.newText}`
    }
    case "terminal":
      return options.hideTerminal ? "" : `Terminal: ${content.terminalId}`
  }
}

function formatContentBlock(content: ContentBlock): string {
  switch (content.type) {
    case "text":
      return content.text
    case "image":
      return `[Image: ${content.mimeType}${content.uri ? ` · ${content.uri}` : ""}]`
    case "audio":
      return `[Audio: ${content.mimeType}]`
    case "resource_link":
      return `[Resource: ${content.title ?? content.name} · ${content.uri}]`
    case "resource":
      return "text" in content.resource
        ? `[Resource: ${content.resource.uri}]\n${content.resource.text}`
        : `[Resource: ${content.resource.uri} · ${content.resource.mimeType ?? "binary"}]`
  }
}

function appendUnknownUpdate(
  entries: readonly TranscriptEntry[],
  update: SessionUpdate,
  sequence: number,
): readonly TranscriptEntry[] {
  const raw = update as unknown as Record<string, unknown>
  const discriminator = typeof raw.sessionUpdate === "string" ? raw.sessionUpdate : "unknown_update"
  const payload = Object.fromEntries(
    Object.entries(raw).filter(([key]) => key !== "sessionUpdate" && key !== "_meta"),
  )
  const safeDiscriminator = formatDisplayText(discriminator).replace(/\n/gu, " ")
  const text = Object.keys(payload).length === 0
    ? "Update received"
    : formatDisplayText(payload)

  return [
    ...entries,
    {
      id: `unknown:${safeDiscriminator}:${sequence}`,
      sequence,
      kind: "unknown",
      label: humanize(safeDiscriminator),
      text,
    },
  ]
}

function appendSessionInfoUpdate(
  entries: readonly TranscriptEntry[],
  sequence: number,
  phase: AcpTurnPhase | undefined,
): readonly TranscriptEntry[] {
  if (phase === "report") return entries

  return [
    ...entries,
    {
      id: `session-info:${sequence}`,
      sequence,
      kind: "unknown",
      label: SESSION_METADATA_LABEL,
      text: "",
    },
  ]
}

function replaceAt(
  entries: readonly TranscriptEntry[],
  index: number,
  entry: TranscriptEntry,
): readonly TranscriptEntry[] {
  return [...entries.slice(0, index), entry, ...entries.slice(index + 1)]
}

function appendMeaningfulText(existing: string, next: string): string {
  if (!next) return existing
  if (!existing) return next
  if (existing === next || existing.split("\n").includes(next)) return existing
  return `${existing}\n${next}`
}

function humanize(value: string): string {
  const words = value.replace(/([a-z\d])([A-Z])/gu, "$1 $2").replace(/[_-]+/gu, " ").trim()
  return words ? `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}` : "Unknown update"
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>()

  const normalize = (current: unknown): unknown => {
    if (current === undefined) return "[undefined]"
    if (typeof current === "bigint") return current.toString()
    if (typeof current === "function") return `[Function ${current.name || "anonymous"}]`
    if (typeof current === "symbol") return current.toString()
    if (current === null || typeof current !== "object") return current
    if (seen.has(current)) return "[Circular]"

    seen.add(current)
    if (Array.isArray(current)) return current.map(normalize)

    return Object.fromEntries(
      Object.entries(current)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalize(nested)]),
    )
  }

  return JSON.stringify(normalize(value), null, 2)
}

function normalizeDisplayValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return sanitizeDisplayText(value)
  if (value === undefined) return "[undefined]"
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`
  if (typeof value === "symbol") return value.toString()
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) return "[Circular]"

  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => normalizeDisplayValue(item, seen))

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "_meta")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [sanitizeDisplayText(key), normalizeDisplayValue(nested, seen)]),
  )
}

function sanitizeDisplayText(value: string): string {
  return redactAbsolutePaths(neutralizeControls(value))
}

function neutralizeControls(value: string): string {
  return value
    .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/gu, "�")
    .replace(/\u001B(?:\[[0-?]*[ -/]*[@-~]|[ -/]*[@-~])/gu, "�")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "�")
    .replace(/\r\n?/gu, "\n")
}

function redactAbsolutePaths(value: string): string {
  return value
    .replace(/(?<![\w])\\\\[A-Za-z0-9._~+@%=-]+(?:[\\/][A-Za-z0-9._~+@%=-]+)+/gu, "[path redacted]")
    .replace(/(?<![\w])[A-Za-z]:[\\/](?:[A-Za-z0-9._~+@%=-]+[\\/]?)+/gu, "[path redacted]")
    .replace(/(?<![\w])\/(?:[A-Za-z0-9._~+@%=-]+\/)*(?:[A-Za-z0-9._~+@%=-]+)(?:\/[A-Za-z0-9._~+@%=-]+)*/gu, "[path redacted]")
}

function truncateDisplayText(value: string): string {
  if (value.length <= MAX_DISPLAY_CHARS) return value
  return `${value.slice(0, MAX_DISPLAY_CHARS - DISPLAY_TRUNCATION_MARKER.length)}${DISPLAY_TRUNCATION_MARKER}`
}

function actionSubtitle(entry: TranscriptEntry): string {
  const intent = `${entry.label}\n${entry.text}`.toLowerCase()

  if (/\b(search|find|grep|ripgrep|glob|locate|rg)\b/u.test(intent)) {
    return "Searching project"
  }
  if (/\b(test|tests|testing|verify|verification|check|build|compile|compilation|lint|typecheck)\b/u.test(intent)) {
    return "Running verification"
  }
  if (/\b(diff|edit|write|patch|apply|update|create|delete|remove|move|rename)\b/u.test(intent)) {
    return "Applying changes"
  }
  if (/\b(read|reading|open|opening|inspect|view|cat|sed|head|tail)\b/u.test(intent)) {
    return "Reading project context"
  }
  if (/\b(fetch|browse|request|download|http|web)\b/u.test(intent)) {
    return "Fetching information"
  }
  if (/\b(execute|executing|command|shell|terminal|run|rtk|bun|npm|git)\b/u.test(intent)) {
    return "Running command"
  }
  return "Processing request"
}

function unknownSubtitle(value: string): string {
  try {
    const payload = JSON.parse(value) as unknown
    if (isRecord(payload) && typeof payload.detail === "string") {
      return conciseLine(payload.detail, 100)
    }
  } catch {
    // Some providers emit plain text for extension updates.
  }

  const compact = compactText(value)
  return compact.startsWith("{") || compact.startsWith("[")
    ? "Update received"
    : conciseLine(compact, 100)
}

function compactText(value: string): string {
  return value
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n[ \t]+/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim()
}

function conciseLine(value: string, limit: number): string {
  const firstLine = value.split("\n").find((line) => line.trim().length > 0) ?? ""
  const plain = firstLine
    .replace(/^\s{0,3}(?:#{1,6}\s+|[-+*]\s+|>\s*)/u, "")
    .replace(/[*`~]/gu, "")
    .trim()
  const firstSentence = plain.match(/^.*?[.!?](?=\s|$)/u)?.[0] ?? plain
  return fitText(firstSentence, limit)
}

function fitText(value: string, limit: number): string {
  if (limit <= 1) return value.slice(0, Math.max(0, limit))
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`
}
