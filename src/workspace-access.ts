import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path"
import type { WorkspaceAccess, WriteAuthorizer } from "./acp-turn.ts"

export type { WorkspaceAccess, WriteAuthorizer } from "./acp-turn.ts"

export type WorkspacePathErrorCode =
  | "invalid-workspace"
  | "relative-path"
  | "path-traversal"
  | "path-escapes-workspace"
  | "nul-byte"
  | "symlink-component"
  | "canonical-escape"
  | "missing-component"
  | "unsafe-ancestor"
  | "indeterminate-path"
  | "missing-authorizer"
  | "target-is-directory"

/** A named, fail-closed error for an unsafe or indeterminate host path. */
export class WorkspaceAccessError extends Error {
  readonly code: WorkspacePathErrorCode
  readonly path: string

  constructor(code: WorkspacePathErrorCode, path: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "WorkspaceAccessError"
    this.code = code
    this.path = path
  }
}

interface PathInspection {
  target: string
  relativePath: string
  components: string[]
  missingAt: number | null
  deepestExisting: string
  targetExists: boolean
  targetIsDirectory: boolean
}

interface CanonicalWorkspace {
  lexical: string
  real: string
}

/**
 * Owns canonical, workspace-contained ACP filesystem operations.
 *
 * The capability intentionally returns file content or no result; it never
 * hands callers a path that was validated separately from the operation that
 * uses it. The accepted V1 residual risk is a hostile same-user pathname swap
 * between the final validation and the underlying filesystem syscall.
 */
export class CanonicalWorkspaceAccess implements WorkspaceAccess {
  readonly #workspace: string

  constructor(workspace: string) {
    if (!isAbsolute(workspace)) {
      throw new WorkspaceAccessError("invalid-workspace", workspace, "workspace must be absolute")
    }
    this.#workspace = resolve(workspace)
  }

  /** Return a normalized relative identity after canonical validation. */
  async workspaceRelativePath(absolutePath: string): Promise<string> {
    const workspace = await inspectWorkspace(this.#workspace)
    const target = validateLexicalPath(workspace.lexical, absolutePath)
    await inspectTarget(workspace, target, true)
    const identity = relativeIdentity(workspace.lexical, target)
    if (!identity) throw new WorkspaceAccessError("unsafe-ancestor", target, "workspace root is not a file identity")
    return identity
  }

  async readTextFile(absolutePath: string): Promise<string> {
    const workspace = await inspectWorkspace(this.#workspace)
    const target = validateLexicalPath(workspace.lexical, absolutePath)
    const initial = await inspectTarget(workspace, target, false)
    if (initial.targetIsDirectory) {
      throw new WorkspaceAccessError("target-is-directory", target, "read target is a directory")
    }
    // Revalidate immediately before the host read so an ancestor that became
    // a symlink is refused rather than followed by readFile.
    await inspectTarget(workspace, target, false)
    return readFile(target, "utf8")
  }

  async writeTextFile(absolutePath: string, content: string, authorize: WriteAuthorizer): Promise<void> {
    if (typeof authorize !== "function") {
      throw new WorkspaceAccessError("missing-authorizer", absolutePath, "write authorization is required")
    }

    const workspace = await inspectWorkspace(this.#workspace)
    const target = validateLexicalPath(workspace.lexical, absolutePath)
    const initial = await inspectTarget(workspace, target, true)
    if (initial.targetIsDirectory) {
      throw new WorkspaceAccessError("target-is-directory", target, "write target is a directory")
    }
    const identity = relativeIdentity(workspace.lexical, target)
    if (!identity) throw new WorkspaceAccessError("unsafe-ancestor", target, "workspace root is not a file target")

    // Authorization runs only after the path has a safe, normalized identity.
    // The neutral contract receives the checked absolute path; callers may
    // derive the relative identity through workspaceRelativePath when needed.
    await authorize(target)

    // This is the immediate pre-mutation parent revalidation required by
    // ADR-003. No mkdir or write occurs before this check succeeds.
    await validateExistingDirectory(workspace, initial.deepestExisting)

    if (initial.missingAt !== null) {
      const directoryComponents = initial.components.slice(initial.missingAt, -1)
      let cursor = initial.deepestExisting
      for (const component of directoryComponents) {
        cursor = join(cursor, component)
        await createAndValidateDirectory(workspace, cursor)
      }
    }

    const parent = dirname(target)
    await validateExistingDirectory(workspace, parent)
    await validateFinalTarget(workspace, target)
    await writeFile(target, content, "utf8")
  }
}

/** Factory used by later exec orchestration without exposing mutable paths. */
export function createWorkspaceAccess(workspace: string): CanonicalWorkspaceAccess {
  return new CanonicalWorkspaceAccess(workspace)
}

/** Descriptive alias for consumers that want to name the canonical boundary. */
export const createCanonicalWorkspaceAccess = createWorkspaceAccess

/**
 * Normalize an already validated absolute path to a workspace-relative
 * identity. This helper is lexical by design; host operations must still go
 * through CanonicalWorkspaceAccess for symlink and realpath validation.
 */
export function normalizeWorkspaceRelativePath(workspace: string, absolutePath: string): string {
  if (!isAbsolute(workspace)) throw new WorkspaceAccessError("invalid-workspace", workspace, "workspace must be absolute")
  const root = resolve(workspace)
  const target = validateLexicalPath(root, absolutePath)
  return relativeIdentity(root, target)
}

async function inspectWorkspace(workspace: string): Promise<CanonicalWorkspace> {
  let status
  try {
    status = await lstat(workspace)
  } catch (error) {
    throw new WorkspaceAccessError("invalid-workspace", workspace, "workspace cannot be inspected", { cause: error })
  }
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new WorkspaceAccessError("invalid-workspace", workspace, "workspace must be a real directory")
  }

  let real: string
  try {
    real = await realpath(workspace)
  } catch (error) {
    throw new WorkspaceAccessError("invalid-workspace", workspace, "workspace cannot be canonicalized", { cause: error })
  }
  return { lexical: workspace, real }
}

function validateLexicalPath(workspace: string, candidate: string): string {
  if (!isAbsolute(candidate)) {
    throw new WorkspaceAccessError("relative-path", candidate, "ACP filesystem paths must be absolute")
  }
  if (candidate.includes("\0")) {
    throw new WorkspaceAccessError("nul-byte", candidate, "ACP filesystem paths cannot contain NUL bytes")
  }
  if (hasPathAlias(candidate)) {
    throw new WorkspaceAccessError("path-traversal", candidate, "ACP filesystem paths cannot contain traversal or alias segments")
  }

  const target = resolve(candidate)
  const offset = relative(workspace, target)
  if (offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
    throw new WorkspaceAccessError("path-escapes-workspace", candidate, "path escapes canonical workspace")
  }
  return target
}

async function inspectTarget(workspace: CanonicalWorkspace, target: string, allowMissing: boolean): Promise<PathInspection> {
  const relativePath = relative(workspace.lexical, target)
  const components = relativePath ? relativePath.split(sep).filter(Boolean) : []
  let cursor = workspace.lexical
  let deepestExisting = workspace.lexical

  for (let index = 0; index < components.length; index += 1) {
    const component = components[index]
    if (!component) continue
    cursor = join(cursor, component)

    let status
    try {
      status = await lstat(cursor)
    } catch (error) {
      if (isMissingPath(error) && allowMissing) {
        return {
          target,
          relativePath,
          components,
          missingAt: index,
          deepestExisting,
          targetExists: false,
          targetIsDirectory: false,
        }
      }
      if (isMissingPath(error)) {
        throw new WorkspaceAccessError("missing-component", cursor, "path component does not exist", { cause: error })
      }
      throw new WorkspaceAccessError("indeterminate-path", cursor, "path component cannot be validated", { cause: error })
    }

    if (status.isSymbolicLink()) {
      throw new WorkspaceAccessError("symlink-component", cursor, "path contains a symlink component")
    }
    if (index < components.length - 1 && !status.isDirectory()) {
      throw new WorkspaceAccessError("unsafe-ancestor", cursor, "path ancestor is not a directory")
    }
    await validateCanonicalComponent(workspace, cursor)
    deepestExisting = cursor
  }

  return {
    target,
    relativePath,
    components,
    missingAt: null,
    deepestExisting: components.length > 0 ? dirname(target) : workspace.lexical,
    targetExists: true,
    targetIsDirectory: components.length > 0
      ? (await lstat(target)).isDirectory()
      : true,
  }
}

async function validateCanonicalComponent(workspace: CanonicalWorkspace, path: string): Promise<void> {
  let canonical: string
  try {
    canonical = await realpath(path)
  } catch (error) {
    throw new WorkspaceAccessError("indeterminate-path", path, "path component cannot be canonicalized", { cause: error })
  }
  if (!isContained(workspace.real, canonical)) {
    throw new WorkspaceAccessError("canonical-escape", path, "canonical path escapes workspace")
  }
}

async function validateExistingDirectory(workspace: CanonicalWorkspace, path: string): Promise<void> {
  let status
  try {
    status = await lstat(path)
  } catch (error) {
    throw new WorkspaceAccessError("indeterminate-path", path, "write parent cannot be revalidated", { cause: error })
  }
  if (status.isSymbolicLink()) throw new WorkspaceAccessError("symlink-component", path, "write parent contains a symlink")
  if (!status.isDirectory()) throw new WorkspaceAccessError("unsafe-ancestor", path, "write parent is not a directory")
  await validateCanonicalComponent(workspace, path)
}

async function createAndValidateDirectory(workspace: CanonicalWorkspace, path: string): Promise<void> {
  try {
    await mkdir(path)
  } catch (error) {
    if (!isAlreadyExists(error)) {
      throw new WorkspaceAccessError("indeterminate-path", path, "unable to create workspace directory", { cause: error })
    }
  }
  await validateExistingDirectory(workspace, path)
}

async function validateFinalTarget(workspace: CanonicalWorkspace, target: string): Promise<void> {
  try {
    const status = await lstat(target)
    if (status.isSymbolicLink()) throw new WorkspaceAccessError("symlink-component", target, "write target is a symlink")
    await validateCanonicalComponent(workspace, target)
    if (status.isDirectory()) throw new WorkspaceAccessError("target-is-directory", target, "write target is a directory")
  } catch (error) {
    if (error instanceof WorkspaceAccessError) throw error
    if (isMissingPath(error)) return
    throw new WorkspaceAccessError("indeterminate-path", target, "write target cannot be validated", { cause: error })
  }
}

function relativeIdentity(workspace: string, target: string): string {
  const offset = relative(workspace, target)
  return offset.split(sep).filter(Boolean).join("/")
}

function hasPathAlias(candidate: string): boolean {
  if (candidate.split(/[\\/]/u).some((component) => component === "." || component === "..")) return true
  const root = parse(candidate).root
  const remainder = candidate.slice(root.length)
  return /[\\/]{2,}/u.test(remainder) || (candidate.length > root.length && /[\\/]$/u.test(candidate))
}

function isContained(root: string, candidate: string): boolean {
  const offset = relative(root, candidate)
  return offset === "" || (offset !== ".." && !offset.startsWith(`..${sep}`) && !isAbsolute(offset))
}

function isMissingPath(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT"
}

function isAlreadyExists(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "EEXIST"
}
