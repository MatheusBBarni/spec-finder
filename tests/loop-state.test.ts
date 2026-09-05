import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_NO_PROGRESS_WINDOW,
  LOOP_DEFINITION_OF_DONE,
  LOOP_GOAL,
  LoopStateError,
  createBootstrapLoopState,
  describeLoopPaths,
  initLoopState,
  loadLoopState,
  loopIterationSummaryPath,
  resetLoopState,
  writeLoopState,
  type LoopState,
} from "../src/loop-state.ts"

async function tempPacket(): Promise<string> {
  return mkdtemp(join(tmpdir(), "spec-finder-loop-state-"))
}

function taskSource(): string {
  return `---
status: pending
title: Inspect ledger
type: chore
complexity: low
dependencies: []
---

# Task 01: Inspect ledger
`
}

describe("loop ledger", () => {
  test("init writes a version-1 bootstrap ledger under the packet loop directory", async () => {
    const packet = await tempPacket()
    const state = await initLoopState(packet, { slug: "demo-packet" })
    const loaded = await loadLoopState(packet)
    const paths = describeLoopPaths(packet)

    expect(state).toEqual(loaded)
    expect(loaded.version).toBe(1)
    expect(loaded.slug).toBe("demo-packet")
    expect(loaded.iteration).toBe(0)
    expect(loaded.terminal).toBeNull()
    expect(loaded.blocker).toBeNull()
    expect(loaded.goal).toBe(LOOP_GOAL)
    expect(loaded.definition_of_done).toBe(LOOP_DEFINITION_OF_DONE)
    expect(loaded.max_iterations).toBe(DEFAULT_MAX_ITERATIONS)
    expect(loaded.no_progress_window).toBe(DEFAULT_NO_PROGRESS_WINDOW)
    expect(loaded.no_progress_streak).toBe(0)
    expect(loaded.iterations).toEqual([])
    expect(JSON.parse(await readFile(paths.statePath, "utf8"))).toMatchObject({ version: 1, iteration: 0, terminal: null })
  })

  test("init does not rewrite an existing valid ledger", async () => {
    const packet = await tempPacket()
    const first = await initLoopState(packet, { slug: "demo-packet" })
    const mutated: LoopState = { ...first, iteration: 4, terminal: "stalled" }
    await writeLoopState(packet, mutated)

    const second = await initLoopState(packet, { slug: "other-slug" })
    expect(second.iteration).toBe(4)
    expect(second.terminal).toBe("stalled")
    expect(second.slug).toBe("demo-packet")
  })

  test("load refuses unknown keys and invalid terminals without rewriting the file", async () => {
    const packet = await tempPacket()
    const initial = await initLoopState(packet, { slug: "demo-packet" })
    const { statePath } = describeLoopPaths(packet)
    const unknownPayload = { ...initial, surprise: true }
    await writeFile(statePath, `${JSON.stringify(unknownPayload, null, 2)}\n`)
    const unknownBytes = await readFile(statePath)

    try {
      await loadLoopState(packet)
      throw new Error("expected unknown key to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(LoopStateError)
      const failure = error as LoopStateError
      expect(failure.path).toBe(statePath)
      expect(failure.message).toContain(statePath)
      expect(failure.issues.join("\n")).toContain("surprise")
    }
    expect(await readFile(statePath)).toEqual(unknownBytes)

    const invalidPayload = { ...initial, terminal: "running" }
    await writeFile(statePath, `${JSON.stringify(invalidPayload, null, 2)}\n`)
    const invalidBytes = await readFile(statePath)

    try {
      await loadLoopState(packet)
      throw new Error("expected invalid terminal to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(LoopStateError)
      const failure = error as LoopStateError
      expect(failure.path).toBe(statePath)
      expect(failure.message).toContain(statePath)
      expect(failure.issues.join("\n")).toContain("terminal")
    }
    expect(await readFile(statePath)).toEqual(invalidBytes)
  })

  test("reset rewrites a bootstrap ledger and leaves sibling task files unchanged", async () => {
    const packet = await tempPacket()
    const taskPath = join(packet, "task_01.md")
    await writeFile(taskPath, taskSource())
    const originalTask = await readFile(taskPath)

    const initial = await initLoopState(packet, { slug: "demo-packet" })
    await writeLoopState(packet, {
      ...initial,
      iteration: 7,
      terminal: "failed",
      no_progress_streak: 3,
      progress: { completed: [], failed: ["task_01"], blocked: [], pending: [] },
    })

    const reset = await resetLoopState(packet, { slug: "demo-packet" })
    expect(reset.version).toBe(1)
    expect(reset.iteration).toBe(0)
    expect(reset.terminal).toBeNull()
    expect(reset.blocker).toBeNull()
    expect(reset.progress).toEqual({ completed: [], failed: [], blocked: [], pending: [] })
    expect(reset.iterations).toEqual([])
    expect(await readFile(taskPath)).toEqual(originalTask)
  })

  test("a temp file created before rename does not become a successful truncated ledger", async () => {
    const packet = await tempPacket()
    const first = await initLoopState(packet, { slug: "demo-packet" })
    const paths = describeLoopPaths(packet)
    const previous = await readFile(paths.statePath)
    await writeFile(join(paths.directory, `state.json.${process.pid}.crash.tmp`), '{"version":1,"slug":"demo-packet"')

    const loaded = await loadLoopState(packet)
    expect(loaded).toEqual(first)
    expect(await readFile(paths.statePath)).toEqual(previous)

    await writeFile(paths.statePath, '{"version":1,"slug":"truncated"')
    try {
      await loadLoopState(packet)
      throw new Error("expected truncated JSON to fail closed")
    } catch (error) {
      expect(error).toBeInstanceOf(LoopStateError)
      const failure = error as LoopStateError
      expect(failure.path).toBe(paths.statePath)
      expect(failure.message).toContain(paths.statePath)
      expect(failure.message).toMatch(/invalid JSON|JSON/i)
    }
  })

  test("the documented non-mutating helper does not create loop/", async () => {
    const packet = await tempPacket()
    const paths = describeLoopPaths(packet)
    expect(paths.statePath).toBe(join(packet, "loop", "state.json"))
    expect(paths.iterationsDirectory).toBe(join(packet, "loop", "iterations"))
    expect(loopIterationSummaryPath(packet, 1)).toBe(join(packet, "loop", "iterations", "001.md"))
    expect(loopIterationSummaryPath(packet, 12)).toBe(join(packet, "loop", "iterations", "012.md"))

    const missing = await Bun.file(paths.directory).exists()
    expect(missing).toBe(false)
  })

  test("createBootstrapLoopState is a non-mutating constructor", () => {
    const state = createBootstrapLoopState({ slug: "demo-packet", maxIterations: 4, noProgressWindow: 2 })
    expect(state.iteration).toBe(0)
    expect(state.max_iterations).toBe(4)
    expect(state.no_progress_window).toBe(2)
    expect(state.goal).toBe(LOOP_GOAL)
  })
})
