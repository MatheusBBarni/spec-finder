import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { SessionConfigOption } from "@agentclientprotocol/sdk"
import {
  createProcessSupervisor,
  type SupervisedProcessHandle,
} from "../src/process-supervisor.ts"
import {
  runAcpTurn,
  type AcpTurnRequest,
  type AcpTurnResult,
  type PermissionBroker,
  type ProcessSupervisor,
  type ProviderLaunch,
  type WorkspaceAccess,
} from "../src/acp-turn.ts"

const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")

describe("neutral ACP v1 turn core", () => {
  test("exports the runtime core without importing packet event types", async () => {
    const module = await import("../src/acp-turn.ts")
    expect(Object.keys(module)).toContain("runAcpTurn")
    expect(await Bun.file(join(import.meta.dir, "..", "src", "acp-turn.ts")).text()).not.toContain("./events.ts")
  })

  test("rejects a non-v1 initialize response before session creation", async () => {
    const { root, lifecycleLog } = await fixtureContext()
    const request = makeRequest(root, lifecycleLog, { SPEC_FINDER_TEST_PROTOCOL_VERSION: "2" })

    await expect(runAcpTurn(request)).rejects.toThrow("unsupported ACP protocol version 2")
    expect(await lifecycleSteps(lifecycleLog)).toEqual(["initialize"])
  })

  test("authenticates only with the advertised method before creating a session", async () => {
    const { root, lifecycleLog } = await fixtureContext()
    const request = makeRequest(root, lifecycleLog, {
      SPEC_FINDER_TEST_AUTH_METHODS: "oauth,device",
      SPEC_FINDER_TEST_EXPECT_AUTH_METHOD: "oauth",
    }, { authMethod: "oauth" })

    const result = await runAcpTurn(request)

    expect(result.stopReason).toBe("end_turn")
    expect(await lifecycleSteps(lifecycleLog)).toEqual([
      "initialize",
      "authenticate:oauth",
      "session/new",
      "session/prompt",
    ])
  })

  test("prefers an advertised API-key method over the cached Grok login", async () => {
    const { root, lifecycleLog } = await fixtureContext()
    const request = makeRequest(root, lifecycleLog, {
      SPEC_FINDER_TEST_AUTH_METHODS: "cached_token,xai.api_key",
      SPEC_FINDER_TEST_EXPECT_AUTH_METHOD: "xai.api_key",
    }, {
      authPreference: grokAuthPreference(["xai.api_key", "cached_token"]),
    })

    const result = await runAcpTurn(request)

    expect(result.stopReason).toBe("end_turn")
    expect(await lifecycleSteps(lifecycleLog)).toEqual([
      "initialize",
      "authenticate:xai.api_key",
      "session/new",
      "session/prompt",
    ])
  })

  test("uses an advertised cached Grok login when API-key authentication is unavailable", async () => {
    const { root, lifecycleLog } = await fixtureContext()
    const request = makeRequest(root, lifecycleLog, {
      SPEC_FINDER_TEST_AUTH_METHODS: "cached_token",
      SPEC_FINDER_TEST_EXPECT_AUTH_METHOD: "cached_token",
    }, {
      authPreference: grokAuthPreference(["xai.api_key", "cached_token"]),
    })

    const result = await runAcpTurn(request)

    expect(result.stopReason).toBe("end_turn")
    expect(await lifecycleSteps(lifecycleLog)).toEqual([
      "initialize",
      "authenticate:cached_token",
      "session/new",
      "session/prompt",
    ])
  })

  test("fails before session creation when no preferred Grok authentication method is advertised", async () => {
    const { root, lifecycleLog } = await fixtureContext()
    const request = makeRequest(root, lifecycleLog, {
      SPEC_FINDER_TEST_AUTH_METHODS: "oauth",
    }, {
      authPreference: grokAuthPreference(["xai.api_key", "cached_token"]),
    })

    await expect(runAcpTurn(request)).rejects.toThrow("Run `grok login` or set XAI_API_KEY")
    expect(await lifecycleSteps(lifecycleLog)).toEqual(["initialize"])
  })

  test("does not fall back after a selected Grok authentication attempt fails", async () => {
    const { root, lifecycleLog } = await fixtureContext()
    const events: import("../src/acp-turn.ts").AcpTurnEvent[] = []
    const request = makeRequest(root, lifecycleLog, {
      SPEC_FINDER_TEST_AUTH_METHODS: "xai.api_key,cached_token",
      SPEC_FINDER_TEST_EXPECT_AUTH_METHOD: "xai.api_key",
      SPEC_FINDER_TEST_FAIL_AUTHENTICATE: "1",
    }, {
      authPreference: grokAuthPreference(["xai.api_key", "cached_token"]),
    }, { emit: (event) => events.push(event) })

    const error = await runAcpTurn(request).catch((failure: unknown) => failure)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe("ACP authentication failed for xai.api_key")
    expect((error as import("../src/acp-turn.ts").AcpTurnError).cause).toBeUndefined()
    expect(JSON.stringify(events)).not.toContain("untrusted authentication detail")
    expect(await lifecycleSteps(lifecycleLog)).toEqual(["initialize", "authenticate:xai.api_key"])
  })

  test("emits one redacted activity while draining repeated provider diagnostics", async () => {
    const { root, lifecycleLog } = await fixtureContext()
    const events: import("../src/acp-turn.ts").AcpTurnEvent[] = []
    const request = makeRequest(root, lifecycleLog, {}, {
      stderrPolicy: "redact",
    }, {
      supervisor: chunkedStderrSupervisor([
        "XAI_API_KEY=FIRST_SENTINEL",
        "cached_token=SECOND_SENTINEL",
        "third diagnostic",
      ]),
      emit: (event) => events.push(event),
    })

    const result = await runAcpTurn(request)
    const diagnostics = events.filter((event) => event.type === "provider_stderr")

    expect(result.stopReason).toBe("end_turn")
    expect(diagnostics).toEqual([{
      type: "provider_stderr",
      text: "Provider emitted diagnostic output; details redacted.",
    }])
    expect(JSON.stringify(events)).not.toContain("SENTINEL")
  })

  test("replaces complete config-option state after every response and update", async () => {
    const { root, lifecycleLog } = await fixtureContext()
    const initialOptions = [
      selectOption("model", "Model", "m1", "Model One", "model"),
      selectOption("reasoning", "Reasoning", "deep", "Deep", "thought_level"),
      booleanOption("speed", "Fast mode", false, "_speed"),
    ]
    const replacementOptions = [
      [selectOption("model", "Model", "m1", "Model One", "model"), booleanOption("speed", "Fast mode", false, "_speed")],
      [selectOption("reasoning", "Reasoning", "deep", "Deep", "thought_level")],
      [booleanOption("speed", "Fast mode", true, "_speed")],
    ]
    const updates = [[selectOption("model", "Model", "m2", "Model Two", "model")]]
    const events: import("../src/acp-turn.ts").AcpTurnEvent[] = []
    const request = makeRequest(root, lifecycleLog, {
      SPEC_FINDER_TEST_CONFIG_OPTIONS: JSON.stringify(initialOptions),
      SPEC_FINDER_TEST_CONFIG_REPLACEMENTS: JSON.stringify(replacementOptions),
      SPEC_FINDER_TEST_CONFIG_UPDATES: JSON.stringify(updates),
    }, undefined, {
      model: "m1",
      reasoning: "deep",
      speed: "fast",
      emit: (event) => events.push(event),
    })

    const result = await runAcpTurn(request)

    expect(result.stopReason).toBe("end_turn")
    expect(events.filter((event) => event.type === "session_configured").at(-1)).toEqual({
      type: "session_configured",
      options: updates[0]!,
    })
    expect((await lifecycleSteps(lifecycleLog)).filter((step) => step.startsWith("session/set_config_option"))).toHaveLength(2)
  })

  test("calls optional session close only when advertised", async () => {
    const advertised = await fixtureContext()
    const advertisedResult = await runAcpTurn(makeRequest(advertised.root, advertised.lifecycleLog, {
      SPEC_FINDER_TEST_ADVERTISE_CLOSE: "1",
    }))
    expect(advertisedResult.stopReason).toBe("end_turn")
    expect(await lifecycleSteps(advertised.lifecycleLog)).toContain("session/close")

    const unsupported = await fixtureContext()
    await runAcpTurn(makeRequest(unsupported.root, unsupported.lifecycleLog))
    expect(await lifecycleSteps(unsupported.lifecycleLog)).not.toContain("session/close")
  })

  test("retains raw stop reasons and neutral outcome categories", async () => {
    const cases = [
      ["end_turn", "completed"],
      ["cancelled", "cancelled"],
      ["refusal", "refused"],
      ["max_tokens", "limited"],
      ["max_turn_requests", "limited"],
    ] as const

    for (const [raw, outcome] of cases) {
      const { root, lifecycleLog } = await fixtureContext()
      const result = await runAcpTurn(makeRequest(root, lifecycleLog, { SPEC_FINDER_TEST_STOP_REASON: raw }))
      expect(result.stopReason).toBe(raw)
      expect(result.outcome).toBe(outcome)
    }
  })

  test("semantically cancels, settles pending permission once, and consumes trailing updates", async () => {
    const { root, lifecycleLog } = await fixtureContext()
    const permission = new BlockingPermissionBroker()
    const events: import("../src/acp-turn.ts").AcpTurnEvent[] = []
    const controller = new AbortController()
    const request = makeRequest(root, lifecycleLog, {
      SPEC_FINDER_TEST_REQUEST_PERMISSION: "1",
      SPEC_FINDER_TEST_EXPECT_PERMISSION: "cancelled",
      SPEC_FINDER_TEST_WAIT_FOR_CANCEL: "1",
    }, undefined, {
      signal: controller.signal,
      permission,
      emit: (event) => events.push(event),
    })

    const running = runAcpTurn(request)
    await waitForLifecycle(lifecycleLog, "session/prompt")
    controller.abort()
    const result = await running

    expect(result.stopReason).toBe("cancelled")
    expect(result.outcome).toBe("cancelled")
    expect(permission.cancelCalls).toBe(1)
    expect(await lifecycleSteps(lifecycleLog)).toContain("session/cancel")
    expect(events.some((event) => event.type === "session_update"
      && event.update.sessionUpdate === "agent_message_chunk"
      && event.update.content.type === "text"
      && event.update.content.text === "trailing update after cancel")).toBeTrue()
  }, 5_000)

  test("forces supervised cleanup immediately when cancellation is repeated", async () => {
    const { root, lifecycleLog } = await fixtureContext()
    const controller = new AbortController()
    const forceController = new AbortController()
    const supervisor = countingCleanupSupervisor()
    const request = makeRequest(root, lifecycleLog, {
      SPEC_FINDER_TEST_WAIT_FOR_CANCEL: "1",
    }, undefined, {
      signal: controller.signal,
      forceSignal: forceController.signal,
      supervisor,
    })

    const running = runAcpTurn(request)
    await waitForLifecycle(lifecycleLog, "session/prompt")
    controller.abort()
    forceController.abort()

    await expect(running).rejects.toThrow("ACP process ended before the task handoff completed")
    expect(supervisor.cancelCalls()).toBeGreaterThanOrEqual(2)
  }, 5_000)

  test("preserves CRLF bytes when an ACP read has no slice", async () => {
    const { root, lifecycleLog } = await fixtureContext()
    const request = makeRequest(root, lifecycleLog, {
      SPEC_FINDER_TEST_FS_READ_PATH: join(root, "windows.txt"),
    }, undefined, {
      hostAccess: {
        readTextFile: async () => "first\r\nsecond\r\n",
        writeTextFile: async () => {},
      },
    })

    const result = await runAcpTurn(request)

    expect(result.finalText).toContain("read response: first\r\nsecond\r\n")
  })

  test("returns a non-success cleanup result after end_turn when supervision fails", async () => {
    const { root, lifecycleLog } = await fixtureContext()
    const result = await runAcpTurn(makeRequest(root, lifecycleLog, {}, undefined, {
      supervisor: failingCleanupSupervisor(),
    }))

    expect(result.stopReason).toBe("end_turn")
    expect(result.cleanup).toBe("failed")
    expect(result.outcome).toBe("failed")
    expect(result.finalText).toContain("mock turn started")
  })
})

class BlockingPermissionBroker implements PermissionBroker {
  cancelCalls = 0
  #resolve: ((outcome: { decision: "cancelled" }) => void) | undefined

  request(): Promise<{ decision: "cancelled" }> {
    return new Promise((resolve) => { this.#resolve = resolve })
  }

  async cancelPending(): Promise<void> {
    this.cancelCalls += 1
    this.#resolve?.({ decision: "cancelled" })
    this.#resolve = undefined
  }
}

function makeRequest(
  root: string,
  lifecycleLog: string,
  env: Record<string, string> = {},
  launchOverrides: Partial<ProviderLaunch> = {},
  overrides: {
    model?: string
    reasoning?: string
    speed?: string
    signal?: AbortSignal
    forceSignal?: AbortSignal
    permission?: PermissionBroker
    supervisor?: ProcessSupervisor
    hostAccess?: WorkspaceAccess
    emit?: (event: import("../src/acp-turn.ts").AcpTurnEvent) => void
  } = {},
): AcpTurnRequest {
  const launch: ProviderLaunch = {
    command: process.execPath,
    args: [fixture],
    cwd: root,
    env: { ...env, SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog },
    authMethod: null,
    ...launchOverrides,
  }
  return {
    prompt: "Run one neutral turn",
    workspace: root,
    runtime: {
      provider: "mock",
      model: overrides.model ?? "auto",
      reasoning: overrides.reasoning ?? "auto",
      speed: overrides.speed ?? "auto",
    },
    launch,
    hostAccess: overrides.hostAccess ?? fakeWorkspaceAccess(),
    permission: overrides.permission ?? allowPermission(),
    supervisor: overrides.supervisor ?? createProcessSupervisor(),
    signal: overrides.signal ?? new AbortController().signal,
    ...(overrides.forceSignal === undefined ? {} : { forceSignal: overrides.forceSignal }),
    ...(overrides.emit === undefined ? {} : { emit: overrides.emit }),
  }
}

function countingCleanupSupervisor(): ProcessSupervisor & { cancelCalls(): number } {
  const supervisor = createProcessSupervisor()
  let calls = 0
  return {
    cancelCalls: () => calls,
    async spawn(spec) {
      const process = await supervisor.spawn(spec)
      return {
        ...process,
        cancelTree: async (deadlineMs) => {
          calls += 1
          return process.cancelTree(deadlineMs)
        },
      }
    },
  }
}

function chunkedStderrSupervisor(chunks: readonly string[]): ProcessSupervisor {
  const supervisor = createProcessSupervisor()
  return {
    async spawn(spec) {
      const process = await supervisor.spawn(spec)
      return {
        ...process,
        stderr: new ReadableStream<Uint8Array>({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
            controller.close()
          },
        }),
      }
    },
  }
}

function fakeWorkspaceAccess(): WorkspaceAccess {
  return {
    readTextFile: async () => "fixture content",
    writeTextFile: async (_path, _content, authorize) => {
      await authorize(_path)
    },
  }
}

function allowPermission(): PermissionBroker {
  return {
    request: async () => ({ decision: "allowed", optionId: "allow_once" }),
    cancelPending: async () => {},
  }
}

function grokAuthPreference(methodIds: readonly string[]): import("../src/acp-turn.ts").AuthMethodPreference {
  return {
    methodIds,
    unavailableMessage: "Grok authentication unavailable. Run `grok login` or set XAI_API_KEY, then rerun.",
  }
}

function failingCleanupSupervisor(): ProcessSupervisor {
  const supervisor = createProcessSupervisor()
  return {
    async spawn(spec) {
      const process = await supervisor.spawn(spec) as SupervisedProcessHandle
      return {
        ...process,
        cancelTree: async (deadlineMs) => {
          await process.cancelTree(deadlineMs)
          return { state: "unconfirmed", error: "fixture cleanup failure" }
        },
      }
    },
  }
}

async function fixtureContext(): Promise<{ root: string; lifecycleLog: string }> {
  const root = await mkdtemp(join(tmpdir(), "spec-finder-acp-core-"))
  return { root, lifecycleLog: join(root, "lifecycle.log") }
}

async function lifecycleSteps(path: string): Promise<string[]> {
  try {
    const content = await readFile(path, "utf8")
    return content.trim().length === 0 ? [] : content.trim().split("\n")
  } catch {
    return []
  }
}

async function waitForLifecycle(path: string, step: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await lifecycleSteps(path)).includes(step)) return
    await Bun.sleep(10)
  }
  throw new Error(`timed out waiting for ${step}`)
}

function selectOption(
  id: string,
  name: string,
  value: string,
  valueName: string,
  category: string,
): SessionConfigOption {
  return {
    type: "select",
    id,
    name,
    category,
    currentValue: value,
    options: [{ value, name: valueName }],
  }
}

function booleanOption(id: string, name: string, value: boolean, category: string): SessionConfigOption {
  return { type: "boolean", id, name, category, currentValue: value }
}
