import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ensurePacketMemory, taskMemoryPaths } from "../src/memory.ts"
import { parseTask } from "../src/tasks.ts"

function taskSource(title: string): string {
  return `---
status: pending
title: ${title}
type: chore
complexity: low
dependencies: []
---

# Task 01: ${title}
`
}

describe("workflow memory", () => {
  test("creates shared and per-task files without overwriting existing memory", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-memory-"))
    const packet = join(root, ".spec-finder", "tasks", "demo")
    const taskPath = join(packet, "task_01.md")
    await mkdir(join(packet, "memory"), { recursive: true })
    await writeFile(join(packet, "memory", "MEMORY.md"), "# Existing memory\n")
    const task = parseTask(taskPath, taskSource("Inspect memory"))

    await ensurePacketMemory(packet, [task])

    const paths = taskMemoryPaths(packet, task.id)
    expect(await readFile(paths.shared, "utf8")).toBe("# Existing memory\n")
    expect(await readFile(paths.task, "utf8")).toContain("# Task Memory: task_01")
    expect(await readFile(paths.task, "utf8")).toContain("- Inspect memory")
  })
})
