import { describe, expect, test } from "bun:test"
import { PROVIDERS } from "../src/config.ts"
import {
  getSetupModelChoices,
  getSetupProfile,
  isCuratedSetupModel,
  isSetupDestination,
  SETUP_PROVIDER_PROFILES,
} from "../src/setup-profile.ts"

describe("setup provider policy", () => {
  test("defines one static, exhaustive profile for every provider", () => {
    expect(Object.keys(SETUP_PROVIDER_PROFILES).sort()).toEqual([...PROVIDERS].sort())

    for (const provider of PROVIDERS) {
      const profile = getSetupProfile(provider)
      expect(profile.provider).toBe(provider)
      expect(profile.label).toBe(provider === "claude" ? "Claude" : provider === "codex" ? "Codex" : "Cursor")
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
  })

  test("keeps auto universal without widening the curated provider lists", () => {
    for (const provider of PROVIDERS) {
      const profile = getSetupProfile(provider)
      expect(profile.models).not.toContain("auto")
      expect(getSetupModelChoices(provider)).toEqual(["auto", ...profile.models])
      expect(isCuratedSetupModel(provider, "not-a-curated-model")).toBeFalse()
    }
  })
})
