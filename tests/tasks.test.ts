import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { executionOrder, loadTaskPacket, updateTaskStatus, validateTasks } from "../src/tasks.ts"

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
})

