import { describe, expect, test } from "bun:test"
import { DEFAULT_CONFIG } from "../src/config.ts"
import {
  EXEC_PROVIDER_CERTIFICATION,
  ProviderCertificationError,
  getProviderCertification,
  isExecProviderCertified,
  resolveExecProviderLaunch,
  resolvePacketProviderLaunch,
  resolveProviderLaunch,
} from "../src/providers.ts"

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

  test("keeps packet launch resolution independent from exec certification", () => {
    for (const provider of ["claude", "codex", "cursor"] as const) {
      expect(() => resolvePacketProviderLaunch({ ...DEFAULT_CONFIG, provider })).not.toThrow()
      expect(isExecProviderCertified(provider)).toBeFalse()
      expect(getProviderCertification(provider)).toEqual({ exec: false })
    }
    expect(EXEC_PROVIDER_CERTIFICATION).toEqual({
      claude: { exec: false },
      codex: { exec: false },
      cursor: { exec: false },
    })
  })

  test("rejects every uncertified real provider before an exec launch", () => {
    for (const provider of ["claude", "codex", "cursor"] as const) {
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
})
