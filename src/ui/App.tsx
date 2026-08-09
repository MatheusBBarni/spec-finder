import type { ScrollBoxRenderable } from "@opentui/core"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react"
import type { PacketOutcome, PacketSummary } from "../batch.ts"
import type { TaskStatus } from "../tasks.ts"
import {
  selectSelectedTask,
  selectSelectedTranscript,
  selectTaskReason,
  selectUnfinishedTasks,
  type CockpitState,
  type CockpitStore,
  type CockpitTask,
  type RuntimeOptionName,
} from "./store.ts"
import type { TranscriptEntry, TranscriptKind } from "./transcript.ts"

const colors = {
  // DESIGN.md surface-soft: deliberate near-black canvas for terminal gutters.
  // Keeping this non-zero avoids terminals that treat true black as their
  // inherited background while preserving the intended dark hierarchy.
  background: "#0d0d0d",
  panel: "#1a1a1a",
  surfaceElevated: "#262626",
  border: "#3c3c3c",
  text: "#bbbbbb",
  textStrong: "#e6e6e6",
  muted: "#7e7e7e",
  dim: "#7e7e7e",
  accent: "#1c69d4",
  accentBright: "#ffffff",
  success: "#0fa336",
  danger: "#e22718",
  warning: "#f4b400",
  active: "#0fa336",
  thought: "#0066b1",
  tool: "#f4b400",
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const
const SPINNER_INTERVAL_MS = 120

export interface TaskTiming {
  startedAt: number
  elapsedMs?: number
}

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
  const batchSummaryRef = useRef<ScrollBoxRenderable>(null)
  const taskTimings = useRef(new Map<string, TaskTiming>())
  const summaryDismissed = useRef(false)
  const [spinnerIndex, setSpinnerIndex] = useState(0)
  const [clock, setClock] = useState(() => performance.now())
  const [summaryOpen, setSummaryOpen] = useState(false)
  const summaryOpenRef = useRef(false)
  summaryOpenRef.current = summaryOpen
  const selectedTask = selectSelectedTask(state)
  const selectedTranscript = selectSelectedTranscript(state)
  const compact = width < 80 || height < 24
  const hasRunningTasks = state.tasks.some((task) => task.status === "in_progress")
  const spinner = SPINNER_FRAMES[spinnerIndex] ?? "⠋"

  useKeyboard((key) => {
    const escape = key.name === "escape" || key.name === "esc" || key.sequence === "\u001b" || key.raw === "\u001b"
    if (escape) {
      if (summaryOpenRef.current) {
        summaryDismissed.current = true
        setSummaryOpen(false)
        return
      }
      if (state.helpOpen) {
        store.setHelpOpen(false)
        return
      }
    }
    if (summaryOpenRef.current) {
      if (key.name === "q" || (key.ctrl && key.name === "c")) {
        onCancel()
        renderer.destroy()
      }
      return
    }
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
    if (state.packetSummaries.length === 0) return
    const index = state.stoppingPacket?.index ?? state.activePacket?.index ?? 0
    batchSummaryRef.current?.scrollChildIntoView(batchPacketRowId(index))
  }, [state.activePacket?.index, state.packetSummaries.length, state.stoppingPacket?.index, summaryOpen])

  useEffect(() => {
    if (state.finished) {
      if (!summaryDismissed.current) setSummaryOpen(true)
      return
    }
    if (state.slug) {
      summaryDismissed.current = false
      taskTimings.current.clear()
      setSummaryOpen(false)
    }
  }, [state.finished, state.slug])

  useEffect(() => {
    const now = performance.now()
    for (const task of state.tasks) {
      const timing = taskTimings.current.get(task.id)
      if (task.status === "in_progress" && !timing) {
        taskTimings.current.set(task.id, { startedAt: now })
      } else if (timing && isTerminal(task.status) && timing.elapsedMs === undefined) {
        timing.elapsedMs = Math.max(0, now - timing.startedAt)
      }
    }
    setClock(now)
    if (!hasRunningTasks) {
      setSpinnerIndex(0)
      renderer.dropLive()
      return
    }

    renderer.requestLive()
    const timer = setInterval(() => {
      setSpinnerIndex((index) => (index + 1) % SPINNER_FRAMES.length)
      setClock(performance.now())
    }, SPINNER_INTERVAL_MS)
    return () => {
      clearInterval(timer)
      renderer.dropLive()
    }
  }, [hasRunningTasks, renderer, state.tasks])

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={colors.background}>
      {summaryOpen ? (
        <RunSummary state={state} width={width} height={height} batchSummaryRef={batchSummaryRef} />
      ) : (
        <LiveCockpit
          state={state}
          width={width}
          height={height}
          compact={compact}
          selectedTask={selectedTask}
          selectedTranscript={selectedTranscript}
          taskListRef={taskListRef}
          transcriptRef={transcriptRef}
          batchSummaryRef={batchSummaryRef}
          spinner={spinner}
          clock={clock}
          taskTimings={taskTimings.current}
        />
      )}
    </box>
  )
}

function LiveCockpit({
  state,
  width,
  height,
  compact,
  selectedTask,
  selectedTranscript,
  taskListRef,
  transcriptRef,
  batchSummaryRef,
  spinner,
  clock,
  taskTimings,
}: {
  state: CockpitState
  width: number
  height: number
  compact: boolean
  selectedTask: CockpitTask | undefined
  selectedTranscript: readonly TranscriptEntry[]
  taskListRef: RefObject<ScrollBoxRenderable | null>
  transcriptRef: RefObject<ScrollBoxRenderable | null>
  batchSummaryRef: RefObject<ScrollBoxRenderable | null>
  spinner: string
  clock: number
  taskTimings: Map<string, TaskTiming>
}) {
  const taskPanelWidth = compact ? "100%" : Math.max(30, Math.min(50, Math.floor(width * 0.28)))
  const taskWidth = typeof taskPanelWidth === "number" ? taskPanelWidth : Math.max(width - 2, 12)
  const mainDirection = compact ? "column" : "row"
  const progressWidth = Math.max(10, taskWidth - 4)
  const titleLimit = Math.max(10, taskWidth - 12)
  const unfinishedTasks = selectUnfinishedTasks(state)

  return (
    <>
      <TitleBar state={state} width={width} />
      {state.packetSummaries.length > 0 || state.batchStatus !== null
        ? <BatchSequenceSummary state={state} width={width} height={height} compact={compact} scrollRef={batchSummaryRef} />
        : null}
      <box height={1} backgroundColor={colors.background}>
        <text fg={colors.border} wrapMode="none">{clip("─".repeat(Math.max(width, 1)), width)}</text>
      </box>

      <box flexGrow={1} flexDirection={mainDirection} gap={1} paddingLeft={1} paddingRight={1} paddingTop={1} backgroundColor={colors.background}>
        <box
          width={taskPanelWidth}
          height={compact ? Math.max(8, Math.floor(height * 0.35)) : "100%"}
          flexDirection="column"
          borderStyle="single"
          borderColor={state.focusedPane === "tasks" ? colors.accent : colors.border}
          backgroundColor={colors.panel}
          paddingLeft={1}
          paddingRight={1}
        >
          <text fg={state.focusedPane === "tasks" ? colors.accent : colors.textStrong} wrapMode="none" flexShrink={0}>
            <strong>TASKS {taskProgressLabel(state)}</strong>
          </text>
          <text fg={colors.active} wrapMode="none" flexShrink={0}>{progressBar(state, progressWidth)}</text>
          <scrollbox id="task-scroll" ref={taskListRef} flexGrow={1} viewportCulling>
            {state.tasks.length === 0 ? <text fg={colors.muted}>Waiting for task packet…</text> : null}
            {state.tasks.length > 0 && unfinishedTasks.length === 0 ? <text fg={colors.muted}>No unfinished tasks</text> : null}
            {unfinishedTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                selected={task.id === state.selectedTaskId}
                spinner={spinner}
                titleLimit={titleLimit}
                elapsed={taskElapsedText(task, taskTimings, clock)}
              />
            ))}
          </scrollbox>
        </box>

        <box flexGrow={1} flexDirection="column" gap={1}>
          <TaskHeader state={state} task={selectedTask} transcript={selectedTranscript} width={width} />
          <box
            flexGrow={1}
            flexDirection="column"
            borderStyle="single"
            borderColor={state.focusedPane === "transcript" ? colors.accent : colors.border}
            backgroundColor={colors.panel}
            paddingLeft={1}
            paddingRight={1}
          >
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
              {selectedTranscript.length === 0 ? <text fg={colors.muted}>Waiting for ACP updates...</text> : null}
              {selectedTranscript.map((entry) => <TranscriptRow key={entry.id} entry={entry} />)}
            </scrollbox>
          </box>
          <TaskStatusStrip state={state} task={selectedTask} />
        </box>
      </box>

      {state.helpOpen ? <HelpOverlay width={width} height={height} /> : null}

      <box height={1} paddingLeft={1} paddingRight={1} backgroundColor={colors.background}>
        <text fg={colors.muted} wrapMode="none">{clip(footerText(state, compact), Math.max(width - 2, 1))}</text>
      </box>
    </>
  )
}

function TaskRow({
  task,
  selected,
  spinner,
  titleLimit,
  elapsed,
}: {
  task: CockpitTask
  selected: boolean
  spinner: string
  titleLimit: number
  elapsed: string
}) {
  const running = task.status === "in_progress"
  const marker = running ? spinner : statusIcon(task.status)
  return (
    <box
      id={taskRowId(task.id)}
      height={4}
      flexDirection="column"
      flexShrink={0}
      borderStyle="single"
      borderColor={selected ? colors.accent : colors.border}
      backgroundColor={colors.surfaceElevated}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={selected ? colors.textStrong : statusColor(task.status)} wrapMode="none">
        <strong>{selected ? "> " : "  "}{marker} {task.id} </strong>{fit(task.title, titleLimit)}
      </text>
      <text fg={selected ? colors.muted : colors.dim} wrapMode="none">
        {task.type} · {elapsed}
      </text>
    </box>
  )
}

function TitleBar({ state, width }: { state: CockpitState; width: number }) {
  const status = workflowStatusText(state)
  const statusColor = workflowStatusColor(state)
  const contentWidth = Math.max(width - 2, 1)
  const statusText = clip(status, Math.max(12, contentWidth))
  const title = `SPEC FINDER · ${state.slug || "cockpit"} · ACP COCKPIT`
  const titleLimit = Math.max(12, contentWidth - statusText.length - 1)
  const identity = runtimeIdentityParts(state).join(" - ")
  return (
    <box height={2} paddingLeft={1} paddingRight={1} flexDirection="column" backgroundColor={colors.background}>
      <box height={1} flexDirection="row" alignItems="center">
        <text fg={colors.accentBright} wrapMode="none"><strong>{fit(title, titleLimit)}</strong></text>
        <box flexGrow={1} />
        <text fg={statusColor} wrapMode="none"><strong>{statusText}</strong></text>
      </box>
      <text fg={colors.muted} wrapMode="none">{clip(identity, contentWidth)}</text>
    </box>
  )
}

function BatchSequenceSummary({
  state,
  width,
  height,
  compact,
  scrollRef,
}: {
  state: CockpitState
  width: number
  height: number
  compact: boolean
  scrollRef: RefObject<ScrollBoxRenderable | null>
}) {
  const panelWidth = Math.max(24, width - 2)
  const innerWidth = Math.max(panelWidth - 4, 18)
  const guidance = batchRecoveryGuidance(state)
  if (height <= 24) {
    const heading = `BATCH ${state.packetSummaries.length} PACKETS · ${batchHeading(state)}`
    return (
      <box
        height={1 + guidance.length}
        paddingLeft={1}
        paddingRight={1}
        flexDirection="column"
        flexShrink={0}
        backgroundColor={colors.panel}
      >
        <text fg={batchPanelColor(state)} wrapMode="none" flexShrink={0}>
          <strong>{fit(heading, Math.max(width - 2, 18))}</strong>
        </text>
        {guidance.map((line, index) => (
          <text key={`${line}-${index}`} fg={index === guidance.length - 1 ? colors.muted : state.stoppingPacket ? colors.warning : colors.muted} wrapMode="none" flexShrink={0}>
            {fit(line, Math.max(width - 2, 18))}
          </text>
        ))}
      </box>
    )
  }

  const maxRows = compact ? 2 : Math.max(2, Math.min(5, Math.floor(height / 8)))
  const rowHeight = Math.max(1, Math.min(maxRows, state.packetSummaries.length))
  const contentHeight = 1 + rowHeight + guidance.length

  return (
    <box
      height={contentHeight + 2}
      width={panelWidth}
      marginLeft={1}
      borderStyle="single"
      borderColor={batchPanelColor(state)}
      backgroundColor={colors.panel}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
      flexShrink={0}
    >
      <text fg={colors.textStrong} wrapMode="none" flexShrink={0}>
        <strong>{fit(batchHeading(state), innerWidth)}</strong>
      </text>
      <scrollbox id="batch-sequence-scroll" ref={scrollRef} height={rowHeight} viewportCulling>
        {state.packetSummaries.map((summary, index) => (
          <BatchPacketRow
            key={`${summary.slug}-${index}`}
            state={state}
            summary={summary}
            index={index}
            width={innerWidth}
            compact={compact}
          />
        ))}
      </scrollbox>
      {guidance.map((line, index) => (
        <text key={`${line}-${index}`} fg={index === guidance.length - 1 ? colors.muted : state.stoppingPacket ? colors.warning : colors.muted} wrapMode="none" flexShrink={0}>
          {fit(line, innerWidth)}
        </text>
      ))}
    </box>
  )
}

function BatchPacketRow({
  state,
  summary,
  index,
  width,
  compact,
}: {
  state: CockpitState
  summary: PacketSummary
  index: number
  width: number
  compact: boolean
}) {
  const displayOutcome = batchPacketDisplayOutcome(state, summary, index)
  const icon = batchPacketIcon(displayOutcome)
  const label = batchPacketLabel(displayOutcome)
  const detail = summary.detail === "already_complete" ? " · already complete" : ""
  const prefix = compact ? `${index + 1}. ` : `PACKET ${index + 1} · `
  const primary = `${prefix}${icon} ${summary.slug} · ${label}${detail}`
  const statusFirst = `${prefix}${icon} ${label}${detail} · ${summary.slug}`
  return (
    <text id={batchPacketRowId(index)} fg={batchPacketColor(displayOutcome)} wrapMode="none" flexShrink={0}>
      <strong>{fit(primary.length <= width ? primary : statusFirst, width)}</strong>
    </text>
  )
}

function BatchRunSummary({
  state,
  width,
  height,
  scrollRef,
}: {
  state: CockpitState
  width: number
  height: number
  scrollRef: RefObject<ScrollBoxRenderable | null>
}) {
  const panelWidth = Math.max(24, Math.min(width - 2, 100))
  const innerWidth = Math.max(panelWidth - 4, 18)
  const guidance = batchRecoveryGuidance(state)
  const messageHeight = state.finished?.message ? 1 : 0
  const rowHeight = Math.max(1, Math.min(
    state.packetSummaries.length,
    height - guidance.length - messageHeight - 8,
  ))
  return (
    <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingTop={1}>
      <box
        width={panelWidth}
        borderStyle="single"
        borderColor={batchPanelColor(state)}
        backgroundColor={colors.panel}
        paddingLeft={1}
        paddingRight={1}
        flexDirection="column"
      >
        <text fg={colors.accentBright} wrapMode="none"><strong>RUN.STATUS · BATCH SEQUENCE</strong></text>
        <text fg={batchPanelColor(state)} wrapMode="none"><strong>{fit(batchHeading(state), innerWidth)}</strong></text>
        <scrollbox id="batch-run-scroll" ref={scrollRef} height={rowHeight} focused viewportCulling>
          {state.packetSummaries.map((summary, index) => (
            <BatchPacketRow
              key={`${summary.slug}-${index}`}
              state={state}
              summary={summary}
              index={index}
              width={innerWidth}
              compact={false}
            />
          ))}
        </scrollbox>
        {guidance.map((line, index) => <text key={`${line}-${index}`} fg={index === guidance.length - 1 ? colors.muted : state.stoppingPacket ? colors.warning : colors.muted} wrapMode="none">{fit(line, innerWidth)}</text>)}
        {state.finished?.message ? <text fg={colors.muted} wrapMode="none">{fit(state.finished.message, innerWidth)}</text> : null}
        <text fg={colors.active} wrapMode="none">{batchProgressBar(state, innerWidth)}</text>
      </box>
      <box height={1} marginTop={1} paddingLeft={1}>
        <text fg={colors.muted} wrapMode="none">[<span fg={colors.accent}>↑↓/PG/HOME/END</span>] PACKETS   [<span fg={colors.accent}>ESC</span>] BACK   [<span fg={colors.accent}>Q</span>] QUIT</text>
      </box>
      <box flexGrow={1} />
    </box>
  )
}

function TaskHeader({
  state,
  task,
  transcript,
  width,
}: {
  state: CockpitState
  task: CockpitTask | undefined
  transcript: readonly TranscriptEntry[]
  width: number
}) {
  const innerWidth = Math.max(width - 12, 24)
  const title = task ? `${task.title.toUpperCase()}  [${task.type}]` : "TASK TRANSCRIPT"
  const mode = task && task.id === state.activeTaskId && state.followingActiveTask ? "FOLLOWING ACTIVE" : "INSPECTING HISTORY"
  const meta = transcript.length === 0 ? "No ACP transcript yet" : `${transcript.length} entries`
  return (
    <box
      height={5}
      flexDirection="column"
      borderStyle="single"
      borderColor={state.focusedPane === "transcript" ? colors.accent : colors.border}
      backgroundColor={colors.panel}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={state.focusedPane === "transcript" ? colors.accent : colors.textStrong} wrapMode="none">
        <strong>{fit(title, innerWidth)}</strong>
      </text>
      <text fg={colors.muted} wrapMode="none">{fit(`TRANSCRIPT · ${task?.id ?? "none"} · ${mode}`, innerWidth)}</text>
      <text fg={colors.dim} wrapMode="none">{fit(meta, innerWidth)}</text>
    </box>
  )
}

function TaskStatusStrip({ state, task }: { state: CockpitState; task: CockpitTask | undefined }) {
  const reason = task ? selectTaskReason(state, task.id) : undefined
  const label = task ? taskStatusText(task.status) : "Waiting for task"
  const color = task ? statusColor(task.status) : colors.muted
  return (
    <box height={4} borderStyle="single" borderColor={color} backgroundColor={colors.panel} paddingLeft={1} paddingRight={1}>
      <text fg={color} wrapMode="none"><strong>{task ? `${statusIcon(task.status)} ${label}` : "› Waiting for task"}</strong></text>
      <text fg={reason ? colors.danger : colors.dim} wrapMode="none">{fit(reason ?? "Read-only progress; no workflow controls", 120)}</text>
    </box>
  )
}

function RunSummary({
  state,
  width,
  height,
  batchSummaryRef,
}: {
  state: CockpitState
  width: number
  height: number
  batchSummaryRef: RefObject<ScrollBoxRenderable | null>
}) {
  if (state.packetSummaries.length > 0 || state.batchStatus !== null) {
    return <BatchRunSummary state={state} width={width} height={height} scrollRef={batchSummaryRef} />
  }

  const completed = state.tasks.filter((task) => isCompleted(task.status)).length
  const failed = state.tasks.filter((task) => task.status === "failed").length
  const blocked = state.tasks.filter((task) => task.status === "blocked").length
  const failures = state.tasks.filter((task) => task.status === "failed" || task.status === "blocked")
  const panelWidth = Math.max(24, Math.min(width - 4, 86))
  const innerWidth = Math.max(panelWidth - 4, 16)
  const failedRun = state.finished?.ok === false || failed > 0 || blocked > 0
  const heading = failedRun
    ? `Execution Complete: ${completed}/${state.tasks.length} succeeded, ${failed} failed${blocked > 0 ? `, ${blocked} blocked` : ""}`
    : `All Tasks Complete: ${completed}/${state.tasks.length} succeeded`

  return (
    <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingTop={1}>
      <box width={panelWidth} borderStyle="single" borderColor={failedRun ? colors.warning : colors.accent} backgroundColor={colors.panel} paddingLeft={1} paddingRight={1}>
        <text fg={colors.accentBright} wrapMode="none"><strong>RUN.STATUS</strong></text>
        <text fg={failedRun ? colors.warning : colors.accent} wrapMode="none"><strong>{fit(heading, innerWidth)}</strong></text>
        <text fg={colors.active} wrapMode="none">{progressBar(state, innerWidth)}</text>
        <text> </text>
        <SummaryStat label="SUCCEEDED" value={String(completed)} color={colors.success} />
        <SummaryStat label="FAILED" value={String(failed)} color={colors.danger} />
        <SummaryStat label="BLOCKED" value={String(blocked)} color={colors.warning} />
        <SummaryStat label="TOTAL" value={String(state.tasks.length)} color={colors.textStrong} />
      </box>

      {failures.length > 0 ? (
        <box width={panelWidth} marginTop={1} borderStyle="single" borderColor={colors.danger} backgroundColor={colors.panel} paddingLeft={1} paddingRight={1}>
          <text fg={colors.accentBright} wrapMode="none"><strong>RUN.FAILURES</strong></text>
          {failures.map((task) => (
            <box key={task.id} flexDirection="column" flexShrink={0}>
              <text fg={colors.danger} wrapMode="none"><strong>FAIL {task.id}</strong><span fg={colors.muted}>  {task.status.toUpperCase()}</span></text>
              <text fg={colors.muted} wrapMode="none">{fit(`  ${selectTaskReason(state, task.id) ?? "Task failed; inspect transcript"}`, innerWidth)}</text>
            </box>
          ))}
        </box>
      ) : null}

      <box height={1} marginTop={1} paddingLeft={1}>
        <text fg={colors.muted} wrapMode="none">[<span fg={colors.accent}>ESC</span>] BACK   [<span fg={colors.accent}>Q</span>] QUIT</text>
      </box>
      <box flexGrow={1} />
    </box>
  )
}

function SummaryStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <text fg={colors.muted} wrapMode="none">{label.padEnd(9, " ")} <span fg={color}><strong>{value}</strong></span></text>
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

type BatchDisplayOutcome = PacketOutcome | "running"

function workflowStatusText(state: CockpitState): string {
  if (state.packetSummaries.length > 0 || state.batchStatus !== null) {
    if (state.batchStatus === "cancelled") return "● batch CANCELLED"
    if (state.batchStatus === "failed" || state.batchStatus === "preflight_failed") return "● batch FAILED"
    if (state.batchStatus === "completed") return "● batch COMPLETE"
    if (state.batchStatus === "running") return "● batch RUNNING"
    return "● batch PREPARING"
  }
  return state.finished
    ? state.finished.ok ? "● workflow COMPLETE" : "● workflow FAILED"
    : state.activeTaskId ? "● workflow RUNNING" : "● workflow PREPARING"
}

function workflowStatusColor(state: CockpitState): string {
  if (state.batchStatus === "cancelled") return colors.warning
  if (state.batchStatus === "failed" || state.batchStatus === "preflight_failed" || state.finished?.ok === false) return colors.danger
  if (state.batchStatus === "completed" || state.finished) return colors.success
  return state.packetSummaries.length > 0 ? colors.active : state.activeTaskId ? colors.active : colors.muted
}

function batchHeading(state: CockpitState): string {
  const active = state.activePacket
    ? `ACTIVE PACKET: ${state.activePacket.slug}`
    : "ACTIVE PACKET: none"
  return `BATCH SEQUENCE · POSITION ${batchSequencePosition(state)} · ${batchStatusLabel(state)} · ${active}`
}

function batchSequencePosition(state: CockpitState): string {
  const total = state.activePacket?.total ?? state.packetSummaries.length
  if (total === 0) return "0/0"
  if (state.activePacket) return `${state.activePacket.index + 1}/${total}`
  if (state.batchStatus === "completed") return `${total}/${total}`
  if (state.stoppingPacket) return `${state.stoppingPacket.index + 1}/${total}`
  return `0/${total}`
}

function batchStatusLabel(state: CockpitState): string {
  switch (state.batchStatus) {
    case "running":
      return "RUNNING"
    case "completed":
      return "COMPLETE"
    case "failed":
      return "FAILED"
    case "cancelled":
      return "CANCELLED"
    case "preflight_failed":
      return "PREFLIGHT FAILED"
    default:
      return "PREPARING"
  }
}

function batchPacketDisplayOutcome(
  state: CockpitState,
  summary: PacketSummary,
  index: number,
): BatchDisplayOutcome {
  if (
    state.batchStatus === "running"
    && state.activePacket?.index === index
    && summary.outcome === "not_started"
  ) return "running"
  return summary.outcome
}

function batchPacketIcon(outcome: BatchDisplayOutcome): string {
  switch (outcome) {
    case "running":
      return "▶"
    case "succeeded":
      return "✓"
    case "failed":
      return "✗"
    case "cancelled":
      return "⊘"
    case "not_started":
      return "·"
  }
}

function batchPacketLabel(outcome: BatchDisplayOutcome): string {
  return outcome
}

function batchPacketColor(outcome: BatchDisplayOutcome): string {
  if (outcome === "succeeded") return colors.success
  if (outcome === "failed") return colors.danger
  if (outcome === "cancelled") return colors.warning
  if (outcome === "running") return colors.active
  return colors.text
}

function batchPanelColor(state: CockpitState): string {
  if (state.batchStatus === "cancelled") return colors.warning
  if (state.batchStatus === "failed" || state.batchStatus === "preflight_failed") return colors.danger
  if (state.batchStatus === "completed") return colors.success
  return colors.accent
}

function batchRecoveryGuidance(state: CockpitState): readonly string[] {
  if (state.batchStatus === "preflight_failed") {
    return [
      "STOPPING PACKET: none · preflight_failed · no packets started",
      "RECOVERY: no automatic retry; fix the packet list and rerun manually",
    ]
  }

  const stopping = state.stoppingPacket
  if (!stopping && state.batchStatus !== "failed" && state.batchStatus !== "cancelled") return []

  if (!stopping) {
    return [
      `STOPPING PACKET: unavailable · ${state.batchStatus ?? "stopped"}`,
      "RECOVERY: no automatic retry; resolve the issue and rerun manually",
    ]
  }

  const later = state.notStartedPackets
    .filter((summary) => summary.slug !== stopping.slug)
    .map((summary) => summary.slug)
  const laterText = later.length > 0 ? `${later.join(", ")} not_started` : "none"
  const action = stopping.outcome === "cancelled"
    ? "rerun manually when ready"
    : "resolve the issue and rerun manually"
  return [
    `STOPPING PACKET: ${stopping.slug} · ${stopping.outcome}`,
    `LATER PACKETS: ${laterText}`,
    `RECOVERY: no automatic retry; ${action}`,
  ]
}

function batchProgressBar(state: CockpitState, width: number): string {
  if (width <= 0) return ""
  const total = state.packetSummaries.length
  if (total === 0) return "░".repeat(width)
  const settled = state.packetSummaries.filter((summary) => summary.outcome !== "not_started").length
  const filled = Math.min(width, Math.max(0, Math.round((settled / total) * width)))
  return "█".repeat(filled) + "░".repeat(width - filled)
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

function taskProgressLabel(state: CockpitState): string {
  const settled = state.tasks.filter((task) => isCompleted(task.status) || task.status === "failed" || task.status === "blocked").length
  return `${settled}/${state.tasks.length}`
}

function progressBar(state: CockpitState, width: number): string {
  const total = state.tasks.length
  if (width <= 0) return ""
  if (total === 0) return "░".repeat(width)
  const settled = state.tasks.filter((task) => isCompleted(task.status) || task.status === "failed" || task.status === "blocked").length
  const filled = Math.min(width, Math.max(0, Math.round((settled / total) * width)))
  return "█".repeat(filled) + "░".repeat(width - filled)
}

export function taskElapsedText(task: CockpitTask, timings: Map<string, TaskTiming>, now: number): string {
  if (task.status === "pending" || task.status === "blocked") return "—"
  const timing = timings.get(task.id)
  if (!timing) return "unavailable"
  const elapsed = timing.elapsedMs ?? Math.max(0, now - timing.startedAt)
  return formatElapsed(elapsed)
}

function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

function taskStatusText(status: TaskStatus): string {
  if (isCompleted(status)) return "Task complete"
  if (status === "in_progress") return "Task running"
  if (status === "failed") return "Task failed"
  if (status === "blocked") return "Task blocked"
  return "Task pending"
}

function isTerminal(status: TaskStatus): boolean {
  return isCompleted(status) || status === "failed"
}

function footerText(state: CockpitState, compact: boolean): string {
  if (compact) return "FOCUS TASKS  [↑↓/JK] TASK  [TAB] FOCUS  [?] HELP  [Q] EXIT"
  if (state.focusedPane === "tasks") return "FOCUS TASKS  [↑↓/JK] TASK  [TAB] FOCUS  [?] HELP  [Q] EXIT"
  return "FOCUS TRANSCRIPT  [↑↓] LINE  [PG/HOME/END] SCROLL  [TAB] FOCUS  [?] HELP  [Q] EXIT"
}

function taskRowId(taskId: string): string {
  return `task-row-${taskId}`
}

function batchPacketRowId(index: number): string {
  return `batch-packet-row-${index}`
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
