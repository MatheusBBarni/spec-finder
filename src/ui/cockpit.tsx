import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./App.tsx"
import type { CockpitStore } from "./store.ts"

export interface CockpitSession {
  close: () => void
  /** Present on the real controller; optional for legacy injected command fakes. */
  waitForExit?: () => Promise<void>
  /** Legacy failure-review lifecycle retained for existing command callers. */
  waitForDismissal: () => Promise<void>
}

interface CockpitSessionController extends CockpitSession {
  dismiss: () => void
  signalExit: () => void
  waitForExit: () => Promise<void>
}

export function createCockpitSessionController(closeRenderer: () => void): CockpitSessionController {
  let closed = false
  let exited = false
  let dismissed = false
  let resolveExit: (() => void) | undefined
  let resolveDismissal: (() => void) | undefined
  const exit = new Promise<void>((resolve) => {
    resolveExit = resolve
  })
  const dismissal = new Promise<void>((resolve) => {
    resolveDismissal = resolve
  })
  const signalExit = () => {
    if (exited) return
    exited = true
    resolveExit?.()
  }
  const dismiss = () => {
    if (dismissed) return
    dismissed = true
    resolveDismissal?.()
  }

  return {
    dismiss,
    signalExit,
    waitForExit: () => exit,
    waitForDismissal: () => dismissal,
    close: () => {
      if (closed) return
      closed = true
      signalExit()
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
  root.render(<App store={store} onCancel={onCancel} onDismiss={session.dismiss} onExit={session.signalExit} />)
  return session
}
