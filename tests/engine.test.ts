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
      mode: "default",
      permissions: "approve-all",
      providers: {
        ...DEFAULT_CONFIG.providers,
        cursor: { command: process.execPath, args: [fixture], env: {}, authMethod: null },
      },
    })

    const result = await runTaskPacket({
      root,
      slug: "demo",
      config,
      signal: new AbortController().signal,
      emit: () => {},
      interactivePermissions: false,
    })

    expect(result).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    expect(await readFile(taskPath, "utf8")).toContain("status: completed")
    expect(await readFile(join(packet, "reports", "task_01.md"), "utf8")).toContain("Final verdict: completed")
  })
})
