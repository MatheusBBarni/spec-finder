import type {
  ContentBlock,
  SessionUpdate,
  ToolCallContent,
} from "@agentclientprotocol/sdk"

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

type TextTranscriptKind = Extract<TranscriptKind, "activity" | "error" | "outcome">

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
): readonly TranscriptEntry[] {
  switch (update.sessionUpdate) {
    case "user_message_chunk":
      return mergeContentChunk(entries, update, sequence, "message", "User", "user", sessionId)
    case "agent_message_chunk":
      return mergeContentChunk(entries, update, sequence, "message", "Agent", "agent", sessionId)
    case "agent_thought_chunk":
      return mergeContentChunk(entries, update, sequence, "thought", "Thought", "thought", sessionId)
    case "tool_call":
    case "tool_call_update":
      return mergeToolUpdate(entries, update, sequence, sessionId)
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
    default:
      return appendUnknownUpdate(entries, update, sequence)
  }
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

  return [
    ...entries,
    {
      id: `unknown:${discriminator}:${sequence}`,
      sequence,
      kind: "unknown",
      label: humanize(discriminator),
      text: Object.keys(payload).length === 0 ? "Update received" : stableStringify(payload),
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
