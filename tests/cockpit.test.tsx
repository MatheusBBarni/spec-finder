import { describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"
import { DEFAULT_CONFIG } from "../src/config.ts"
import { App } from "../src/ui/App.tsx"
import { CockpitStore } from "../src/ui/store.ts"

describe("cockpit", () => {
  test("renders runtime identity and task state", async () => {
    const store = new CockpitStore()
    store.consume({ type: "run_started", slug: "demo", config: DEFAULT_CONFIG, tasks: [] })
    const screen = await testRender(<App store={store} onCancel={() => {}} />, { width: 100, height: 30 })
    try {
      await screen.renderOnce()
      const frame = screen.captureCharFrame()
      expect(frame).toContain("SPEC FINDER")
      expect(frame).toContain("demo")
      expect(frame).toContain("codex")
      expect(frame).toContain("ACP ACTIVITY")
    } finally {
      await act(async () => screen.renderer.destroy())
    }
  })
})
