import { readdir, realpath, stat } from "node:fs/promises"
import type { Dirent } from "node:fs"
import { join } from "node:path"
import { LoopStateError, loadLoopState, type LoopTerminal } from "./loop-state.ts"
import { assertInsideWorkspace, specPath, TASKS_DIR } from "./paths.ts"
import {
  executionOrder,
  hasPendingCheckpointDelivery,
  isCheckpointBlocked,
  isCompletedStatus,
  isValidTaskSlug,
  snapshotTaskPacket,
  validateTasks,
  type TaskFile,
  type TaskStatus,
} from "./tasks.ts"

export type GlanceKind = "remaining" | "early-stage" | "blocked" | "invalid"

export type GlanceRow = {
  slug: string
  kind: GlanceKind
  completed: number
  total: number
  detail?: string
}

export type GlanceSuccess = { ok: true; rows: GlanceRow[] }
export type GlanceFailure = {
  ok: false
  code: "tasks_unreadable" | "invalid_invocation"
  message: string
}

export type InspectTaskRef = { id: string; status: TaskStatus }

export type InspectBlocker = {
  taskId: string
  kind: "checkpoint" | "handoff"
  message: string
}

export type LoopInspect =
  | { state: "absent" }
  | { state: "none"; terminal: null }
  | { state: "terminal"; terminal: LoopTerminal }
  | { state: "invalid"; message: string }

export type InspectSuccess = {
  ok: true
  slug: string
  kind: Exclude<GlanceKind, "invalid">
  completed: number
  total: number
  remaining: InspectTaskRef[]
  blockers: InspectBlocker[]
  loop: LoopInspect
}

export type InspectFailure = {
  ok: false
  code: "invalid_invocation" | "invalid_slug" | "missing" | "invalid_packet"
  message: string
  issues?: string[]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isMissingPath(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}

function isGlanceBlocked(task: TaskFile): boolean {
  return isCheckpointBlocked(task)
    || (task.frontmatter.handoff?.phase === "report" && task.frontmatter.handoff.error !== undefined)
}

function completedCount(tasks: TaskFile[]): number {
  return tasks.filter((task) => (
    isCompletedStatus(task.frontmatter.status) && !hasPendingCheckpointDelivery(task)
  )).length
}

function inspectBlockers(tasks: TaskFile[]): InspectBlocker[] {
  const blockers: InspectBlocker[] = []
  for (const task of tasks) {
    if (isCheckpointBlocked(task) && task.frontmatter.checkpoint?.state === "blocked") {
      blockers.push({ taskId: task.id, kind: "checkpoint", message: task.frontmatter.checkpoint.error })
    }
    const handoffError = task.frontmatter.handoff?.error
    if (task.frontmatter.handoff?.phase === "report" && handoffError !== undefined) {
      blockers.push({ taskId: task.id, kind: "handoff", message: handoffError })
    }
  }
  return blockers
}

async function inspectLoop(packetDirectory: string): Promise<LoopInspect> {
  try {
    const ledger = await loadLoopState(packetDirectory)
    if (ledger.terminal === null) return { state: "none", terminal: null }
    return { state: "terminal", terminal: ledger.terminal }
  } catch (error) {
    if (error instanceof LoopStateError && error.message.startsWith("missing loop ledger")) {
      return { state: "absent" }
    }
    return { state: "invalid", message: errorMessage(error) }
  }
}

async function isPacketDirectory(path: string, dirent: Dirent): Promise<boolean> {
  if (dirent.isDirectory()) return true
  if (!dirent.isSymbolicLink()) return false
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function classifyPacket(root: string, slug: string, absolutePath: string): Promise<GlanceRow> {
  const invalid = (detail: string): GlanceRow => ({
    slug,
    kind: "invalid",
    completed: 0,
    total: 0,
    detail,
  })

  try {
    const canonicalRoot = await realpath(root)
    const canonicalPacket = await realpath(absolutePath)
    assertInsideWorkspace(canonicalRoot, canonicalPacket)
  } catch (error) {
    return invalid(errorMessage(error))
  }

  if (!isValidTaskSlug(slug)) return invalid("invalid slug")

  let tasks: TaskFile[]
  try {
    tasks = (await snapshotTaskPacket(root, slug, { enforceContainment: true })).tasks
  } catch (error) {
    return invalid(errorMessage(error))
  }

  if (tasks.length === 0) {
    return { slug, kind: "early-stage", completed: 0, total: 0 }
  }

  const issues = validateTasks(tasks)
  if (issues.length > 0) {
    return invalid(issues.map((issue) => issue.message).join("; "))
  }

  return {
    slug,
    kind: tasks.some(isGlanceBlocked) ? "blocked" : "remaining",
    completed: completedCount(tasks),
    total: tasks.length,
  }
}

export async function listActivePackets(root: string): Promise<GlanceSuccess | GlanceFailure> {
  const tasksDir = specPath(root, TASKS_DIR)
  let entries: Dirent[]
  try {
    const canonicalRoot = await realpath(root)
    const canonicalTasksDir = await realpath(tasksDir)
    assertInsideWorkspace(canonicalRoot, canonicalTasksDir)
    entries = await readdir(tasksDir, { withFileTypes: true })
  } catch (error) {
    return {
      ok: false,
      code: "tasks_unreadable",
      message: `cannot read .spec-finder/tasks: ${errorMessage(error)}`,
    }
  }

  const rows: GlanceRow[] = []
  for (const entry of entries) {
    const absolutePath = join(tasksDir, entry.name)
    if (!await isPacketDirectory(absolutePath, entry)) continue
    rows.push(await classifyPacket(root, entry.name, absolutePath))
  }

  rows.sort((left, right) => left.slug.localeCompare(right.slug))
  return { ok: true, rows }
}

export async function inspectPacket(root: string, slug: string): Promise<InspectSuccess | InspectFailure> {
  if (!isValidTaskSlug(slug)) {
    return { ok: false, code: "invalid_slug", message: `invalid task slug: ${slug}` }
  }

  const directory = specPath(root, TASKS_DIR, slug)
  try {
    const canonicalRoot = await realpath(root)
    const canonicalPacket = await realpath(directory)
    assertInsideWorkspace(canonicalRoot, canonicalPacket)
    if (!(await stat(canonicalPacket)).isDirectory()) {
      return { ok: false, code: "invalid_packet", message: `packet is not a directory: ${slug}` }
    }
  } catch (error) {
    if (isMissingPath(error)) {
      return { ok: false, code: "missing", message: `packet is missing: ${slug}` }
    }
    return { ok: false, code: "invalid_packet", message: errorMessage(error) }
  }

  let tasks: TaskFile[]
  try {
    tasks = (await snapshotTaskPacket(root, slug, { enforceContainment: true })).tasks
  } catch (error) {
    return { ok: false, code: "invalid_packet", message: errorMessage(error) }
  }

  if (tasks.length > 0) {
    const issues = validateTasks(tasks)
    if (issues.length > 0) {
      return {
        ok: false,
        code: "invalid_packet",
        message: `packet ${slug} is invalid`,
        issues: issues.map((issue) => issue.message),
      }
    }
  }

  const kind = tasks.length === 0
    ? "early-stage"
    : tasks.some(isGlanceBlocked) ? "blocked" : "remaining"

  return {
    ok: true,
    slug,
    kind,
    completed: completedCount(tasks),
    total: tasks.length,
    remaining: executionOrder(tasks).map((task) => ({
      id: task.id,
      status: task.frontmatter.status,
    })),
    blockers: inspectBlockers(tasks),
    loop: await inspectLoop(directory),
  }
}
