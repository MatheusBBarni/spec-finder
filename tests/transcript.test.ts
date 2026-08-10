import { describe, expect, test } from "bun:test"
import type { SessionUpdate } from "@agentclientprotocol/sdk"
import {
  appendTranscriptLines,
  applySessionUpdate,
  formatDisplayText,
  transcriptPresentation,
  type TranscriptEntry,
} from "../src/ui/transcript.ts"

describe("task transcript normalization", () => {
  test("coalesces streamed messages by identity without changing their first position", () => {
    const first = applySessionUpdate([], message("message-1", "Hello"), 4)
    const withActivity = appendTranscriptLines(first, "activity", "Checking files", 5)
    const merged = applySessionUpdate(withActivity, message("message-1", " world"), 6)

    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({
      id: "agent:message-1",
      sequence: 4,
      kind: "message",
      label: "Agent",
      sourceId: "message-1",
      text: "Hello world",
      streaming: true,
    })
    expect(merged.map((entry) => entry.sequence)).toEqual([4, 5])
    expect(first[0]?.text).toBe("Hello")
  })

  test("keeps different stream categories and anonymous chunks separate", () => {
    let entries: readonly TranscriptEntry[] = []
    entries = applySessionUpdate(entries, message("shared", "Answer"), 1)
    entries = applySessionUpdate(entries, thought("shared", "Reasoning"), 2)
    entries = applySessionUpdate(entries, message(null, "First anonymous"), 3)
    entries = applySessionUpdate(entries, message(null, "Second anonymous"), 4)

    expect(entries.map((entry) => [entry.kind, entry.text])).toEqual([
      ["message", "Answer"],
      ["thought", "Reasoning"],
      ["message", "First anonymous"],
      ["message", "Second anonymous"],
    ])
  })

  test("scopes reused message and tool IDs to their ACP turn", () => {
    let entries: readonly TranscriptEntry[] = []
    entries = applySessionUpdate(entries, message("reused", "Implementation"), 1, "implementation")
    entries = applySessionUpdate(entries, message("reused", " report"), 2, "report")
    entries = applySessionUpdate(entries, {
      sessionUpdate: "tool_call",
      toolCallId: "reused-tool",
      title: "Implementation tool",
      status: "completed",
    }, 3, "implementation")
    entries = applySessionUpdate(entries, {
      sessionUpdate: "tool_call_update",
      toolCallId: "reused-tool",
      status: "completed",
      rawOutput: { turn: "report" },
    }, 4, "report")

    expect(entries.map((entry) => entry.id)).toEqual([
      "agent:implementation:reused",
      "agent:report:reused",
      "tool:implementation:reused-tool",
      "tool:report:reused-tool",
    ])
    expect(entries[0]?.text).toBe("Implementation")
    expect(entries[1]?.text).toBe(" report")
    expect(entries[2]?.label).toBe("Tool · Implementation tool")
    expect(entries[3]?.text).toContain('"turn": "report"')
  })

  test("keeps reused identities distinct across sessions in the same phase", () => {
    let entries: readonly TranscriptEntry[] = []
    entries = applySessionUpdate(entries, message("reused", "First attempt"), 1, "session-one", "implementation")
    entries = applySessionUpdate(entries, message("reused", "Second attempt"), 2, "session-two", "implementation")
    entries = applySessionUpdate(entries, {
      sessionUpdate: "tool_call",
      toolCallId: "reused-tool",
      title: "First attempt tool",
      status: "completed",
    }, 3, "session-one", "implementation")
    entries = applySessionUpdate(entries, {
      sessionUpdate: "tool_call",
      toolCallId: "reused-tool",
      title: "Second attempt tool",
      status: "completed",
    }, 4, "session-two", "implementation")

    expect(entries.map((entry) => entry.id)).toEqual([
      "agent:session-one:implementation:reused",
      "agent:session-two:implementation:reused",
      "tool:session-one:implementation:reused-tool",
      "tool:session-two:implementation:reused-tool",
    ])
    expect(entries.map((entry) => entry.text)).toEqual([
      "First attempt",
      "Second attempt",
      "Tool call reused-tool",
      "Tool call reused-tool",
    ])
  })

  test("uses explicit phases when a provider reuses its session ID", () => {
    let entries: readonly TranscriptEntry[] = []
    entries = applySessionUpdate(entries, message("reused", "Implementation"), 1, "test-session", "implementation")
    entries = applySessionUpdate(entries, message("reused", " report"), 2, "test-session", "report")
    entries = applySessionUpdate(entries, {
      sessionUpdate: "tool_call",
      toolCallId: "reused-tool",
      title: "Implementation tool",
      status: "completed",
    }, 3, "test-session", "implementation")
    entries = applySessionUpdate(entries, {
      sessionUpdate: "tool_call_update",
      toolCallId: "reused-tool",
      status: "completed",
      rawOutput: { turn: "report" },
    }, 4, "test-session", "report")

    expect(entries.map((entry) => entry.id)).toEqual([
      "agent:test-session:implementation:reused",
      "agent:test-session:report:reused",
      "tool:test-session:implementation:reused-tool",
      "tool:test-session:report:reused-tool",
    ])
    expect(entries[0]?.text).toBe("Implementation")
    expect(entries[1]?.text).toBe(" report")
    expect(entries[2]?.label).toBe("Tool · Implementation tool")
    expect(entries[3]?.text).toContain('"turn": "report"')
  })

  test("merges a tool update received before its initial call without losing details", () => {
    const earlyUpdate = {
      sessionUpdate: "tool_call_update",
      toolCallId: "tool-1",
      status: "in_progress",
      content: [{ type: "content", content: { type: "text", text: "Opening file" } }],
      rawOutput: { zeta: 2, alpha: 1 },
    } satisfies SessionUpdate
    const initialCall = {
      sessionUpdate: "tool_call",
      toolCallId: "tool-1",
      title: "Read configuration",
      kind: "read",
      status: "completed",
      rawInput: { path: "/tmp/config.json" },
    } satisfies SessionUpdate

    const fallback = applySessionUpdate([], earlyUpdate, 3)
    const merged = applySessionUpdate(fallback, initialCall, 8)

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      id: "tool:tool-1",
      sequence: 3,
      kind: "tool",
      label: "Tool · Read configuration",
      sourceId: "tool-1",
      status: "completed",
      streaming: false,
    })
    expect(merged[0]?.text).toContain("Opening file")
    expect(merged[0]?.text).toContain('"alpha": 1')
    expect(merged[0]?.text).toContain("Kind: Read")
    expect(merged[0]?.text).toContain("/tmp/config.json")
    expect(fallback[0]).toMatchObject({ kind: "tool_update", sequence: 3 })
  })

  test("formats executed command output as readable terminal text", () => {
    const update = {
      sessionUpdate: "tool_call",
      toolCallId: "exec-1",
      title: "rtk cat package.json",
      kind: "execute",
      status: "completed",
      content: [{ type: "terminal", terminalId: "exec-1" }],
      rawInput: {
        command: "rtk cat package.json",
        cwd: "/workspace/spec-finder",
      },
      rawOutput: {
        exit_code: 0,
        formatted_output: '{\n  "name": "spec-finder"\n}',
      },
    } satisfies SessionUpdate

    const entries = applySessionUpdate([], update, 1)

    expect(entries[0]?.text).toContain("Working directory: /workspace/spec-finder")
    expect(entries[0]?.text).toContain("Exit code: 0")
    expect(entries[0]?.text).toContain('{\n  "name": "spec-finder"\n}')
    expect(entries[0]?.text).not.toContain("formatted_output")
    expect(entries[0]?.text).not.toContain("Terminal: exec-1")
    expect(entries[0]?.text).not.toContain("\\\\n")
    expect(transcriptPresentation(entries[0]!)).toEqual({
      label: "Action",
      subtitle: "Reading project context",
    })
  })

  test("classifies concise action subtitles without exposing raw operation details", () => {
    const fixtures = [
      ["bun test tests/cockpit.test.tsx", "Running verification"],
      ["apply patch src/ui/App.tsx", "Applying changes"],
      ["rg transcript src tests", "Searching project"],
      ["cat src/ui/App.tsx", "Reading project context"],
      ["fetch documentation", "Fetching information"],
      ["execute shell command", "Running command"],
      ["provider tool", "Processing request"],
    ] as const

    for (const [title, subtitle] of fixtures) {
      const entry: TranscriptEntry = {
        id: title,
        sequence: 1,
        kind: "tool",
        label: `Tool · ${title}`,
        text: `raw details for ${title}`,
      }
      expect(transcriptPresentation(entry)).toEqual({ label: "Action", subtitle })
    }
  })

  test("retains labeled plan, thought, activity, outcome, and unknown updates in order", () => {
    const plan = {
      sessionUpdate: "plan",
      entries: [{ content: "Inspect code", priority: "high", status: "in_progress" }],
    } satisfies SessionUpdate
    const unknown = {
      sessionUpdate: "provider_status_update",
      detail: "Waiting for capacity",
      retryAfter: 5,
    } as unknown as SessionUpdate

    let entries: readonly TranscriptEntry[] = []
    entries = applySessionUpdate(entries, plan, 1)
    entries = applySessionUpdate(entries, thought("thought-1", "Compare contracts"), 2)
    entries = appendTranscriptLines(entries, "activity", "Read source\nRun fixture", 3)
    entries = appendTranscriptLines(entries, "error", "Provider stalled", 4)
    entries = appendTranscriptLines(entries, "outcome", "Task completed", 5)
    entries = applySessionUpdate(entries, unknown, 6)

    expect(entries.map((entry) => entry.kind)).toEqual([
      "plan",
      "thought",
      "activity",
      "activity",
      "error",
      "outcome",
      "unknown",
    ])
    expect(entries.map((entry) => entry.label)).toEqual([
      "Plan",
      "Thought",
      "Activity",
      "Activity",
      "Error",
      "Outcome",
      "Provider status update",
    ])
    expect(entries.at(-1)?.text).toContain("Waiting for capacity")
  })

  test("drops report session metadata without exposing any provider payload", () => {
    const update = {
      sessionUpdate: "session_info_update",
      title: `${"oversized report prompt ".repeat(80)} /Users/alice/spec-finder/report.md`,
      updatedAt: "2026-08-09T12:00:00Z",
      _meta: {
        prompt: "final report prompt",
        root: "/Users/alice/spec-finder",
        controls: "\u001b[31mred\u001b[0m\u0000\u007f",
      },
    } satisfies SessionUpdate

    expect(applySessionUpdate([], update, 1, "test-session", "report")).toEqual([])
  })

  test("renders implementation and phase-missing session metadata as a fixed label", () => {
    const update = {
      sessionUpdate: "session_info_update",
      title: "provider title with /Users/alice/spec-finder",
      updatedAt: "2026-08-09T12:00:00Z",
      _meta: { prompt: "do not render this" },
    } satisfies SessionUpdate

    const implementation = applySessionUpdate([], update, 2, "test-session", "implementation")
    const missingPhase = applySessionUpdate(implementation, update, 3, "test-session")

    expect(implementation).toEqual([{
      id: "session-info:2",
      sequence: 2,
      kind: "unknown",
      label: "Session metadata",
      text: "",
    }])
    expect(missingPhase.at(-1)).toEqual({
      id: "session-info:3",
      sequence: 3,
      kind: "unknown",
      label: "Session metadata",
      text: "",
    })
    expect(JSON.stringify(missingPhase)).not.toContain("provider title")
    expect(JSON.stringify(missingPhase)).not.toContain("/Users/alice")
    expect(JSON.stringify(missingPhase)).not.toContain("do not render this")
  })

  test("keeps reused-session phase identity while suppressing only report metadata", () => {
    const update = { sessionUpdate: "session_info_update", title: "provider metadata" } satisfies SessionUpdate
    let entries: readonly TranscriptEntry[] = []
    entries = applySessionUpdate(entries, update, 1, "test-session", "implementation")
    entries = applySessionUpdate(entries, update, 2, "test-session", "report")

    expect(entries).toHaveLength(1)
    expect(entries[0]?.id).toBe("session-info:1")
    expect(entries[0]?.label).toBe("Session metadata")
    expect(entries[0]?.text).toBe("")
  })

  test("formats unrelated unknown updates deterministically and safely", () => {
    const unknownPayload = {
      sessionUpdate: "provider_status_update",
      zeta: 2,
      alpha: "POSIX /Users/alice/spec-finder/report.md",
      detail: [
        "drive C:\\Users\\alice\\report.md",
        "UNC \\\\server\\share\\report.md",
        "controls \u0000 \u001b[31mred\u001b[0m \u007f",
        "x".repeat(1_400),
      ].join(" "),
      _meta: { secret: "do not render this" },
    }
    const unknown = unknownPayload as unknown as SessionUpdate

    const reversed = {
      sessionUpdate: "provider_status_update",
      _meta: { secret: "do not render this" },
      detail: unknownPayload.detail,
      alpha: unknownPayload.alpha,
      zeta: unknownPayload.zeta,
    } as unknown as SessionUpdate
    const first = applySessionUpdate([], unknown, 4)[0]
    const second = applySessionUpdate([], reversed, 4)[0]
    const text = first?.text ?? ""

    expect(first?.label).toBe("Provider status update")
    expect(second?.text).toBe(text)
    expect(text).toContain("[path redacted]")
    expect(text).not.toContain("/Users/alice")
    expect(text).not.toContain("C:\\Users\\alice")
    expect(text).not.toContain("\\\\server\\share")
    expect(text).not.toContain("do not render this")
    expect(text).not.toContain("\u0000")
    expect(text).not.toContain("\u001b")
    expect(text).not.toContain("\u007f")
    expect(text).toEndWith("…")
    expect(text.length).toBe(1024)
  })

  test("handles cyclic unknown values through the bounded display formatter", () => {
    const cyclic: Record<string, unknown> = { detail: "diagnostic" }
    cyclic.self = cyclic
    const update = { sessionUpdate: "provider_status_update", cyclic } as unknown as SessionUpdate

    const entry = applySessionUpdate([], update, 5)[0]

    expect(formatDisplayText(cyclic)).toContain("[Circular]")
    expect(entry?.text).toContain("[Circular]")
  })

  test("keeps ACP startup capabilities and configuration out of the task transcript", () => {
    const availableCommands = {
      sessionUpdate: "available_commands_update",
      availableCommands: [{
        name: "plan",
        description: "Turn plan mode on.",
        input: { hint: "optional context" },
      }],
    } satisfies SessionUpdate
    const currentMode = {
      sessionUpdate: "current_mode_update",
      currentModeId: "plan",
    } satisfies SessionUpdate
    const configOptions = {
      sessionUpdate: "config_option_update",
      configOptions: [],
    } satisfies SessionUpdate

    let entries = appendTranscriptLines([], "activity", "ACP Codex initialized", 1)
    entries = applySessionUpdate(entries, availableCommands, 2)
    entries = applySessionUpdate(entries, currentMode, 3)
    entries = applySessionUpdate(entries, configOptions, 4)

    expect(entries).toEqual([{
      id: "activity:1:0",
      sequence: 1,
      kind: "activity",
      label: "Activity",
      text: "ACP Codex initialized",
    }])
  })

  test("retains non-text message content and every tool observation", () => {
    let entries: readonly TranscriptEntry[] = []
    entries = applySessionUpdate(entries, {
      sessionUpdate: "agent_message_chunk",
      messageId: "media",
      content: { type: "image", data: "encoded", mimeType: "image/png", uri: "file:///preview.png" },
    }, 1)
    entries = applySessionUpdate(entries, {
      sessionUpdate: "tool_call",
      toolCallId: "edit-1",
      title: "Edit file",
      content: [{ type: "diff", path: "/tmp/a.ts", oldText: "old", newText: "new" }],
      locations: [{ path: "/tmp/a.ts", line: 7 }],
    }, 2)
    entries = applySessionUpdate(entries, {
      sessionUpdate: "tool_call_update",
      toolCallId: "edit-1",
      content: [{ type: "terminal", terminalId: "terminal-1" }],
    }, 3)

    expect(entries[0]?.text).toBe("[Image: image/png · file:///preview.png]")
    expect(entries[1]?.text).toContain("Before:\nold")
    expect(entries[1]?.text).toContain("After:\nnew")
    expect(entries[1]?.text).toContain("Locations: /tmp/a.ts:7")
    expect(entries[1]?.text).toContain("Terminal: terminal-1")
  })

  test("does not cap histories above 250 entries", () => {
    let entries: readonly TranscriptEntry[] = []

    for (let sequence = 0; sequence < 300; sequence += 1) {
      entries = appendTranscriptLines(entries, "activity", `Activity ${sequence}`, sequence)
    }

    expect(entries).toHaveLength(300)
    expect(entries[0]?.text).toBe("Activity 0")
    expect(entries.at(-1)?.text).toBe("Activity 299")
  })
})

function message(messageId: string | null, text: string): SessionUpdate {
  return {
    sessionUpdate: "agent_message_chunk",
    messageId,
    content: { type: "text", text },
  }
}

function thought(messageId: string | null, text: string): SessionUpdate {
  return {
    sessionUpdate: "agent_thought_chunk",
    messageId,
    content: { type: "text", text },
  }
}
