import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runAcpTurn } from "../src/acp-client.ts"
import { DEFAULT_CONFIG, parseConfig } from "../src/config.ts"
import type { AcpTurnPhase, RunEvent } from "../src/events.ts"

describe("ACP client", () => {
  test("completes a framed turn and selects an allow option for approve-all", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-acp-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
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
      phase: "implementation",
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_REQUEST_PERMISSION: "1",
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
      },
    })

    expect(result.stopReason).toBe("end_turn")
    expect((await readFile(lifecycleLog, "utf8")).trim().split("\n")).toEqual([
      "initialize",
      "session/new",
      "session/prompt",
    ])
    expect(events).toContainEqual({
      type: "runtime_option",
      name: "model",
      requested: "auto",
      outcome: "default",
      detail: "launch-time",
    })
    expect(events).toContainEqual({
      type: "runtime_option",
      name: "reasoning",
      requested: "auto",
      outcome: "default",
    })
    expect(events).toContainEqual({
      type: "runtime_option",
      name: "speed",
      requested: "auto",
      outcome: "default",
    })
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
    const updates = sessionUpdates(events)
    expect(updates.length).toBeGreaterThan(0)
    expect(updates.every((event) => event.phase === "implementation")).toBeTrue()
    expect(updates.every((event) => event.sessionId === "test-session")).toBeTrue()
  })

  test("selects a reject option for deny", async () => {
    const { events, result } = await runPermissionTurn({
      phase: "report",
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
    const updates = sessionUpdates(events)
    expect(updates.length).toBeGreaterThan(0)
    expect(updates.every((event) => event.phase === "report")).toBeTrue()
  })

  test("cancels prompt permission requests in the TUI without emitting an interactive event", async () => {
    const { events, result } = await runPermissionTurn({
      phase: "report",
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
      phase: "report",
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

  test("fails promptly when the ACP process exits before completing the turn", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-acp-exit-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "cursor",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })

    await expect(runAcpTurn({
      root,
      config,
      prompt: "This prompt must not hang",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: () => {},
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: { SPEC_FINDER_TEST_EXIT_IMMEDIATELY: "1" },
        authMethod: null,
      },
    })).rejects.toThrow("ACP process ended before the task handoff completed (exit 23)")
  }, 2_000)

  test("terminates ACP descendant processes after a completed handoff", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-acp-tree-"))
    const descendantPath = join(root, "descendant.pid")
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "cursor",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })

    const result = await runAcpTurn({
      root,
      config,
      prompt: "Complete and clean up the process tree",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: () => {},
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: { SPEC_FINDER_TEST_DESCENDANT_PID: descendantPath },
        authMethod: null,
      },
    })

    expect(result.stopReason).toBe("end_turn")
    const descendantPid = Number((await readFile(descendantPath, "utf8")).trim())
    expect(await processExited(descendantPid)).toBeTrue()
  }, 2_000)
})

async function processExited(pid: number): Promise<boolean> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      process.kill(pid, 0)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return true
      throw error
    }
    await Bun.sleep(10)
  }
  return false
}

async function runPermissionTurn(options: {
  phase: AcpTurnPhase
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
    phase: options.phase,
    signal: new AbortController().signal,
    emit: (event) => events.push(event),
    interactivePermissions: options.interactivePermissions,
    providerLaunch: { command: process.execPath, args: [fixture], env, authMethod: null },
  })

  return { events, result }
}

function sessionUpdates(events: readonly RunEvent[]): Array<Extract<RunEvent, { type: "session_update" }>> {
  return events.filter((event): event is Extract<RunEvent, { type: "session_update" }> => event.type === "session_update")
}
