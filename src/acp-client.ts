import { spawn } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { Readable, Writable } from "node:stream"
import { createInterface } from "node:readline/promises"
import * as acp from "@agentclientprotocol/sdk"
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionConfigOption,
} from "@agentclientprotocol/sdk"
import type { SpecFinderConfig } from "./config.ts"
import type { RunEventListener } from "./events.ts"
import { assertInsideWorkspace } from "./paths.ts"
import { resolveProviderLaunch, type ProviderLaunch } from "./providers.ts"
import { VERSION } from "./version.ts"

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

export async function runAcpTurn(options: AcpTurnOptions): Promise<AcpTurnResult> {
  const launch = options.providerLaunch ?? resolveProviderLaunch(options.config)
  const child = spawn(launch.command, launch.args, {
    cwd: options.root,
    env: { ...process.env, ...launch.env },
    stdio: ["pipe", "pipe", "pipe"],
  })

  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk: string) => options.emit({ type: "activity", taskId: options.taskId, message: chunk }))

  const stream = acp.ndJsonStream(
    Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
    Readable.toWeb(child.stdout) as unknown as ReadableStream<Uint8Array>,
  )

  const handlers = acp
    .client({ name: "spec-finder" })
    .onRequest(acp.methods.client.session.requestPermission, (context) =>
      resolvePermission(context.params, options),
    )
    .onRequest(acp.methods.client.fs.readTextFile, async (context) => ({
      content: await readTextFile(options.root, context.params.path, context.params.line, context.params.limit),
    }))
    .onRequest(acp.methods.client.fs.writeTextFile, async (context) => {
      const path = assertInsideWorkspace(options.root, context.params.path)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, context.params.content)
      return {}
    })

  const onAbort = () => child.kill("SIGTERM")
  options.signal.addEventListener("abort", onAbort, { once: true })

  try {
    return await handlers.connectWith(stream, async (context) => {
      const initialized = await context.request(acp.methods.agent.initialize, {
        protocolVersion: acp.PROTOCOL_VERSION,
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          session: { configOptions: { boolean: {} } },
        },
        clientInfo: { name: "spec-finder", version: VERSION, title: "Spec Finder" },
      })
      options.emit({
        type: "activity",
        taskId: options.taskId,
        message: `ACP ${initialized.agentInfo?.title ?? initialized.agentInfo?.name ?? options.config.provider} initialized`,
      })

      if (launch.authMethod) {
        const offered = initialized.authMethods?.find((method) => method.id === launch.authMethod)
        if (!offered) throw new Error(`ACP auth method ${launch.authMethod} was not advertised`)
        await context.request(acp.methods.agent.authenticate, { methodId: offered.id })
      }

      return context.buildSession(options.root).withSession(async (session) => {
        await configureSession(context, session, options)
        const turn = session.prompt(options.prompt, { cancellationSignal: options.signal })
        const failure = turn.then<never>(
          () => new Promise<never>(() => {}),
          (error: unknown) => Promise.reject(error),
        )
        for (;;) {
          const message = await Promise.race([session.nextUpdate(), failure])
          if (message.kind === "stop") return { stopReason: message.stopReason }
          options.emit({ type: "session_update", taskId: options.taskId, update: message.update })
        }
      })
    })
  } finally {
    options.signal.removeEventListener("abort", onAbort)
    if (!child.killed) child.kill("SIGTERM")
  }
}

async function configureSession(
  context: acp.ClientContext,
  session: acp.ActiveSession,
  options: AcpTurnOptions,
): Promise<void> {
  let configOptions = session.newSessionResponse.configOptions ?? []
  if (options.config.provider !== "claude" && options.config.provider !== "cursor") {
    configOptions = await applySelect(context, session.sessionId, configOptions, {
      name: "model",
      requested: options.config.model,
      ids: ["model"],
      categories: ["model"],
      required: options.config.model !== "auto",
    }, options.emit)
  } else {
    options.emit({ type: "runtime_option", name: "model", requested: options.config.model, outcome: options.config.model === "auto" ? "default" : "applied", detail: "launch-time" })
  }

  configOptions = await applySelect(context, session.sessionId, configOptions, {
    name: "reasoning",
    requested: options.config.reasoning,
    ids: ["reasoning_effort", "effort", "reasoning"],
    categories: ["thought_level"],
    required: false,
  }, options.emit)

  await applySpeed(context, session.sessionId, configOptions, options.config.speed, options.emit)
}

interface SelectRequest {
  name: "model" | "reasoning"
  requested: string
  ids: string[]
  categories: string[]
  required: boolean
}

async function applySelect(
  context: acp.ClientContext,
  sessionId: string,
  options: SessionConfigOption[],
  request: SelectRequest,
  emit: RunEventListener,
): Promise<SessionConfigOption[]> {
  if (request.requested === "auto") {
    emit({ type: "runtime_option", name: request.name, requested: request.requested, outcome: "default" })
    return options
  }
  const option = options.find((candidate) =>
    candidate.type === "select" && (request.ids.includes(candidate.id) || request.categories.includes(candidate.category ?? "")),
  )
  if (!option || option.type !== "select") {
    emit({ type: "runtime_option", name: request.name, requested: request.requested, outcome: "unsupported" })
    if (request.required) throw new Error(`agent did not advertise a ${request.name} configuration option`)
    return options
  }
  const values = flattenSelectOptions(option.options)
  const selected = values.find((value) => value.value === request.requested || value.name.toLowerCase() === request.requested.toLowerCase())
  if (!selected) {
    throw new Error(`${request.name} ${request.requested} is invalid; available values: ${values.map((value) => value.value).join(", ")}`)
  }
  const response = await context.request(acp.methods.agent.session.setConfigOption, {
    sessionId,
    configId: option.id,
    value: selected.value,
  })
  emit({ type: "runtime_option", name: request.name, requested: request.requested, outcome: "applied" })
  return response.configOptions
}

async function applySpeed(
  context: acp.ClientContext,
  sessionId: string,
  options: SessionConfigOption[],
  requested: SpecFinderConfig["speed"],
  emit: RunEventListener,
): Promise<void> {
  if (requested === "auto") {
    emit({ type: "runtime_option", name: "speed", requested, outcome: "default" })
    return
  }
  const option = options.find((candidate) => candidate.id === "speed" || candidate.id === "fast" || candidate.category === "_speed")
  if (!option) {
    emit({ type: "runtime_option", name: "speed", requested, outcome: "unsupported" })
    return
  }
  if (option.type === "boolean") {
    await context.request(acp.methods.agent.session.setConfigOption, {
      sessionId,
      configId: option.id,
      type: "boolean",
      value: requested === "fast",
    })
  } else {
    const values = flattenSelectOptions(option.options)
    const selected = values.find((value) => value.value === requested || value.name.toLowerCase() === requested)
    if (!selected) {
      emit({ type: "runtime_option", name: "speed", requested, outcome: "unsupported", detail: "value unavailable" })
      return
    }
    await context.request(acp.methods.agent.session.setConfigOption, {
      sessionId,
      configId: option.id,
      value: selected.value,
    })
  }
  emit({ type: "runtime_option", name: "speed", requested, outcome: "applied" })
}

function flattenSelectOptions(options: acp.SessionConfigSelectOptions): acp.SessionConfigSelectOption[] {
  return options.flatMap((entry) => "options" in entry ? entry.options : [entry])
}

async function resolvePermission(request: RequestPermissionRequest, options: AcpTurnOptions): Promise<RequestPermissionResponse> {
  if (options.config.permissions !== "prompt") {
    const allow = options.config.permissions === "approve-all"
    const selected = request.options.find((option) => allow ? option.kind.startsWith("allow") : option.kind.startsWith("reject"))
    return selected
      ? { outcome: { outcome: "selected", optionId: selected.optionId } }
      : { outcome: { outcome: "cancelled" } }
  }
  if (options.interactivePermissions) {
    options.emit({
      type: "activity",
      taskId: options.taskId,
      message: "Permission request cancelled because the cockpit is read-only; configure permissions before rerunning.",
    })
    return { outcome: { outcome: "cancelled" } }
  }
  if (!process.stdin.isTTY) return { outcome: { outcome: "cancelled" } }
  const readline = createInterface({ input: process.stdin, output: process.stdout })
  try {
    process.stdout.write(`\nPermission: ${request.toolCall.title}\n`)
    request.options.forEach((option, index) => process.stdout.write(`  ${index + 1}. ${option.name} (${option.kind})\n`))
    const answer = await readline.question("Choose an option: ")
    const selected = request.options[Number(answer) - 1]
    return selected ? { outcome: { outcome: "selected", optionId: selected.optionId } } : { outcome: { outcome: "cancelled" } }
  } finally {
    readline.close()
  }
}

async function readTextFile(root: string, candidate: string, line?: number | null, limit?: number | null): Promise<string> {
  const path = assertInsideWorkspace(root, candidate)
  const content = await readFile(path, "utf8")
  if (!line && !limit) return content
  const lines = content.split(/\r?\n/)
  const start = Math.max(0, (line ?? 1) - 1)
  return lines.slice(start, limit ? start + limit : undefined).join("\n")
}
