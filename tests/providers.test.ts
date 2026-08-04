import { describe, expect, test } from "bun:test"
import { DEFAULT_CONFIG } from "../src/config.ts"
import { resolveProviderLaunch } from "../src/providers.ts"

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
})

