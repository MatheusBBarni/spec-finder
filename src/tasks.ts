import { readdir, readFile, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { parse as parseYaml, stringify as stringifyYaml } from "yaml"
import { z } from "zod"
import { specPath, TASKS_DIR } from "./paths.ts"

const TASK_PATTERN = /^task_(\d+)\.md$/
const statusSchema = z.enum(["pending", "in_progress", "completed", "done", "finished", "failed", "blocked"])
export type TaskStatus = z.infer<typeof statusSchema>

const frontmatterSchema = z.object({
  status: statusSchema,
  title: z.string().trim().min(1),
  type: z.string().trim().min(1),
  complexity: z.enum(["low", "medium", "high", "critical"]),
  dependencies: z.array(z.string()).default([]),
}).passthrough()

export type TaskFrontmatter = z.infer<typeof frontmatterSchema>

export interface TaskFile {
  id: string
  number: number
  path: string
  body: string
  source: string
  frontmatter: TaskFrontmatter
}

export interface TaskIssue {
  path: string
  message: string
}

function splitFrontmatter(source: string): { raw: string; body: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match?.[1]) throw new Error("missing YAML frontmatter")
  return { raw: match[1], body: match[2] ?? "" }
}

export function parseTask(path: string, source: string): TaskFile {
  const file = basename(path)
  const nameMatch = file.match(TASK_PATTERN)
  if (!nameMatch?.[1]) throw new Error(`invalid task filename: ${file}`)
  const { raw, body } = splitFrontmatter(source)
  const parsed = frontmatterSchema.safeParse(parseYaml(raw))
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "))
  }
  const number = Number(nameMatch[1])
  return { id: `task_${nameMatch[1]}`, number, path, body, source, frontmatter: parsed.data }
}

export async function loadTaskPacket(root: string, slug: string): Promise<{ directory: string; tasks: TaskFile[] }> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`invalid task slug: ${slug}`)
  const directory = specPath(root, TASKS_DIR, slug)
  const files = (await readdir(directory)).filter((name) => TASK_PATTERN.test(name)).sort()
  if (files.length === 0) throw new Error(`no task_XX.md files found in ${directory}`)
  const tasks = await Promise.all(files.map(async (name) => {
    const path = join(directory, name)
    return parseTask(path, await readFile(path, "utf8"))
  }))
  return { directory, tasks: tasks.sort((a, b) => a.number - b.number) }
}

function normalizeDependency(value: string): string {
  return value.replace(/\.md$/, "")
}

export function validateTasks(tasks: TaskFile[]): TaskIssue[] {
  const issues: TaskIssue[] = []
  const ids = new Set(tasks.map((task) => task.id))
  for (const task of tasks) {
    for (const dependency of task.frontmatter.dependencies) {
      const id = normalizeDependency(dependency)
      if (!ids.has(id)) issues.push({ path: task.path, message: `unknown dependency ${dependency}` })
      if (id === task.id) issues.push({ path: task.path, message: "task cannot depend on itself" })
    }
    const h1 = task.body.match(/^#\s+(?:Task\s+\d+:\s*)?(.+)$/m)?.[1]?.trim()
    if (!h1 || h1 !== task.frontmatter.title) {
      issues.push({ path: task.path, message: `frontmatter title must match H1 (${JSON.stringify(h1 ?? "missing")})` })
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      issues.push({ path: byId.get(id)?.path ?? id, message: "circular dependency detected" })
      return
    }
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of byId.get(id)?.frontmatter.dependencies ?? []) {
      const normalized = normalizeDependency(dependency)
      if (byId.has(normalized)) visit(normalized)
    }
    visiting.delete(id)
    visited.add(id)
  }
  for (const task of tasks) visit(task.id)
  return issues
}

export function executionOrder(tasks: TaskFile[], includeCompleted = false): TaskFile[] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const result: TaskFile[] = []
  const visited = new Set<string>()
  const visit = (task: TaskFile): void => {
    if (visited.has(task.id)) return
    for (const dependency of task.frontmatter.dependencies) {
      const target = byId.get(normalizeDependency(dependency))
      if (target) visit(target)
    }
    visited.add(task.id)
    if (includeCompleted || !["completed", "done", "finished"].includes(task.frontmatter.status)) result.push(task)
  }
  for (const task of tasks) visit(task)
  return result
}

export async function updateTaskStatus(task: TaskFile, status: TaskStatus): Promise<TaskFile> {
  const next = { ...task.frontmatter, status }
  const source = `---\n${stringifyYaml(next).trimEnd()}\n---\n\n${task.body.replace(/^\s+/, "")}`
  await writeFile(task.path, source)
  return { ...task, source, frontmatter: next }
}

