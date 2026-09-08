import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"

export const TDD_OPT_IN_FILENAME = "tdd.json"
export const TDD_OPT_IN_VERSION = 1

export type ExecutionPath = "tdd" | "core"

const TASK_ID_PATTERN = /^task_\d+$/

const tddOptInSchema = z.object({
  version: z.literal(TDD_OPT_IN_VERSION),
  packet: z.literal("tdd").optional(),
  tasks: z.array(z.string().regex(TASK_ID_PATTERN, "must be a task_NN id")).optional(),
}).strict().superRefine((document, context) => {
  if (document.tasks === undefined) return
  const seen = new Set<string>()
  for (const [index, id] of document.tasks.entries()) {
    if (seen.has(id)) {
      context.addIssue({
        code: "custom",
        path: ["tasks", index],
        message: `duplicate task id ${id}`,
      })
    }
    seen.add(id)
  }
})

export type TddOptInDocument = z.infer<typeof tddOptInSchema>

export class TddOptInError extends Error {
  constructor(
    message: string,
    readonly path: string,
    readonly issues: string[] = [],
  ) {
    super(message)
    this.name = "TddOptInError"
  }
}

export function parseTddOptIn(value: unknown, path = TDD_OPT_IN_FILENAME): TddOptInDocument {
  const result = tddOptInSchema.safeParse(value)
  if (result.success) return result.data
  throw tddOptInError(path, result.error.issues.map((issue) => {
    const issuePath = issue.path.length > 0 ? issue.path.join(".") : TDD_OPT_IN_FILENAME
    return `${issuePath}: ${issue.message}`
  }))
}

export async function loadTddOptIn(
  packetDirectory: string,
  taskIds: readonly string[],
): Promise<TddOptInDocument | undefined> {
  const path = join(packetDirectory, TDD_OPT_IN_FILENAME)
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch (error) {
    if (isMissingPath(error)) return undefined
    throw tddOptInError(path, [`unreadable: ${errorMessage(error)}`])
  }

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (error) {
    throw tddOptInError(path, [`invalid JSON: ${errorMessage(error)}`])
  }

  const document = parseTddOptIn(value, path)
  const unknownIds = unknownTaskIds(document, taskIds)
  if (unknownIds.length > 0) {
    throw tddOptInError(path, unknownIds.map((id) => `tasks: unknown task id ${id}`))
  }
  return document
}

export function resolveTddPath(document: TddOptInDocument | undefined, taskId: string): ExecutionPath {
  if (document?.packet === "tdd") return "tdd"
  if (document?.tasks?.includes(taskId)) return "tdd"
  return "core"
}

function unknownTaskIds(document: TddOptInDocument, taskIds: readonly string[]): string[] {
  if (document.tasks === undefined) return []
  const known = new Set(taskIds)
  return document.tasks.filter((id) => !known.has(id))
}

function tddOptInError(path: string, issues: string[]): TddOptInError {
  return new TddOptInError(`invalid ${TDD_OPT_IN_FILENAME}: ${issues.join("; ")}`, path, issues)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isMissingPath(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT"
}
