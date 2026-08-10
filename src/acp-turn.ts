import * as acp from "@agentclientprotocol/sdk"
import { isAbsolute } from "node:path"
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionConfigOption,
  SessionConfigSelectOption,
  SessionConfigSelectOptions,
  SessionUpdate,
} from "@agentclientprotocol/sdk"

/** Runtime choices shared by an ACP turn without provider-specific config types. */
export interface ExecRuntimeProfile {
  provider: string
  model: string
  reasoning: string
  speed: string
}

export type PermissionPolicy = "prompt" | "approve-all" | "deny"

export type HostAccessMode = "read-only" | "write-capable"

export interface ResolvedExecContext {
  workspace: string
  runtime: ExecRuntimeProfile
  runtimeSource: "repository" | "user"
  permission: PermissionPolicy
  permissionSource: "user" | "default"
  hostAccess: HostAccessMode
}

/** Raw ACP v1 stop reasons are retained so adapters can map them truthfully. */
export type AcpStopReason =
  | "end_turn"
  | "max_tokens"
  | "max_turn_requests"
  | "refusal"
  | "cancelled"
  | (string & {})

export type AcpTurnFailure = "protocol" | "provider" | "transport"

export type AcpTurnErrorKind = AcpTurnFailure | "cleanup"

export type TurnOutcome =
  | "completed"
  | "cancelled"
  | "permission-denied"
  | "refused"
  | "limited"
  | "failed"

/** Result owned by the neutral ACP lifecycle; presentation adapters map it later. */
export interface AcpTurnResult {
  stopReason?: AcpStopReason
  finalText: string
  permissionDenied: boolean
  cleanup: "confirmed" | "failed"
  outcome?: TurnOutcome
  failure?: AcpTurnFailure
}

export class AcpTurnError extends Error {
  readonly kind: AcpTurnErrorKind
  readonly cause?: unknown
  readonly result: AcpTurnResult | undefined

  constructor(
    kind: AcpTurnErrorKind,
    message: string,
    cause?: unknown,
    result?: AcpTurnResult,
  ) {
    super(message)
    this.name = "AcpTurnError"
    this.kind = kind
    this.cause = cause
    this.result = result
  }
}

export interface AcpAgentInfo {
  name?: string
  title?: string
  version?: string
}

export type RuntimeOptionName = "model" | "reasoning" | "speed"

export type RuntimeOptionOutcome = "applied" | "default" | "unsupported"

export type RuntimeOptionPolicy = "required" | "optional" | "launch-time"

export type PermissionDecision = "allowed" | "denied" | "cancelled"

export interface PermissionOutcome {
  decision: PermissionDecision
  optionId?: string
}

/** Source-owned order for choosing an advertised ACP authentication method. */
export interface AuthMethodPreference {
  readonly methodIds: readonly string[]
  readonly unavailableMessage: string
}

/** Provider-owned adapter input for nonstandard ACP configuration metadata. */
export interface SessionConfigAdvertisement {
  readonly configOptions: readonly SessionConfigOption[] | null | undefined
  readonly metadata: Readonly<Record<string, unknown>> | null | undefined
}

/** Convert provider extension metadata into neutral ACP session options. */
export type SessionConfigNormalizer = (advertisement: SessionConfigAdvertisement) => readonly SessionConfigOption[]

/** Controls whether provider diagnostic text may cross the ACP event boundary. */
export type ProviderStderrPolicy = "forward" | "redact"

/** A per-turn broker keeps permission policy and pending-request state injectable. */
export interface PermissionBroker {
  request(request: RequestPermissionRequest): Promise<PermissionOutcome>
  cancelPending(): Promise<void>
}

export type PermissionResolver = PermissionBroker

/** Authorization is intentionally an operation, not an unchecked path result. */
export type WriteAuthorizer = (absolutePath: string) => Promise<void>

export interface WorkspaceAccess {
  readTextFile(absolutePath: string): Promise<string>
  writeTextFile(
    absolutePath: string,
    content: string,
    authorize: WriteAuthorizer,
  ): Promise<void>
}

export interface ProviderLaunch {
  command: string
  args: readonly string[]
  cwd: string
  env: Readonly<Record<string, string>>
  authMethod?: string | null
  authPreference?: AuthMethodPreference
  sessionConfigNormalizer?: SessionConfigNormalizer
  stderrPolicy?: ProviderStderrPolicy
}

export interface ProcessExit {
  code: number | null
  signal: string | null
  error?: string
}

export type CleanupState = "requested" | "signalled" | "closed" | "unconfirmed" | "failed"

export interface CleanupResult {
  state: CleanupState
  exit?: ProcessExit
  error?: string
}

export interface SupervisedProcess {
  pid: number
  closed: Promise<ProcessExit>
  stdin?: WritableStream<Uint8Array>
  stdout?: ReadableStream<Uint8Array>
  stderr?: ReadableStream<Uint8Array>
  cancelTree(deadlineMs: number): Promise<CleanupResult>
}

export interface ProcessSupervisor {
  spawn(spec: ProviderLaunch): Promise<SupervisedProcess>
}

export type AcpTurnEvent =
  | {
      type: "initialized"
      protocolVersion: number
      agentInfo?: AcpAgentInfo
    }
  | {
      type: "session_started"
      sessionId: string
    }
  | {
      type: "session_configured"
      options: readonly SessionConfigOption[]
    }
  | {
      type: "runtime_option"
      name: RuntimeOptionName
      requested: string
      outcome: RuntimeOptionOutcome
      detail?: string
    }
  | {
      type: "session_update"
      sessionId: string
      update: SessionUpdate
    }
  | {
      type: "provider_stderr"
      text: string
    }
  | {
      type: "permission_requested"
      request: RequestPermissionRequest
      respond: (response: RequestPermissionResponse) => void | Promise<void>
    }
  | {
      type: "permission_resolved"
      requestId?: string
      outcome: PermissionOutcome
    }
  | {
      type: "turn_stopped"
      stopReason: AcpStopReason
    }
  | {
      type: "cleanup"
      outcome: CleanupResult
    }

export type AcpTurnEventListener = (event: AcpTurnEvent) => void

export type TurnEvent = AcpTurnEvent
export type TurnEventListener = AcpTurnEventListener

export interface AcpTurnRequest {
  prompt: string
  workspace: string
  runtime: ExecRuntimeProfile
  launch: ProviderLaunch
  hostAccess: WorkspaceAccess
  /** Controls which ACP host capabilities are advertised for this turn. */
  hostAccessMode?: HostAccessMode
  permission: PermissionBroker
  supervisor: ProcessSupervisor
  signal: AbortSignal
  /** A repeated operator cancellation that skips the remaining cleanup grace. */
  forceSignal?: AbortSignal
  emit?: AcpTurnEventListener
  runtimeOptionPolicy?: Partial<Record<RuntimeOptionName, RuntimeOptionPolicy>>
}

export type AcpSessionRequest = Omit<AcpTurnRequest, "prompt">

export interface AcpSessionHandle {
  runTurn(prompt: string): Promise<AcpTurnResult>
}

export interface AcpTurn {
  run(request: AcpTurnRequest): Promise<AcpTurnResult>
}

export type AcpTurnContract = AcpTurn
export type AcpTurnRunner = (request: AcpTurnRequest) => Promise<AcpTurnResult>

export type ExecOutcome =
  | "completed"
  | "cancelled"
  | "permission-denied"
  | "refused"
  | "limited"
  | "invalid-invocation"
  | "config-error"
  | "provider-error"
  | "cleanup-error"

export const ACP_PROTOCOL_VERSION = 1
export const SEMANTIC_CANCEL_GRACE_MS = 2_000
export const SESSION_CLOSE_TIMEOUT_MS = 1_000
export const PROCESS_CLEANUP_DEADLINE_MS = 5_000

const CANCEL_GRACE_EXPIRED = Symbol("cancel-grace-expired")

interface CancellationState {
  startedAt?: number
  aborted: boolean
  cancelSent: boolean
  cancelPromise?: Promise<void>
  gracePromise?: Promise<typeof CANCEL_GRACE_EXPIRED>
  cleanupPromise?: Promise<CleanupResult>
  forceRequested: boolean
}

interface SessionRuntime {
  context: acp.ClientContext
  sessionId: string
  closeAdvertised: boolean
  currentOptions: SessionConfigOption[]
}

/** Preserve adapter callback failures without mistaking them for transport errors. */
class SessionCallbackError extends Error {
  readonly original: unknown

  constructor(original: unknown) {
    super("ACP session callback failed")
    this.name = "SessionCallbackError"
    this.original = original
  }
}

/**
 * Run one fresh ACP v1 prompt turn through the neutral lifecycle.
 *
 * The session helper below is intentionally also available to the packet
 * compatibility adapter so implementation/report handoffs can remain on one
 * ACP process and session without moving packet policy into this module.
 */
export async function runAcpTurn(request: AcpTurnRequest): Promise<AcpTurnResult> {
  if (request.signal.aborted) {
    return {
      stopReason: "cancelled",
      finalText: "",
      permissionDenied: false,
      cleanup: "confirmed",
      outcome: "cancelled",
    }
  }

  try {
    return await withAcpTurnSession(
      omitPrompt(request),
      (session) => session.runTurn(request.prompt),
    )
  } catch (error) {
    if (error instanceof AcpTurnError && error.result !== undefined) return error.result
    throw error
  }
}

export const runAcpTurnCore = runAcpTurn

export function createAcpTurn(): AcpTurn {
  return { run: runAcpTurn }
}

/**
 * Own the ACP process, v1 negotiation, session lifecycle, and supervised
 * cleanup while allowing a compatibility adapter to run more than one packet
 * phase on the same fresh session.
 */
export async function withAcpTurnSession<T>(
  request: AcpSessionRequest,
  use: (session: AcpSessionHandle) => Promise<T>,
): Promise<T> {
  if (!isAbsolute(request.workspace)) {
    throw new AcpTurnError("protocol", "ACP session workspace must be an absolute path")
  }
  if (!isAbsolute(request.launch.cwd)) {
    throw new AcpTurnError("protocol", "ACP provider cwd must be an absolute path")
  }
  const emit = request.emit ?? (() => {})
  let process: SupervisedProcess | undefined
  let turnResult: AcpTurnResult | undefined
  let closeFailure: string | undefined
  let callbackError: unknown
  let callbackValue: T | undefined
  let callbackCompleted = false
  const permissionState = { denied: false }
  const cancellation: CancellationState = {
    aborted: false,
    cancelSent: false,
    forceRequested: false,
  }
  let sendCancel: (() => Promise<void>) | undefined

  const onAbort = () => {
    if (!cancellation.aborted) {
      cancellation.aborted = true
      cancellation.startedAt = Date.now()
      cancellation.gracePromise = delay(SEMANTIC_CANCEL_GRACE_MS).then(() => CANCEL_GRACE_EXPIRED)
    }
    void settleCancellation().catch(() => {})
  }

  const settleCancellation = async (): Promise<void> => {
    if (cancellation.cancelPromise === undefined) {
      cancellation.cancelPromise = (async () => {
        await request.permission.cancelPending()
        if (sendCancel !== undefined && !cancellation.cancelSent) {
          cancellation.cancelSent = true
          await sendCancel()
        }
      })().catch((error: unknown) => {
        throw new AcpTurnError("transport", "unable to settle ACP cancellation", error)
      })
    } else if (sendCancel !== undefined && !cancellation.cancelSent) {
      cancellation.cancelSent = true
      await sendCancel()
    }
    await cancellation.cancelPromise
  }

  const onForceAbort = () => {
    cancellation.forceRequested = true
    onAbort()
    if (process === undefined) return
    const deadline = (cancellation.startedAt ?? Date.now()) + PROCESS_CLEANUP_DEADLINE_MS
    const cleanupPromise = process.cancelTree(deadline)
    cancellation.cleanupPromise ??= cleanupPromise
    void process.cancelTree(deadline).catch(() => {})
  }

  request.signal.addEventListener("abort", onAbort, { once: true })
  request.forceSignal?.addEventListener("abort", onForceAbort, { once: true })
  if (request.signal.aborted) onAbort()
  if (request.forceSignal?.aborted) onForceAbort()

  try {
    try {
      process = await request.supervisor.spawn(request.launch)
      if (cancellation.forceRequested) onForceAbort()
      if (process.stderr !== undefined) {
        let redactedDiagnosticEmitted = false
        void consumeProviderStderr(process.stderr, (text) => {
          if (request.launch.stderrPolicy !== "redact") {
            emit({ type: "provider_stderr", text })
            return
          }
          if (redactedDiagnosticEmitted) return
          redactedDiagnosticEmitted = true
          emit({ type: "provider_stderr", text: "Provider emitted diagnostic output; details redacted." })
        })
      }
      if (process.stdin === undefined || process.stdout === undefined) {
        throw new AcpTurnError("transport", "ACP provider did not expose stdio streams")
      }

      const stream = acp.ndJsonStream(
        process.stdin as WritableStream<Uint8Array<ArrayBufferLike>>,
        process.stdout as ReadableStream<Uint8Array<ArrayBufferLike>>,
      )
      const client = acp
        .client({ name: "spec-finder" })
        .onRequest(acp.methods.client.session.requestPermission, async (context) => {
          const permission = context.params
          let externalResponse: RequestPermissionResponse | undefined
          emit({
            type: "permission_requested",
            request: permission,
            respond: (response) => {
              externalResponse = response
            },
          })
          const outcome = await request.permission.request(permission)
          if (outcome.decision === "denied") permissionState.denied = true
          emit({
            type: "permission_resolved",
            requestId: permission.toolCall.toolCallId,
            outcome,
          })
          // The broker is authoritative. Keep the callback value observable
          // for adapters without allowing an event listener to bypass policy.
          void externalResponse
          return toAcpPermissionResponse(outcome)
        })
        .onRequest(acp.methods.client.fs.readTextFile, async (context) => {
          const result = await request.hostAccess.readTextFile(context.params.path)
          return { content: sliceTextFile(result, context.params.line, context.params.limit) }
        })
        .onRequest(acp.methods.client.fs.writeTextFile, async (context) => {
          await request.hostAccess.writeTextFile(
            context.params.path,
            context.params.content,
            async (absolutePath) => {
              const outcome = await request.permission.request(hostWritePermission(context.params.sessionId, absolutePath))
              if (outcome.decision === "denied") permissionState.denied = true
              if (outcome.decision !== "allowed") {
                throw new Error(`host write permission ${outcome.decision}`)
              }
            },
          )
          return {}
        })

      callbackValue = await client.connectWith(stream, async (context) => {
        const initialized = await requestInitialize(context, request)
        if (initialized.protocolVersion !== ACP_PROTOCOL_VERSION) {
          throw new AcpTurnError(
            "protocol",
            `unsupported ACP protocol version ${initialized.protocolVersion}; expected ${ACP_PROTOCOL_VERSION}`,
          )
        }
        emit({
          type: "initialized",
          protocolVersion: initialized.protocolVersion,
          ...(initialized.agentInfo === null || initialized.agentInfo === undefined
            ? {}
            : { agentInfo: toAgentInfo(initialized.agentInfo) }),
        })

        const authMethod = selectAuthMethod(request.launch, initialized.authMethods)
        if (authMethod !== undefined) {
          try {
            await context.request(acp.methods.agent.authenticate, { methodId: authMethod })
          } catch {
            throw new AcpTurnError("provider", `ACP authentication failed for ${authMethod}`)
          }
        }

        return context.buildSession(request.workspace).withSession(async (session) => {
          const activeRuntime: SessionRuntime = {
            context,
            sessionId: session.sessionId,
            closeAdvertised: initialized.agentCapabilities?.sessionCapabilities?.close !== undefined
              && initialized.agentCapabilities?.sessionCapabilities?.close !== null,
            currentOptions: normalizeSessionConfigOptions(
              request.launch,
              session.newSessionResponse.configOptions,
              session.newSessionResponse._meta,
            ),
          }
          emit({ type: "session_started", sessionId: session.sessionId })
          emit({ type: "session_configured", options: activeRuntime.currentOptions })
          sendCancel = () => context.notify(acp.methods.agent.session.cancel, { sessionId: session.sessionId })
          if (cancellation.aborted) void settleCancellation().catch(() => {})

          try {
            await configureSession(context, activeRuntime, request, emit)
            const handle: AcpSessionHandle = {
              runTurn: async (prompt) => {
                const result = await runSessionTurn(
                  session,
                  activeRuntime,
                  prompt,
                  request,
                  emit,
                  cancellation,
                  permissionState,
                  settleCancellation,
                  process as SupervisedProcess,
                )
                turnResult = result
                return result
              },
            }
            try {
              return await use(handle)
            } catch (error) {
              throw new SessionCallbackError(error)
            }
          } finally {
            if (activeRuntime.closeAdvertised) {
              try {
                await withTimeout(
                  context.request(acp.methods.agent.session.close, { sessionId: session.sessionId }),
                  SESSION_CLOSE_TIMEOUT_MS,
                )
              } catch (error) {
                closeFailure = error instanceof Error ? error.message : String(error)
              }
            }
          }
        })
      })
      callbackCompleted = true
    } catch (error) {
      callbackError = error instanceof SessionCallbackError
        ? error.original instanceof AcpTurnError
          ? await normalizeSessionError(error.original, process, request.signal)
          : error.original
        : await normalizeSessionError(error, process, request.signal)
    }
  } finally {
    request.signal.removeEventListener("abort", onAbort)
    request.forceSignal?.removeEventListener("abort", onForceAbort)
    try {
      if (cancellation.cancelPromise !== undefined) await cancellation.cancelPromise
      else await request.permission.cancelPending()
    } catch (error) {
      if (callbackError === undefined) callbackError = normalizeAcpError(error)
    }
    if (process !== undefined) {
      const deadline = cancellation.startedAt === undefined
        ? Date.now() + PROCESS_CLEANUP_DEADLINE_MS
        : cancellation.startedAt + PROCESS_CLEANUP_DEADLINE_MS
      const cleanupPromise = cancellation.cleanupPromise ?? supervisorCleanup(process, deadline)
      cancellation.cleanupPromise = cleanupPromise
      let cleanup: CleanupResult
      try {
        cleanup = await cleanupPromise
      } catch (error) {
        cleanup = { state: "failed", error: error instanceof Error ? error.message : String(error) }
      }
      emit({ type: "cleanup", outcome: cleanup })
      const cleanupFailed = cleanup.state !== "closed" || closeFailure !== undefined
      if (callbackError === undefined && cleanupFailed) {
        const result = resultWithCleanup(turnResult, cleanupFailed, permissionState.denied, closeFailure)
        callbackError = new AcpTurnError(
          "cleanup",
          closeFailure ?? cleanup.error ?? "ACP provider cleanup could not be confirmed",
          undefined,
          result,
        )
      } else if (turnResult !== undefined) {
        turnResult = resultWithCleanup(turnResult, cleanupFailed, permissionState.denied, closeFailure)
        if (callbackCompleted && isAcpTurnResult(callbackValue)) callbackValue = turnResult as T
      }
    }
  }

  if (callbackError !== undefined) throw callbackError
  if (callbackCompleted) return callbackValue as T
  // The only path without a callback error and without a returned value is an
  // unexpected implementation error. Keep this impossible branch explicit.
  throw new AcpTurnError("transport", "ACP session completed without a result")
}

async function requestInitialize(
  context: acp.ClientContext,
  request: AcpSessionRequest,
): Promise<acp.InitializeResponse> {
  try {
    return await context.request(acp.methods.agent.initialize, {
      protocolVersion: ACP_PROTOCOL_VERSION,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: request.hostAccessMode !== "read-only",
        },
        session: { configOptions: { boolean: {} } },
      },
      clientInfo: { name: "spec-finder", version: "1.0.0", title: "Spec Finder" },
    })
  } catch (error) {
    throw normalizeAcpError(error, "provider", request.signal)
  }
}

async function configureSession(
  context: acp.ClientContext,
  runtime: SessionRuntime,
  request: AcpSessionRequest,
  emit: AcpTurnEventListener,
): Promise<void> {
  const policies: Record<RuntimeOptionName, RuntimeOptionPolicy> = {
    model: request.runtimeOptionPolicy?.model ?? "optional",
    reasoning: request.runtimeOptionPolicy?.reasoning ?? "optional",
    speed: request.runtimeOptionPolicy?.speed ?? "optional",
  }
  await applyRuntimeOption(context, runtime, request.launch, request.runtime.model, "model", policies.model, emit)
  await applyRuntimeOption(context, runtime, request.launch, request.runtime.reasoning, "reasoning", policies.reasoning, emit)
  await applyRuntimeOption(context, runtime, request.launch, request.runtime.speed, "speed", policies.speed, emit)
}

function normalizeSessionConfigOptions(
  launch: ProviderLaunch,
  configOptions: readonly SessionConfigOption[] | null | undefined,
  metadata: Readonly<Record<string, unknown>> | null | undefined,
): SessionConfigOption[] {
  if (launch.sessionConfigNormalizer === undefined) return [...(configOptions ?? [])]
  try {
    return [...launch.sessionConfigNormalizer({ configOptions, metadata })]
  } catch {
    throw new AcpTurnError("protocol", "agent configuration metadata could not be normalized")
  }
}

async function applyRuntimeOption(
  context: acp.ClientContext,
  runtime: SessionRuntime,
  launch: ProviderLaunch,
  requested: string,
  name: RuntimeOptionName,
  policy: RuntimeOptionPolicy,
  emit: AcpTurnEventListener,
): Promise<void> {
  if (requested === "auto") {
    emit({
      type: "runtime_option",
      name,
      requested,
      outcome: "default",
      ...(policy === "launch-time" ? { detail: "launch-time" } : {}),
    })
    return
  }
  if (policy === "launch-time") {
    emit({ type: "runtime_option", name, requested, outcome: "applied", detail: "launch-time" })
    return
  }

  const option = findConfigOption(runtime.currentOptions, name)
  if (option === undefined) {
    emit({ type: "runtime_option", name, requested, outcome: "unsupported" })
    if (policy === "required") throw new AcpTurnError("protocol", `agent did not advertise a ${name} configuration option`)
    return
  }

  try {
    let value: string | boolean
    let type: "boolean" | undefined
    if (option.type === "boolean") {
      if (name !== "speed") throw new AcpTurnError("protocol", `${name} configuration option is boolean`)
      value = requested === "fast"
      type = "boolean"
    } else {
      const values = flattenSelectOptions(option.options)
      const selected = values.find((candidate) =>
        candidate.value === requested || candidate.name.toLowerCase() === requested.toLowerCase(),
      )
      if (selected === undefined) {
        throw new AcpTurnError("protocol", `${name} ${requested} is not an advertised configuration value`)
      }
      value = selected.value
    }
    const params: acp.SetSessionConfigOptionRequest = type === "boolean"
      ? { sessionId: runtime.sessionId, configId: option.id, type, value: value as boolean }
      : { sessionId: runtime.sessionId, configId: option.id, value: value as string }
    const response = await context.request(acp.methods.agent.session.setConfigOption, params) as acp.SetSessionConfigOptionResponse
    runtime.currentOptions = normalizeSessionConfigOptions(
      launch,
      response.configOptions,
      response._meta,
    )
    emit({ type: "session_configured", options: runtime.currentOptions })
    emit({ type: "runtime_option", name, requested, outcome: "applied" })
  } catch (error) {
    if (error instanceof AcpTurnError) throw error
    throw new AcpTurnError("protocol", `unable to set ${name} configuration option`, error)
  }
}

function findConfigOption(
  options: readonly SessionConfigOption[],
  name: RuntimeOptionName,
): SessionConfigOption | undefined {
  const ids: Record<RuntimeOptionName, readonly string[]> = {
    model: ["model"],
    reasoning: ["reasoning_effort", "effort", "reasoning"],
    speed: ["speed", "fast"],
  }
  const categories: Record<RuntimeOptionName, readonly string[]> = {
    model: ["model"],
    reasoning: ["thought_level"],
    speed: ["_speed"],
  }
  return options.find((option) => ids[name].includes(option.id) || categories[name].includes(option.category ?? ""))
}

function selectAuthMethod(
  launch: ProviderLaunch,
  advertisedMethods: readonly { id: string }[] | null | undefined,
): string | undefined {
  if (launch.authMethod !== undefined && launch.authMethod !== null && launch.authPreference !== undefined) {
    throw new AcpTurnError("protocol", "ACP launch cannot combine exact and preferred authentication")
  }

  const advertised = advertisedMethods ?? []
  if (launch.authMethod !== undefined && launch.authMethod !== null) {
    if (!advertised.some((method) => method.id === launch.authMethod)) {
      throw new AcpTurnError("protocol", `ACP auth method ${launch.authMethod} was not advertised`)
    }
    return launch.authMethod
  }

  if (launch.authPreference === undefined) return undefined
  const selected = launch.authPreference.methodIds.find((methodId) =>
    advertised.some((method) => method.id === methodId),
  )
  if (selected !== undefined) return selected
  throw new AcpTurnError("provider", launch.authPreference.unavailableMessage)
}

function flattenSelectOptions(options: SessionConfigSelectOptions): SessionConfigSelectOption[] {
  return options.flatMap((entry) => "options" in entry ? entry.options : [entry])
}

async function runSessionTurn(
  session: acp.ActiveSession,
  runtime: SessionRuntime,
  prompt: string,
  request: AcpSessionRequest,
  emit: AcpTurnEventListener,
  cancellation: CancellationState,
  permissionState: { denied: boolean },
  settleCancellation: () => Promise<void>,
  process: SupervisedProcess,
): Promise<AcpTurnResult> {
  if (cancellation.aborted) await settleCancellation()
  const promptRequest = session.prompt(prompt, {})
  const promptFailure = promptRequest.then<never>(
    () => new Promise<never>(() => {}),
    (error: unknown) => Promise.reject(normalizeAcpError(error, "transport", request.signal)),
  )
  let finalText = ""
  let stopReason: AcpStopReason | undefined
  try {
    for (;;) {
      const nextUpdate = session.nextUpdate()
      const message = cancellation.aborted && cancellation.gracePromise !== undefined
        ? await Promise.race([nextUpdate, promptFailure, cancellation.gracePromise])
        : await Promise.race([nextUpdate, promptFailure])
      if (message === CANCEL_GRACE_EXPIRED) {
        const startedAt = cancellation.startedAt ?? Date.now()
        cancellation.cleanupPromise ??= process.cancelTree(startedAt + PROCESS_CLEANUP_DEADLINE_MS)
        stopReason = "cancelled"
        break
      }
      if (message.kind === "stop") {
        stopReason = message.stopReason
        break
      }
      const update = message.update
      if (update.sessionUpdate === "config_option_update") {
        runtime.currentOptions = normalizeSessionConfigOptions(
          request.launch,
          update.configOptions,
          update._meta,
        )
        emit({ type: "session_configured", options: runtime.currentOptions })
      }
      if (update.sessionUpdate === "agent_message_chunk" && update.content.type === "text") {
        finalText += update.content.text
      }
      emit({ type: "session_update", sessionId: runtime.sessionId, update })
    }
  } catch (error) {
    if (cancellation.aborted) {
      stopReason = "cancelled"
    } else {
      throw await normalizeSessionError(error, process, request.signal)
    }
  }
  if (stopReason === undefined) stopReason = cancellation.aborted ? "cancelled" : "refusal"
  emit({ type: "turn_stopped", stopReason })
  const outcome = cancellation.aborted
    ? "cancelled"
    : permissionState.denied
      ? "permission-denied"
      : mapStopReason(stopReason)
  return {
    stopReason,
    finalText,
    permissionDenied: permissionState.denied,
    cleanup: "confirmed",
    outcome,
  }
}

function mapStopReason(stopReason: AcpStopReason): TurnOutcome {
  if (stopReason === "end_turn") return "completed"
  if (stopReason === "cancelled") return "cancelled"
  if (stopReason === "refusal") return "refused"
  if (stopReason === "max_tokens" || stopReason === "max_turn_requests") return "limited"
  return "failed"
}

function toAgentInfo(info: acp.Implementation): AcpAgentInfo {
  return {
    ...(info.name === null || info.name === undefined ? {} : { name: info.name }),
    ...(info.title === null || info.title === undefined ? {} : { title: info.title }),
    ...(info.version === null || info.version === undefined ? {} : { version: info.version }),
  }
}

function resultWithCleanup(
  result: AcpTurnResult | undefined,
  cleanupFailed: boolean,
  permissionDenied: boolean,
  closeFailure?: string,
): AcpTurnResult {
  const base = result ?? {
    finalText: "",
    permissionDenied,
    cleanup: "confirmed" as const,
    outcome: "failed" as const,
  }
  return {
    ...base,
    permissionDenied: base.permissionDenied || permissionDenied,
    cleanup: cleanupFailed ? "failed" : "confirmed",
    outcome: cleanupFailed
      ? "failed"
      : base.outcome ?? mapStopReason(base.stopReason ?? "refusal"),
    ...(closeFailure === undefined ? {} : { failure: "transport" as const }),
  }
}

function isAcpTurnResult(value: unknown): value is AcpTurnResult {
  return typeof value === "object" && value !== null && "finalText" in value && "cleanup" in value
}

function normalizeAcpError(error: unknown, fallback: AcpTurnErrorKind = "transport", signal?: AbortSignal): AcpTurnError {
  if (error instanceof AcpTurnError) return error
  if (signal?.aborted) return new AcpTurnError("provider", "ACP turn cancelled", error)
  const message = error instanceof Error ? error.message : String(error)
  return new AcpTurnError(fallback, message, error)
}

async function normalizeSessionError(
  error: unknown,
  process: SupervisedProcess | undefined,
  signal: AbortSignal,
): Promise<AcpTurnError> {
  if (error instanceof AcpTurnError) {
    if (error.kind === "protocol" || error.kind === "cleanup") return error
  }
  if (process !== undefined) {
    const exit = await settledWithin(process.closed, 100)
    if (exit !== undefined) {
      const detail = exit.signal === null ? `exit ${exit.code ?? "unknown"}` : `signal ${exit.signal}`
      return new AcpTurnError(
        "provider",
        `ACP process ended before the task handoff completed (${detail})`,
        error,
      )
    }
  }
  return normalizeAcpError(error, "transport", signal)
}

async function consumeProviderStderr(
  stream: ReadableStream<Uint8Array>,
  emit: (text: string) => void,
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) {
        const tail = decoder.decode()
        if (tail.length > 0) emit(tail)
        return
      }
      const text = decoder.decode(chunk.value, { stream: true })
      if (text.length > 0) emit(text)
    }
  } catch {
    // Provider stderr is advisory. The process supervisor owns pipe failures.
  } finally {
    reader.releaseLock()
  }
}

function toAcpPermissionResponse(outcome: PermissionOutcome): RequestPermissionResponse {
  if (outcome.decision !== "allowed" && outcome.decision !== "denied") {
    return { outcome: { outcome: "cancelled" } }
  }
  if (outcome.optionId === undefined) return { outcome: { outcome: "cancelled" } }
  return { outcome: { outcome: "selected", optionId: outcome.optionId } }
}

export const toPermissionResponse = toAcpPermissionResponse

function hostWritePermission(sessionId: string, absolutePath: string): RequestPermissionRequest {
  return {
    sessionId,
    toolCall: {
      toolCallId: `host-write:${absolutePath}`,
      title: `write ${absolutePath}`,
      kind: "edit",
      status: "pending",
    },
    options: [
      { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
      { optionId: "reject_once", name: "Reject once", kind: "reject_once" },
    ],
  }
}

function sliceTextFile(content: string, line?: number | null, limit?: number | null): string {
  if (line == null && limit == null) return content
  const start = Math.max(0, (line ?? 1) - 1)
  const lines = content.split(/\r?\n/u)
  return lines.slice(start, limit === undefined || limit === null ? undefined : start + Math.max(0, limit)).join("\n")
}

function omitPrompt(request: AcpTurnRequest): AcpSessionRequest {
  const { prompt: _prompt, ...sessionRequest } = request
  return sessionRequest
}

async function supervisorCleanup(process: SupervisedProcess, deadline: number): Promise<CleanupResult> {
  return process.cancelTree(deadline)
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`ACP session close exceeded ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

async function settledWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), timeoutMs)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
