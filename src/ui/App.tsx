import type { ScrollBoxRenderable } from "@opentui/core"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { TaskStatus } from "../tasks.ts"
import {
  selectSelectedTask,
  selectSelectedTranscript,
  selectTaskReason,
  type CockpitState,
  type CockpitStore,
  type CockpitTask,
  type RuntimeOptionName,
} from "./store.ts"
import type { TranscriptEntry, TranscriptKind } from "./transcript.ts"

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
  thought: "#c69af1",
  tool: "#e6c36a",
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const
const SPINNER_INTERVAL_MS = 120

interface AppProps {
  store: CockpitStore
  onCancel: () => void
}

export function App({ store, onCancel }: AppProps) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const taskListRef = useRef<ScrollBoxRenderable>(null)
  const transcriptRef = useRef<ScrollBoxRenderable>(null)
  const [spinnerIndex, setSpinnerIndex] = useState(0)
  const selectedTask = selectSelectedTask(state)
  const selectedTranscript = selectSelectedTranscript(state)
  const compact = width < 80 || height < 24
  const expanded = width >= 120 && !compact
  const hasRunningTasks = state.tasks.some((task) => task.status === "in_progress")
  const spinner = SPINNER_FRAMES[spinnerIndex] ?? "⠋"

  useKeyboard((key) => {
    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      onCancel()
      renderer.destroy()
      return
    }
    if (key.name === "?") {
      store.toggleHelp()
      return
    }
    if (state.helpOpen) {
      if (key.name === "escape") store.setHelpOpen(false)
      return
    }
    if (key.name === "tab") {
      store.toggleFocusedPane()
      return
    }
    if (state.focusedPane !== "tasks") return
    if (key.name === "up" || key.name === "k") store.moveTask(-1)
    else if (key.name === "down" || key.name === "j") store.moveTask(1)
  })

  useEffect(() => {
    if (!state.selectedTaskId) return
    taskListRef.current?.scrollChildIntoView(taskRowId(state.selectedTaskId))
    const transcript = transcriptRef.current
    if (transcript) transcript.scrollTo(transcript.scrollHeight)
  }, [state.selectedTaskId])

  useEffect(() => {
    if (!hasRunningTasks) {
      setSpinnerIndex(0)
      return
    }

    renderer.requestLive()
    const timer = setInterval(() => {
      setSpinnerIndex((index) => (index + 1) % SPINNER_FRAMES.length)
    }, SPINNER_INTERVAL_MS)
    return () => {
      clearInterval(timer)
      renderer.dropLive()
    }
  }, [hasRunningTasks, renderer])

  const headerLines = buildHeaderLines(state, width, height, compact, expanded)
  const mainDirection = compact ? "column" : "row"
  const taskPanelWidth = compact ? "100%" : expanded ? 40 : Math.max(34, Math.floor(width * 0.34))
  const compactTaskHeight = Math.max(5, Math.min(8, Math.floor((height - headerLines.length - 5) / 3)))

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={colors.background}>
      <box
        height={headerLines.length + 2}
        paddingLeft={1}
        paddingRight={1}
        flexDirection="column"
        justifyContent="center"
        borderStyle="single"
        borderColor={state.finished?.ok === false ? colors.danger : colors.border}
      >
        <text fg={colors.accent} wrapMode="none"><strong>{headerLines[0]}</strong></text>
        {headerLines.slice(1).map((line, index) => (
          <text key={`header-${index}`} fg={index === 0 ? colors.text : colors.muted} wrapMode="none">{line}</text>
        ))}
      </box>

      <box flexGrow={1} flexDirection={mainDirection} gap={1} paddingLeft={1} paddingRight={1} paddingBottom={1}>
        <box
          width={taskPanelWidth}
          height={compact ? compactTaskHeight : "100%"}
          flexDirection="column"
          borderStyle="rounded"
          borderColor={state.focusedPane === "tasks" ? colors.accent : colors.border}
          backgroundColor={colors.panel}
          paddingLeft={1}
          paddingRight={1}
        >
          <text fg={state.focusedPane === "tasks" ? colors.accent : colors.text} wrapMode="none" truncate>
            <strong>TASKS{state.focusedPane === "tasks" ? " · FOCUS" : ""}</strong>
          </text>
          <scrollbox id="task-scroll" ref={taskListRef} flexGrow={1} viewportCulling>
            {state.tasks.length === 0 ? <text fg={colors.muted}>Waiting for task packet…</text> : null}
            {state.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                selected={task.id === state.selectedTaskId}
                reason={selectTaskReason(state, task.id)}
                spinner={spinner}
                titleLimit={compact ? Math.max(12, width - 29) : expanded ? 36 : Math.max(10, Number(taskPanelWidth) - 23)}
              />
            ))}
          </scrollbox>
        </box>

        <box
          flexGrow={1}
          flexDirection="column"
          borderStyle="rounded"
          borderColor={state.focusedPane === "transcript" ? colors.accent : colors.border}
          backgroundColor={colors.panel}
          paddingLeft={1}
          paddingRight={1}
        >
          <text fg={state.focusedPane === "transcript" ? colors.accent : colors.text} wrapMode="word" flexShrink={0}>
            <strong>{transcriptTitle(selectedTask?.id, state)}</strong>
            {selectedTask && selectTaskReason(state, selectedTask.id) ? (
              <><br /><span fg={colors.danger}>{`Reason: ${selectTaskReason(state, selectedTask.id)}`}</span></>
            ) : null}
          </text>
          <scrollbox
            id="transcript-scroll"
            ref={transcriptRef}
            flexGrow={1}
            focused={state.focusedPane === "transcript" && !state.helpOpen}
            stickyScroll
            stickyStart="bottom"
            viewportCulling
          >
            <text id="transcript-start" flexShrink={0}> </text>
            {selectedTranscript.length === 0 ? <text fg={colors.muted}>No transcript yet.</text> : null}
            {selectedTranscript.map((entry) => <TranscriptRow key={entry.id} entry={entry} />)}
          </scrollbox>
        </box>
      </box>

      {state.helpOpen ? <HelpOverlay width={width} height={height} /> : null}

      <box height={compact ? 2 : 1} paddingLeft={1} paddingRight={1}>
        <text fg={colors.muted} wrapMode="none" truncate>{footerText(state, compact)}</text>
      </box>
    </box>
  )
}

function TaskRow({
  task,
  selected,
  reason,
  spinner,
  titleLimit,
}: {
  task: CockpitTask
  selected: boolean
  reason: string | undefined
  spinner: string
  titleLimit: number
}) {
  const running = task.status === "in_progress"
  const label = running ? "" : statusLabel(task.status)
  const marker = running ? spinner : statusIcon(task.status)
  return (
    <text id={taskRowId(task.id)} fg={selected ? colors.accent : statusColor(task.status)} wrapMode="word" flexShrink={0}>
      {selected ? ">" : " "}{marker} {task.id}{label ? ` [${label}]` : ""} {fit(task.title, titleLimit)}
      {reason ? <><br /><span fg={colors.danger}>  ! {reason}</span></> : null}
    </text>
  )
}

function TranscriptRow({ entry }: { entry: TranscriptEntry }) {
  const status = entry.status ? ` · ${humanize(entry.status)}` : entry.streaming ? " · streaming" : ""
  const text = compactTranscriptText(entry.text)
  return (
    <text id={`transcript-entry-${entry.id}`} fg={transcriptColor(entry.kind)} wrapMode="word" flexShrink={0}>
      <strong>{transcriptIcon(entry.kind)} {entry.label}{status}</strong>
      <br />
      <span fg={entry.kind === "error" ? colors.danger : colors.text}>{text}</span>
    </text>
  )
}

function HelpOverlay({ width, height }: { width: number; height: number }) {
  const overlayWidth = Math.max(24, width - (width >= 80 ? 12 : 2))
  const overlayHeight = Math.max(8, Math.min(18, height - 2))
  return (
    <box
      position="absolute"
      left={width >= 80 ? 6 : 1}
      top={1}
      width={overlayWidth}
      height={overlayHeight}
      zIndex={20}
      flexDirection="column"
      padding={1}
      borderStyle="double"
      borderColor={colors.accent}
      backgroundColor={colors.panel}
    >
      <text fg={colors.accent}><strong>READ-ONLY COCKPIT HELP</strong></text>
      <text fg={colors.text} marginTop={1}>Tab / Shift+Tab   Switch task and transcript focus</text>
      <text fg={colors.text}>↑ / ↓ or j / k    Select a task while Tasks has focus</text>
      <text fg={colors.text}>↑ / ↓              Scroll transcript by line</text>
      <text fg={colors.text}>PageUp / PageDown  Scroll transcript by page</text>
      <text fg={colors.text}>Home / End         Jump to transcript start / live tail</text>
      <text fg={colors.text}>? / Esc            Close this help</text>
      <text fg={colors.text}>q / Ctrl+C         Cancel the run and leave the terminal UI</text>
      <text fg={colors.muted} marginTop={1}>View only: navigation, scrolling, help, and terminal cancellation.</text>
    </box>
  )
}

function buildHeaderLines(
  state: CockpitState,
  width: number,
  height: number,
  compact: boolean,
  expanded: boolean,
): string[] {
  const max = Math.max(12, width - 6)
  const phase = runPhase(state)
  const active = activeTaskSummary(state)
  const counts = taskCounts(state)
  const identity = runtimeIdentityParts(state)
  const title = `SPEC FINDER · ${state.slug || "cockpit"}`

  if (expanded) {
    return [
      clip(`${title}  |  ${phase}`, max),
      clip(`${active}  |  ${counts}`, max),
      clip(identity.join(" - "), max),
    ]
  }
  if (compact) {
    return [
      clip(`${title} · COMPACT ${width}x${height}`, max),
      clip(`${phase} · ${active}`, max),
      clip(`${counts} · ${identity.join(" - ")}`, max),
    ]
  }
  return [
    clip(title, max),
    clip(`${phase} · ${active}`, max),
    clip(`${counts} · ${identity.join(" - ")}`, max),
  ]
}

function runPhase(state: CockpitState): string {
  if (state.finished) return `Outcome: ${state.finished.ok ? "completed" : "failed"} · ${state.finished.message}`
  if (state.activeTaskId) return "Phase: running"
  if (state.slug) return "Phase: preparing"
  return "Phase: initializing"
}

function activeTaskSummary(state: CockpitState): string {
  const active = state.tasks.find((task) => task.id === state.activeTaskId)
  return active ? `Active: ${active.id} ${active.title}` : "Active: none"
}

function taskCounts(state: CockpitState): string {
  const completed = state.tasks.filter((task) => isCompleted(task.status)).length
  const running = state.tasks.filter((task) => task.status === "in_progress").length
  const failed = state.tasks.filter((task) => task.status === "failed").length
  const blocked = state.tasks.filter((task) => task.status === "blocked").length
  return `Tasks: ${completed}/${state.tasks.length} completed · ${running} running · ${failed} failed · ${blocked} blocked`
}

function runtimeIdentityParts(state: CockpitState): string[] {
  if (!state.config) return ["initializing"]
  return [
    state.config.provider,
    runtimeOptionValue("model", state),
    runtimeOptionValue("reasoning", state),
    runtimeOptionValue("speed", state),
  ]
}

function runtimeOptionValue(name: RuntimeOptionName, state: CockpitState): string {
  const outcome = state.runtimeOptions[name]
  const requested = outcome?.requested ?? state.config?.[name] ?? "auto"
  if (!outcome) return `${requested} (requested)`
  if (outcome.outcome === "applied") return `${requested} (applied)`
  if (outcome.outcome === "default") return "provider default"
  return `${requested} (unsupported)`
}

function transcriptTitle(selectedTaskId: string | undefined, state: CockpitState): string {
  if (!selectedTaskId) return "TRANSCRIPT · no task selected"
  const mode = selectedTaskId === state.activeTaskId && state.followingActiveTask ? "FOLLOWING ACTIVE" : "INSPECTING HISTORY"
  return `TRANSCRIPT · ${selectedTaskId} · ${mode}${state.focusedPane === "transcript" ? " · FOCUS" : ""}`
}

function footerText(state: CockpitState, compact: boolean): string {
  if (compact) return "Tab pane · ↑↓/Pg/Home/End navigate · ? help · q/Ctrl+C cancel"
  if (state.focusedPane === "tasks") return "↑/↓ or j/k select · Tab transcript · ? help · q/Ctrl+C cancel"
  return "↑/↓ line · PgUp/PgDn page · Home/End start/tail · Tab tasks · ? help · q/Ctrl+C cancel"
}

function taskRowId(taskId: string): string {
  return `task-row-${taskId}`
}

function statusIcon(status: TaskStatus): string {
  if (isCompleted(status)) return "✓"
  if (status === "failed") return "✗"
  if (status === "blocked") return "!"
  if (status === "in_progress") return "▶"
  return "·"
}

function statusLabel(status: TaskStatus): string {
  if (isCompleted(status)) return "COMPLETED"
  return status.toUpperCase()
}

function statusColor(status: TaskStatus): string {
  if (isCompleted(status)) return colors.success
  if (status === "failed" || status === "blocked") return colors.danger
  if (status === "in_progress") return colors.active
  return colors.text
}

function transcriptIcon(kind: TranscriptKind): string {
  const icons: Record<TranscriptKind, string> = {
    message: "●",
    thought: "◇",
    plan: "≡",
    tool: "◆",
    tool_update: "↻",
    activity: "·",
    error: "✗",
    outcome: "✓",
    unknown: "?",
  }
  return icons[kind]
}

function transcriptColor(kind: TranscriptKind): string {
  if (kind === "error") return colors.danger
  if (kind === "outcome") return colors.success
  if (kind === "tool" || kind === "tool_update") return colors.tool
  if (kind === "thought" || kind === "plan") return colors.thought
  if (kind === "message") return colors.active
  return colors.muted
}

function humanize(value: string): string {
  return value.replaceAll("_", " ")
}

function fit(value: string, limit: number): string {
  if (limit <= 1) return value.slice(0, Math.max(0, limit))
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`
}

function clip(value: string, limit: number): string {
  return value.slice(0, Math.max(0, limit))
}

function compactTranscriptText(value: string): string {
  const compact = value
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n[ \t]+/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim()
  return compact || "(no text)"
}

function isCompleted(status: TaskStatus): boolean {
  return status === "completed" || status === "done" || status === "finished"
}
