import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_CONFIG, parseConfig } from "../src/config.ts"
import { runTaskPacket } from "../src/engine.ts"
import type { RunEvent } from "../src/events.ts"

describe("task engine", () => {
  test("requires a separate report turn before completing a task", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-engine-"))
    const packet = join(root, ".spec-finder", "tasks", "demo")
    await mkdir(packet, { recursive: true })
    const taskPath = join(packet, "task_01.md")
    const promptLog = join(root, "prompts.log")
    await writeFile(taskPath, `---
status: pending
title: Build the mock
type: test
complexity: low
dependencies: []
---

# Task 01: Build the mock

## Requirements

1. Complete both ACP phases.
`)
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "cursor",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })

    const result = await runTaskPacket({
      root,
      slug: "demo",
      config,
      signal: new AbortController().signal,
      emit: () => {},
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: { SPEC_FINDER_TEST_PROMPT_LOG: promptLog },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    expect(await readFile(taskPath, "utf8")).toContain("status: completed")
    expect(await readFile(join(packet, "memory", "MEMORY.md"), "utf8")).toContain("## Shared Decisions")
    expect(await readFile(join(packet, "memory", "task_01.md"), "utf8")).toContain("- Build the mock")
    expect(await readFile(join(packet, "reports", "task_01.md"), "utf8")).toContain("Final verdict: completed")
    expect(await readFile(promptLog, "utf8")).toContain(`Use the sf-execute-task skill to execute ${taskPath}.`)
  })

  test("emits the read-only permission notice before the existing engine failure activity", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-engine-"))
    const packet = join(root, ".spec-finder", "tasks", "demo")
    await mkdir(packet, { recursive: true })
    await writeFile(join(packet, "task_01.md"), `---
status: pending
title: Request permission
type: test
complexity: low
dependencies: []
---

# Task 01: Request permission
`)
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "cursor",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "prompt",
    })
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root,
      slug: "demo",
      config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: true,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: { SPEC_FINDER_TEST_REQUEST_PERMISSION: "1" },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: false, completed: 0, failed: 1, blocked: 0 })
    const noticeIndex = events.findIndex((event) =>
      event.type === "activity" && event.message.includes("cockpit is read-only")
    )
    const failureIndex = events.findIndex((event) =>
      event.type === "activity" && event.message === "implementation stopped: refusal"
    )
    expect(noticeIndex).toBeGreaterThan(-1)
    expect(failureIndex).toBeGreaterThan(noticeIndex)
    expect(events.some((event) => event.type === "permission_requested")).toBe(false)
  })
})
