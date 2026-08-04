import { access } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const SPEC_DIR = ".spec-finder"
export const TASKS_DIR = "tasks"
export const CONFIG_FILE = "config.json"

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function findWorkspaceRoot(start = process.cwd()): Promise<string> {
  let cursor = resolve(start)
  for (;;) {
    if (await exists(join(cursor, SPEC_DIR))) return cursor
    const parent = dirname(cursor)
    if (parent === cursor) return resolve(start)
    cursor = parent
  }
}

export function specPath(root: string, ...parts: string[]): string {
  return join(root, SPEC_DIR, ...parts)
}

export function bundledSkillsPath(): string {
  return fileURLToPath(new URL("../skills", import.meta.url))
}

export function assertInsideWorkspace(root: string, candidate: string): string {
  const workspace = resolve(root)
  const target = isAbsolute(candidate) ? resolve(candidate) : resolve(workspace, candidate)
  const offset = relative(workspace, target)
  if (offset === ".." || offset.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(offset)) {
    throw new Error(`path escapes workspace: ${candidate}`)
  }
  return target
}
