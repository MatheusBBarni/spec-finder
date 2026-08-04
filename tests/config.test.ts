import { describe, expect, test } from "bun:test"
import { DEFAULT_CONFIG, ConfigError, parseConfig } from "../src/config.ts"

describe("config", () => {
  test("accepts the default configuration", () => {
    expect(parseConfig(DEFAULT_CONFIG)).toEqual(DEFAULT_CONFIG)
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

  test("keeps reports mandatory and inside the task packet", () => {
    expect(() => parseConfig({ ...DEFAULT_CONFIG, report: { enabled: false, directory: "reports" } })).toThrow(ConfigError)
    expect(() => parseConfig({ ...DEFAULT_CONFIG, report: { enabled: true, directory: "../reports" } })).toThrow(ConfigError)
  })
})
