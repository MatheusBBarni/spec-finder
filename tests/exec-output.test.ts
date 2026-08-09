import { describe, expect, test } from "bun:test"
import {
  createExecOutputReporter,
  ExecOutputReporter,
  normalizePermissionDecision,
  normalizeToolKind,
  normalizeToolStatus,
  type ExecOutputStream,
} from "../src/exec-output.ts"
import type { ResolvedExecContext } from "../src/acp-turn.ts"

describe("safe exec output", () => {
  test("writes the fixed preflight contract to stderr", () => {
    const output = captureOutput()
    const reporter = createExecOutputReporter(output.streams)

    reporter.preflight(context())

    expect(output.stderr.text).toBe([
      "[exec] workspace: /workspace/project",
      "[exec] runtime: mock model reasoning speed (repository)",
      "[exec] permissions: prompt (user)",
      "[exec] host-access: read-only",
      "",
    ].join("\n"))
    expect(output.stdout.text).toBe("")
  })

  test("preserves agent text order and adds only a missing final newline on success", () => {
    const output = captureOutput()
    const reporter = createExecOutputReporter(output.streams)

    reporter.consume(agentText("first "))
    reporter.consume(agentText("second"))
    reporter.finish({
      stopReason: "end_turn",
      outcome: "completed",
      cleanup: "confirmed",
      finalText: "ignored duplicate result text",
    })

    expect(output.stdout.text).toBe("first second\n")
    expect(output.stderr.text).toBe("[exec] result: completed\n")
  })

  test("preserves an existing final newline and supports result-only text", () => {
    const output = captureOutput()
    const reporter = createExecOutputReporter(output.streams)

    reporter.finish({
      stopReason: "end_turn",
      outcome: "completed",
      cleanup: "confirmed",
      finalText: "already complete\n",
    })

    expect(output.stdout.text).toBe("already complete\n")
  })

  test("uses end_turn and confirmed cleanup as the success proof when outcome is omitted", () => {
    const output = captureOutput()
    const reporter = createExecOutputReporter(output.streams)

    reporter.finish({
      stopReason: "end_turn",
      cleanup: "confirmed",
      finalText: "protocol-complete",
    })

    expect(output.stdout.text).toBe("protocol-complete\n")
    expect(output.stderr.text).toBe("[exec] result: completed\n")
  })

  test("keeps stdout empty for every non-success result", () => {
    const cases = [
      ["cancelled", "cancelled", "cancelled"],
      ["permission denied", "end_turn", "permission-denied"],
      ["refusal", "refusal", "refused"],
      ["token limit", "max_tokens", "limited:max-tokens"],
      ["turn limit", "max_turn_requests", "limited:max-turn-requests"],
      ["invocation", undefined, "invalid-invocation"],
      ["configuration", undefined, "config-error"],
      ["provider", undefined, "provider-error"],
      ["cleanup", "end_turn", "cleanup-error"],
    ] as const

    for (const [label, stopReason, outcome] of cases) {
      const output = captureOutput()
      const reporter = createExecOutputReporter(output.streams)
      reporter.consume(agentText(`${label} partial response`))
      reporter.finish({
        ...(stopReason === undefined ? {} : { stopReason }),
        outcome,
        cleanup: label === "cleanup" ? "failed" : "confirmed",
        permissionDenied: outcome === "permission-denied",
        finalText: "unused result text",
      })

      expect(output.stdout.text, label).toBe("")
      expect(output.stderr.text).toBe(`[exec] result: ${outcome}\n`)
    }
  })

  test("normalizes tools and permission outcomes without serializing payloads", () => {
    const output = captureOutput()
    const reporter = createExecOutputReporter(output.streams)

    reporter.consume({
      type: "session_update",
      sessionId: "secret-session",
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "secret-tool-id",
        title: "/private/secret.ts",
        kind: "read",
        status: "in_progress",
        rawInput: { path: "/private/secret.ts", token: "secret-input" },
        rawOutput: "secret-output",
      },
    })
    reporter.consume({
      type: "session_update",
      sessionId: "secret-session",
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "secret-tool-id",
        kind: "future-tool-kind",
        status: "future-status",
      },
    })
    reporter.consume({
      type: "permission_requested",
      request: { secret: "permission-payload" },
      respond: () => undefined,
    })
    reporter.consume({
      type: "permission_resolved",
      requestId: "secret-request-id",
      outcome: { decision: "allowed", optionId: "secret-option" },
    })

    expect(output.stderr.text).toBe([
      "[exec] tool: read in_progress",
      "[exec] tool: other other",
      "[exec] permission: requested",
      "[exec] permission: allowed",
      "",
    ].join("\n"))
    expect(output.stderr.text).not.toContain("secret")
  })

  test("omits thoughts, plans, provider stderr, and unknown payloads", () => {
    const output = captureOutput()
    const reporter = createExecOutputReporter(output.streams)

    reporter.consume({
      type: "session_update",
      sessionId: "secret-session",
      update: {
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "secret thought" },
      },
    })
    reporter.consume({
      type: "session_update",
      sessionId: "secret-session",
      update: {
        sessionUpdate: "plan",
        entries: [{ content: "secret plan" }],
      },
    })
    reporter.consume({ type: "provider_stderr", text: "secret provider stderr" })
    reporter.consume({ type: "future-event", payload: "secret unknown payload" })
    reporter.consume({
      type: "session_update",
      sessionId: "secret-session",
      update: { sessionUpdate: "future-update", payload: "secret update payload" },
    })
    reporter.finish({ outcome: "provider-error", cleanup: "confirmed" })

    expect(output.stdout.text).toBe("")
    expect(output.stderr.text).toBe([
      "[exec] warning: provider output omitted",
      "[exec] warning: unknown event omitted",
      "[exec] warning: unknown update omitted",
      "[exec] result: provider-error",
      "",
    ].join("\n"))
    expect(output.stderr.text).not.toContain("secret")
  })

  test("does not publish after cleanup becomes unconfirmed and is idempotent", () => {
    const output = captureOutput()
    const reporter = createExecOutputReporter(output.streams)

    reporter.consume(agentText("partial"))
    reporter.consume({ type: "cleanup", outcome: { state: "unconfirmed", error: "secret" } })
    const first = reporter.finish({
      stopReason: "end_turn",
      outcome: "completed",
      cleanup: "confirmed",
      finalText: "ignored",
    })
    reporter.finish({ stopReason: "end_turn", outcome: "completed", cleanup: "confirmed", finalText: "late" })

    expect(first).toEqual({ outcome: "cleanup-error", stdoutPublished: false })
    expect(output.stdout.text).toBe("")
    expect(output.stderr.text).toBe([
      "[exec] warning: cleanup could not be confirmed",
      "[exec] result: cleanup-error",
      "",
    ].join("\n"))
  })

  test("suppresses stdout when a completed stop carries a lifecycle failure", () => {
    const output = captureOutput()
    const reporter = createExecOutputReporter(output.streams)
    reporter.consume(agentText("partial despite transport failure"))

    reporter.finish({
      stopReason: "end_turn",
      outcome: "completed",
      cleanup: "confirmed",
      failure: "transport",
      finalText: "must not publish",
    })

    expect(output.stdout.text).toBe("")
    expect(output.stderr.text).toBe("[exec] result: provider-error\n")
  })

  test("keeps preflight and progress on stderr when stdout is redirected", () => {
    const output = captureOutput()
    const reporter = createExecOutputReporter(output.streams)
    reporter.preflight(context())
    reporter.consume({
      type: "session_update",
      sessionId: "session",
      update: { sessionUpdate: "tool_call", kind: "execute", status: "completed" },
    })
    reporter.consume(agentText("redirected answer"))
    reporter.finish({ stopReason: "end_turn", outcome: "completed", cleanup: "confirmed" })

    expect(output.stdout.text).toBe("redirected answer\n")
    expect(output.stderr.text).toContain("[exec] workspace: /workspace/project\n")
    expect(output.stderr.text).toContain("[exec] tool: execute completed\n")
    expect(output.stderr.text).toContain("[exec] result: completed\n")
  })

  test("keeps the stream-injected aliases and normalizers deterministic", () => {
    const output = captureOutput()
    const reporter = new ExecOutputReporter({ stdout: output.stdout, stderr: output.stderr })
    reporter.emitPreflight(context())
    reporter.handle(agentText("alias answer"))

    expect(reporter.bufferedText).toBe("alias answer")
    expect(reporter.finalized).toBe(false)
    reporter.finalize({ stopReason: "end_turn", cleanup: "confirmed" })
    expect(reporter.finalized).toBe(true)
    expect(output.stdout.text).toBe("alias answer\n")

    const discarded = createExecOutputReporter(output.streams).discard()
    expect(discarded).toEqual({ outcome: "provider-error", stdoutPublished: false })
    expect(normalizeToolKind("think")).toBe("other")
    expect(normalizeToolKind("future")).toBe("other")
    expect(normalizeToolStatus("future")).toBe("other")
    expect(normalizePermissionDecision({ decision: "future" })).toBe("cancelled")
  })
})

function context(): ResolvedExecContext {
  return {
    workspace: "/workspace/project",
    runtime: {
      provider: "mock",
      model: "model",
      reasoning: "reasoning",
      speed: "speed",
    },
    runtimeSource: "repository",
    permission: "prompt",
    permissionSource: "user",
    hostAccess: "read-only",
  }
}

function agentText(text: string): unknown {
  return {
    type: "session_update",
    sessionId: "session",
    update: {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text },
    },
  }
}

function captureOutput(): {
  stdout: Capture
  stderr: Capture
  streams: { stdout: ExecOutputStream; stderr: ExecOutputStream }
} {
  const stdout = new Capture()
  const stderr = new Capture()
  return { stdout, stderr, streams: { stdout, stderr } }
}

class Capture implements ExecOutputStream {
  text = ""

  write(chunk: string): boolean {
    this.text += chunk
    return true
  }
}
