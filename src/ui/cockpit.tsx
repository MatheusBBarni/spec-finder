import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./App.tsx"
import type { CockpitStore } from "./store.ts"

export async function startCockpit(store: CockpitStore, onCancel: () => void): Promise<{ close: () => void }> {
  const renderer = await createCliRenderer({ exitOnCtrlC: false, backgroundColor: "#000000" })
  // Keep the renderer's clear color explicit as well as the root surface color.
  // OpenTUI can retain the terminal's previous background when only the
  // renderer option is supplied, which makes transparent structural cells
  // appear as a tinted gutter on some terminals.
  renderer.setBackgroundColor("#000000")
  const root = createRoot(renderer)
  root.render(<App store={store} onCancel={onCancel} />)
  return { close: () => renderer.destroy() }
}
