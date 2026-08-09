import { describe, expect, test } from "bun:test"
import { DEFAULT_CONFIG, ConfigError, parseConfig } from "../src/config.ts"

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
    ])
  })

  test("defaults omitted auto_commit to false", () => {
    const config = parseConfig({
      version: 2,
      provider: "codex",
      model: "auto",
      reasoning: "high",
      speed: "normal",
      permissions: "prompt",
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
})
