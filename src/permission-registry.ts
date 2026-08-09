import type { RequestPermissionRequest, RequestPermissionResponse } from "@agentclientprotocol/sdk"
import { Readable, type Writable } from "node:stream"
import type {
  PermissionBroker,
  PermissionDecision,
  PermissionOutcome,
  PermissionPolicy,
} from "./acp-turn.ts"

export type PermissionInput = Readable & { isTTY?: boolean }
export type PermissionOutput = Writable & { isTTY?: boolean }

export interface PermissionRegistryOptions {
  /** Effective user-owned policy. Invalid runtime values safely become prompt. */
  policy?: PermissionPolicy
  /** Singular alias used by some host-capability adapters. */
  permission?: PermissionPolicy
  /** Alias accepted by callers that use the config field name. */
  permissions?: PermissionPolicy
  input?: PermissionInput
  output?: PermissionOutput
  stdin?: PermissionInput
  stderr?: PermissionOutput
  /** Explicit test seam for forcing or disabling interactive prompting. */
  interactive?: boolean
  signal?: AbortSignal
}

interface PendingRequest {
  resolve: (outcome: PermissionOutcome) => void
  request: RequestPermissionRequest
  settled: boolean
}

interface LineWaiter {
  resolve: (line: string | undefined) => void
  settled: boolean
}

const CANCELLED: PermissionOutcome = { decision: "cancelled" }

/**
 * Per-turn permission broker for both ACP permission requests and host writes.
 *
 * The registry is intentionally in-memory. It never remembers an `*_always`
 * selection and every request is resolved through the options offered for that
 * request. Abort transitions the broker into a terminal state and settles all
 * pending requests exactly once.
 */
export class PermissionRegistry implements PermissionBroker {
  readonly #policy: PermissionPolicy
  readonly #input: PermissionInput
  readonly #output: PermissionOutput
  readonly #interactiveOverride: boolean | undefined
  readonly #pending = new Map<number, PendingRequest>()
  readonly #lineQueue: string[] = []
  readonly #lineWaiters: LineWaiter[] = []
  #nextRequestId = 1
  #inputBuffer = ""
  #inputStarted = false
  #inputEnded = false
  #aborted = false
  #permissionDenied = false
  #signal: AbortSignal | undefined
  #abortListener: (() => void) | undefined
  #onData: ((chunk: string | Uint8Array) => void) | undefined
  #onEnd: (() => void) | undefined
  #onClose: (() => void) | undefined

  constructor(
    policyOrOptions: PermissionPolicy | PermissionRegistryOptions = {},
    input?: PermissionInput,
    output?: PermissionOutput,
  ) {
    const options: PermissionRegistryOptions = typeof policyOrOptions === "string"
      ? {
          policy: policyOrOptions,
          ...(input === undefined ? {} : { input }),
          ...(output === undefined ? {} : { output }),
        }
      : policyOrOptions
    const requestedPolicy = options.policy ?? options.permission ?? options.permissions
    this.#policy = isPermissionPolicy(requestedPolicy) ? requestedPolicy : "prompt"
    this.#input = options.input ?? options.stdin ?? process.stdin
    this.#output = options.output ?? options.stderr ?? process.stderr
    this.#interactiveOverride = options.interactive
    if (options.signal) this.attachSignal(options.signal)
  }

  get policy(): PermissionPolicy {
    return this.#policy
  }

  get pendingCount(): number {
    return this.#pending.size
  }

  get aborted(): boolean {
    return this.#aborted
  }

  get permissionDenied(): boolean {
    return this.#permissionDenied
  }

  async request(request: RequestPermissionRequest): Promise<PermissionOutcome> {
    if (this.#aborted) return { ...CANCELLED }

    const selected = this.#policy === "approve-all"
      ? selectOfferedOption(request, "allow")
      : this.#policy === "deny"
        ? selectOfferedOption(request, "reject")
        : undefined

    if (this.#policy === "approve-all") {
      return this.settleSynchronous(selected ? allowed(selected.optionId) : CANCELLED)
    }
    if (this.#policy === "deny") {
      return this.settleSynchronous(selected ? denied(selected.optionId) : CANCELLED)
    }
    if (!this.isInteractive()) {
      const rejection = selectOfferedOption(request, "reject")
      return this.settleSynchronous(rejection ? denied(rejection.optionId) : CANCELLED)
    }

    const id = this.#nextRequestId
    this.#nextRequestId += 1
    return new Promise<PermissionOutcome>((resolve) => {
      const pending: PendingRequest = { resolve, request, settled: false }
      this.#pending.set(id, pending)
      this.ensureInputReader()
      this.writePermissionPrompt(request)
      void this.resolveInteractive(id, pending)
    })
  }

  /** Host write callbacks use the same policy and the same per-turn registry. */
  authorize(request: RequestPermissionRequest): Promise<PermissionOutcome> {
    return this.request(request)
  }

  authorizeWrite(request: RequestPermissionRequest): Promise<PermissionOutcome> {
    return this.request(request)
  }

  authorizeHostWrite(request: RequestPermissionRequest): Promise<PermissionOutcome> {
    return this.request(request)
  }

  requestHostWrite(request: RequestPermissionRequest): Promise<PermissionOutcome> {
    return this.request(request)
  }

  async cancelPending(): Promise<void> {
    if (!this.#aborted) this.#aborted = true
    this.closeInputReader()
    const pending = [...this.#pending.entries()]
    for (const [id, entry] of pending) this.settle(id, entry, CANCELLED)
  }

  async abort(): Promise<void> {
    await this.cancelPending()
  }

  async dispose(): Promise<void> {
    await this.cancelPending()
    if (this.#signal && this.#abortListener) {
      this.#signal.removeEventListener("abort", this.#abortListener)
      this.#abortListener = undefined
    }
    this.#signal = undefined
  }

  private attachSignal(signal: AbortSignal): void {
    this.#signal = signal
    this.#abortListener = () => { void this.cancelPending() }
    signal.addEventListener("abort", this.#abortListener, { once: true })
    if (signal.aborted) void this.cancelPending()
  }

  private isInteractive(): boolean {
    if (this.#interactiveOverride !== undefined) {
      return this.#interactiveOverride && this.#input.isTTY === true && this.#output.isTTY === true
    }
    return this.#input.isTTY === true && this.#output.isTTY === true
  }

  private settleSynchronous(outcome: PermissionOutcome): PermissionOutcome {
    if (outcome.decision === "denied") this.#permissionDenied = true
    return { ...outcome }
  }

  private async resolveInteractive(id: number, pending: PendingRequest): Promise<void> {
    try {
      const line = await this.waitForLine()
      if (!this.#pending.has(id) || pending.settled) return
      if (line === undefined) {
        this.settle(id, pending, CANCELLED)
        return
      }
      const selected = chooseInteractiveOption(pending.request, line)
      if (selected === undefined) {
        this.writeLine("[exec] permission: invalid choice; denied")
        this.settle(id, pending, denied())
        return
      }
      this.settle(id, pending, selected.kind.startsWith("allow") ? allowed(selected.optionId) : denied(selected.optionId))
    } catch {
      // A closed or broken input stream is noninteractive from the broker's
      // perspective. Never leave the ACP request unresolved.
      this.settle(id, pending, CANCELLED)
    }
  }

  private settle(id: number, pending: PendingRequest, outcome: PermissionOutcome): void {
    if (pending.settled) return
    pending.settled = true
    this.#pending.delete(id)
    if (outcome.decision === "denied") this.#permissionDenied = true
    pending.resolve({ ...outcome })
  }

  private ensureInputReader(): void {
    if (this.#inputStarted) return
    this.#inputStarted = true
    this.#onData = (chunk) => this.handleInput(String(chunk))
    this.#onEnd = () => {
      this.#inputEnded = true
      this.resolveLineWaiters(undefined)
    }
    this.#onClose = () => {
      this.#inputEnded = true
      this.resolveLineWaiters(undefined)
    }
    this.#input.on("data", this.#onData)
    this.#input.once("end", this.#onEnd)
    this.#input.once("close", this.#onClose)
  }

  private handleInput(chunk: string): void {
    this.#inputBuffer += chunk
    for (;;) {
      const newline = this.#inputBuffer.search(/\r?\n/u)
      if (newline === -1) return
      const line = this.#inputBuffer.slice(0, newline)
      this.#inputBuffer = this.#inputBuffer.slice(this.#inputBuffer[newline] === "\r" ? newline + 2 : newline + 1)
      this.enqueueLine(line)
    }
  }

  private enqueueLine(line: string): void {
    const waiter = this.#lineWaiters.shift()
    if (waiter && !waiter.settled) {
      waiter.settled = true
      waiter.resolve(line)
      return
    }
    this.#lineQueue.push(line)
  }

  private waitForLine(): Promise<string | undefined> {
    if (this.#lineQueue.length > 0) return Promise.resolve(this.#lineQueue.shift())
    if (this.#inputEnded || this.#aborted) return Promise.resolve(undefined)
    return new Promise<string | undefined>((resolve) => {
      this.#lineWaiters.push({ resolve, settled: false })
    })
  }

  private resolveLineWaiters(line: string | undefined): void {
    const waiters = this.#lineWaiters.splice(0)
    for (const waiter of waiters) {
      if (waiter.settled) continue
      waiter.settled = true
      waiter.resolve(line)
    }
  }

  private closeInputReader(): void {
    if (!this.#inputStarted) return
    this.#inputStarted = false
    this.#inputEnded = true
    this.resolveLineWaiters(undefined)
    if (this.#onData) this.#input.off("data", this.#onData)
    if (this.#onEnd) this.#input.off("end", this.#onEnd)
    if (this.#onClose) this.#input.off("close", this.#onClose)
    this.#onData = undefined
    this.#onEnd = undefined
    this.#onClose = undefined
  }

  private writePermissionPrompt(request: RequestPermissionRequest): void {
    const title = sanitizeDisplayText(request.toolCall.title ?? "agent action")
    this.writeLine(`[exec] permission: ${title}`)
    request.options.forEach((option, index) => {
      const name = sanitizeDisplayText(option.name)
      this.writeLine(`[exec] permission option ${index + 1}: ${name}`)
    })
    this.writeLine("[exec] permission choice: enter an option number")
  }

  private writeLine(line: string): void {
    try {
      this.#output.write(`${line}\n`)
    } catch {
      // Output is advisory; permission remains fail-closed if it cannot be
      // rendered to the terminal.
    }
  }
}

export function createPermissionRegistry(
  policyOrOptions: PermissionPolicy | PermissionRegistryOptions = {},
  input?: PermissionInput,
  output?: PermissionOutput,
): PermissionRegistry {
  return new PermissionRegistry(policyOrOptions, input, output)
}

export const createPermissionBroker = createPermissionRegistry
export const createPermissionResolver = createPermissionRegistry

export function toPermissionResponse(outcome: PermissionOutcome): RequestPermissionResponse {
  if (outcome.decision === "cancelled" || outcome.optionId === undefined) {
    return { outcome: { outcome: "cancelled" } }
  }
  return { outcome: { outcome: "selected", optionId: outcome.optionId } }
}

export const toAcpPermissionResponse = toPermissionResponse

function selectOfferedOption(
  request: RequestPermissionRequest,
  prefix: "allow" | "reject",
): { optionId: string; kind: string } | undefined {
  const once = request.options.find((option) => option.kind === `${prefix}_once`)
  if (once) return { optionId: once.optionId, kind: once.kind }
  const offered = request.options.find((option) => option.kind.startsWith(`${prefix}_`))
  return offered ? { optionId: offered.optionId, kind: offered.kind } : undefined
}

function chooseInteractiveOption(
  request: RequestPermissionRequest,
  line: string,
): { optionId: string; kind: string } | undefined {
  const trimmed = line.trim()
  if (trimmed.length === 0) return undefined
  const index = Number.parseInt(trimmed, 10)
  if (Number.isInteger(index) && String(index) === trimmed) {
    const option = request.options[index - 1]
    return option ? { optionId: option.optionId, kind: option.kind } : undefined
  }
  const option = request.options.find((candidate) => candidate.optionId === trimmed)
  return option ? { optionId: option.optionId, kind: option.kind } : undefined
}

function allowed(optionId: string): PermissionOutcome {
  return { decision: "allowed", optionId }
}

function denied(optionId?: string): PermissionOutcome {
  return optionId === undefined ? { decision: "denied" } : { decision: "denied", optionId }
}

function isPermissionPolicy(value: unknown): value is PermissionPolicy {
  return value === "prompt" || value === "approve-all" || value === "deny"
}

function sanitizeDisplayText(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 160) || "(unnamed)"
}

export type { PermissionBroker, PermissionDecision, PermissionOutcome, PermissionPolicy }
