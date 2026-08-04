import { describe, expect, test } from "bun:test"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runAcpTurn } from "../src/acp-client.ts"
import { DEFAULT_CONFIG, parseConfig } from "../src/config.ts"
import type { RunEvent } from "../src/events.ts"

describe("ACP client", () => {
  test("completes a framed turn and selects an allow option for approve-all", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-acp-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "cursor",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })
    const events: RunEvent[] = []

    const result = await runAcpTurn({
      root,
      config,
      prompt: "Run the mock turn",
      taskId: "task_01",
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: { SPEC_FINDER_TEST_REQUEST_PERMISSION: "1" },
        authMethod: null,
      },
    })

    expect(result.stopReason).toBe("end_turn")
    expect(events).toContainEqual(expect.objectContaining({
      type: "activity",
      taskId: "task_01",
      message: "ACP Test Agent initialized",
    }))
    expect(events).toContainEqual(expect.objectContaining({
      type: "session_update",
      taskId: "task_01",
      update: expect.objectContaining({ sessionUpdate: "agent_message_chunk" }),
    }))
    expect(events).toContainEqual(expect.objectContaining({
      type: "session_update",
      taskId: "task_01",
      update: expect.objectContaining({
        content: { type: "text", text: "permission response: allow" },
      }),
    }))
  })

  test("selects a reject option for deny", async () => {
    const { events, result } = await runPermissionTurn({
      permissions: "deny",
      interactivePermissions: false,
      expectedPermission: "reject",
    })

    expect(result.stopReason).toBe("end_turn")
    expect(events).toContainEqual(expect.objectContaining({
      type: "session_update",
      update: expect.objectContaining({
        content: { type: "text", text: "permission response: reject" },
      }),
    }))
  })

  test("cancels prompt permission requests in the TUI without emitting an interactive event", async () => {
    const { events, result } = await runPermissionTurn({
      permissions: "prompt",
      interactivePermissions: true,
    })

    expect(result.stopReason).toBe("refusal")
    expect(events).toContainEqual({
      type: "activity",
      taskId: "task_01",
      message: "Permission request cancelled because the cockpit is read-only; configure permissions before rerunning.",
    })
    expect(events.some((event) => event.type === "permission_requested")).toBe(false)
    expect(events).toContainEqual(expect.objectContaining({
      type: "session_update",
      update: expect.objectContaining({
        content: { type: "text", text: "permission response: cancelled" },
      }),
    }))
  })

  test("preserves non-UI prompt cancellation when stdin is not interactive", async () => {
    const { events, result } = await runPermissionTurn({
      permissions: "prompt",
      interactivePermissions: false,
      expectedPermission: "cancelled",
    })

    expect(process.stdin.isTTY).not.toBe(true)
    expect(result.stopReason).toBe("end_turn")
    expect(events.some((event) =>
      event.type === "activity" && event.message.includes("cockpit is read-only")
    )).toBe(false)
    expect(events.some((event) => event.type === "permission_requested")).toBe(false)
  })
})

async function runPermissionTurn(options: {
  permissions: "prompt" | "approve-all" | "deny"
  interactivePermissions: boolean
  expectedPermission?: "allow" | "reject" | "cancelled"
}) {
  const root = await mkdtemp(join(tmpdir(), "spec-finder-acp-"))
  const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
  const config = parseConfig({
    ...DEFAULT_CONFIG,
    provider: "cursor",
    model: "auto",
    reasoning: "auto",
    speed: "auto",
    permissions: options.permissions,
  })
  const events: RunEvent[] = []
  const env: Record<string, string> = { SPEC_FINDER_TEST_REQUEST_PERMISSION: "1" }
  if (options.expectedPermission) env.SPEC_FINDER_TEST_EXPECT_PERMISSION = options.expectedPermission

  const result = await runAcpTurn({
    root,
    config,
    prompt: "Run the mock permission turn",
    taskId: "task_01",
    signal: new AbortController().signal,
    emit: (event) => events.push(event),
    interactivePermissions: options.interactivePermissions,
    providerLaunch: { command: process.execPath, args: [fixture], env, authMethod: null },
  })

  return { events, result }
}
