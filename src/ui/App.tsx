import { useSyncExternalStore } from "react"
import { useKeyboard, useRenderer } from "@opentui/react"
import type { CockpitStore } from "./store.ts"

const colors = {
  background: "#111318",
  panel: "#191c24",
  border: "#394150",
  text: "#e6e9ef",
  muted: "#8d95a5",
  accent: "#f3a952",
  success: "#78c69b",
  danger: "#ef7d7d",
  active: "#80a8ff",
}

interface AppProps {
  store: CockpitStore
  onCancel: () => void
}

export function App({ store, onCancel }: AppProps) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const renderer = useRenderer()

  useKeyboard((key) => {
    if (state.permission) {
      if (key.name === "up" || key.name === "k") store.movePermission(-1)
      else if (key.name === "down" || key.name === "j") store.movePermission(1)
      else if (key.name === "return") store.selectPermission()
      else if (key.name === "escape") store.cancelPermission()
      return
    }
    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      onCancel()
      renderer.destroy()
    }
  })

  const config = state.config
  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={colors.background}>
      <box height={3} paddingLeft={1} paddingRight={1} flexDirection="row" justifyContent="space-between" alignItems="center" borderStyle="single" borderColor={colors.border}>
        <text fg={colors.accent}><strong>SPEC FINDER</strong>  {state.slug || "cockpit"}</text>
        <text fg={colors.muted}>{config ? `${config.provider} · ${config.model} · ${config.reasoning} · ${config.speed}` : "initializing"}</text>
      </box>

      <box flexGrow={1} flexDirection="row" gap={1} padding={1}>
        <box width="38%" flexDirection="column" borderStyle="rounded" borderColor={colors.border} backgroundColor={colors.panel} padding={1}>
          <text fg={colors.text}><strong>TASKS</strong></text>
          <box flexDirection="column" marginTop={1}>
            {state.tasks.map((task) => (
              <text key={task.id} fg={statusColor(task.status)}>
                {task.id === state.activeTaskId ? "▶" : statusIcon(task.status)} {task.id}  {task.title} <span fg={colors.muted}>[{task.complexity}]</span>
              </text>
            ))}
          </box>
        </box>

        <box flexGrow={1} flexDirection="column" borderStyle="rounded" borderColor={colors.border} backgroundColor={colors.panel} padding={1}>
          <text fg={colors.text}><strong>ACP ACTIVITY</strong></text>
          <scrollbox flexGrow={1} stickyScroll stickyStart="bottom" viewportCulling>
            {state.activity.map((line, index) => <text key={`${index}-${line}`} fg={colors.muted}>{line}</text>)}
          </scrollbox>
        </box>
      </box>

      {state.permission ? (
        <box position="absolute" left="15%" top="20%" width="70%" height="60%" zIndex={20} flexDirection="column" padding={1} borderStyle="double" borderColor={colors.accent} backgroundColor={colors.panel}>
          <text fg={colors.accent}><strong>PERMISSION REQUIRED</strong></text>
          <text fg={colors.text} marginTop={1}>{state.permission.request.toolCall.title}</text>
          <box flexDirection="column" marginTop={1}>
            {state.permission.request.options.map((option, index) => (
              <text key={option.optionId} fg={index === state.permission?.selectedIndex ? colors.active : colors.muted}>
                {index === state.permission?.selectedIndex ? "▶" : " "} {option.name} ({option.kind})
              </text>
            ))}
          </box>
          <text fg={colors.muted} marginTop={1}>↑/↓ choose · Enter confirm · Esc cancel</text>
        </box>
      ) : null}

      <box height={1} paddingLeft={1} paddingRight={1} flexDirection="row" justifyContent="space-between">
        <text fg={state.finished?.ok === false ? colors.danger : colors.muted}>{state.finished?.message ?? "q cancel"}</text>
        <text fg={colors.muted}>reports: required</text>
      </box>
    </box>
  )
}

function statusIcon(status: string): string {
  if (["completed", "done", "finished"].includes(status)) return "✓"
  if (status === "failed") return "✗"
  if (status === "blocked") return "!"
  return "·"
}

function statusColor(status: string): string {
  if (["completed", "done", "finished"].includes(status)) return colors.success
  if (status === "failed" || status === "blocked") return colors.danger
  if (status === "in_progress") return colors.active
  return colors.text
}
