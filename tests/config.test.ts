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
    ])
  })

  test("rejects unknown keys and invalid runtime values", () => {
    expect(() => parseConfig({ ...DEFAULT_CONFIG, speed: "turbo", surprise: true })).toThrow(ConfigError)
    try {
      parseConfig({ ...DEFAULT_CONFIG, speed: "turbo" })
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError)
      expect((error as ConfigError).issues.join("\n")).toContain("speed")
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
    })).toEqual(DEFAULT_CONFIG)
  })
})
