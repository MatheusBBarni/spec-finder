import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { createInterface } from "node:readline/promises"
import { createProcessSupervisor } from "./process-supervisor.ts"
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from "@agentclientprotocol/sdk"
import {
  AcpTurnError,
  withAcpTurnSession,
  type AcpSessionRequest,
  type AcpTurnEvent,
  type PermissionBroker,
  type PermissionOutcome,
  type ProviderLaunch as NeutralProviderLaunch,
  type WorkspaceAccess,
} from "./acp-turn.ts"
import type { SpecFinderConfig } from "./config.ts"
import type { RunEventListener } from "./events.ts"
import { assertInsideWorkspace } from "./paths.ts"
import { resolveProviderLaunch, type ProviderLaunch } from "./providers.ts"

export interface AcpTurnOptions {
  root: string
  config: SpecFinderConfig
  prompt: string
  taskId: string
  signal: AbortSignal
  emit: RunEventListener
  interactivePermissions: boolean
  providerLaunch?: ProviderLaunch
}

export interface AcpTurnResult {
  stopReason: string
}

export type AcpSessionOptions = Omit<AcpTurnOptions, "prompt">

export interface AcpSessionHandle {
  runTurn(prompt: string): Promise<AcpTurnResult>
}

export class AcpProcessExitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AcpProcessExitError"
  }
}

/** Packet compatibility adapter over the task-neutral ACP v1 lifecycle. */
export async function runAcpTurn(options: AcpTurnOptions): Promise<AcpTurnResult> {
  if (options.signal.aborted) return { stopReason: "cancelled" }
  return withAcpSession(options, (session) => session.runTurn(options.prompt))
}

/**
 * Keeps packet implementation/report turns on one ACP process and protocol
 * session while leaving all protocol and cleanup ownership in the neutral core.
 */
export async function withAcpSession<T>(
  options: AcpSessionOptions,
  use: (session: AcpSessionHandle) => Promise<T>,
): Promise<T> {
  const launch = options.providerLaunch ?? resolveProviderLaunch(options.config)
  const request: AcpSessionRequest = {
    workspace: options.root,
    runtime: {
      provider: options.config.provider,
      model: options.config.model,
      reasoning: options.config.reasoning,
      speed: options.config.speed,
    },
    launch: toNeutralLaunch(options.root, launch),
    hostAccess: createPacketWorkspaceAccess(options.root),
    permission: new PacketPermissionBroker(options),
    supervisor: createProcessSupervisor(),
    signal: options.signal,
    runtimeOptionPolicy: {
      model: options.config.provider === "claude" || options.config.provider === "cursor"
        ? "launch-time"
        : "required",
      reasoning: "optional",
      speed: "optional",
    },
    emit: (event) => emitPacketEvent(event, options),
  }

  try {
    return await withAcpTurnSession(request, async (neutralSession) => {
      const packetSession: AcpSessionHandle = {
        runTurn: async (prompt) => {
          try {
            const result = await neutralSession.runTurn(prompt)
            if (result.cleanup === "failed") {
              throw new AcpProcessExitError("ACP cleanup failed after the packet turn")
            }
            return { stopReason: result.stopReason ?? "refusal" }
          } catch (error) {
            // Adapt lifecycle failures at the packet session boundary so the
            // existing engine can replace a crashed provider before its
            // phase-level retry loop consumes the dead session.
            const adapted = adaptNeutralError(error, options.signal)
            throw adapted
          }
        },
      }
      return use(packetSession)
    })
  } catch (error) {
    throw adaptNeutralError(error, options.signal)
  }
}

function toNeutralLaunch(root: string, launch: ProviderLaunch): NeutralProviderLaunch {
  return {
    command: launch.command,
    args: launch.args,
    cwd: root,
    env: launch.env,
    authMethod: launch.authMethod,
  }
}

function emitPacketEvent(event: AcpTurnEvent, options: AcpSessionOptions): void {
  switch (event.type) {
    case "initialized":
      options.emit({
        type: "activity",
        taskId: options.taskId,
        message: `ACP ${event.agentInfo?.title ?? event.agentInfo?.name ?? options.config.provider} initialized`,
      })
      return
    case "runtime_option":
      options.emit({
        type: "runtime_option",
        name: event.name,
        requested: event.requested,
        outcome: event.outcome,
        ...(event.detail === undefined ? {} : { detail: event.detail }),
      })
      return
    case "session_update":
      options.emit({
        type: "session_update",
        taskId: options.taskId,
        sessionId: event.sessionId,
        update: event.update,
      })
      return
    case "provider_stderr":
      options.emit({ type: "activity", taskId: options.taskId, message: event.text })
      return
    case "permission_requested":
    case "permission_resolved":
    case "session_started":
    case "session_configured":
    case "turn_stopped":
    case "cleanup":
      return
  }
}

function adaptNeutralError(error: unknown, signal: AbortSignal): Error {
  if (error instanceof AcpProcessExitError) return error
  if (signal.aborted) return new Error("ACP turn cancelled")
  if (error instanceof AcpTurnError) {
    if (error.kind === "cleanup") {
      return new AcpProcessExitError(`ACP cleanup failed: ${error.message}`)
    }
    if (error.kind === "provider" && error.message.startsWith("ACP process ended before")) {
      return new AcpProcessExitError(error.message)
    }
    return error
  }
  return error instanceof Error ? error : new Error(String(error))
}

class PacketPermissionBroker implements PermissionBroker {
  readonly #options: AcpSessionOptions
  readonly #pending = new Set<(outcome: PermissionOutcome) => void>()

  constructor(options: AcpSessionOptions) {
    this.#options = options
  }

  async request(request: RequestPermissionRequest): Promise<PermissionOutcome> {
    if (this.#options.config.permissions !== "prompt") {
      const allow = this.#options.config.permissions === "approve-all"
      const selected = request.options.find((option) => allow
        ? option.kind.startsWith("allow")
        : option.kind.startsWith("reject"))
      if (selected === undefined) return { decision: "cancelled" }
      return {
        decision: allow ? "allowed" : "denied",
        optionId: selected.optionId,
      }
    }

    if (this.#options.interactivePermissions) {
      this.#options.emit({
        type: "activity",
        taskId: this.#options.taskId,
        message: "Permission request cancelled because the cockpit is read-only; configure permissions before rerunning.",
      })
      return { decision: "cancelled" }
    }
    if (!process.stdin.isTTY) return { decision: "cancelled" }

    return new Promise<PermissionOutcome>((resolve) => {
      let settled = false
      const settle = (outcome: PermissionOutcome) => {
        if (settled) return
        settled = true
        this.#pending.delete(settle)
        resolve(outcome)
      }
      this.#pending.add(settle)
      void this.prompt(request).then(settle, () => settle({ decision: "cancelled" }))
    })
  }

  async cancelPending(): Promise<void> {
    for (const settle of [...this.#pending]) settle({ decision: "cancelled" })
  }

  private async prompt(request: RequestPermissionRequest): Promise<PermissionOutcome> {
    const readline = createInterface({ input: process.stdin, output: process.stdout })
    try {
      process.stdout.write(`\nPermission: ${request.toolCall.title}\n`)
      request.options.forEach((option, index) => process.stdout.write(`  ${index + 1}. ${option.name} (${option.kind})\n`))
      const answer = await readline.question("Choose an option: ")
      const selected = request.options[Number(answer) - 1]
      if (selected === undefined) return { decision: "cancelled" }
      return {
        decision: selected.kind.startsWith("allow") ? "allowed" : "denied",
        optionId: selected.optionId,
      }
    } finally {
      readline.close()
    }
  }
}

function createPacketWorkspaceAccess(root: string): WorkspaceAccess {
  return {
    async readTextFile(candidate) {
      const path = assertInsideWorkspace(root, candidate)
      return readFile(path, "utf8")
    },
    async writeTextFile(candidate, content) {
      // Packet behavior intentionally remains on the existing lexical path
      // boundary and does not adopt exec's canonical host policy in this task.
      const path = assertInsideWorkspace(root, candidate)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, content)
    },
  }
}

export function toPacketPermissionResponse(outcome: PermissionOutcome): RequestPermissionResponse {
  if (outcome.decision === "cancelled" || outcome.optionId === undefined) {
    return { outcome: { outcome: "cancelled" } }
  }
  return { outcome: { outcome: "selected", optionId: outcome.optionId } }
}
