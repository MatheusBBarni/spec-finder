import { describe, expect, test } from "bun:test"
import { PROVIDERS } from "../src/config.ts"
import {
  defaultsRuntimeToAutoOnProviderSwitch,
  getSetupModelChoices,
  getSetupProfile,
  isCuratedSetupModel,
  isSetupDestination,
  resolveSetupSkills,
  SETUP_PROVIDER_PROFILES,
  SPEC_FINDER_SKILLS,
} from "../src/setup-profile.ts"

describe("setup provider policy", () => {
  test("defines one static, exhaustive profile for every provider", () => {
    expect(Object.keys(SETUP_PROVIDER_PROFILES).sort()).toEqual([...PROVIDERS].sort())

    for (const provider of PROVIDERS) {
      const profile = getSetupProfile(provider)
      expect(profile.provider).toBe(provider)
      expect(profile.label).toBe(
        provider === "claude"
          ? "Claude"
          : provider === "codex"
            ? "Codex"
            : provider === "cursor"
              ? "Cursor"
              : provider === "pi"
                ? "Pi"
                : "Grok Build",
      )
      expect(isSetupDestination(profile.destination)).toBeTrue()
      expect(["auto", ...profile.models]).toContain(profile.defaultModel)
      expect(isCuratedSetupModel(provider, "auto")).toBeTrue()
      expect(isCuratedSetupModel(provider, profile.defaultModel)).toBeTrue()
    }
  })

  test("uses the approved destinations and curated defaults", () => {
    expect(getSetupProfile("codex")).toMatchObject({
      label: "Codex",
      destination: ".agents/skills",
      models: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
      defaultModel: "gpt-5.6-luna",
    })
    expect(getSetupProfile("claude")).toMatchObject({
      label: "Claude",
      destination: ".claude/skills",
      models: ["fable", "opus", "sonnet", "haiku"],
      defaultModel: "fable",
    })
    expect(getSetupProfile("cursor")).toMatchObject({
      label: "Cursor",
      destination: ".agents/skills",
      models: [],
      defaultModel: "auto",
    })
    expect(getSetupProfile("grok")).toMatchObject({
      label: "Grok Build",
      destination: ".agents/skills",
      models: [],
      defaultModel: "auto",
    })
    expect(getSetupProfile("pi")).toMatchObject({
      label: "Pi",
      destination: ".agents/skills",
      models: [],
      defaultModel: "auto",
    })
    expect(isCuratedSetupModel("pi", "anthropic/claude-sonnet-4")).toBeFalse()
  })

  test("keeps auto universal without widening the curated provider lists", () => {
    for (const provider of PROVIDERS) {
      const profile = getSetupProfile(provider)
      expect(profile.models).not.toContain("auto")
      expect(getSetupModelChoices(provider)).toEqual(["auto", ...profile.models])
      expect(isCuratedSetupModel(provider, "not-a-curated-model")).toBeFalse()
    }
  })

  test("defaults omitted runtime model and reasoning only when switching to grok or pi", () => {
    expect(defaultsRuntimeToAutoOnProviderSwitch("grok")).toBeTrue()
    expect(defaultsRuntimeToAutoOnProviderSwitch("pi")).toBeTrue()
    expect(defaultsRuntimeToAutoOnProviderSwitch("claude")).toBeFalse()
    expect(defaultsRuntimeToAutoOnProviderSwitch("codex")).toBeFalse()
    expect(defaultsRuntimeToAutoOnProviderSwitch("cursor")).toBeFalse()
  })

  test("canonicalizes selected skills and rejects empty, unknown, or duplicate names", () => {
    expect(resolveSetupSkills()).toEqual([...SPEC_FINDER_SKILLS])
    expect(resolveSetupSkills(["sf-memory", "sf-write-spec"])).toEqual(["sf-write-spec", "sf-memory"])
    expect(() => resolveSetupSkills([])).toThrow("at least one skill")
    expect(() => resolveSetupSkills(["sf-memory", "nope"])).toThrow("unsupported setup skill: nope")
    expect(() => resolveSetupSkills(["sf-memory", "sf-memory"])).toThrow("duplicate setup skill: sf-memory")
    expect(SPEC_FINDER_SKILLS).toContain("sf-review")
  })

})
