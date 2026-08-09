import { createHash, randomUUID } from "node:crypto"
import { lstat, mkdir, readFile, readdir, realpath, rename, rmdir, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const OWNER_FILE = "owner.json"
const INITIALIZING_GRACE_MS = 5_000

interface RunLockOwner {
  pid: number
  root: string
  started_at: string
  token: string
}

export interface RunLease {
  release(): Promise<void>
}

export interface RunLockOptions {
  directory?: string
  pid?: number
}

/**
 * Serializes task runners per workspace without adding worktree-visible files.
 * Crashed owners are recovered on the next acquisition.
 */
export async function acquireRunLock(root: string, options: RunLockOptions = {}): Promise<RunLease> {
  const canonicalRoot = await canonicalizeRoot(root)
  const base = options.directory ?? join(tmpdir(), "spec-finder-run-locks")
  const key = createHash("sha256").update(canonicalRoot).digest("hex")
  const lockPath = join(base, key)
  const ownerPath = join(lockPath, OWNER_FILE)
  const owner: RunLockOwner = {
    pid: options.pid ?? process.pid,
    root: canonicalRoot,
    started_at: new Date().toISOString(),
    token: randomUUID(),
  }
  await mkdir(base, { recursive: true, mode: 0o700 })

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await mkdir(lockPath, { mode: 0o700 })
      try {
        await writeFile(ownerPath, `${JSON.stringify(owner)}\n`, { mode: 0o600 })
      } catch (error) {
        await removeIncompleteLock(lockPath, ownerPath)
        throw error
      }
      return {
        release: () => releaseOwnedLock(lockPath, owner),
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      const existing = await readOwner(ownerPath)
      if (existing !== undefined && processIsAlive(existing.pid)) {
        throw new Error(
          `another Spec Finder run is active for ${canonicalRoot} (PID ${existing.pid}); wait for it to finish or stop it before starting another run`,
        )
      }
      if (existing === undefined && await lockIsInitializing(lockPath)) {
        throw new Error(`another Spec Finder run is initializing for ${canonicalRoot}; retry after it starts or exits`)
      }
      await quarantineStaleLock(lockPath)
    }
  }

  throw new Error(`could not acquire the Spec Finder run lock for ${canonicalRoot}`)
}

async function canonicalizeRoot(root: string): Promise<string> {
  const absolute = resolve(root)
  try {
    return await realpath(absolute)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return absolute
    throw error
  }
}

async function readOwner(path: string): Promise<RunLockOwner | undefined> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<RunLockOwner>
    if (
      typeof parsed.pid !== "number"
      || !Number.isSafeInteger(parsed.pid)
      || parsed.pid <= 0
      || typeof parsed.root !== "string"
      || typeof parsed.started_at !== "string"
      || typeof parsed.token !== "string"
    ) return undefined
    return parsed as RunLockOwner
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENOENT" || error instanceof SyntaxError) return undefined
    throw error
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH"
  }
}

async function lockIsInitializing(path: string): Promise<boolean> {
  try {
    const metadata = await lstat(path)
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error(`unsafe Spec Finder run lock entry: ${path}`)
    }
    return Date.now() - metadata.mtimeMs < INITIALIZING_GRACE_MS
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

async function quarantineStaleLock(path: string): Promise<void> {
  const quarantine = `${path}.stale-${randomUUID()}`
  try {
    await rename(path, quarantine)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    throw error
  }
  const entries = await readdir(quarantine)
  if (entries.some((entry) => entry !== OWNER_FILE)) {
    throw new Error(`stale Spec Finder run lock contains unexpected files: ${quarantine}`)
  }
  if (entries.includes(OWNER_FILE)) await unlink(join(quarantine, OWNER_FILE))
  await rmdir(quarantine)
}

async function removeIncompleteLock(lockPath: string, ownerPath: string): Promise<void> {
  try {
    await unlink(ownerPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  try {
    await rmdir(lockPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
}

async function releaseOwnedLock(path: string, owner: RunLockOwner): Promise<void> {
  const current = await readOwner(join(path, OWNER_FILE))
  if (current?.token !== owner.token) return
  await unlink(join(path, OWNER_FILE))
  await rmdir(path)
}
