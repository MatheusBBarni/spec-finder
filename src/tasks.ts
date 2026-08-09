import { readdir, readFile, writeFile } from "node:fs/promises"
import { basename, isAbsolute, join } from "node:path"
import { parse as parseYaml, stringify as stringifyYaml } from "yaml"
import { z } from "zod"
import { specPath, TASKS_DIR } from "./paths.ts"

const TASK_PATTERN = /^task_(\d+)\.md$/
const TASK_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const statusSchema = z.enum(["pending", "in_progress", "completed", "done", "finished", "failed", "blocked"])
export type TaskStatus = z.infer<typeof statusSchema>

const OBJECT_ID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i
const DIGEST_PATTERN = /^[a-f0-9]{64}$/i

function isSafeCheckpointPath(value: string): boolean {
  if (value.length === 0 || value.includes("\0") || value.includes("\\")) return false
  if (isAbsolute(value) || /^[a-z]:/i.test(value)) return false
  const segments = value.split("/")
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
}

const checkpointPathSchema = z.string().min(1).refine(isSafeCheckpointPath, {
  message: "must be a safe repository-relative path",
})

const checkpointPathsSchema = z.array(checkpointPathSchema).min(1).superRefine((paths, context) => {
  const seen = new Set<string>()
  for (const [index, path] of paths.entries()) {
    if (seen.has(path)) {
      context.addIssue({
        code: "custom",
        path: [index],
        message: "candidate paths must be unique",
      })
    }
    seen.add(path)
  }
})

const checkpointFields = {
  base_head: z.string().regex(OBJECT_ID_PATTERN, "must be a 40- or 64-character hexadecimal object ID"),
  baseline_digest: z.string().regex(DIGEST_PATTERN, "must be a 64-character hexadecimal SHA-256 digest"),
  paths: checkpointPathsSchema,
}

const checkpointActiveSchema = z.object({
  ...checkpointFields,
  state: z.literal("active"),
}).strict()

const checkpointBlockedSchema = z.object({
  ...checkpointFields,
  state: z.literal("blocked"),
  error: z.string().trim().min(1).max(4096),
}).strict()

export const checkpointRecordSchema = z.discriminatedUnion("state", [checkpointActiveSchema, checkpointBlockedSchema])
export type CheckpointRecord = z.infer<typeof checkpointRecordSchema>
export type CheckpointState = CheckpointRecord["state"]

const taskHandoffSchema = z.object({
  phase: z.literal("report"),
  error: z.string().trim().min(1).max(4096).optional(),
}).strict()
export type TaskHandoff = z.infer<typeof taskHandoffSchema>

const frontmatterSchema = z.object({
  status: statusSchema,
  title: z.string().trim().min(1),
  type: z.string().trim().min(1),
  complexity: z.enum(["low", "medium", "high", "critical"]),
  dependencies: z.array(z.string()).default([]),
  checkpoint: checkpointRecordSchema.optional(),
  handoff: taskHandoffSchema.optional(),
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

export function isValidTaskSlug(slug: string): boolean {
  return TASK_SLUG_PATTERN.test(slug)
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
  if (!isValidTaskSlug(slug)) throw new Error(`invalid task slug: ${slug}`)
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
    if (includeCompleted || !isCompletedStatus(task.frontmatter.status) || hasPendingCheckpointDelivery(task)) {
      result.push(task)
    }
  }
  for (const task of tasks) visit(task)
  return result
}

export function isCompletedStatus(status: TaskStatus): boolean {
  return ["completed", "done", "finished"].includes(status)
}

export function isCheckpointBlocked(task: TaskFile): boolean {
  return isCompletedStatus(task.frontmatter.status) && task.frontmatter.checkpoint?.state === "blocked"
}

export function hasPendingCheckpointDelivery(task: TaskFile): boolean {
  return isCompletedStatus(task.frontmatter.status) && task.frontmatter.checkpoint !== undefined
}

export async function updateTaskStatus(task: TaskFile, status: TaskStatus): Promise<TaskFile> {
  const next = { ...task.frontmatter, status }
  return writeTaskFrontmatter(task, next)
}

export async function updateTaskCheckpoint(task: TaskFile, checkpoint: CheckpointRecord | undefined): Promise<TaskFile> {
  const next = { ...task.frontmatter }
  if (checkpoint === undefined) {
    delete next.checkpoint
  } else {
    const parsed = checkpointRecordSchema.safeParse(checkpoint)
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "))
    }
    next.checkpoint = parsed.data
  }
  return writeTaskFrontmatter(task, next)
}

export function clearTaskCheckpoint(task: TaskFile): Promise<TaskFile> {
  return updateTaskCheckpoint(task, undefined)
}

export async function updateTaskHandoff(task: TaskFile, handoff: TaskHandoff | undefined): Promise<TaskFile> {
  const next = { ...task.frontmatter }
  if (handoff === undefined) {
    delete next.handoff
  } else {
    next.handoff = taskHandoffSchema.parse(handoff)
  }
  return writeTaskFrontmatter(task, next)
}

export function clearTaskHandoff(task: TaskFile): Promise<TaskFile> {
  return updateTaskHandoff(task, undefined)
}

async function writeTaskFrontmatter(task: TaskFile, frontmatter: TaskFrontmatter): Promise<TaskFile> {
  const parsed = frontmatterSchema.safeParse(frontmatter)
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "))
  }
  const source = `---\n${stringifyYaml(parsed.data).trimEnd()}\n---\n${task.body}`
  await writeFile(task.path, source)
  return { ...task, source, frontmatter: parsed.data }
}
