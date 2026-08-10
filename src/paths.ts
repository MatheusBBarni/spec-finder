import { access, lstat, realpath } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
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

/**
 * Resolve the workspace used by the packet-free exec path.
 *
 * This deliberately does not consult configuration or the Git root. The
 * invocation directory is canonicalized first, then the nearest real
 * `.spec-finder` marker is selected. Symlink markers are ignored so a
 * repository cannot redirect the exec boundary through a marker alias.
 */
export async function findExecWorkspace(start = process.cwd()): Promise<string> {
  const canonicalStart = await canonicalInvocationDirectory(start)
  let cursor = canonicalStart

  for (;;) {
    if (await hasRealSpecMarker(cursor)) return cursor
    const parent = dirname(cursor)
    if (parent === cursor) return canonicalStart
    cursor = parent
  }
}

/** Alias for callers that want the canonical nature of exec discovery explicit. */
export const findCanonicalWorkspace = findExecWorkspace

/** Alias retained for the exec configuration resolver's descriptive naming. */
export const resolveExecWorkspace = findExecWorkspace

async function canonicalInvocationDirectory(start: string): Promise<string> {
  const candidate = resolve(start)
  try {
    const status = await lstat(candidate)
    if (!status.isDirectory() && !status.isSymbolicLink()) {
      throw new Error(`exec workspace start is not a directory: ${candidate}`)
    }
    const canonical = await realpath(candidate)
    const canonicalStatus = await lstat(canonical)
    if (!canonicalStatus.isDirectory()) throw new Error(`exec workspace start is not a directory: ${candidate}`)
    return canonical
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("exec workspace start is")) throw error
    throw new Error(`unable to canonicalize exec workspace start: ${candidate}`, { cause: error })
  }
}

async function hasRealSpecMarker(directory: string): Promise<boolean> {
  const marker = join(directory, SPEC_DIR)
  try {
    const status = await lstat(marker)
    return !status.isSymbolicLink() && status.isDirectory()
  } catch (error) {
    if (isMissingPath(error)) return false
    throw new Error(`unable to inspect exec workspace marker: ${marker}`, { cause: error })
  }
}

function isMissingPath(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT"
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

/**
 * Convert an existing workspace artifact into a canonical, safe relative
 * reference. Any filesystem or containment uncertainty omits the optional
 * reference instead of turning a validated task into a failure.
 */
export async function resolveWorkspaceRelativeReference(
  root: string,
  candidate: string,
): Promise<string | undefined> {
  if (candidate.trim().length === 0 || containsPathControl(candidate) || isWindowsAbsolutePath(candidate)) return undefined

  try {
    const canonicalRoot = await realpath(root)
    const targetInput = isAbsolute(candidate) ? candidate : resolve(canonicalRoot, candidate)
    const canonicalTarget = await realpath(targetInput)
    const offset = relative(canonicalRoot, canonicalTarget)
    if (offset.length === 0 || isAbsolute(offset) || isWindowsAbsolutePath(offset) || containsPathControl(offset)) return undefined

    const reference = offset.split(sep).join("/")
    if (reference.length === 0
      || reference.startsWith("/")
      || isWindowsAbsolutePath(reference)
      || containsPathControl(reference)) return undefined
    if (reference.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
      return undefined
    }
    return reference
  } catch {
    return undefined
  }
}

function containsPathControl(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value)
}

function isWindowsAbsolutePath(value: string): boolean {
  return /^[a-z]:[\\/]/i.test(value) || value.startsWith("\\\\")
}
