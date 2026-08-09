import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./App.tsx"
import type { CockpitStore } from "./store.ts"

export interface CockpitSession {
  close: () => void
  waitForDismissal: () => Promise<void>
}

interface CockpitSessionController extends CockpitSession {
  dismiss: () => void
}

export function createCockpitSessionController(closeRenderer: () => void): CockpitSessionController {
  let closed = false
  let dismissed = false
  let resolveDismissal: (() => void) | undefined
  const dismissal = new Promise<void>((resolve) => {
    resolveDismissal = resolve
  })
  const dismiss = () => {
    if (dismissed) return
    dismissed = true
    resolveDismissal?.()
  }

  return {
    dismiss,
    waitForDismissal: () => dismissal,
    close: () => {
      if (closed) return
      closed = true
      dismiss()
      closeRenderer()
    },
  }
}

export async function startCockpit(store: CockpitStore, onCancel: () => void): Promise<CockpitSession> {
  const renderer = await createCliRenderer({ exitOnCtrlC: false, backgroundColor: "#0d0d0d" })
  // Keep the renderer's clear color explicit as well as the root surface color.
  // OpenTUI can retain the terminal's previous background when only the
  // renderer option is supplied, which makes transparent structural cells
  // appear as a tinted gutter on some terminals.
  renderer.setBackgroundColor("#0d0d0d")
  const session = createCockpitSessionController(() => renderer.destroy())
  const root = createRoot(renderer)
  root.render(<App store={store} onCancel={onCancel} onDismiss={session.dismiss} />)
  return session
}
