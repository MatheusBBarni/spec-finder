import { describe, expect, test } from "bun:test"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runAcpTurn } from "../src/acp-client.ts"
import { DEFAULT_CONFIG, parseConfig } from "../src/config.ts"
import type { RunEvent } from "../src/events.ts"

describe("ACP client", () => {
  test("completes a framed turn and resolves agent permissions", async () => {
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
      providerLaunch: { command: process.execPath, args: [fixture], env: {}, authMethod: null },
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
  })
})
