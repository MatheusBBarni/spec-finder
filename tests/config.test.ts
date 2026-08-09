import { describe, expect, test } from "bun:test"
import {
  applyRuntimeConfigOverrides,
  DEFAULT_CONFIG,
  ConfigError,
  parseConfig,
  serializeConfigCandidate,
} from "../src/config.ts"

describe("config", () => {
  test("accepts the default configuration", () => {
    expect(parseConfig(DEFAULT_CONFIG)).toEqual(DEFAULT_CONFIG)
    expect(Object.keys(DEFAULT_CONFIG)).toEqual([
      "version",
      "provider",
      "model",
      "reasoning",
      "speed",
      "permissions",
      "auto_commit",
      "setup",
    ])
  })

  test("defaults omitted auto_commit to false", () => {
    const config = parseConfig({
      version: 3,
      provider: "codex",
      model: "auto",
      reasoning: "high",
      speed: "normal",
      permissions: "prompt",
      setup: { status: "unconfigured" },
    })

    expect(config).toEqual(DEFAULT_CONFIG)
    expect(config.auto_commit).toBe(false)
  })

  test("preserves an explicit auto_commit opt-in without changing runtime settings", () => {
    const config = parseConfig({ ...DEFAULT_CONFIG, auto_commit: true })

    expect(config).toEqual({ ...DEFAULT_CONFIG, auto_commit: true })
    expect(config).toMatchObject({
      provider: DEFAULT_CONFIG.provider,
      model: DEFAULT_CONFIG.model,
      reasoning: DEFAULT_CONFIG.reasoning,
      speed: DEFAULT_CONFIG.speed,
      permissions: DEFAULT_CONFIG.permissions,
    })
  })

  test("rejects unknown keys and invalid runtime values", () => {
    expect(() => parseConfig({ ...DEFAULT_CONFIG, speed: "turbo", surprise: true })).toThrow(ConfigError)
    expect(() => parseConfig({ ...DEFAULT_CONFIG, auto_commit: "true" })).toThrow(ConfigError)
    try {
      parseConfig({ ...DEFAULT_CONFIG, speed: "turbo" })
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError)
      expect((error as ConfigError).issues.join("\n")).toContain("speed")
    }
    try {
      parseConfig({ ...DEFAULT_CONFIG, auto_commit: "true" })
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError)
      expect((error as ConfigError).issues.join("\n")).toContain("auto_commit")
    }
  })

  test("rejects removed version 2 settings", () => {
    expect(() => parseConfig({ ...DEFAULT_CONFIG, mode: "agent" })).toThrow(ConfigError)
    expect(() => parseConfig({ ...DEFAULT_CONFIG, providers: {} })).toThrow(ConfigError)
    expect(() => parseConfig({ ...DEFAULT_CONFIG, report: { enabled: true } })).toThrow(ConfigError)
  })

  test("migrates a verbose version 1 configuration", () => {
    expect(parseConfig({
      version: 1,
      provider: "codex",
      model: "auto",
      reasoning: "high",
      speed: "normal",
      mode: "agent",
      permissions: "prompt",
      report: { enabled: true, directory: "reports" },
      execution: { continueOnError: false, includeCompleted: false },
      providers: { codex: { command: "custom-command" } },
      auto_commit: true,
    })).toEqual(DEFAULT_CONFIG)
  })

  test("migrates a valid version 2 configuration in memory", () => {
    expect(parseConfig({
      version: 2,
      provider: "claude",
      model: "custom-claude-model",
      reasoning: "low",
      speed: "fast",
      permissions: "deny",
      auto_commit: true,
    })).toEqual({
      version: 3,
      provider: "claude",
      model: "custom-claude-model",
      reasoning: "low",
      speed: "fast",
      permissions: "deny",
      auto_commit: true,
      setup: { status: "unconfigured" },
    })
  })

  test("accepts configured setup metadata only for the provider-derived destination", () => {
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "claude",
      setup: { status: "configured", scope: "global", destination: ".claude/skills" },
    })

    expect(config.setup).toEqual({ status: "configured", scope: "global", destination: ".claude/skills" })
    expect(() => parseConfig({
      ...config,
      setup: { status: "configured", scope: "global", destination: ".agents/skills" },
    })).toThrow(ConfigError)
    try {
      parseConfig({
        ...config,
        setup: { status: "configured", scope: "global", destination: ".agents/skills" },
      })
    } catch (error) {
      expect((error as ConfigError).issues.join("\n")).toContain("setup.destination")
    }
  })

  test("rejects unknown setup keys and invalid setup states", () => {
    expect(() => parseConfig({
      ...DEFAULT_CONFIG,
      setup: { status: "unconfigured", scope: "local" },
    })).toThrow(ConfigError)
    expect(() => parseConfig({
      ...DEFAULT_CONFIG,
      setup: { status: "configured", scope: "local", destination: ".agents/skills", extra: true },
    })).toThrow(ConfigError)
    expect(() => parseConfig({
      ...DEFAULT_CONFIG,
      setup: { status: "configured", scope: "workspace", destination: ".agents/skills" },
    })).toThrow(ConfigError)
  })

  test("keeps non-empty custom models legal for runtime config", () => {
    expect(parseConfig({ ...DEFAULT_CONFIG, model: "provider-specific-custom-model" }).model)
      .toBe("provider-specific-custom-model")
  })

  test("serializes only a validated v3 candidate", () => {
    const candidate = serializeConfigCandidate({
      ...DEFAULT_CONFIG,
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    })
    expect(JSON.parse(candidate)).toEqual({
      ...DEFAULT_CONFIG,
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    })
    expect(() => serializeConfigCandidate({
      ...DEFAULT_CONFIG,
      setup: { status: "configured", scope: "local", destination: ".claude/skills" },
    })).toThrow(ConfigError)
  })

  test("applies runtime overrides without re-validating or changing setup metadata", () => {
    const configured = parseConfig({
      ...DEFAULT_CONFIG,
      setup: { status: "configured", scope: "local", destination: ".agents/skills" },
    })
    const overridden = applyRuntimeConfigOverrides(configured, { provider: "claude", model: "custom" })

    expect(overridden.provider).toBe("claude")
    expect(overridden.model).toBe("custom")
    expect(overridden.setup).toBe(configured.setup)
    expect(() => applyRuntimeConfigOverrides(configured, { provider: "not-a-provider" as never })).toThrow(ConfigError)
  })
})
