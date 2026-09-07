import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PacketPermissionBroker, runAcpTurn, sanitizePermissionTitle } from "../src/acp-client.ts"
import { DEFAULT_CONFIG, parseConfig } from "../src/config.ts"
import type { AcpTurnPhase, RunEvent } from "../src/events.ts"
import {
  createGrokAuthMethodPreference,
  createPiAuthMethodPreference,
  normalizeGrokSessionConfigOptions,
} from "../src/providers.ts"
import { GROK_BUILD_1_0_SESSION_CONFIG_METADATA } from "./fixtures/grok-session-config.ts"
import { CockpitStore } from "../src/ui/store.ts"

describe("ACP client", () => {
  test("leaves auto Grok runtime choices to provider defaults", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-grok-auto-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
    const events: RunEvent[] = []
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "grok",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })

    const result = await runAcpTurn({
      root,
      config,
      prompt: "Run one provider-default Grok fixture turn",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_AUTH_METHODS: "cached_token",
          SPEC_FINDER_TEST_CONFIG_OPTIONS: JSON.stringify([]),
          SPEC_FINDER_TEST_CONFIG_METADATA: JSON.stringify(GROK_BUILD_1_0_SESSION_CONFIG_METADATA),
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
        authPreference: createGrokAuthMethodPreference(false),
        sessionConfigNormalizer: normalizeGrokSessionConfigOptions,
        stderrPolicy: "redact",
      },
    })

    expect(result.stopReason).toBe("end_turn")
    expect(await readFile(lifecycleLog, "utf8")).not.toContain("session/set_config_option")
    expect(events.filter((event) => event.type === "runtime_option")).toEqual([
      { type: "runtime_option", name: "model", requested: "auto", outcome: "default" },
      { type: "runtime_option", name: "reasoning", requested: "auto", outcome: "default" },
      { type: "runtime_option", name: "speed", requested: "auto", outcome: "default" },
    ])
  })

  test("applies explicit values through an accepting generic ACP config-option fixture", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-generic-acp-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
    const events: RunEvent[] = []
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "codex",
      model: "generic-model",
      reasoning: "high",
      speed: "fast",
      permissions: "approve-all",
    })
    const result = await runAcpTurn({
      root,
      config,
      prompt: "Run one generic ACP fixture turn",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_CONFIG_OPTIONS: JSON.stringify([
            {
              type: "select",
              id: "model",
              name: "Model",
              currentValue: "generic-model",
              options: [{ value: "generic-model", name: "Generic model" }],
              category: "model",
            },
            {
              type: "select",
              id: "reasoning",
              name: "Reasoning",
              currentValue: "high",
              options: [{ value: "high", name: "High" }],
              category: "thought_level",
            },
          ]),
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
      },
    })

    expect(result.stopReason).toBe("end_turn")
    expect(await readFile(lifecycleLog, "utf8")).toContain("session/set_config_option:model:generic-model")
    expect(await readFile(lifecycleLog, "utf8")).toContain("session/set_config_option:reasoning:high")
    expect(events).toContainEqual({ type: "runtime_option", name: "model", requested: "generic-model", outcome: "applied" })
    expect(events).toContainEqual({ type: "runtime_option", name: "reasoning", requested: "high", outcome: "applied" })
    expect(events).toContainEqual({ type: "runtime_option", name: "speed", requested: "fast", outcome: "unsupported" })
  })

  test("fails explicit Grok 1.0.0 options before prompting when its generic setter is rejected", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-grok-rejects-config-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
    const events: RunEvent[] = []
    const sentinel = "XAI_API_KEY=GROK_CONFIG_SETTER_STDERR_SENTINEL"
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "grok",
      model: "grok-4.5",
      reasoning: "high",
      speed: "fast",
      permissions: "approve-all",
    })

    await expect(runAcpTurn({
      root,
      config,
      prompt: "This must not prompt",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_AUTH_METHODS: "cached_token",
          SPEC_FINDER_TEST_EXPECT_AUTH_METHOD: "cached_token",
          SPEC_FINDER_TEST_CONFIG_OPTIONS: JSON.stringify([]),
          SPEC_FINDER_TEST_CONFIG_METADATA: JSON.stringify(GROK_BUILD_1_0_SESSION_CONFIG_METADATA),
          SPEC_FINDER_TEST_REJECT_CONFIG_OPTION: "1",
          SPEC_FINDER_TEST_PROVIDER_STDERR: sentinel,
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
        authPreference: createGrokAuthMethodPreference(false),
        sessionConfigNormalizer: normalizeGrokSessionConfigOptions,
        stderrPolicy: "redact",
      },
    })).rejects.toThrow("unable to set model configuration option")

    expect((await readFile(lifecycleLog, "utf8")).trim().split("\n")).toEqual([
      "initialize",
      "authenticate:cached_token",
      "session/new",
      "session/set_config_option:model:grok-4.5",
    ])
    expect(events).toContainEqual({
      type: "activity",
      taskId: "task_01",
      message: "Provider emitted diagnostic output; details redacted.",
    })
    expect(JSON.stringify(events)).not.toContain(sentinel)
    expect(JSON.stringify(events)).not.toContain("method not found")
  })

  test("fails clearly when Grok metadata omits a required model choice", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-grok-option-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "grok",
      model: "grok-4.5",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })

    await expect(runAcpTurn({
      root,
      config,
      prompt: "This must not prompt",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: () => {},
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_AUTH_METHODS: "cached_token",
          SPEC_FINDER_TEST_CONFIG_OPTIONS: JSON.stringify([]),
          SPEC_FINDER_TEST_CONFIG_METADATA: JSON.stringify({
            "x.ai/sessionConfig": {
              options: GROK_BUILD_1_0_SESSION_CONFIG_METADATA["x.ai/sessionConfig"].options
                .filter((option) => option.category === "mode"),
            },
          }),
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
        authPreference: createGrokAuthMethodPreference(false),
        sessionConfigNormalizer: normalizeGrokSessionConfigOptions,
        stderrPolicy: "redact",
      },
    })).rejects.toThrow("agent did not advertise a model configuration option")

    expect((await readFile(lifecycleLog, "utf8")).trim().split("\n")).toEqual([
      "initialize",
      "authenticate:cached_token",
      "session/new",
    ])
  })

  test("fails clearly when Grok metadata omits a required reasoning choice after model configuration", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-grok-reasoning-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "grok",
      model: "grok-4.5",
      reasoning: "high",
      speed: "auto",
      permissions: "approve-all",
    })
    await expect(runAcpTurn({
      root,
      config,
      prompt: "This must not prompt",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: () => {},
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_AUTH_METHODS: "cached_token",
          SPEC_FINDER_TEST_CONFIG_OPTIONS: JSON.stringify([]),
          SPEC_FINDER_TEST_CONFIG_METADATA: JSON.stringify({
            "x.ai/sessionConfig": {
              options: GROK_BUILD_1_0_SESSION_CONFIG_METADATA["x.ai/sessionConfig"].options
                .filter((option) => option.category === "model"),
            },
          }),
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
        authPreference: createGrokAuthMethodPreference(false),
        sessionConfigNormalizer: normalizeGrokSessionConfigOptions,
        stderrPolicy: "redact",
      },
    })).rejects.toThrow("agent did not advertise a reasoning configuration option")

    expect((await readFile(lifecycleLog, "utf8")).trim().split("\n")).toEqual([
      "initialize",
      "authenticate:cached_token",
      "session/new",
      "session/set_config_option:model:grok-4.5",
    ])
  })

  test("fails before prompting when a Grok metadata model value is not advertised", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-grok-model-mismatch-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "grok",
      model: "grok-unavailable",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })

    await expect(runAcpTurn({
      root,
      config,
      prompt: "This must not prompt",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: () => {},
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_AUTH_METHODS: "cached_token",
          SPEC_FINDER_TEST_CONFIG_OPTIONS: JSON.stringify([]),
          SPEC_FINDER_TEST_CONFIG_METADATA: JSON.stringify(GROK_BUILD_1_0_SESSION_CONFIG_METADATA),
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
        authPreference: createGrokAuthMethodPreference(false),
        sessionConfigNormalizer: normalizeGrokSessionConfigOptions,
        stderrPolicy: "redact",
      },
    })).rejects.toThrow("model grok-unavailable is not an advertised configuration value")

    expect((await readFile(lifecycleLog, "utf8")).trim().split("\n")).toEqual([
      "initialize",
      "authenticate:cached_token",
      "session/new",
    ])
  })

  test("fails before prompting when a Grok metadata reasoning value is not advertised", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-grok-reasoning-mismatch-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "grok",
      model: "grok-4.5",
      reasoning: "ultra",
      speed: "auto",
      permissions: "approve-all",
    })

    await expect(runAcpTurn({
      root,
      config,
      prompt: "This must not prompt",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: () => {},
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_AUTH_METHODS: "cached_token",
          SPEC_FINDER_TEST_CONFIG_OPTIONS: JSON.stringify([]),
          SPEC_FINDER_TEST_CONFIG_METADATA: JSON.stringify(GROK_BUILD_1_0_SESSION_CONFIG_METADATA),
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
        authPreference: createGrokAuthMethodPreference(false),
        sessionConfigNormalizer: normalizeGrokSessionConfigOptions,
        stderrPolicy: "redact",
      },
    })).rejects.toThrow("reasoning ultra is not an advertised configuration value")

    expect((await readFile(lifecycleLog, "utf8")).trim().split("\n")).toEqual([
      "initialize",
      "authenticate:cached_token",
      "session/new",
      "session/set_config_option:model:grok-4.5",
    ])
  })

  test("redacts Grok provider stderr before packet activities receive it", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-grok-stderr-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const events: RunEvent[] = []
    const sentinel = "XAI_API_KEY=REDACTION_SENTINEL_NOT_A_CREDENTIAL"
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "grok",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })

    const result = await runAcpTurn({
      root,
      config,
      prompt: "Run one redacted Grok fixture turn",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: { SPEC_FINDER_TEST_PROVIDER_STDERR: sentinel },
        authMethod: null,
        stderrPolicy: "redact",
      },
    })

    expect(result.stopReason).toBe("end_turn")
    expect(events).toContainEqual({
      type: "activity",
      taskId: "task_01",
      message: "Provider emitted diagnostic output; details redacted.",
    })
    expect(JSON.stringify(events)).not.toContain(sentinel)
  })

  test("leaves auto Pi runtime choices to provider defaults", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-pi-auto-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
    const events: RunEvent[] = []
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "pi",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })

    const result = await runAcpTurn({
      root,
      config,
      prompt: "Run one provider-default Pi fixture turn",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_AUTH_METHODS: "pi-stored-credentials",
          SPEC_FINDER_TEST_CONFIG_OPTIONS: JSON.stringify(piSessionConfigOptions()),
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
        authPreference: createPiAuthMethodPreference(),
        stderrPolicy: "redact",
      },
    })

    expect(result.stopReason).toBe("end_turn")
    expect(await readFile(lifecycleLog, "utf8")).not.toContain("session/set_config_option")
    expect(events.filter((event) => event.type === "runtime_option")).toEqual([
      { type: "runtime_option", name: "model", requested: "auto", outcome: "default" },
      { type: "runtime_option", name: "reasoning", requested: "auto", outcome: "default" },
      { type: "runtime_option", name: "speed", requested: "auto", outcome: "default" },
    ])
  })

  test("applies explicit Pi model and reasoning through advertised thought_level options", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-pi-apply-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
    const events: RunEvent[] = []
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "pi",
      model: "anthropic/claude-sonnet-4",
      reasoning: "high",
      speed: "auto",
      permissions: "approve-all",
    })

    const result = await runAcpTurn({
      root,
      config,
      prompt: "Run one explicit Pi fixture turn",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_AUTH_METHODS: "pi-stored-credentials",
          SPEC_FINDER_TEST_CONFIG_OPTIONS: JSON.stringify(piSessionConfigOptions()),
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
        authPreference: createPiAuthMethodPreference(),
        stderrPolicy: "redact",
      },
    })

    expect(result.stopReason).toBe("end_turn")
    expect(await readFile(lifecycleLog, "utf8")).toContain("session/set_config_option:model:anthropic/claude-sonnet-4")
    expect(await readFile(lifecycleLog, "utf8")).toContain("session/set_config_option:thinkingLevel:high")
    expect(events).toContainEqual({
      type: "runtime_option",
      name: "model",
      requested: "anthropic/claude-sonnet-4",
      outcome: "applied",
    })
    expect(events).toContainEqual({
      type: "runtime_option",
      name: "reasoning",
      requested: "high",
      outcome: "applied",
    })
    expect(events).toContainEqual({ type: "runtime_option", name: "speed", requested: "auto", outcome: "default" })
  })

  test("fails explicit Pi options before prompting when the generic setter is rejected", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-pi-rejects-config-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "pi",
      model: "anthropic/claude-sonnet-4",
      reasoning: "high",
      speed: "auto",
      permissions: "approve-all",
    })

    await expect(runAcpTurn({
      root,
      config,
      prompt: "This must not prompt",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: () => {},
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_AUTH_METHODS: "pi-stored-credentials",
          SPEC_FINDER_TEST_CONFIG_OPTIONS: JSON.stringify(piSessionConfigOptions()),
          SPEC_FINDER_TEST_REJECT_CONFIG_OPTION: "1",
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
        authPreference: createPiAuthMethodPreference(),
        stderrPolicy: "redact",
      },
    })).rejects.toThrow("unable to set model configuration option")

    expect((await readFile(lifecycleLog, "utf8")).trim().split("\n")).toEqual([
      "initialize",
      "authenticate:pi-stored-credentials",
      "session/new",
      "session/set_config_option:model:anthropic/claude-sonnet-4",
    ])
  })

  test("fails before prompting when Pi omits a required reasoning option", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-pi-no-reasoning-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "pi",
      model: "anthropic/claude-sonnet-4",
      reasoning: "high",
      speed: "auto",
      permissions: "approve-all",
    })

    await expect(runAcpTurn({
      root,
      config,
      prompt: "This must not prompt",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: () => {},
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_AUTH_METHODS: "pi-stored-credentials",
          SPEC_FINDER_TEST_CONFIG_OPTIONS: JSON.stringify(piSessionConfigOptions({ reasoning: false })),
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
        authPreference: createPiAuthMethodPreference(),
        stderrPolicy: "redact",
      },
    })).rejects.toThrow("agent did not advertise a reasoning configuration option")

    expect((await readFile(lifecycleLog, "utf8")).trim().split("\n")).toEqual([
      "initialize",
      "authenticate:pi-stored-credentials",
      "session/new",
      "session/set_config_option:model:anthropic/claude-sonnet-4",
    ])
  })

  test("continues a Pi turn when requested speed is unsupported", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-pi-speed-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
    const events: RunEvent[] = []
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "pi",
      model: "auto",
      reasoning: "auto",
      speed: "fast",
      permissions: "approve-all",
    })

    const result = await runAcpTurn({
      root,
      config,
      prompt: "Run one Pi fixture turn without speed",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_AUTH_METHODS: "pi-stored-credentials",
          SPEC_FINDER_TEST_CONFIG_OPTIONS: JSON.stringify(piSessionConfigOptions()),
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
        authPreference: createPiAuthMethodPreference(),
        stderrPolicy: "redact",
      },
    })

    expect(result.stopReason).toBe("end_turn")
    expect(await readFile(lifecycleLog, "utf8")).toContain("session/prompt")
    expect(events).toContainEqual({ type: "runtime_option", name: "speed", requested: "fast", outcome: "unsupported" })
  })

  test("redacts Pi provider stderr before packet activities receive it", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-pi-stderr-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const events: RunEvent[] = []
    const sentinel = "PI_API_KEY=REDACTION_SENTINEL_NOT_A_CREDENTIAL"
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "pi",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })

    const result = await runAcpTurn({
      root,
      config,
      prompt: "Run one redacted Pi fixture turn",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_AUTH_METHODS: "pi-stored-credentials",
          SPEC_FINDER_TEST_PROVIDER_STDERR: sentinel,
        },
        authMethod: null,
        authPreference: createPiAuthMethodPreference(),
        stderrPolicy: "redact",
      },
    })

    expect(result.stopReason).toBe("end_turn")
    expect(events).toContainEqual({
      type: "activity",
      taskId: "task_01",
      message: "Provider emitted diagnostic output; details redacted.",
    })
    expect(JSON.stringify(events)).not.toContain(sentinel)
  })

  test("completes a framed turn and selects an allow option for approve-all", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-acp-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const lifecycleLog = join(root, "lifecycle.log")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "cursor",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })
    const events: RunEvent[] = []

    const result = await runAcpTurn({
      root,
      config,
      prompt: "Run the mock turn",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_REQUEST_PERMISSION: "1",
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
      },
    })

    expect(result.stopReason).toBe("end_turn")
    expect((await readFile(lifecycleLog, "utf8")).trim().split("\n")).toEqual([
      "initialize",
      "session/new",
      "session/prompt",
    ])
    expect(events).toContainEqual({
      type: "runtime_option",
      name: "model",
      requested: "auto",
      outcome: "default",
      detail: "launch-time",
    })
    expect(events).toContainEqual({
      type: "runtime_option",
      name: "reasoning",
      requested: "auto",
      outcome: "default",
    })
    expect(events).toContainEqual({
      type: "runtime_option",
      name: "speed",
      requested: "auto",
      outcome: "default",
    })
    expect(events).toContainEqual(expect.objectContaining({
      type: "activity",
      taskId: "task_01",
      message: "ACP Test Agent initialized",
    }))
    expect(events).toContainEqual(expect.objectContaining({
      type: "session_update",
      taskId: "task_01",
      update: expect.objectContaining({ sessionUpdate: "agent_message_chunk" }),
    }))
    expect(events).toContainEqual(expect.objectContaining({
      type: "session_update",
      taskId: "task_01",
      update: expect.objectContaining({
        content: { type: "text", text: "permission response: allow" },
      }),
    }))
    const updates = sessionUpdates(events)
    expect(updates.length).toBeGreaterThan(0)
    expect(updates.every((event) => event.phase === "implementation")).toBeTrue()
    expect(updates.every((event) => event.sessionId === "test-session")).toBeTrue()
  })

  test("selects a reject option for deny", async () => {
    const { events, result } = await runPermissionTurn({
      phase: "report",
      permissions: "deny",
      interactivePermissions: false,
      expectedPermission: "reject",
    })

    expect(result.stopReason).toBe("end_turn")
    expect(events).toContainEqual(expect.objectContaining({
      type: "session_update",
      update: expect.objectContaining({
        content: { type: "text", text: "permission response: reject" },
      }),
    }))
    const updates = sessionUpdates(events)
    expect(updates.length).toBeGreaterThan(0)
    expect(updates.every((event) => event.phase === "report")).toBeTrue()
  })

  test("waits on cockpit prompt instead of auto-cancelling", async () => {
    const events: RunEvent[] = []
    const controller = new AbortController()
    const turn = runCockpitPermissionTurn(events, controller.signal)

    const prompt = await Promise.race([
      waitForRunEvent(events, "permission_prompt"),
      turn.then(() => {
        throw new Error("turn finished before permission_prompt")
      }),
    ])

    expect(prompt).toMatchObject({
      type: "permission_prompt",
      taskId: "task_01",
      title: "Mock edit",
      allowOnce: true,
      rejectOnce: true,
    })
    expect(typeof prompt.settle).toBe("function")
    expect(events.some((event) =>
      event.type === "activity" && event.message.includes("cockpit is read-only")
    )).toBe(false)
    expect(events.some((event) => event.type === "permission_requested")).toBe(false)
    expect(events.some((event) => event.type === "permission_settled")).toBe(false)

    await Bun.sleep(50)
    expect(events.some((event) => event.type === "permission_settled")).toBe(false)

    controller.abort()
    await turn
    expect(events).toContainEqual({
      type: "permission_settled",
      taskId: "task_01",
      decision: "cancelled",
    })
  }, 10_000)

  test("cancels an overlapping cockpit prompt without claiming operator reject", async () => {
    const events: RunEvent[] = []
    const broker = new PacketPermissionBroker({
      root: "/tmp",
      config: parseConfig({ ...DEFAULT_CONFIG, permissions: "prompt" }),
      taskId: "task_01",
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: true,
    })
    const request = {
      sessionId: "s1",
      toolCall: { toolCallId: "t1", title: "  \u0007Write\nfile  ", status: "pending" as const },
      options: [
        { optionId: "allow", name: "Allow", kind: "allow_once" as const },
        { optionId: "reject", name: "Reject", kind: "reject_once" as const },
      ],
    }
    const first = broker.request(request)
    expect(events).toContainEqual(expect.objectContaining({
      type: "permission_prompt",
      title: sanitizePermissionTitle("  \u0007Write\nfile  "),
      allowOnce: true,
      rejectOnce: true,
    }))
    expect(await broker.request(request)).toEqual({ decision: "cancelled" })
    expect(events.filter((event) => event.type === "permission_prompt")).toHaveLength(1)
    expect(events.some((event) => event.type === "permission_settled")).toBe(false)
    await broker.cancelPending()
    await expect(first).resolves.toEqual({ decision: "cancelled" })
    expect(events).toContainEqual({
      type: "permission_settled",
      taskId: "task_01",
      decision: "cancelled",
    })
  })

  test("maps cockpit settle to once-options only", async () => {
    const events: RunEvent[] = []
    const broker = new PacketPermissionBroker({
      root: "/tmp",
      config: parseConfig({ ...DEFAULT_CONFIG, permissions: "prompt" }),
      taskId: "task_01",
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: true,
    })
    const request = {
      sessionId: "s1",
      toolCall: { toolCallId: "t1", title: "Edit", status: "pending" as const },
      options: [
        { optionId: "allow-always", name: "Always", kind: "allow_always" as const },
        { optionId: "allow", name: "Allow", kind: "allow_once" as const },
        { optionId: "reject", name: "Reject", kind: "reject_once" as const },
      ],
    }
    const allowed = broker.request(request)
    const prompt = events.find((event) => event.type === "permission_prompt")
    if (prompt?.type !== "permission_prompt") throw new Error("missing permission_prompt")
    prompt.settle("allowed")
    await expect(allowed).resolves.toEqual({ decision: "allowed", optionId: "allow" })
    expect(events).toContainEqual({
      type: "permission_settled",
      taskId: "task_01",
      decision: "allowed",
    })

    const deniedEvents: RunEvent[] = []
    const denyBroker = new PacketPermissionBroker({
      root: "/tmp",
      config: parseConfig({ ...DEFAULT_CONFIG, permissions: "prompt" }),
      taskId: "task_01",
      signal: new AbortController().signal,
      emit: (event) => deniedEvents.push(event),
      interactivePermissions: true,
    })
    const denied = denyBroker.request(request)
    const denyPrompt = deniedEvents.find((event) => event.type === "permission_prompt")
    if (denyPrompt?.type !== "permission_prompt") throw new Error("missing permission_prompt")
    denyPrompt.settle("denied")
    await expect(denied).resolves.toEqual({ decision: "denied", optionId: "reject" })
  })

  test("allows a cockpit prompt once and continues the turn", async () => {
    const store = new CockpitStore()
    const events: RunEvent[] = []
    const turn = runCockpitPermissionTurn(events, new AbortController().signal, {
      emit: (event) => {
        events.push(event)
        store.consume(event)
      },
    })
    await Promise.race([
      waitForRunEvent(events, "permission_prompt"),
      turn.then(() => {
        throw new Error("turn finished before permission_prompt")
      }),
    ])
    store.allowPendingPermission()
    const result = await turn
    expect(result.stopReason).toBe("end_turn")
    expect(events).toContainEqual({
      type: "permission_settled",
      taskId: "task_01",
      decision: "allowed",
    })
    expect(events).toContainEqual(expect.objectContaining({
      type: "session_update",
      update: expect.objectContaining({
        content: { type: "text", text: "permission response: allow" },
      }),
    }))
    expect(events.some((event) =>
      event.type === "activity" && event.message.includes("cockpit is read-only")
    )).toBe(false)
    expect(store.getSnapshot().pendingPermission).toBeNull()
  }, 10_000)

  test("rejects a cockpit prompt once without auto-cancelling the run", async () => {
    const store = new CockpitStore()
    const events: RunEvent[] = []
    const turn = runCockpitPermissionTurn(events, new AbortController().signal, {
      expectedPermission: "reject",
      emit: (event) => {
        events.push(event)
        store.consume(event)
      },
    })
    await Promise.race([
      waitForRunEvent(events, "permission_prompt"),
      turn.then(() => {
        throw new Error("turn finished before permission_prompt")
      }),
    ])
    store.rejectPendingPermission()
    const result = await turn
    expect(result.stopReason).toBe("end_turn")
    expect(events).toContainEqual({
      type: "permission_settled",
      taskId: "task_01",
      decision: "denied",
    })
    expect(events).toContainEqual(expect.objectContaining({
      type: "session_update",
      update: expect.objectContaining({
        content: { type: "text", text: "permission response: reject" },
      }),
    }))
    expect(events.some((event) =>
      event.type === "activity" && event.message.includes("cockpit is read-only")
    )).toBe(false)
  }, 10_000)

  test("asks again for a later cockpit permission request", async () => {
    const store = new CockpitStore()
    const events: RunEvent[] = []
    const turn = runCockpitPermissionTurn(events, new AbortController().signal, {
      permissionRounds: "2",
      emit: (event) => {
        events.push(event)
        store.consume(event)
      },
    })
    await Promise.race([
      waitForRunEvent(events, "permission_prompt"),
      turn.then(() => {
        throw new Error("turn finished before permission_prompt")
      }),
    ])
    store.allowPendingPermission()
    await waitForRunEventCount(events, "permission_prompt", 2)
    expect(store.getSnapshot().pendingPermission?.title).toBe("Mock edit 2")
    store.allowPendingPermission()
    const result = await turn
    expect(result.stopReason).toBe("end_turn")
    expect(events.filter((event) => event.type === "permission_prompt")).toHaveLength(2)
  }, 10_000)

  test("preserves non-UI prompt cancellation when stdin is not interactive", async () => {
    const { events, result } = await runPermissionTurn({
      phase: "report",
      permissions: "prompt",
      interactivePermissions: false,
      expectedPermission: "cancelled",
    })

    expect(process.stdin.isTTY).not.toBe(true)
    expect(result.stopReason).toBe("end_turn")
    expect(events.some((event) =>
      event.type === "activity" && event.message.includes("cockpit is read-only")
    )).toBe(false)
    expect(events.some((event) => event.type === "permission_requested")).toBe(false)
  })

  test("fails promptly when the ACP process exits before completing the turn", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-acp-exit-"))
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "cursor",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })

    await expect(runAcpTurn({
      root,
      config,
      prompt: "This prompt must not hang",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: () => {},
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: { SPEC_FINDER_TEST_EXIT_IMMEDIATELY: "1" },
        authMethod: null,
      },
    })).rejects.toThrow("ACP process ended before the task handoff completed (exit 23)")
  }, 2_000)

  test("terminates ACP descendant processes after a completed handoff", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-acp-tree-"))
    const descendantPath = join(root, "descendant.pid")
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "cursor",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })

    const result = await runAcpTurn({
      root,
      config,
      prompt: "Complete and clean up the process tree",
      taskId: "task_01",
      phase: "implementation",
      signal: new AbortController().signal,
      emit: () => {},
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: { SPEC_FINDER_TEST_DESCENDANT_PID: descendantPath },
        authMethod: null,
      },
    })

    expect(result.stopReason).toBe("end_turn")
    const descendantPid = Number((await readFile(descendantPath, "utf8")).trim())
    expect(await processExited(descendantPid)).toBeTrue()
  }, 2_000)
})

async function processExited(pid: number): Promise<boolean> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      process.kill(pid, 0)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return true
      throw error
    }
    await Bun.sleep(10)
  }
  return false
}

async function runCockpitPermissionTurn(
  events: RunEvent[],
  signal: AbortSignal,
  options: {
    emit?: (event: RunEvent) => void
    permissionRounds?: string
    expectedPermission?: string
  } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "spec-finder-acp-"))
  const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
  const config = parseConfig({
    ...DEFAULT_CONFIG,
    provider: "cursor",
    model: "auto",
    reasoning: "auto",
    speed: "auto",
    permissions: "prompt",
  })
  const env: Record<string, string> = {
    SPEC_FINDER_TEST_REQUEST_PERMISSION: options.permissionRounds ?? "1",
  }
  if (options.expectedPermission) env.SPEC_FINDER_TEST_EXPECT_PERMISSION = options.expectedPermission
  return runAcpTurn({
    root,
    config,
    prompt: "Run the mock permission turn",
    taskId: "task_01",
    phase: "report",
    signal,
    emit: options.emit ?? ((event) => events.push(event)),
    interactivePermissions: true,
    providerLaunch: {
      command: process.execPath,
      args: [fixture],
      env,
      authMethod: null,
    },
  })
}

async function waitForRunEvent<T extends RunEvent["type"]>(
  events: RunEvent[],
  type: T,
  timeoutMs = 8_000,
): Promise<Extract<RunEvent, { type: T }>> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const event = events.find((candidate): candidate is Extract<RunEvent, { type: T }> => candidate.type === type)
    if (event) return event
    await Bun.sleep(10)
  }
  throw new Error(`timed out waiting for ${type}`)
}

async function waitForRunEventCount<T extends RunEvent["type"]>(
  events: RunEvent[],
  type: T,
  count: number,
  timeoutMs = 8_000,
): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (events.filter((event) => event.type === type).length >= count) return
    await Bun.sleep(10)
  }
  throw new Error(`timed out waiting for ${count} ${type} events`)
}

async function runPermissionTurn(options: {
  phase: AcpTurnPhase
  permissions: "prompt" | "approve-all" | "deny"
  interactivePermissions: boolean
  expectedPermission?: "allow" | "reject" | "cancelled"
}) {
  const root = await mkdtemp(join(tmpdir(), "spec-finder-acp-"))
  const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
  const config = parseConfig({
    ...DEFAULT_CONFIG,
    provider: "cursor",
    model: "auto",
    reasoning: "auto",
    speed: "auto",
    permissions: options.permissions,
  })
  const events: RunEvent[] = []
  const env: Record<string, string> = { SPEC_FINDER_TEST_REQUEST_PERMISSION: "1" }
  if (options.expectedPermission) env.SPEC_FINDER_TEST_EXPECT_PERMISSION = options.expectedPermission

  const result = await runAcpTurn({
    root,
    config,
    prompt: "Run the mock permission turn",
    taskId: "task_01",
    phase: options.phase,
    signal: new AbortController().signal,
    emit: (event) => events.push(event),
    interactivePermissions: options.interactivePermissions,
    providerLaunch: { command: process.execPath, args: [fixture], env, authMethod: null },
  })

  return { events, result }
}

function sessionUpdates(events: readonly RunEvent[]): Array<Extract<RunEvent, { type: "session_update" }>> {
  return events.filter((event): event is Extract<RunEvent, { type: "session_update" }> => event.type === "session_update")
}

function piSessionConfigOptions(options: { model?: boolean; reasoning?: boolean } = {}) {
  const includeModel = options.model !== false
  const includeReasoning = options.reasoning !== false
  return [
    ...(includeModel ? [{
      type: "select" as const,
      id: "model",
      name: "Model",
      currentValue: "auto",
      options: [
        { value: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
        { value: "auto", name: "Auto" },
      ],
      category: "model",
    }] : []),
    ...(includeReasoning ? [{
      type: "select" as const,
      id: "thinkingLevel",
      name: "Thinking",
      currentValue: "auto",
      options: [
        { value: "high", name: "High" },
        { value: "low", name: "Low" },
      ],
      category: "thought_level",
    }] : []),
  ]
}
