import { randomBytes } from "node:crypto"
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import { isValidTaskSlug } from "./tasks.ts"

export const LOOP_STATE_VERSION = 1
export const DEFAULT_MAX_ITERATIONS = 50
export const DEFAULT_NO_PROGRESS_WINDOW = 3
export const MAX_LOOP_ITERATION_HISTORY = 50
export const MAX_LOOP_TEXT_CHARS = 4096

export const LOOP_GOAL = "Implement every pending task in this packet to completed with evidence reports."
export const LOOP_DEFINITION_OF_DONE =
  "All task_*.md frontmatter status is completed, done, or finished; every task has a substantive report; no pending checkpoint delivery; no open report handoff."

export const LOOP_TERMINALS = [
  "done",
  "no_op",
  "blocked",
  "failed",
  "exhausted",
  "stalled",
  "cancelled",
] as const
export type LoopTerminal = (typeof LOOP_TERMINALS)[number]

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
const TASK_ID_PATTERN = /^task_\d+$/

const boundedTextSchema = z.string().max(MAX_LOOP_TEXT_CHARS).refine(
  (value) => !CONTROL_CHARS.test(value),
  "must not contain control characters",
)

const taskIdSchema = z.string().regex(TASK_ID_PATTERN, "must be a task_NN id")

const loopTerminalSchema = z.enum(LOOP_TERMINALS)

const loopBlockerSchema = z.object({
  code: z.string().trim().min(1).max(128).refine((value) => !CONTROL_CHARS.test(value), "must not contain control characters"),
  message: boundedTextSchema.min(1),
}).strict()

const loopProgressSchema = z.object({
  completed: z.array(taskIdSchema),
  failed: z.array(taskIdSchema),
  blocked: z.array(taskIdSchema),
  pending: z.array(taskIdSchema),
}).strict()

const loopFeedbackSchema = z.object({
  previous_outcome: boundedTextSchema,
  route_causes: z.array(boundedTextSchema),
  last_failed_task_ids: z.array(taskIdSchema),
}).strict()

const loopIterationRecordSchema = z.object({
  n: z.number().int().min(0),
  at: z.iso.datetime(),
  action: boundedTextSchema.min(1),
  outcome: boundedTextSchema.min(1),
  summary: boundedTextSchema,
}).strict()

export const loopStateSchema = z.object({
  version: z.literal(LOOP_STATE_VERSION),
  slug: z.string().refine(isValidTaskSlug, "must be a valid task slug"),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  goal: z.literal(LOOP_GOAL),
  definition_of_done: z.literal(LOOP_DEFINITION_OF_DONE),
  iteration: z.number().int().min(0),
  max_iterations: z.number().int().min(1),
  no_progress_window: z.number().int().min(1),
  no_progress_streak: z.number().int().min(0),
  terminal: loopTerminalSchema.nullable(),
  blocker: loopBlockerSchema.nullable(),
  progress: loopProgressSchema,
  feedback: loopFeedbackSchema,
  iterations: z.array(loopIterationRecordSchema).max(MAX_LOOP_ITERATION_HISTORY),
}).strict()

export type LoopState = z.infer<typeof loopStateSchema>
export type LoopBlocker = z.infer<typeof loopBlockerSchema>
export type LoopProgress = z.infer<typeof loopProgressSchema>
export type LoopFeedback = z.infer<typeof loopFeedbackSchema>
export type LoopIterationRecord = z.infer<typeof loopIterationRecordSchema>

export class LoopStateError extends Error {
  constructor(
    message: string,
    readonly path: string,
    readonly issues: string[] = [],
  ) {
    super(message)
    this.name = "LoopStateError"
  }
}

export interface LoopPaths {
  directory: string
  statePath: string
  iterationsDirectory: string
}

export interface BootstrapLoopStateInput {
  slug: string
  maxIterations?: number
  noProgressWindow?: number
  now?: Date
}

/**
 * Non-mutating. Returns ledger paths without creating directories or files.
 */
export function describeLoopPaths(packetDirectory: string): LoopPaths {
  const directory = join(packetDirectory, "loop")
  return {
    directory,
    statePath: join(directory, "state.json"),
    iterationsDirectory: join(directory, "iterations"),
  }
}

export function loopIterationSummaryPath(packetDirectory: string, n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`iteration summary index must be a non-negative integer: ${n}`)
  }
  return join(describeLoopPaths(packetDirectory).iterationsDirectory, `${String(n).padStart(3, "0")}.md`)
}

export function createBootstrapLoopState(input: BootstrapLoopStateInput): LoopState {
  const now = (input.now ?? new Date()).toISOString()
  return parseLoopState({
    version: LOOP_STATE_VERSION,
    slug: input.slug,
    created_at: now,
    updated_at: now,
    goal: LOOP_GOAL,
    definition_of_done: LOOP_DEFINITION_OF_DONE,
    iteration: 0,
    max_iterations: input.maxIterations ?? DEFAULT_MAX_ITERATIONS,
    no_progress_window: input.noProgressWindow ?? DEFAULT_NO_PROGRESS_WINDOW,
    no_progress_streak: 0,
    terminal: null,
    blocker: null,
    progress: {
      completed: [],
      failed: [],
      blocked: [],
      pending: [],
    },
    feedback: {
      previous_outcome: "",
      route_causes: [],
      last_failed_task_ids: [],
    },
    iterations: [],
  })
}

export function parseLoopState(value: unknown, path = "loop/state.json"): LoopState {
  const result = loopStateSchema.safeParse(value)
  if (result.success) return result.data
  const issues = result.error.issues.map((issue) => {
    const issuePath = issue.path.length > 0 ? issue.path.join(".") : "ledger"
    return `${issuePath}: ${issue.message}`
  })
  throw new LoopStateError(`invalid loop ledger ${path}: ${issues.join("; ")}`, path, issues)
}

export async function loadLoopState(packetDirectory: string): Promise<LoopState> {
  const { statePath } = describeLoopPaths(packetDirectory)
  let raw: string
  try {
    raw = await readFile(statePath, "utf8")
  } catch (error) {
    if (isMissingPath(error)) {
      throw new LoopStateError(`missing loop ledger ${statePath}`, statePath, [errorMessage(error)])
    }
    throw new LoopStateError(
      `unreadable loop ledger ${statePath}: ${errorMessage(error)}`,
      statePath,
      [errorMessage(error)],
    )
  }

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (error) {
    throw new LoopStateError(
      `invalid JSON in loop ledger ${statePath}: ${errorMessage(error)}`,
      statePath,
      [errorMessage(error)],
    )
  }

  return parseLoopState(value, statePath)
}

export async function initLoopState(packetDirectory: string, input: BootstrapLoopStateInput): Promise<LoopState> {
  const { statePath } = describeLoopPaths(packetDirectory)
  try {
    return await loadLoopState(packetDirectory)
  } catch (error) {
    if (error instanceof LoopStateError && error.message.startsWith("missing loop ledger")) {
      const state = createBootstrapLoopState(input)
      await writeLoopState(packetDirectory, state)
      return state
    }
    throw new LoopStateError(
      `refusing to init over invalid loop ledger ${statePath}: ${error instanceof Error ? error.message : String(error)}`,
      statePath,
      error instanceof LoopStateError ? error.issues : [String(error)],
    )
  }
}

export async function resetLoopState(packetDirectory: string, input: BootstrapLoopStateInput): Promise<LoopState> {
  const state = createBootstrapLoopState(input)
  await writeLoopState(packetDirectory, state)
  return state
}

export async function writeLoopState(packetDirectory: string, state: LoopState): Promise<void> {
  const parsed = parseLoopState(state)
  const paths = describeLoopPaths(packetDirectory)
  await mkdir(paths.directory, { recursive: true })
  const payload = `${JSON.stringify(parsed, null, 2)}\n`
  const tempPath = join(paths.directory, `state.json.${process.pid}.${Date.now()}.${randomBytes(4).toString("hex")}.tmp`)
  try {
    await writeFile(tempPath, payload, { encoding: "utf8", flag: "wx" })
    await rename(tempPath, paths.statePath)
  } catch (error) {
    await unlink(tempPath).catch(() => undefined)
    throw new LoopStateError(
      `failed to write loop ledger ${paths.statePath}: ${errorMessage(error)}`,
      paths.statePath,
      [errorMessage(error)],
    )
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isMissingPath(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT"
}
