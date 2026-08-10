import { describe, expect, test } from "bun:test"
import { DEFAULT_CONFIG } from "../src/config.ts"
import {
  EXEC_PROVIDER_CERTIFICATION,
  ProviderCertificationError,
  createGrokAuthMethodPreference,
  getProviderCertification,
  isExecProviderCertified,
  normalizeGrokSessionConfigOptions,
  providerLabel,
  resolveExecProviderLaunch,
  resolvePacketProviderLaunch,
  resolveProviderLaunch,
} from "../src/providers.ts"
import { GROK_BUILD_1_0_SESSION_CONFIG_METADATA } from "./fixtures/grok-session-config.ts"

describe("provider launch", () => {
  test("pins Claude models through ANTHROPIC_MODEL", () => {
    const launch = resolveProviderLaunch({ ...DEFAULT_CONFIG, provider: "claude", model: "opus" })
    expect(launch.env.ANTHROPIC_MODEL).toBe("opus")
  })

  test("pins Cursor models with a launch argument", () => {
    const launch = resolveProviderLaunch({ ...DEFAULT_CONFIG, provider: "cursor", model: "gpt-5" })
    expect(launch.args.slice(-2)).toEqual(["--model", "gpt-5"])
  })

  test("delivers Codex host guidance through CODEX_CONFIG", () => {
    const launch = resolveProviderLaunch(DEFAULT_CONFIG)
    expect(JSON.parse(launch.env.CODEX_CONFIG!).developer_instructions).toContain("Spec Finder")
  })

  test("launches Grok Build through its source-owned no-update ACP recipe", () => {
    const launch = resolveProviderLaunch({ ...DEFAULT_CONFIG, provider: "grok", model: "custom-model" })

    expect(launch.command).toBe("grok")
    expect(launch.args).toEqual(["--no-auto-update", "agent", "stdio"])
    expect(launch.env).toEqual({})
    expect(launch.authMethod).toBeNull()
    expect(launch.authPreference?.methodIds).toContain("cached_token")
    expect(launch.sessionConfigNormalizer).toBe(normalizeGrokSessionConfigOptions)
    expect(launch.stderrPolicy).toBe("redact")
  })

  test("chooses Grok authentication methods without copying an API key", () => {
    expect(createGrokAuthMethodPreference(true)).toEqual({
      methodIds: ["xai.api_key", "cached_token"],
      unavailableMessage: "Grok authentication unavailable. Run `grok login` or set XAI_API_KEY, then rerun.",
    })
    expect(createGrokAuthMethodPreference(false)).toEqual({
      methodIds: ["cached_token"],
      unavailableMessage: "Grok authentication unavailable. Run `grok login` or set XAI_API_KEY, then rerun.",
    })
  })

  test("derives Grok authentication preference from a nonblank key without copying the environment", () => {
    const absent = withXaiApiKey(undefined, () =>
      resolveProviderLaunch({ ...DEFAULT_CONFIG, provider: "grok" }),
    )
    const empty = withXaiApiKey("", () =>
      resolveProviderLaunch({ ...DEFAULT_CONFIG, provider: "grok" }),
    )
    const whitespace = withXaiApiKey("  \t", () =>
      resolveProviderLaunch({ ...DEFAULT_CONFIG, provider: "grok" }),
    )
    const present = withXaiApiKey("configured", () =>
      resolveProviderLaunch({ ...DEFAULT_CONFIG, provider: "grok" }),
    )

    expect(absent.authPreference?.methodIds).toEqual(["cached_token"])
    expect(empty.authPreference?.methodIds).toEqual(["cached_token"])
    expect(whitespace.authPreference?.methodIds).toEqual(["cached_token"])
    expect(present.authPreference?.methodIds).toEqual(["xai.api_key", "cached_token"])
    expect(absent.env).toEqual({})
    expect(empty.env).toEqual({})
    expect(whitespace.env).toEqual({})
    expect(present.env).toEqual({})
    expect(Object.hasOwn(absent.env, "XAI_API_KEY")).toBeFalse()
    expect(Object.hasOwn(empty.env, "XAI_API_KEY")).toBeFalse()
    expect(Object.hasOwn(whitespace.env, "XAI_API_KEY")).toBeFalse()
    expect(Object.hasOwn(present.env, "XAI_API_KEY")).toBeFalse()
  })

  test("normalizes Grok Build 1.0.0 session metadata without exposing raw metadata", () => {
    const options = normalizeGrokSessionConfigOptions({
      configOptions: [],
      metadata: GROK_BUILD_1_0_SESSION_CONFIG_METADATA,
    })

    expect(options).toEqual([
      {
        type: "select",
        id: "model",
        name: "Model",
        currentValue: "grok-4.5",
        options: [{ value: "grok-4.5", name: "Grok 4.5" }],
        category: "model",
      },
      {
        type: "select",
        id: "mode",
        name: "Reasoning",
        currentValue: "high",
        options: [
          { value: "high", name: "High" },
          { value: "medium", name: "Medium" },
          { value: "low", name: "Low" },
        ],
        category: "thought_level",
      },
    ])
    expect(JSON.stringify(options)).not.toContain("x.ai/sessionConfig")
  })

  test("preserves standard ACP options while adding Grok metadata choices", () => {
    const standardSpeed = {
      type: "boolean" as const,
      id: "speed",
      name: "Fast mode",
      currentValue: false,
      category: "_speed",
    }
    const options = normalizeGrokSessionConfigOptions({
      configOptions: [standardSpeed],
      metadata: GROK_BUILD_1_0_SESSION_CONFIG_METADATA,
    })

    expect(options.map((option) => option.id)).toEqual(["speed", "model", "mode"])
    expect(options[0]).toBe(standardSpeed)
  })

  test("keeps packet launch resolution independent from exec certification", () => {
    for (const provider of ["claude", "codex", "cursor", "grok"] as const) {
      expect(() => resolvePacketProviderLaunch({ ...DEFAULT_CONFIG, provider })).not.toThrow()
      expect(isExecProviderCertified(provider)).toBeFalse()
      expect(getProviderCertification(provider)).toEqual({ exec: false })
    }
    expect(EXEC_PROVIDER_CERTIFICATION).toEqual({
      claude: { exec: false },
      codex: { exec: false },
      cursor: { exec: false },
      grok: { exec: false },
    })
  })

  test("rejects every uncertified real provider before an exec launch", () => {
    for (const provider of ["claude", "codex", "cursor", "grok"] as const) {
      expect(() => resolveExecProviderLaunch({ ...DEFAULT_CONFIG, provider }))
        .toThrow(ProviderCertificationError)
    }
  })

  test("keeps injected fixture launches available without mutating them", () => {
    const fixture = {
      command: process.execPath,
      args: ["fixture-agent.ts"],
      env: { FIXTURE: "yes" },
      authMethod: null,
    }
    const first = resolveExecProviderLaunch({ ...DEFAULT_CONFIG, provider: "codex" }, fixture)
    first.args.push("--changed")
    first.env.FIXTURE = "changed"

    const second = resolveExecProviderLaunch({ ...DEFAULT_CONFIG, provider: "codex" }, fixture)
    expect(second).toMatchObject(fixture)
    expect(second.mode).toBe("exec")
    expect(second.args).not.toBe(first.args)
    expect(second.env).not.toBe(first.env)
  })

  test("preserves model mapping in packet and exec-shaped launch copies", () => {
    const packet = resolveProviderLaunch({ ...DEFAULT_CONFIG, provider: "claude", model: "opus" }, "packet")
    const exec = resolveProviderLaunch({ ...DEFAULT_CONFIG, provider: "claude", model: "opus" }, "exec")
    expect(packet.env.ANTHROPIC_MODEL).toBe("opus")
    expect(exec.env.ANTHROPIC_MODEL).toBe("opus")
    expect(packet.mode).toBe("packet")
    expect(exec.mode).toBe("exec")
  })

  test("omits packet task/report instructions from an exec Codex launch", () => {
    const launch = resolveProviderLaunch({ ...DEFAULT_CONFIG, provider: "codex" }, "exec")
    expect(launch.env.CODEX_CONFIG).toBeUndefined()
  })

  test("labels every supported provider", () => {
    expect(providerLabel("claude")).toBe("Claude")
    expect(providerLabel("codex")).toBe("Codex")
    expect(providerLabel("cursor")).toBe("Cursor")
    expect(providerLabel("grok")).toBe("Grok Build")
  })
})

function withXaiApiKey<T>(value: string | undefined, use: () => T): T {
  const prior = process.env.XAI_API_KEY
  try {
    if (value === undefined) delete process.env.XAI_API_KEY
    else process.env.XAI_API_KEY = value
    return use()
  } finally {
    if (prior === undefined) delete process.env.XAI_API_KEY
    else process.env.XAI_API_KEY = prior
  }
}
