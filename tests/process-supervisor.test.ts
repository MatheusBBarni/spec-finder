import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { EventEmitter } from "node:events"
import type { ChildProcess } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"
import { performance } from "node:perf_hooks"
import { createProcessSupervisor, buildTaskkillArgs, type SupervisedProcessHandle } from "../src/process-supervisor.ts"
import type { ProviderLaunch } from "../src/acp-turn.ts"

const fixture = join(import.meta.dir, "fixtures", "process-tree.ts")
const roots: string[] = []
const handles: SupervisedProcessHandle[] = []

afterEach(async () => {
  await Promise.all(handles.splice(0).map(async (handle) => {
    try {
      await handle.cancelTree(1_000)
    } catch {
      // The assertion that owns the handle reports the primary failure.
    }
  }))
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("process supervisor", () => {
  test("spawns directly with explicit pipes and confirms normal closure", async () => {
    const root = await temporaryRoot("normal")
    const supervisor = createProcessSupervisor({ termGraceMs: 50 })
    const handle = await supervisor.spawn(launch(root, "exit"))
    handles.push(handle)

    const exit = await handle.closed
    expect(exit.code).toBe(0)
    expect(exit.signal).toBeNull()
    expect(handle.cleanupState).toBe("requested")
    const cleanup = await handle.cancelTree(500)
    expect(cleanup.state).toBe("closed")
    expect(cleanup.exit?.code).toBe(0)
  }, 2_000)

  test("returns a typed spawn failure without an unhandled process event", async () => {
    const root = await temporaryRoot("spawn-failure")
    const supervisor = createProcessSupervisor()
    const failure = await supervisor.spawn({ ...launch(root, "hold"), command: join(root, "does-not-exist") })
      .catch((error: unknown) => error)

    expect(failure).toMatchObject({
      name: "ProcessSupervisorError",
      stage: "spawn",
    })
    expect((failure as Error).message).toContain("verify it is installed and available on PATH")
  }, 2_000)

  test("exposes a process-stage failure when the provider exits unsuccessfully", async () => {
    const root = await temporaryRoot("process-failure")
    const supervisor = createProcessSupervisor()
    const handle = await supervisor.spawn(launch(root, "exit-nonzero"))
    handles.push(handle)

    const exit = await handle.closed
    expect(exit.code).toBe(7)
    expect((await handle.failure)?.stage).toBe("process")
  }, 2_000)

  test("exposes a pipe-stage failure after process closure", async () => {
    const root = await temporaryRoot("pipe-failure")
    const child = new EventEmitter() as EventEmitter & Partial<ChildProcess> & { pid: number }
    child.pid = 42_424
    child.stdin = new PassThrough()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => true
    const supervisor = createProcessSupervisor({
      platform: "win32",
      spawnProcess: (() => child) as unknown as typeof import("node:child_process").spawn,
      treeProbe: async () => true,
    })
    const pending = supervisor.spawn(launch(root, "hold"))
    child.emit("spawn")
    const handle = await pending
    handles.push(handle)
    child.stdout.destroy(new Error("fixture pipe broke"))
    child.stdin.destroy()
    child.stderr.destroy()
    child.emit("close", 0, null)

    const exit = await handle.closed
    expect(exit.error).toContain("pipe")
    expect((await handle.failure)?.stage).toBe("pipe")
  })

  test("does not accept direct-child exit while a recorded descendant holds the pipe", async () => {
    const root = await temporaryRoot("grandchild")
    const record = join(root, "tree.json")
    const supervisor = createProcessSupervisor({ termGraceMs: 40, pollIntervalMs: 10 })
    const handle = await supervisor.spawn(launch(root, "parent-exits", { SPEC_FINDER_PROCESS_TREE_RECORD: record }))
    handles.push(handle)
    const tree = await readTree(record)
    handle.trackDescendant(tree.descendantPid)

    await waitForProcess(tree.parentPid, true)
    let closed = false
    void handle.closed.then(() => { closed = true })
    await Bun.sleep(40)
    expect(closed).toBe(false)

    const cleanup = await handle.cancelTree(1_000)
    expect(cleanup.state).toBe("closed")
    expect(await processGone(tree.descendantPid)).toBe(true)
  }, 3_000)

  test("cleans an isolated POSIX process group after direct-child signalling", async () => {
    const root = await temporaryRoot("group")
    const record = join(root, "tree.json")
    const supervisor = createProcessSupervisor({ termGraceMs: 30, pollIntervalMs: 10 })
    const handle = await supervisor.spawn(launch(root, "grandchild", { SPEC_FINDER_PROCESS_TREE_RECORD: record }))
    handles.push(handle)
    const tree = await readTree(record)
    handle.trackDescendant(tree.descendantPid)

    process.kill(handle.pid, "SIGTERM")
    await waitForProcess(handle.pid, true)
    expect(await processGone(tree.descendantPid)).toBe(false)

    const cleanup = await handle.cancelTree(1_000)
    expect(cleanup.state).toBe("closed")
    expect(await processGone(tree.descendantPid)).toBe(true)
  }, 3_000)

  test("runs one idempotent escalation sequence and shares the result", async () => {
    const root = await temporaryRoot("idempotent")
    const record = join(root, "tree.json")
    const supervisor = createProcessSupervisor({
      termGraceMs: 30,
      pollIntervalMs: 10,
    })
    const handle = await supervisor.spawn(launch(root, "grandchild", { SPEC_FINDER_PROCESS_TREE_RECORD: record }))
    handles.push(handle)
    const tree = await readTree(record)
    handle.trackDescendant(tree.descendantPid)
    const first = handle.cancelTree(1_000)
    const second = handle.cancelTree(10)
    expect(first).toBe(second)
    const cleanup = await first
    expect(cleanup.state).toBe("closed")
  }, 3_000)

  test("lets a second cancellation skip the remaining TERM grace", async () => {
    const root = await temporaryRoot("second-cancel")
    const record = join(root, "tree.json")
    const supervisor = createProcessSupervisor({ termGraceMs: 1_000, pollIntervalMs: 10 })
    const handle = await supervisor.spawn(launch(root, "grandchild", { SPEC_FINDER_PROCESS_TREE_RECORD: record }))
    handles.push(handle)
    const tree = await readTree(record)
    handle.trackDescendant(tree.descendantPid)
    const started = performance.now()
    const first = handle.cancelTree(2_000)
    await Bun.sleep(20)
    const second = handle.cancelTree(2_000)

    expect(first).toBe(second)
    expect((await first).state).toBe("closed")
    expect(performance.now() - started).toBeLessThan(500)
  }, 3_000)

  test("surfaces an unconfirmed detached descendant by deadline", async () => {
    const root = await temporaryRoot("unconfirmed")
    const record = join(root, "tree.json")
    const supervisor = createProcessSupervisor({ termGraceMs: 20, pollIntervalMs: 10 })
    const handle = await supervisor.spawn(launch(root, "detached-grandchild", { SPEC_FINDER_PROCESS_TREE_RECORD: record }))
    handles.push(handle)
    const tree = await readTree(record)
    handle.trackDescendant(tree.descendantPid)

    const cleanup = await handle.cancelTree(120)
    expect(cleanup.state).toBe("unconfirmed")
    expect(cleanup.error).toContain("confirmed")
    process.kill(tree.descendantPid, "SIGKILL")
  }, 2_000)

  test("uses taskkill tree arguments on the Windows branch without a shell", async () => {
    const root = await temporaryRoot("windows")
    const calls: Array<{ pid: number; deadline: number }> = []
    const supervisor = createProcessSupervisor({
      platform: "win32",
      termGraceMs: 10,
      pollIntervalMs: 5,
      taskkill: async (pid, deadline) => {
        calls.push({ pid, deadline })
        try {
          process.kill(pid, "SIGKILL")
        } catch {
          // The target may have already exited before taskkill was invoked.
        }
        return { code: 0, signal: null }
      },
      treeProbe: async (pid) => processGone(pid),
    })
    const handle = await supervisor.spawn(launch(root, "exit"))
    handles.push(handle)
    const cleanup = await handle.cancelTree(500)

    expect(buildTaskkillArgs(42)).toEqual(["/PID", "42", "/T", "/F"])
    expect(calls).toHaveLength(1)
    expect(calls[0]?.pid).toBe(handle.pid)
    expect(calls[0]?.deadline).toBeGreaterThan(Date.now() - 1_000)
    expect(cleanup.state).toBe("closed")
  }, 2_000)
})

function launch(root: string, mode: string, env: Record<string, string> = {}): ProviderLaunch {
  return {
    command: process.execPath,
    args: [fixture, mode],
    cwd: root,
    env,
    authMethod: null,
  }
}

async function temporaryRoot(name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `spec-finder-${name}-`))
  roots.push(root)
  return root
}

async function readTree(path: string): Promise<{ parentPid: number; descendantPid: number }> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const tree = JSON.parse(await readFile(path, "utf8")) as { parentPid: number; descendantPid: number | null }
      if (tree.descendantPid !== null) return { parentPid: tree.parentPid, descendantPid: tree.descendantPid }
    } catch {
      // The fixture writes the record after the descendant starts.
    }
    await Bun.sleep(5)
  }
  throw new Error(`fixture did not write a complete process record: ${path}`)
}

async function waitForProcess(pid: number, gone: boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await processGone(pid) === gone) return
    await Bun.sleep(5)
  }
  throw new Error(`process ${pid} did not reach gone=${gone}`)
}

async function processGone(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0)
    return false
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return true
    throw error
  }
}
