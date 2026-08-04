import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { TaskFile } from "./tasks.ts"

export interface TaskMemoryPaths {
  directory: string
  shared: string
  task: string
}

export function taskMemoryPaths(packetDirectory: string, taskId: string): TaskMemoryPaths {
  const directory = join(packetDirectory, "memory")
  return {
    directory,
    shared: join(directory, "MEMORY.md"),
    task: join(directory, `${taskId}.md`),
  }
}

export async function ensurePacketMemory(packetDirectory: string, tasks: TaskFile[]): Promise<void> {
  const directory = join(packetDirectory, "memory")
  await mkdir(directory, { recursive: true })
  await writeIfMissing(join(directory, "MEMORY.md"), sharedMemoryTemplate())
  await Promise.all(tasks.map(async (task) => {
    await writeIfMissing(join(directory, `${task.id}.md`), taskMemoryTemplate(task))
  }))
}

function sharedMemoryTemplate(): string {
  return `# Workflow Memory

## Current State

## Shared Decisions

## Shared Learnings

## Open Risks

## Handoffs
`
}

function taskMemoryTemplate(task: TaskFile): string {
  return `# Task Memory: ${task.id}

## Objective Snapshot

- ${task.frontmatter.title}

## Important Decisions

## Learnings

## Files / Surfaces

## Errors / Corrections

## Ready for Next Run
`
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  try {
    await writeFile(path, content, { flag: "wx" })
  } catch (error) {
    if (!isAlreadyPresent(error)) throw error
  }
}

function isAlreadyPresent(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST"
}
