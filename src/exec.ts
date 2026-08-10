import {
  parseExecArguments,
  type ParsedExecArguments,
} from "./commands.ts"
import {
  AcpTurnError,
  runAcpTurn,
  type AcpTurn,
  type AcpTurnRequest,
  type AcpTurnResult,
  type AuthMethodPreference,
  type ExecOutcome,
  type PermissionBroker,
  type ProcessSupervisor,
  type ProviderStderrPolicy,
  type ProviderLaunch as NeutralProviderLaunch,
  type SessionConfigNormalizer,
  type WorkspaceAccess,
} from "./acp-turn.ts"
import {
  ExecConfigError,
  resolveExecConfig,
  resolveExecLaunch,
  type ExecConfigDependencies,
  type ResolveExecConfigOptions,
} from "./exec-config.ts"
import {
  ExecOutputReporter,
  type ExecOutputStream,
  type ExecOutputStreams,
} from "./exec-output.ts"
import {
  createPermissionRegistry,
  type PermissionInput,
  type PermissionOutput,
} from "./permission-registry.ts"
import {
  ProviderCertificationError,
  resolveExecProviderLaunch,
} from "./providers.ts"
import { createProcessSupervisor } from "./process-supervisor.ts"
import { createWorkspaceAccess, WorkspaceAccessError } from "./workspace-access.ts"

/** A launch supplied by a test fixture is the only way to run before task 09. */
export interface ExecFixtureLaunch {
  mode?: "packet" | "exec"
  command: string
  args: readonly string[]
  env: Readonly<Record<string, string>>
  authMethod?: string | null
  authPreference?: AuthMethodPreference
  sessionConfigNormalizer?: SessionConfigNormalizer
  stderrPolicy?: ProviderStderrPolicy
  /** Accepted for embedding compatibility; the canonical workspace wins. */
  cwd?: string
}

export interface ExecRunOptions extends ExecConfigDependencies {
  /** Redirected final response stream; defaults to process.stdout. */
  stdout?: ExecOutputStream
  /** Human progress stream; defaults to process.stderr. */
  stderr?: ExecOutputStream
  /** Alias for stdout used by embedding callers. */
  output?: ExecOutputStream
  streams?: ExecOutputStreams
  /** Permission input; defaults to process.stdin. */
  input?: PermissionInput
  /** Optional externally-owned cancellation signal. */
  signal?: AbortSignal
  /** Optional controller used by the command signal bridge. */
  controller?: AbortController
  /** Optional repeated-cancellation signal and controller used by the command bridge. */
  forceSignal?: AbortSignal
  forceController?: AbortController
  /** Deterministic fixture launch. Real launches remain certification-gated. */
  providerLaunch?: ExecFixtureLaunch
  fixtureLaunch?: ExecFixtureLaunch
  launch?: ExecFixtureLaunch
  /** Inject lower-level contracts for fixture and composition tests. */
  permission?: PermissionBroker
  supervisor?: ProcessSupervisor
  hostAccess?: WorkspaceAccess
  turn?: AcpTurn | ((request: AcpTurnRequest) => Promise<AcpTurnResult>)
  runTurn?: (request: AcpTurnRequest) => Promise<AcpTurnResult>
  resolveConfig?: (options: ResolveExecConfigOptions) => Promise<import("./acp-turn.ts").ResolvedExecContext>
  resolveLaunch?: (
    context: import("./acp-turn.ts").ResolvedExecContext,
    fixture?: ExecFixtureLaunch,
  ) => ExecFixtureLaunch
}

export interface ExecRunResult {
  exitCode: number
  outcome: ExecOutcome
}

/**
 * Compose one packet-free ACP turn. This function deliberately has no packet,
 * task, report, memory, checkpoint, cockpit, or history dependencies.
 */
export async function runExec(
  args: readonly string[],
  options: ExecRunOptions = {},
): Promise<number> {
  const streams = resolveStreams(options)
  const reporter = new ExecOutputReporter(streams)
  const parsed = parseExecArguments(args)
  if (parsed.mode === "error") {
    writeDiagnostic(streams.stderr, parsed.error.message)
    reporter.finish({ outcome: "invalid-invocation", cleanup: "confirmed" })
    return 2
  }

  let context: import("./acp-turn.ts").ResolvedExecContext
  let effectiveContext: import("./acp-turn.ts").ResolvedExecContext
  let launch: NeutralProviderLaunch
  try {
    context = await resolveContext(parsed, options)
    effectiveContext = {
      ...context,
      hostAccess: "read-only",
    }
    const fixture = options.providerLaunch ?? options.fixtureLaunch ?? options.launch
    const resolved = options.resolveLaunch === undefined
      ? resolveExecLaunch(context, fixture === undefined ? undefined : toProviderFixture(fixture))
      : options.resolveLaunch(context, fixture)
    launch = toNeutralLaunch(context.workspace, resolved)
  } catch (error) {
    const outcome = classifyPreflightError(error)
    writeDiagnostic(streams.stderr, preflightErrorMessage(error))
    reporter.finish({ outcome, cleanup: "confirmed" })
    return exitCodeFor(outcome)
  }

  const controller = options.controller
  const signal = options.signal ?? controller?.signal ?? new AbortController().signal
  let permission: PermissionBroker
  let hostAccess: WorkspaceAccess
  let supervisor: ProcessSupervisor
  let executeTurn: (request: AcpTurnRequest) => Promise<AcpTurnResult>
  try {
    const configuredPermission = options.permission ?? createPermissionRegistry({
      policy: context.permission,
      input: options.input ?? process.stdin,
      output: streams.stderr as PermissionOutput,
      signal,
    })
    const baseHostAccess = options.hostAccess ?? createWorkspaceAccess(context.workspace)
    permission = configuredPermission
    // Task 09 owns the write-release gate. Task 08 always runs with the
    // explicit read-only host capability, even if an embedding resolver
    // supplies a broader context by mistake.
    hostAccess = createReadOnlyWorkspaceAccess(baseHostAccess)
    supervisor = options.supervisor ?? createProcessSupervisor()
    executeTurn = resolveTurn(options)
  } catch (error) {
    writeDiagnostic(streams.stderr, preflightErrorMessage(error))
    reporter.finish({ outcome: "config-error", cleanup: "confirmed" })
    return 2
  }

  reporter.preflight(effectiveContext)
  const request: AcpTurnRequest = {
    prompt: parsed.prompt,
    workspace: context.workspace,
    runtime: context.runtime,
    launch,
    hostAccess,
    hostAccessMode: "read-only",
    permission,
    supervisor,
    signal,
    ...(options.forceSignal === undefined ? {} : { forceSignal: options.forceSignal }),
    emit: (event) => reporter.consume(event),
  }

  try {
    const result = await executeTurn(request)
    const publication = reporter.finish(result)
    return exitCodeFor(publication.outcome)
  } catch (error) {
    const result = error instanceof AcpTurnError ? error.result : undefined
    if (result !== undefined) {
      const publication = reporter.finish(result)
      return exitCodeFor(publication.outcome)
    }
    const outcome = classifyTurnError(error, signal)
    writeDiagnostic(streams.stderr, turnErrorMessage(error))
    reporter.finish({
      outcome,
      cleanup: outcome === "cleanup-error" ? "failed" : "confirmed",
      ...(outcome === "provider-error" ? { failure: "transport" as const } : {}),
    })
    return exitCodeFor(outcome)
  } finally {
    const disposable = permission as PermissionBroker & { dispose?: () => Promise<void> }
    try {
      await disposable.dispose?.()
    } catch {
      // Permission cleanup is in-memory and advisory after the turn has a
      // terminal result; the ACP supervisor owns process cleanup truth.
    }
  }
}

/** Descriptive aliases for CLI and embedding callers. */
export const execCommand = runExec
export const executeExec = runExec
export const runExecCommand = runExec
export const executeExecCommand = runExec

function resolveStreams(options: ExecRunOptions): ExecOutputStreams {
  const stdout = options.streams?.stdout ?? options.stdout ?? options.output ?? process.stdout
  const stderr = options.streams?.stderr ?? options.stderr ?? process.stderr
  return { stdout, stderr }
}

async function resolveContext(
  parsed: ParsedExecArguments,
  options: ExecRunOptions,
): Promise<import("./acp-turn.ts").ResolvedExecContext> {
  const resolve = options.resolveConfig ?? resolveExecConfig
  const dependencies: ResolveExecConfigOptions = {
    overrides: parsed.overrides,
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.home === undefined ? {} : { home: options.home }),
    ...(options.readFile === undefined ? {} : { readFile: options.readFile }),
    ...(options.findWorkspace === undefined ? {} : { findWorkspace: options.findWorkspace }),
  }
  return resolve(dependencies)
}

function resolveTurn(options: ExecRunOptions): (request: AcpTurnRequest) => Promise<AcpTurnResult> {
  if (options.runTurn !== undefined) return options.runTurn
  const turn = options.turn
  if (turn !== undefined) {
    return typeof turn === "function"
      ? turn
      : (request) => turn.run(request)
  }
  return runAcpTurn
}

function toNeutralLaunch(workspace: string, launch: ExecFixtureLaunch): NeutralProviderLaunch {
  return {
    command: launch.command,
    args: [...launch.args],
    // The invocation-derived canonical workspace is authoritative. Fixtures
    // cannot add a custom cwd or broaden the host boundary.
    cwd: workspace,
    env: { ...launch.env },
    authMethod: launch.authMethod ?? null,
    ...(launch.authPreference === undefined
      ? {}
      : {
          authPreference: {
            methodIds: [...launch.authPreference.methodIds],
            unavailableMessage: launch.authPreference.unavailableMessage,
          },
        }),
    ...(launch.sessionConfigNormalizer === undefined ? {} : { sessionConfigNormalizer: launch.sessionConfigNormalizer }),
    ...(launch.stderrPolicy === undefined ? {} : { stderrPolicy: launch.stderrPolicy }),
  }
}

function toProviderFixture(fixture: ExecFixtureLaunch): Parameters<typeof resolveExecProviderLaunch>[1] {
  return {
    ...(fixture.mode === undefined ? {} : { mode: fixture.mode }),
    command: fixture.command,
    args: [...fixture.args],
    env: { ...fixture.env },
    authMethod: fixture.authMethod ?? null,
    ...(fixture.authPreference === undefined
      ? {}
      : {
          authPreference: {
            methodIds: [...fixture.authPreference.methodIds],
            unavailableMessage: fixture.authPreference.unavailableMessage,
          },
        }),
    ...(fixture.sessionConfigNormalizer === undefined ? {} : { sessionConfigNormalizer: fixture.sessionConfigNormalizer }),
    ...(fixture.stderrPolicy === undefined ? {} : { stderrPolicy: fixture.stderrPolicy }),
  }
}

function createReadOnlyWorkspaceAccess(delegate: WorkspaceAccess): WorkspaceAccess {
  return {
    readTextFile: (absolutePath) => delegate.readTextFile(absolutePath),
    writeTextFile: async (absolutePath) => {
      throw new WorkspaceAccessError(
        "missing-authorizer",
        absolutePath,
        "exec host access is read-only until release certification",
      )
    },
  }
}

function classifyPreflightError(error: unknown): ExecOutcome {
  // Invalid certification is a pre-spawn configuration/usage failure for the
  // command contract. It is intentionally not a provider process failure.
  if (error instanceof ExecConfigError || error instanceof ProviderCertificationError) return "config-error"
  if (error instanceof WorkspaceAccessError) return "config-error"
  return "config-error"
}

function preflightErrorMessage(error: unknown): string {
  if (error instanceof ExecConfigError) return `exec configuration: ${safeDiagnostic(error.message)}`
  if (error instanceof ProviderCertificationError) return `exec provider unavailable: ${safeDiagnostic(error.message)}`
  if (error instanceof WorkspaceAccessError) return `exec workspace access: ${safeDiagnostic(error.message)}`
  return `exec preflight failed: ${safeDiagnostic(error)}`
}

function writeDiagnostic(stream: ExecOutputStream, message: string): void {
  stream.write(`${safeDiagnostic(message)}\n`)
}

function classifyTurnError(error: unknown, signal: AbortSignal): ExecOutcome {
  if (signal.aborted) return "cancelled"
  if (error instanceof AcpTurnError && error.kind === "cleanup") return "cleanup-error"
  return "provider-error"
}

function turnErrorMessage(error: unknown): string {
  if (error instanceof AcpTurnError) {
    if (error.kind === "cleanup") return "exec turn: cleanup error"
    if (error.kind === "protocol") return "exec turn: protocol error"
    if (error.kind === "provider") return "exec turn: provider error"
    return "exec turn: transport error"
  }
  return "exec turn failed: provider error"
}

function safeDiagnostic(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/[\u0000-\u001F\u007F]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 400)
}

function exitCodeFor(outcome: ExecOutcome | string): number {
  if (outcome === "completed") return 0
  if (outcome === "invalid-invocation" || outcome === "config-error") return 2
  if (outcome === "cancelled") return 130
  return 1
}

export const execExitCode = exitCodeFor
