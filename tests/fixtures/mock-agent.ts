import { Readable, Writable } from "node:stream"
import { spawn } from "node:child_process"
import { access, appendFile, writeFile } from "node:fs/promises"
import * as acp from "@agentclientprotocol/sdk"

if (process.env.SPEC_FINDER_TEST_EXIT_IMMEDIATELY === "1") process.exit(23)
if (process.env.SPEC_FINDER_TEST_DESCENDANT_PID) {
  const descendant = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" })
  if (descendant.pid === undefined) throw new Error("mock descendant did not start")
  await writeFile(process.env.SPEC_FINDER_TEST_DESCENDANT_PID, `${descendant.pid}\n`)
}

let cancelRequested = false
let cancelWaiter: (() => void) | undefined
let configOptions = readConfigOptions(process.env.SPEC_FINDER_TEST_CONFIG_OPTIONS)
const configReplacements = readConfigOptionReplacements(process.env.SPEC_FINDER_TEST_CONFIG_REPLACEMENTS)
const sessionId = process.env.SPEC_FINDER_TEST_SESSION_ID ?? "test-session"

const stream = acp.ndJsonStream(
  Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as unknown as ReadableStream<Uint8Array>,
)

acp
  .agent({ name: "spec-finder-test-agent" })
  .onRequest(acp.methods.agent.initialize, async (context) => {
    await recordLifecycle("initialize")
    if (process.env.SPEC_FINDER_TEST_CAPABILITY_LOG) {
      await appendFile(
        process.env.SPEC_FINDER_TEST_CAPABILITY_LOG,
        `writeTextFile=${String(context.params.clientCapabilities?.fs?.writeTextFile ?? false)}\n`,
      )
    }
    return {
      protocolVersion: Number(process.env.SPEC_FINDER_TEST_PROTOCOL_VERSION ?? acp.PROTOCOL_VERSION),
      agentCapabilities: {
        loadSession: false,
        ...(process.env.SPEC_FINDER_TEST_ADVERTISE_CLOSE === "1"
          ? { sessionCapabilities: { close: {} } }
          : {}),
      },
      ...(process.env.SPEC_FINDER_TEST_AUTH_METHODS === undefined
        ? {}
        : {
            authMethods: process.env.SPEC_FINDER_TEST_AUTH_METHODS.split(",").map((id) => ({
              id,
              name: id,
            })),
          }),
      agentInfo: { name: "spec-finder-test-agent", version: "1.0.0", title: "Test Agent" },
    }
  })
  .onRequest(acp.methods.agent.authenticate, async (context) => {
    await recordLifecycle(`authenticate:${context.params.methodId}`)
    if (process.env.SPEC_FINDER_TEST_EXPECT_AUTH_METHOD !== undefined
      && process.env.SPEC_FINDER_TEST_EXPECT_AUTH_METHOD !== context.params.methodId) {
      throw new Error("unexpected authentication method")
    }
    return {}
  })
  .onRequest(acp.methods.agent.session.new, async () => {
    await recordLifecycle("session/new")
    return {
      sessionId,
      ...(configOptions === undefined ? {} : { configOptions }),
    }
  })
  .onRequest(acp.methods.agent.session.setConfigOption, async (context) => {
    await recordLifecycle(`session/set_config_option:${context.params.configId}:${String(context.params.value)}`)
    configOptions = configReplacements.shift() ?? configOptions ?? []
    return { configOptions }
  })
  .onRequest(acp.methods.agent.session.close, async (context) => {
    await recordLifecycle("session/close")
    const delay = Number(process.env.SPEC_FINDER_TEST_CLOSE_DELAY_MS ?? "0")
    if (delay > 0) await Bun.sleep(delay)
    void context
    return {}
  })
  .onNotification(acp.methods.agent.session.cancel, async (context) => {
    await recordLifecycle("session/cancel")
    cancelRequested = true
    cancelWaiter?.()
    cancelWaiter = undefined
    void context
  })
  .onRequest(acp.methods.agent.session.prompt, async (context) => {
    await recordLifecycle("session/prompt")
    const prompt = context.params.prompt
      .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
      .map((block) => block.text)
      .join("\n")
    if (process.env.SPEC_FINDER_TEST_PROMPT_LOG) {
      await appendFile(process.env.SPEC_FINDER_TEST_PROMPT_LOG, `${prompt}\n--- TURN ---\n`)
    }
    if (process.env.SPEC_FINDER_TEST_PROCESS_LOG) {
      await appendFile(process.env.SPEC_FINDER_TEST_PROCESS_LOG, `${process.pid}\n`)
    }
    await context.client.notify(acp.methods.client.session.update, {
      sessionId: context.params.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "mock turn started" },
      },
    })
    if (process.env.SPEC_FINDER_TEST_EMIT_TOOL_UPDATE === "1") {
      await context.client.notify(acp.methods.client.session.update, {
        sessionId: context.params.sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          kind: process.env.SPEC_FINDER_TEST_TOOL_KIND ?? "read",
          status: process.env.SPEC_FINDER_TEST_TOOL_STATUS ?? "in_progress",
        },
      })
    }
    if (process.env.SPEC_FINDER_TEST_EMIT_THOUGHT === "1") {
      await context.client.notify(acp.methods.client.session.update, {
        sessionId: context.params.sessionId,
        update: {
          sessionUpdate: "agent_thought_chunk",
          content: { type: "text", text: "mock thought omitted" },
        },
      })
    }
    await emitConfiguredUpdates(context.params.sessionId, async (update) => {
      await context.client.notify(acp.methods.client.session.update, update)
    })
    const reportPath = prompt.match(/Write the final report to (.+)\. The report MUST/)?.[1]
    if (reportPath && process.env.SPEC_FINDER_TEST_EMIT_REPORT_SESSION_INFO === "1") {
      await context.client.notify(acp.methods.client.session.update, {
        sessionId: context.params.sessionId,
        update: {
          sessionUpdate: "session_info_update",
          title: `Final report prompt: ${prompt}`,
          updatedAt: "2026-08-09T00:00:00.000Z",
          _meta: {
            reportPath,
            prompt,
            control: "unsafe\u001b[31m",
          },
        },
      })
    }
    const exitFirstImplementation = process.env.SPEC_FINDER_TEST_EXIT_FIRST_IMPLEMENTATION
    if (!reportPath && exitFirstImplementation && await claimFirstAttempt(exitFirstImplementation)) process.exit(25)
    const failFirstImplementation = process.env.SPEC_FINDER_TEST_FAIL_FIRST_IMPLEMENTATION
    if (!reportPath && failFirstImplementation && await claimFirstAttempt(failFirstImplementation)) {
      return { stopReason: "refusal" }
    }
    if (process.env.SPEC_FINDER_TEST_REQUEST_PERMISSION === "1") {
      const permission = await context.client.request(acp.methods.client.session.requestPermission, {
        sessionId: context.params.sessionId,
        toolCall: {
          toolCallId: "mock-edit",
          title: "Mock edit",
          kind: "edit",
          status: "pending",
        },
        options: [
          { optionId: "allow", name: "Allow", kind: "allow_once" },
          { optionId: "reject", name: "Reject", kind: "reject_once" },
        ],
      })
      const permissionOutcome = permission.outcome.outcome === "selected"
        ? permission.outcome.optionId
        : "cancelled"
      await context.client.notify(acp.methods.client.session.update, {
        sessionId: context.params.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: `permission response: ${permissionOutcome}` },
        },
      })
      const expectedOutcome = process.env.SPEC_FINDER_TEST_EXPECT_PERMISSION ?? "allow"
      if (permissionOutcome !== expectedOutcome) return { stopReason: "refusal" }
    }
    if (process.env.SPEC_FINDER_TEST_WAIT_FOR_CANCEL === "1") {
      await waitForCancel()
      await context.client.notify(acp.methods.client.session.update, {
        sessionId: context.params.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "trailing update after cancel" },
        },
      })
      return { stopReason: "cancelled" }
    }
    if (process.env.SPEC_FINDER_TEST_FS_READ_PATH) {
      const response = await context.client.request(acp.methods.client.fs.readTextFile, {
        sessionId: context.params.sessionId,
        path: process.env.SPEC_FINDER_TEST_FS_READ_PATH,
      })
      await context.client.notify(acp.methods.client.session.update, {
        sessionId: context.params.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: `read response: ${response.content}` },
        },
      })
    }
    if (process.env.SPEC_FINDER_TEST_FS_WRITE_PATH) {
      await context.client.request(acp.methods.client.fs.writeTextFile, {
        sessionId: context.params.sessionId,
        path: process.env.SPEC_FINDER_TEST_FS_WRITE_PATH,
        content: process.env.SPEC_FINDER_TEST_FS_WRITE_CONTENT ?? "mock write\n",
      })
    }
    if (reportPath) {
      if (process.env.SPEC_FINDER_TEST_CANCEL_REPORT === "1") return { stopReason: "cancelled" }
      const exitFirstReport = process.env.SPEC_FINDER_TEST_EXIT_FIRST_REPORT
      if (exitFirstReport && await claimFirstAttempt(exitFirstReport)) process.exit(24)
      if (process.env.SPEC_FINDER_TEST_FAIL_REPORT === "1") return { stopReason: "refusal" }
      const incompleteFirstReport = process.env.SPEC_FINDER_TEST_INCOMPLETE_FIRST_REPORT
      const incomplete = incompleteFirstReport
        ? await claimFirstAttempt(incompleteFirstReport)
        : false
      await context.client.request(acp.methods.client.fs.writeTextFile, {
        sessionId: context.params.sessionId,
        path: reportPath,
        content: incomplete
          ? "# Incomplete report\n"
          : `# Final Report\n\nTask and outcome: completed.\n\nFiles changed: mock output.\n\nRequirements satisfied: all mock requirements.\n\nTests and exact results: ACP integration passed.\n\nUnresolved risks: none.\n\nFinal verdict: completed.\n`,
      })
    }
    return {
      stopReason: readStopReason(
        process.env.SPEC_FINDER_TEST_STOP_REASON ?? modeStopReason(process.env.SPEC_FINDER_TEST_MODE),
      ),
    }
  })
  .connect(stream)

async function claimFirstAttempt(path: string): Promise<boolean> {
  try {
    await access(path)
    return false
  } catch {
    await writeFile(path, "attempted\n")
    return true
  }
}

async function recordLifecycle(step: string): Promise<void> {
  const path = process.env.SPEC_FINDER_TEST_LIFECYCLE_LOG
  if (path) await appendFile(path, `${step}\n`)
}

async function waitForCancel(): Promise<void> {
  if (cancelRequested) return
  await new Promise<void>((resolve) => { cancelWaiter = resolve })
}

async function emitConfiguredUpdates(
  sessionId: string,
  notify: (update: { sessionId: string; update: acp.SessionUpdate }) => Promise<void>,
): Promise<void> {
  const raw = process.env.SPEC_FINDER_TEST_CONFIG_UPDATES
  if (raw === undefined) return
  const updates = JSON.parse(raw) as acp.SessionConfigOption[][]
  for (const options of updates) {
    await notify({
      sessionId,
      update: {
        sessionUpdate: "config_option_update",
        configOptions: options,
      },
    })
  }
}

function readConfigOptions(raw: string | undefined): acp.SessionConfigOption[] | undefined {
  if (raw === undefined) return undefined
  return JSON.parse(raw) as acp.SessionConfigOption[]
}

function readConfigOptionReplacements(raw: string | undefined): acp.SessionConfigOption[][] {
  if (raw === undefined) return []
  return JSON.parse(raw) as acp.SessionConfigOption[][]
}

function readStopReason(raw: string | undefined): acp.StopReason {
  if (raw === "max_tokens" || raw === "max_turn_requests" || raw === "refusal" || raw === "cancelled") return raw
  return "end_turn"
}

function modeStopReason(mode: string | undefined): string | undefined {
  if (mode === "refused") return "refusal"
  if (mode === "limited") return "max_tokens"
  if (mode === "turn-limited") return "max_turn_requests"
  if (mode === "cancelled") return "cancelled"
  return undefined
}
