import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_CONFIG } from "../src/config.ts"
import type { RunOptions, RunResult } from "../src/engine.ts"
import { detectLoopAction, runLoop } from "../src/loop.ts"
import {
  createBootstrapLoopState,
  describeLoopPaths,
  initLoopState,
  parseLoopState,
  writeLoopState,
  type LoopState,
} from "../src/loop-state.ts"
import { parseTask, type TaskFile } from "../src/tasks.ts"

const HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const DIGEST = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

function snapshot(id: string, status: string, extra = ""): TaskFile {
  const number = id.replace("task_", "")
  const title = `Task ${number}`
  return parseTask(`${id}.md`, `---
status: ${status}
title: ${title}
type: chore
complexity: low
dependencies: []
${extra}---

# Task ${Number(number)}: ${title}
`)
}

function ledger(overrides: Partial<LoopState> = {}): LoopState {
  return parseLoopState({
    ...createBootstrapLoopState({ slug: "demo-packet" }),
    ...overrides,
  })
}

function priorLedger(overrides: Partial<LoopState> = {}): LoopState {
  return ledger({
    iteration: 1,
    iterations: [{
      n: 1,
      at: "2026-09-04T17:00:00.000Z",
      action: "execute",
      outcome: "continue",
      summary: "prior pass",
    }],
    ...overrides,
  })
}

const checkpointYaml = `checkpoint:
  state: active
  base_head: ${HEAD}
  baseline_digest: ${DIGEST}
  paths:
    - src/loop.ts
`

describe("detectLoopAction", () => {
  test("completed packet on a fresh ledger is no_op", () => {
    const result = detectLoopAction([
      snapshot("task_01", "completed"),
      snapshot("task_02", "done"),
    ], ledger())
    expect(result.action).toBe("no_op")
    expect(result.terminal).toBe("no_op")
  })

  test("all tasks completed after prior iterations is done", () => {
    const result = detectLoopAction([
      snapshot("task_01", "completed"),
      snapshot("task_02", "finished"),
    ], priorLedger())
    expect(result.action).toBe("done")
    expect(result.terminal).toBe("done")
  })

  test("report handoff is recover_handoff, not execute", () => {
    const result = detectLoopAction([
      snapshot("task_01", "in_progress", `handoff:
  phase: report
`),
      snapshot("task_02", "pending"),
    ], ledger())
    expect(result.action).toBe("recover_handoff")
    expect(result.terminal).toBeNull()
    expect(result.taskId).toBe("task_01")
  })

  test("pending checkpoint delivery is recover_checkpoint", () => {
    const result = detectLoopAction([
      snapshot("task_01", "completed", checkpointYaml),
      snapshot("task_02", "completed"),
    ], ledger())
    expect(result.action).toBe("recover_checkpoint")
    expect(result.terminal).toBeNull()
    expect(result.taskId).toBe("task_01")
  })

  test("any failed status is terminal failed even if later tasks are pending", () => {
    const result = detectLoopAction([
      snapshot("task_01", "failed"),
      snapshot("task_02", "pending"),
    ], ledger())
    expect(result.action).toBe("failed")
    expect(result.terminal).toBe("failed")
  })

  test("blocker with no recoverable or pending work is blocked", () => {
    const result = detectLoopAction([
      snapshot("task_01", "completed"),
    ], ledger({
      blocker: { code: "permission_denied", message: "provider credentials missing" },
    }))
    expect(result.action).toBe("blocked")
    expect(result.terminal).toBe("blocked")
    expect(result.reason).toContain("permission_denied")
  })

  test("iteration at max_iterations before another pass is exhausted", () => {
    const result = detectLoopAction([
      snapshot("task_01", "pending"),
    ], ledger({ iteration: 1, max_iterations: 1 }))
    expect(result.action).toBe("exhausted")
    expect(result.terminal).toBe("exhausted")
    expect(result.reason).toContain("1/1")
  })

  test("unchanged progress for the no-progress window is stalled", () => {
    const result = detectLoopAction([
      snapshot("task_01", "pending"),
    ], ledger({ no_progress_window: 2, no_progress_streak: 2 }))
    expect(result.action).toBe("stalled")
    expect(result.terminal).toBe("stalled")
    expect(result.reason).toContain("window 2")
  })

  test("in_progress after a simulated kill is execute", () => {
    const result = detectLoopAction([
      snapshot("task_01", "completed"),
      snapshot("task_02", "in_progress"),
    ], ledger())
    expect(result.action).toBe("execute")
    expect(result.terminal).toBeNull()
  })
})

const okResult: RunResult = { ok: true, completed: 1, failed: 0, blocked: 0 }

function diskTask(id: string, status: string, title: string, extra = ""): string {
  const number = id.replace("task_", "")
  return `---
status: ${status}
title: ${title}
type: chore
complexity: low
dependencies: []
${extra}---

# Task ${number}: ${title}
`
}

async function createLoopPacket(files: Record<string, string>): Promise<{ root: string; packet: string }> {
  const root = await mkdtemp(join(tmpdir(), "spec-finder-loop-"))
  const packet = join(root, ".spec-finder", "tasks", "demo-packet")
  await mkdir(packet, { recursive: true })
  await Promise.all(Object.entries(files).map(([name, body]) => writeFile(join(packet, name), body)))
  return { root, packet }
}

async function snapshotTree(directory: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  async function walk(current: string, prefix: string): Promise<void> {
    const entries = (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      const path = join(current, entry.name)
      if (entry.isDirectory()) await walk(path, rel)
      else out[rel] = await readFile(path, "utf8")
    }
  }
  await walk(directory, "")
  return out
}

describe("runLoop", () => {
  test("no_op before any pass does not call the runner", async () => {
    const { root } = await createLoopPacket({
      "task_01.md": diskTask("task_01", "completed", "Already done"),
    })
    let calls = 0
    const result = await runLoop({
      root,
      slug: "demo-packet",
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      emit: () => undefined,
      interactivePermissions: false,
      runTaskPacket: async () => {
        calls += 1
        return okResult
      },
    })
    expect(calls).toBe(0)
    expect(result.terminal).toBe("no_op")
  })

  test("continues after a report-only handoff without a new process", async () => {
    const { root, packet } = await createLoopPacket({
      "task_01.md": diskTask("task_01", "in_progress", "Handoff", `handoff:\n  phase: report\n`),
      "task_02.md": diskTask("task_02", "pending", "Next"),
    })
    const feedback: Array<string | undefined> = []
    const result = await runLoop({
      root,
      slug: "demo-packet",
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      emit: () => undefined,
      interactivePermissions: false,
      runTaskPacket: async (options: RunOptions) => {
        feedback.push(options.loopFeedback)
        if (feedback.length === 1) {
          await writeFile(join(packet, "task_01.md"), diskTask("task_01", "completed", "Handoff"))
        } else {
          await writeFile(join(packet, "task_02.md"), diskTask("task_02", "completed", "Next"))
        }
        return okResult
      },
    })
    expect(feedback).toHaveLength(2)
    expect(feedback[0]).toBeUndefined()
    expect(feedback[1]?.length).toBeGreaterThan(0)
    expect(result.terminal).toBe("done")
  })

  test("continues after pending checkpoint delivery without re-implementing that task", async () => {
    const { root, packet } = await createLoopPacket({
      "task_01.md": diskTask("task_01", "completed", "Deliver", checkpointYaml),
      "task_02.md": diskTask("task_02", "pending", "Next"),
    })
    let calls = 0
    const result = await runLoop({
      root,
      slug: "demo-packet",
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      emit: () => undefined,
      interactivePermissions: false,
      runTaskPacket: async () => {
        calls += 1
        if (calls === 1) {
          await writeFile(join(packet, "task_01.md"), diskTask("task_01", "completed", "Deliver"))
        } else {
          await writeFile(join(packet, "task_02.md"), diskTask("task_02", "completed", "Next"))
        }
        return okResult
      },
    })
    expect(calls).toBe(2)
    expect(result.terminal).toBe("done")
  })

  test("failed task stops after one runner call", async () => {
    const { root, packet } = await createLoopPacket({
      "task_01.md": diskTask("task_01", "pending", "Boom"),
      "task_02.md": diskTask("task_02", "pending", "Later"),
    })
    let calls = 0
    const result = await runLoop({
      root,
      slug: "demo-packet",
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      emit: () => undefined,
      interactivePermissions: false,
      runTaskPacket: async () => {
        calls += 1
        await writeFile(join(packet, "task_01.md"), diskTask("task_01", "failed", "Boom"))
        return { ok: false, completed: 0, failed: 1, blocked: 0 }
      },
    })
    expect(calls).toBe(1)
    expect(result.terminal).toBe("failed")
  })

  test("maxIterations 1 with remaining work is exhausted", async () => {
    const { root, packet } = await createLoopPacket({
      "task_01.md": diskTask("task_01", "pending", "Cap"),
    })
    const result = await runLoop({
      root,
      slug: "demo-packet",
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      emit: () => undefined,
      interactivePermissions: false,
      maxIterations: 1,
      runTaskPacket: async () => {
        await writeFile(join(packet, "task_01.md"), diskTask("task_01", "in_progress", "Cap"))
        return okResult
      },
    })
    expect(result.terminal).toBe("exhausted")
    expect(result.reason).toContain("1/1")
  })

  test("unchanged identity across the no-progress window is stalled", async () => {
    const { root } = await createLoopPacket({
      "task_01.md": diskTask("task_01", "pending", "Stuck"),
    })
    let calls = 0
    const result = await runLoop({
      root,
      slug: "demo-packet",
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      emit: () => undefined,
      interactivePermissions: false,
      noProgressWindow: 2,
      runTaskPacket: async () => {
        calls += 1
        return okResult
      },
    })
    expect(calls).toBe(2)
    expect(result.terminal).toBe("stalled")
  })

  test("abort after a runner return is cancelled", async () => {
    const { root } = await createLoopPacket({
      "task_01.md": diskTask("task_01", "pending", "Cancel during"),
    })
    const controller = new AbortController()
    let calls = 0
    const result = await runLoop({
      root,
      slug: "demo-packet",
      config: DEFAULT_CONFIG,
      signal: controller.signal,
      emit: () => undefined,
      interactivePermissions: false,
      runTaskPacket: async () => {
        calls += 1
        controller.abort()
        return okResult
      },
    })
    expect(calls).toBe(1)
    expect(result.terminal).toBe("cancelled")
  })

  test("abort before a pass is cancelled", async () => {
    const { root } = await createLoopPacket({
      "task_01.md": diskTask("task_01", "pending", "Cancel"),
    })
    const controller = new AbortController()
    controller.abort()
    let calls = 0
    const result = await runLoop({
      root,
      slug: "demo-packet",
      config: DEFAULT_CONFIG,
      signal: controller.signal,
      emit: () => undefined,
      interactivePermissions: false,
      runTaskPacket: async () => {
        calls += 1
        return okResult
      },
    })
    expect(calls).toBe(0)
    expect(result.terminal).toBe("cancelled")
  })

  test("dry-run on a pending packet does not call the runner or mutate files", async () => {
    const { root, packet } = await createLoopPacket({
      "task_01.md": diskTask("task_01", "pending", "Plan"),
    })
    const before = await snapshotTree(packet)
    let calls = 0
    const result = await runLoop({
      root,
      slug: "demo-packet",
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      emit: () => undefined,
      interactivePermissions: false,
      dryRun: true,
      runTaskPacket: async () => {
        calls += 1
        return okResult
      },
    })
    expect(calls).toBe(0)
    expect(result.reason).toContain("dry-run")
    expect(await snapshotTree(packet)).toEqual(before)
    expect(await Bun.file(describeLoopPaths(packet).directory).exists()).toBe(false)
  })

  test("resume from mid-loop ledger skips completed work", async () => {
    const { root, packet } = await createLoopPacket({
      "task_01.md": diskTask("task_01", "completed", "Done"),
      "task_02.md": diskTask("task_02", "pending", "Left"),
    })
    const initial = await initLoopState(packet, { slug: "demo-packet" })
    await writeLoopState(packet, parseLoopState({
      ...initial,
      iteration: 1,
      iterations: [{
        n: 1,
        at: "2026-09-04T17:00:00.000Z",
        action: "execute",
        outcome: "continue",
        summary: "completed task_01",
      }],
    }))
    let calls = 0
    const result = await runLoop({
      root,
      slug: "demo-packet",
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      emit: () => undefined,
      interactivePermissions: false,
      runTaskPacket: async () => {
        calls += 1
        await writeFile(join(packet, "task_02.md"), diskTask("task_02", "completed", "Left"))
        return okResult
      },
    })
    expect(calls).toBe(1)
    expect(result.terminal).toBe("done")
  })
})
