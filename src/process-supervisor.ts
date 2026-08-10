import { spawn, type ChildProcess, type ChildProcessWithoutNullStreams } from "node:child_process"
import { Readable, Writable } from "node:stream"
import type {
  CleanupResult,
  ProcessExit,
  ProcessSupervisor as ProcessSupervisorContract,
  ProviderLaunch,
  SupervisedProcess,
} from "./acp-turn.ts"

export type ProcessFailureStage = "spawn" | "process" | "pipe" | "cleanup"

/**
 * A typed failure at the process boundary. Spawn failures reject `spawn`; the
 * remaining stages are represented on the supervised process or cleanup
 * result so callers can still observe terminal closure.
 */
export class ProcessSupervisorError extends Error {
  readonly stage: ProcessFailureStage
  readonly cause?: unknown

  constructor(stage: ProcessFailureStage, message: string, cause?: unknown) {
    super(message)
    this.name = "ProcessSupervisorError"
    this.stage = stage
    this.cause = cause
  }
}

export interface TaskkillResult {
  code: number | null
  signal: string | null
  error?: string
}

export interface ProcessSupervisorOptions {
  /** Override the host platform for deterministic branch tests. */
  platform?: NodeJS.Platform
  /** Inject the child launcher; production uses node:child_process.spawn. */
  spawnProcess?: typeof spawn
  /** Inject Windows taskkill; production executes it without a shell. */
  taskkill?: (pid: number, deadline: number) => Promise<TaskkillResult>
  /** Inject a monotonic-ish clock for deadline tests. */
  now?: () => number
  /** Inject sleeping for deterministic bounded command tests. */
  sleep?: (milliseconds: number) => Promise<void>
  /** Grace between POSIX TERM and KILL. */
  termGraceMs?: number
  /** Poll cadence while confirming process and pipe closure. */
  pollIntervalMs?: number
  /** Optional tree probe; true means every descendant is confirmed gone. */
  treeProbe?: (pid: number, descendantPids: readonly number[]) => Promise<boolean>
}

export interface SupervisedProcessHandle extends SupervisedProcess {
  /** Record fixture-observed descendants that must also be gone at cleanup. */
  trackDescendant(pid: number): void
  /** Current best-known cleanup state for diagnostics and tests. */
  readonly cleanupState: CleanupResult["state"]
  /** Resolves after closure with the non-spawn process or pipe stage, if any. */
  readonly failure: Promise<ProcessSupervisorError | undefined>
  /** Request immediate escalation when a second cancellation arrives. */
  forceCleanup(): Promise<CleanupResult>
}

const DEFAULT_TERM_GRACE_MS = 1_500
const DEFAULT_POLL_INTERVAL_MS = 20
const DEFAULT_CLEANUP_DEADLINE_MS = 5_000

export const PROCESS_CLEANUP_DEADLINE_MS = DEFAULT_CLEANUP_DEADLINE_MS

/** Build the documented Windows tree-termination argv without interpolation. */
export function buildTaskkillArgs(pid: number): readonly string[] {
  return ["/PID", String(pid), "/T", "/F"]
}

/**
 * Concrete process supervisor used by the neutral ACP lifecycle. It performs
 * no shell expansion and keeps all child processes in an isolated POSIX
 * process group when the host supports groups.
 */
export class NodeProcessSupervisor implements ProcessSupervisorContract {
  private readonly platform: NodeJS.Platform
  private readonly spawnProcess: typeof spawn
  private readonly taskkill: ((pid: number, deadline: number) => Promise<TaskkillResult>) | undefined
  private readonly now: () => number
  private readonly sleep: (milliseconds: number) => Promise<void>
  private readonly termGraceMs: number
  private readonly pollIntervalMs: number
  private readonly treeProbe: ((pid: number, descendantPids: readonly number[]) => Promise<boolean>) | undefined

  constructor(options: ProcessSupervisorOptions = {}) {
    this.platform = options.platform ?? process.platform
    this.spawnProcess = options.spawnProcess ?? spawn
    this.taskkill = options.taskkill
    this.now = options.now ?? Date.now
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
    this.termGraceMs = Math.max(0, options.termGraceMs ?? DEFAULT_TERM_GRACE_MS)
    this.pollIntervalMs = Math.max(1, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
    this.treeProbe = options.treeProbe
  }

  async spawn(spec: ProviderLaunch): Promise<SupervisedProcessHandle> {
    validateLaunchSpec(spec)
    const launch = this.spawnProcess
    const detached = this.platform !== "win32"
    let child: ChildProcess

    try {
      child = launch(spec.command, [...spec.args], {
        cwd: spec.cwd,
        env: { ...process.env, ...spec.env },
        shell: false,
        detached,
        windowsHide: this.platform === "win32",
        stdio: ["pipe", "pipe", "pipe"],
      })
    } catch (error) {
      throw new ProcessSupervisorError(
        "spawn",
        `unable to spawn provider ${spec.command}; verify it is installed and available on PATH`,
        error,
      )
    }

    const pid = child.pid
    if (pid === undefined || pid <= 0) {
      suppressChildError(child)
      throw new ProcessSupervisorError(
        "spawn",
        `unable to start provider ${spec.command}; verify it is installed and available on PATH`,
      )
    }

    let streams: ChildStreams
    try {
      streams = assertPipedStreams(child, spec.command)
    } catch (error) {
      suppressChildError(child)
      terminateAfterSetupFailure(child, this.platform)
      throw error
    }
    const lifecycle = observeLifecycle(child, streams, spec.command)
    const processHandle = new ManagedProcessHandle({
      child: child as ChildProcessWithoutNullStreams,
      pid,
      lifecycle,
      platform: this.platform,
      taskkill: this.taskkill ?? runTaskkill,
      now: this.now,
      sleep: this.sleep,
      termGraceMs: this.termGraceMs,
      pollIntervalMs: this.pollIntervalMs,
      treeProbe: this.treeProbe,
    })

    try {
      await lifecycle.spawned
    } catch (error) {
      await processHandle.cancelTree(this.now() + DEFAULT_CLEANUP_DEADLINE_MS)
      if (error instanceof ProcessSupervisorError) throw error
      throw new ProcessSupervisorError("spawn", `unable to start provider ${spec.command}`, error)
    }

    return processHandle
  }
}

/** Factory used by later ACP adapters and by focused fixture tests. */
export function createProcessSupervisor(options: ProcessSupervisorOptions = {}): NodeProcessSupervisor {
  return new NodeProcessSupervisor(options)
}

/** Compatibility alias for callers that name the implementation explicitly. */
export const ProcessSupervisorImpl = NodeProcessSupervisor

interface ChildStreams {
  stdin: NonNullable<ChildProcess["stdin"]>
  stdout: NonNullable<ChildProcess["stdout"]>
  stderr: NonNullable<ChildProcess["stderr"]>
}

interface ChildLifecycle {
  readonly spawned: Promise<void>
  readonly closed: Promise<ProcessExit>
  readonly isClosed: () => boolean
  readonly isFullyClosed: () => boolean
  readonly hasPipeFailure: () => boolean
  readonly pipeFailureMessage: () => string | undefined
  readonly failure: Promise<ProcessSupervisorError | undefined>
}

interface ManagedProcessOptions {
  child: ChildProcessWithoutNullStreams
  pid: number
  lifecycle: ChildLifecycle
  platform: NodeJS.Platform
  taskkill: (pid: number, deadline: number) => Promise<TaskkillResult>
  now: () => number
  sleep: (milliseconds: number) => Promise<void>
  termGraceMs: number
  pollIntervalMs: number
  treeProbe: ((pid: number, descendantPids: readonly number[]) => Promise<boolean>) | undefined
}

class ManagedProcessHandle implements SupervisedProcessHandle {
  readonly pid: number
  readonly closed: Promise<ProcessExit>
  readonly stdin: WritableStream<Uint8Array>
  readonly stdout: ReadableStream<Uint8Array>
  readonly stderr: ReadableStream<Uint8Array>
  readonly failure: Promise<ProcessSupervisorError | undefined>

  private readonly child: ChildProcessWithoutNullStreams
  private readonly lifecycle: ChildLifecycle
  private readonly platform: NodeJS.Platform
  private readonly taskkill: (pid: number, deadline: number) => Promise<TaskkillResult>
  private readonly now: () => number
  private readonly sleep: (milliseconds: number) => Promise<void>
  private readonly termGraceMs: number
  private readonly pollIntervalMs: number
  private readonly treeProbe: ((pid: number, descendantPids: readonly number[]) => Promise<boolean>) | undefined
  private readonly descendants = new Set<number>()
  private readonly forced: Promise<void>
  private forceResolve!: () => void
  private cleanupPromise: Promise<CleanupResult> | undefined
  private cleanupSettled = false
  private forceRequested = false
  private currentCleanupState: CleanupResult["state"] = "requested"

  constructor(options: ManagedProcessOptions) {
    this.pid = options.pid
    this.child = options.child
    this.lifecycle = options.lifecycle
    this.platform = options.platform
    this.taskkill = options.taskkill
    this.now = options.now
    this.sleep = options.sleep
    this.termGraceMs = options.termGraceMs
    this.pollIntervalMs = options.pollIntervalMs
    this.treeProbe = options.treeProbe
    this.closed = options.lifecycle.closed
    this.failure = options.lifecycle.failure
    this.forced = new Promise((resolve) => { this.forceResolve = resolve })

    try {
      this.stdin = Writable.toWeb(options.child.stdin) as unknown as WritableStream<Uint8Array>
      this.stdout = Readable.toWeb(options.child.stdout) as unknown as ReadableStream<Uint8Array>
      this.stderr = Readable.toWeb(options.child.stderr) as unknown as ReadableStream<Uint8Array>
    } catch (error) {
      throw new ProcessSupervisorError("pipe", "unable to expose provider stdio pipes", error)
    }
  }

  get cleanupState(): CleanupResult["state"] {
    return this.currentCleanupState
  }

  trackDescendant(pid: number): void {
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) this.descendants.add(pid)
  }

  cancelTree(deadlineMs: number): Promise<CleanupResult> {
    if (this.cleanupPromise !== undefined) {
      if (!this.cleanupSettled) this.requestForce()
      return this.cleanupPromise
    }
    this.cleanupPromise = this.cleanupTree(resolveDeadline(this.now(), deadlineMs)).finally(() => {
      this.cleanupSettled = true
    })
    return this.cleanupPromise
  }

  forceCleanup(): Promise<CleanupResult> {
    if (this.cleanupPromise === undefined) {
      this.requestForce()
      return this.cancelTree(0)
    }
    this.requestForce()
    return this.cleanupPromise
  }

  private requestForce(): void {
    if (this.forceRequested) return
    this.forceRequested = true
    this.forceResolve()
  }

  private async cleanupTree(deadline: number): Promise<CleanupResult> {
    this.currentCleanupState = "requested"
    if (await this.treeIsGone(deadline)) {
      return this.closedResult()
    }

    if (this.platform === "win32") return this.cleanupWindows(deadline)
    return this.cleanupPosix(deadline)
  }

  private async cleanupPosix(deadline: number): Promise<CleanupResult> {
    const termResult = signalPosixGroup(this.pid, "SIGTERM")
    if (termResult.error !== undefined) {
      this.currentCleanupState = "failed"
      return { state: "failed", error: termResult.error }
    }
    this.currentCleanupState = "signalled"

    const termDeadline = Math.min(deadline, this.now() + this.termGraceMs)
    if (await this.waitForTreeClosure(termDeadline)) return this.closedResult()

    const killResult = signalPosixGroup(this.pid, "SIGKILL")
    if (killResult.error !== undefined) {
      const fallback = signalPids([this.pid, ...this.descendants], "SIGKILL")
      if (fallback.error !== undefined) {
        this.currentCleanupState = "failed"
        return { state: "failed", error: `${killResult.error}; ${fallback.error}` }
      }
    }
    this.currentCleanupState = "signalled"
    if (await this.waitForTreeClosure(deadline, false)) return this.closedResult()
    return this.unconfirmedResult("provider process tree could not be confirmed closed")
  }

  private async cleanupWindows(deadline: number): Promise<CleanupResult> {
    let taskkillResult: TaskkillResult
    try {
      taskkillResult = await this.runBoundedTaskkill(deadline)
    } catch (error) {
      this.currentCleanupState = "failed"
      return { state: "failed", error: formatFailure("cleanup", "taskkill failed", error) }
    }
    this.currentCleanupState = "signalled"
    if (taskkillResult.error !== undefined) {
      this.currentCleanupState = "failed"
      return { state: "failed", error: taskkillResult.error }
    }
    if (await this.waitForTreeClosure(deadline, false)) return this.closedResult()
    if (this.now() >= deadline) return this.unconfirmedResult("Windows process tree could not be confirmed closed")
    return { state: "failed", error: `taskkill exited with ${taskkillResult.code ?? "unknown"}` }
  }

  private async waitForTreeClosure(deadline: number, interruptOnForce = true): Promise<boolean> {
    if (interruptOnForce && this.forceRequested) return false
    while (this.now() < deadline) {
      if (await this.treeIsGone(deadline)) return true
      const remaining = deadline - this.now()
      await Promise.race([
        this.closed.then(() => undefined),
        this.sleep(Math.min(this.pollIntervalMs, remaining)),
        interruptOnForce ? this.forced : new Promise<void>(() => {}),
      ])
      if (interruptOnForce && this.forceRequested) return false
    }
    return this.treeIsGone(deadline)
  }

  private async treeIsGone(deadline: number): Promise<boolean> {
    if (!this.lifecycle.isFullyClosed()) return false
    if (this.treeProbe !== undefined) {
      try {
        const remaining = Math.max(0, deadline - this.now())
        return await Promise.race([
          this.treeProbe(this.pid, [...this.descendants]),
          this.sleep(remaining).then(() => false),
        ])
      } catch {
        return false
      }
    }

    if (this.platform === "win32") {
      if (!(await allPidsGone([...this.descendants]))) return false
      return true
    }

    if (!(await allPidsGone([...this.descendants]))) return false
    return processGroupGone(this.pid)
  }

  private async runBoundedTaskkill(deadline: number): Promise<TaskkillResult> {
    const remaining = Math.max(0, deadline - this.now())
    return Promise.race([
      this.taskkill(this.pid, deadline),
      this.sleep(remaining).then(() => ({
        code: null,
        signal: null,
        error: "cleanup failure: taskkill exceeded cleanup deadline",
      })),
    ])
  }

  private async closedResult(): Promise<CleanupResult> {
    this.currentCleanupState = "closed"
    const exit = await this.closed
    if (this.lifecycle.hasPipeFailure()) {
      this.currentCleanupState = "failed"
      return { state: "failed", exit, error: this.lifecycle.pipeFailureMessage() ?? "provider stdio pipe failed" }
    }
    return { state: "closed", exit }
  }

  private async unconfirmedResult(error: string): Promise<CleanupResult> {
    this.currentCleanupState = "unconfirmed"
    const exit = await settledExit(this.closed)
    return exit === undefined ? { state: "unconfirmed", error } : { state: "unconfirmed", error, exit }
  }
}

function validateLaunchSpec(spec: ProviderLaunch): void {
  if (typeof spec.command !== "string" || spec.command.trim() === "") {
    throw new ProcessSupervisorError("spawn", "provider command must be non-empty")
  }
  if (!Array.isArray(spec.args)) throw new ProcessSupervisorError("spawn", "provider arguments must be an array")
  if (typeof spec.cwd !== "string" || spec.cwd.trim() === "") {
    throw new ProcessSupervisorError("spawn", "provider working directory must be non-empty")
  }
}

function assertPipedStreams(child: ChildProcess, command: string): ChildStreams {
  if (child.stdin === null || child.stdout === null || child.stderr === null) {
    throw new ProcessSupervisorError("pipe", `provider ${command} did not expose explicit stdio pipes`)
  }
  return { stdin: child.stdin, stdout: child.stdout, stderr: child.stderr }
}

function terminateAfterSetupFailure(child: ChildProcess, platform: NodeJS.Platform): void {
  const pid = child.pid
  if (pid === undefined || pid <= 1 || pid === process.pid) return
  try {
    if (platform === "win32") child.kill()
    else process.kill(-pid, "SIGKILL")
  } catch {
    // The spawn/pipe failure remains the authoritative result. There is no
    // second unbounded cleanup attempt during setup failure handling.
  }
}

function suppressChildError(child: ChildProcess): void {
  child.once("error", () => {})
}

function observeLifecycle(child: ChildProcess, streams: ChildStreams, command: string): ChildLifecycle {
  let closed = false
  let fullyClosed = false
  let pipeFailure: string | undefined
  let processFailure: ProcessSupervisorError | undefined
  let spawnedResolve!: () => void
  let spawnedReject!: (error: unknown) => void
  const spawned = new Promise<void>((resolve, reject) => {
    spawnedResolve = resolve
    spawnedReject = reject
  })
  const processExit = new Promise<ProcessExit>((resolve) => {
    const settle = (exit: ProcessExit) => {
      if (closed) return
      closed = true
      resolve(exit)
    }
    child.once("spawn", () => spawnedResolve())
    child.once("error", (error) => {
      if (!closed) {
        spawnedReject(new ProcessSupervisorError(
          "spawn",
          `unable to start provider ${command}; verify it is installed and available on PATH`,
          error,
        ))
      }
      processFailure ??= new ProcessSupervisorError("process", "provider process emitted an error", error)
      settle({ code: null, signal: null, error: formatFailure("process", "provider process error", error) })
    })
    child.once("close", (code, signal) => {
      const exit: ProcessExit = { code, signal: signal as string | null }
      if (code !== 0 || signal !== null) {
        exit.error = `provider process exited (${formatExit(code, signal)})`
        processFailure ??= new ProcessSupervisorError("process", exit.error)
      }
      settle(exit)
    })
  })
  const pipeClosed = Promise.all([
    observePipe(streams.stdin, "stdin", (message) => { pipeFailure ??= message }),
    observePipe(streams.stdout, "stdout", (message) => { pipeFailure ??= message }),
    observePipe(streams.stderr, "stderr", (message) => { pipeFailure ??= message }),
  ])
  const closedPromise = Promise.all([processExit, pipeClosed]).then(([exit]) => {
    fullyClosed = true
    if (pipeFailure === undefined) return exit
    return { ...exit, error: pipeFailure }
  })
  const failure = closedPromise.then(() => {
    if (pipeFailure !== undefined) return new ProcessSupervisorError("pipe", pipeFailure)
    return processFailure
  })
  return {
    spawned,
    closed: closedPromise,
    isClosed: () => closed,
    isFullyClosed: () => fullyClosed,
    hasPipeFailure: () => pipeFailure !== undefined,
    pipeFailureMessage: () => pipeFailure,
    failure,
  }
}

function observePipe(stream: NodeJS.ReadableStream | NodeJS.WritableStream, name: string, onFailure: (message: string) => void): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    stream.once("close", finish)
    stream.once("error", (error) => {
      onFailure(formatFailure("pipe", `${name} pipe failed`, error))
      finish()
    })
  })
}

function signalPosixGroup(pid: number, signal: NodeJS.Signals): { error?: string } {
  if (pid <= 1 || pid === process.pid) return { error: "refusing to signal the host process group" }
  try {
    process.kill(-pid, signal)
    return {}
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return {}
    return { error: formatFailure("cleanup", `unable to signal isolated process group with ${signal}`, error) }
  }
}

function signalPids(pids: readonly number[], signal: NodeJS.Signals): { error?: string } {
  for (const pid of pids) {
    if (pid <= 1 || pid === process.pid) continue
    try {
      process.kill(pid, signal)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") continue
      return { error: formatFailure("cleanup", `unable to signal process ${pid} with ${signal}`, error) }
    }
  }
  return {}
}

async function runTaskkill(pid: number, deadline: number): Promise<TaskkillResult> {
  const command = spawn("taskkill", [...buildTaskkillArgs(pid)], {
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  })
  const stdout = command.stdout
  const stderr = command.stderr
  let outputError: string | undefined
  stdout?.resume()
  stderr?.resume()
  stdout?.once("error", (error) => { outputError ??= formatFailure("pipe", "taskkill stdout pipe failed", error) })
  stderr?.once("error", (error) => { outputError ??= formatFailure("pipe", "taskkill stderr pipe failed", error) })

  const result = await new Promise<TaskkillResult>((resolve) => {
    let settled = false
    const finish = (value: TaskkillResult) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    command.once("error", (error) => finish({ code: null, signal: null, error: formatFailure("cleanup", "unable to start taskkill", error) }))
    command.once("close", (code, signal) => {
      const result: TaskkillResult = { code, signal: signal as string | null }
      if (outputError !== undefined) result.error = outputError
      finish(result)
    })
    const remaining = Math.max(0, deadline - Date.now())
    const timer = setTimeout(() => {
      command.kill()
      finish({ code: null, signal: "SIGTERM", error: "taskkill exceeded cleanup deadline" })
    }, remaining)
    command.once("close", () => clearTimeout(timer))
    command.once("error", () => clearTimeout(timer))
  })
  return result
}

function processGroupGone(pid: number): boolean {
  try {
    process.kill(-pid, 0)
    return false
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH"
  }
}

async function allPidsGone(pids: readonly number[]): Promise<boolean> {
  for (const pid of pids) {
    try {
      process.kill(pid, 0)
      return false
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== "ESRCH") return false
    }
  }
  return true
}

function resolveDeadline(now: number, value: number): number {
  if (!Number.isFinite(value)) return now
  // Epoch millisecond deadlines are currently around 10^12; smaller values
  // remain convenient duration inputs for injected/unit callers.
  if (value >= 1_000_000_000) return value
  return now + Math.max(0, value)
}

async function settledExit(closed: Promise<ProcessExit>): Promise<ProcessExit | undefined> {
  return Promise.race([
    closed,
    new Promise<undefined>((resolve) => setTimeout(resolve, 0)),
  ])
}

function formatExit(code: number | null, signal: string | null): string {
  return signal === null ? `code ${code ?? "unknown"}` : `signal ${signal}`
}

function formatFailure(stage: ProcessFailureStage, message: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error)
  return `${stage} failure: ${message}: ${detail}`
}

export default createProcessSupervisor
