import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_CONFIG, parseConfig } from "../src/config.ts"
import { runTaskPacket } from "../src/engine.ts"

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
})
