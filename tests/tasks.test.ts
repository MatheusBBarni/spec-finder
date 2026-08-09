import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  clearTaskCheckpoint,
  clearTaskHandoff,
  executionOrder,
  loadTaskPacket,
  parseTask,
  updateTaskCheckpoint,
  updateTaskHandoff,
  updateTaskStatus,
  validateTasks,
} from "../src/tasks.ts"

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

function task(number: number, title: string, dependencies: string[] = []): string {
  return `---
status: pending
title: ${title}
type: backend
complexity: low
dependencies: [${dependencies.join(", ")}]
---

# Task ${number}: ${title}

## Overview
Test task.
`
}

const baseHead = "a".repeat(40)
const baselineDigest = "b".repeat(64)

function checkpoint(state: "active" | "blocked", error?: string): string {
  return `checkpoint:
  state: ${state}
  base_head: ${baseHead}
  baseline_digest: ${baselineDigest}
  paths:
    - src/example.ts
${error === undefined ? "" : `  error: ${error}\n`}`
}

function taskWithCheckpoint(
  number: number,
  title: string,
  status: string,
  checkpointYaml: string,
  dependencies: string[] = [],
): string {
  return `---
status: ${status}
title: ${title}
type: backend
complexity: low
dependencies: [${dependencies.join(", ")}]
${checkpointYaml}---

# Task ${number}: ${title}

## Overview
Test task.
`
}

describe("task packets", () => {
  test("loads, validates, orders, and updates tasks", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-task-"))
    roots.push(root)
    const directory = join(root, ".spec-finder", "tasks", "demo")
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, "task_02.md"), task(2, "Second", ["task_01"]))
    await writeFile(join(directory, "task_01.md"), task(1, "First"))

    const packet = await loadTaskPacket(root, "demo")
    expect(validateTasks(packet.tasks)).toEqual([])
    expect(executionOrder(packet.tasks).map((item) => item.id)).toEqual(["task_01", "task_02"])

    await updateTaskStatus(packet.tasks[0]!, "completed")
    expect(await readFile(packet.tasks[0]!.path, "utf8")).toContain("status: completed")
  })

  test("detects unknown and circular dependencies", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-cycle-"))
    roots.push(root)
    const directory = join(root, ".spec-finder", "tasks", "cycle")
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, "task_01.md"), task(1, "First", ["task_02", "task_99"]))
    await writeFile(join(directory, "task_02.md"), task(2, "Second", ["task_01"]))
    const packet = await loadTaskPacket(root, "cycle")
    const messages = validateTasks(packet.tasks).map((issue) => issue.message).join("\n")
    expect(messages).toContain("unknown dependency task_99")
    expect(messages).toContain("circular dependency")
  })

  test("accepts absent, active, and blocked checkpoint metadata", () => {
    const active = parseTask(
      "task_01.md",
      taskWithCheckpoint(1, "Active", "in_progress", checkpoint("active")),
    )
    const blocked = parseTask(
      "task_02.md",
      taskWithCheckpoint(2, "Blocked", "completed", checkpoint("blocked", "hook failed")),
    )
    const absent = parseTask("task_03.md", task(3, "Absent"))

    expect(active.frontmatter.checkpoint).toEqual({
      state: "active",
      base_head: baseHead,
      baseline_digest: baselineDigest,
      paths: ["src/example.ts"],
    })
    expect(blocked.frontmatter.checkpoint).toEqual({
      state: "blocked",
      base_head: baseHead,
      baseline_digest: baselineDigest,
      paths: ["src/example.ts"],
      error: "hook failed",
    })
    expect(absent.frontmatter.checkpoint).toBeUndefined()
    expect(active.body).toContain("# Task 1: Active")
    expect(blocked.body).toContain("# Task 2: Blocked")
  })

  test("rejects malformed checkpoint state, fields, digest, paths, and blocked errors", () => {
    const invalidSources = [
      taskWithCheckpoint(1, "Bad state", "in_progress", checkpoint("retrying" as "active")),
      taskWithCheckpoint(1, "Missing head", "in_progress", `checkpoint:
  state: active
  baseline_digest: ${baselineDigest}
  paths:
    - src/example.ts
`),
      taskWithCheckpoint(1, "Bad digest", "in_progress", `checkpoint:
  state: active
  base_head: ${baseHead}
  baseline_digest: invalid
  paths:
    - src/example.ts
`),
      taskWithCheckpoint(1, "Unsafe path", "in_progress", `checkpoint:
  state: active
  base_head: ${baseHead}
  baseline_digest: ${baselineDigest}
  paths:
    - ../outside.ts
`),
      taskWithCheckpoint(1, "Missing error", "completed", checkpoint("blocked")),
    ]

    for (const source of invalidSources) {
      expect(() => parseTask("task_01.md", source)).toThrow()
    }
  })

  test("retries completed blocked delivery in dependency order and skips delivered or absent completion", () => {
    const blocked = parseTask(
      "task_01.md",
      taskWithCheckpoint(1, "Blocked", "completed", checkpoint("blocked", "commit hook failed")),
    )
    const pending = parseTask("task_02.md", task(2, "Pending", ["task_01"]))
    const active = parseTask(
      "task_03.md",
      taskWithCheckpoint(3, "Active", "completed", checkpoint("active")),
    )
    const absent = parseTask("task_04.md", task(4, "Absent").replace("status: pending", "status: completed"))

    expect(executionOrder([blocked, pending, active, absent]).map((item) => item.id)).toEqual(["task_01", "task_02"])
    expect(executionOrder([blocked, pending, active, absent], true).map((item) => item.id)).toEqual([
      "task_01",
      "task_02",
      "task_03",
      "task_04",
    ])
  })

  test("loads a blocked completed dependency before its pending task", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-checkpoint-order-"))
    roots.push(root)
    const directory = join(root, ".spec-finder", "tasks", "recovery")
    await mkdir(directory, { recursive: true })
    await writeFile(
      join(directory, "task_01.md"),
      taskWithCheckpoint(1, "First", "completed", checkpoint("blocked", "delivery unavailable")),
    )
    await writeFile(join(directory, "task_02.md"), task(2, "Second", ["task_01"]))

    const packet = await loadTaskPacket(root, "recovery")
    expect(validateTasks(packet.tasks)).toEqual([])
    expect(executionOrder(packet.tasks).map((item) => item.id)).toEqual(["task_01", "task_02"])
  })

  test("preserves lifecycle metadata, unrelated frontmatter, and body when updating checkpoint state", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-checkpoint-update-"))
    roots.push(root)
    const path = join(root, "task_02.md")
    const source = `---
status: in_progress
title: Preserve metadata
type: backend
complexity: medium
dependencies: [task_01]
owner: platform
---

# Task 2: Preserve metadata

Body content stays byte-for-byte stable.
`
    await writeFile(path, source)
    const taskFile = parseTask(path, source)
    const updated = await updateTaskCheckpoint(taskFile, {
      state: "blocked",
      base_head: baseHead,
      baseline_digest: baselineDigest,
      paths: ["src/example.ts"],
      error: "delivery failed",
    })

    expect(updated.frontmatter.status).toBe("in_progress")
    expect(updated.frontmatter.title).toBe("Preserve metadata")
    expect(updated.frontmatter.dependencies).toEqual(["task_01"])
    expect(updated.frontmatter.owner).toBe("platform")
    expect(updated.body).toBe(taskFile.body)
    const persisted = parseTask(path, await readFile(path, "utf8"))
    expect(persisted.frontmatter.checkpoint).toEqual(updated.frontmatter.checkpoint)
    expect(persisted.body).toBe(taskFile.body)

    const completed = await updateTaskStatus(updated, "completed")
    expect(completed.frontmatter.checkpoint?.state).toBe("blocked")
    expect(completed.body).toBe(taskFile.body)
    const cleared = await clearTaskCheckpoint(completed)
    expect(cleared.frontmatter.checkpoint).toBeUndefined()
    expect(cleared.frontmatter.status).toBe("completed")
    expect(cleared.body).toBe(taskFile.body)
  })

  test("accepts strict report handoff metadata and rejects malformed records", () => {
    const valid = parseTask("task_01.md", task(1, "Report handoff").replace(
      "dependencies: []",
      "dependencies: []\nhandoff:\n  phase: report\n  error: report process exited",
    ))
    expect(valid.frontmatter.handoff).toEqual({ phase: "report", error: "report process exited" })

    for (const handoff of [
      "handoff:\n  phase: implementation",
      "handoff:\n  phase: report\n  error: \"\"",
      "handoff:\n  phase: report\n  unexpected: true",
    ]) {
      expect(() => parseTask(
        "task_01.md",
        task(1, "Bad handoff").replace("dependencies: []", `dependencies: []\n${handoff}`),
      )).toThrow()
    }
  })

  test("updates and clears report handoff metadata without changing task content", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-handoff-update-"))
    roots.push(root)
    const path = join(root, "task_01.md")
    const source = task(1, "Preserve report handoff")
    await writeFile(path, source)

    const taskFile = parseTask(path, source)
    const updated = await updateTaskHandoff(taskFile, { phase: "report", error: "transport closed" })
    expect(updated.frontmatter.status).toBe("pending")
    expect(updated.frontmatter.handoff).toEqual({ phase: "report", error: "transport closed" })
    expect(updated.body).toBe(taskFile.body)

    const cleared = await clearTaskHandoff(updated)
    expect(cleared.frontmatter.handoff).toBeUndefined()
    expect(cleared.frontmatter.status).toBe("pending")
    expect(cleared.body).toBe(taskFile.body)
  })

  test("documents the checkpoint metadata contract", async () => {
    const documentation = await readFile(
      join(import.meta.dir, "..", "skills", "sf-create-tasks", "references", "task-context-schema.md"),
      "utf8",
    )
    expect(documentation).toContain("Optional checkpoint delivery metadata")
    expect(documentation).toContain("checkpoint.state: blocked")
    expect(documentation).toContain("Existing task files without it remain valid")
    expect(documentation).toContain("Optional report handoff metadata")
    expect(documentation).toContain("report-only recovery")
  })
})
