import type { ScrollBoxRenderable } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react"
import type { PacketOutcome, PacketSummary } from "../batch.ts"
import type { TaskStatus } from "../tasks.ts"
import {
  selectSelectedTask,
  selectSelectedTranscript,
  selectPacketTaskView,
  selectTaskCheckpoint,
  selectTaskFailureDetail,
  selectTaskReason,
  selectVisibleTasks,
  type CockpitState,
  type CockpitStore,
  type CockpitCheckpoint,
  type CockpitTask,
  type RuntimeOptionName,
} from "./store.ts"
import { transcriptPresentation, type TranscriptEntry, type TranscriptKind } from "./transcript.ts"

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
  onDismiss: () => void
}

export function App({ store, onCancel, onDismiss }: AppProps) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const { width, height } = useTerminalDimensions()
  const taskListRef = useRef<ScrollBoxRenderable>(null)
  const transcriptRef = useRef<ScrollBoxRenderable>(null)
  const batchSummaryRef = useRef<ScrollBoxRenderable>(null)
  const taskTimings = useRef(new Map<string, TaskTiming>())
  const summaryDismissed = useRef(false)
  const [spinnerIndex, setSpinnerIndex] = useState(0)
  const [clock, setClock] = useState(() => performance.now())
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [batchCursorIndex, setBatchCursorIndex] = useState(0)
  const [batchTaskCursorIndex, setBatchTaskCursorIndex] = useState(0)
  const summaryOpenRef = useRef(false)
  summaryOpenRef.current = summaryOpen
  const compact = width < 80 || height < 24
  const batchMode = isBatchCockpit(state)
  const retainedFailureReview = isRetainedFailureReview(state)
  const taskState = selectPacketTaskView(state, batchCursorIndex, batchTaskCursorIndex)
  const selectedTask = selectSelectedTask(taskState)
  const selectedTranscript = selectSelectedTranscript(taskState)
  const hasRunningTasks = taskState.tasks.some((task) => task.status === "in_progress")
  const spinner = SPINNER_FRAMES[spinnerIndex] ?? "⠋"

  useKeyboard((key) => {
    const escape = key.name === "escape" || key.name === "esc" || key.sequence === "\u001b" || key.raw === "\u001b"
    if (escape) {
      if (summaryOpenRef.current) {
        if (retainedFailureReview) {
          onDismiss()
          return
        }
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
        if (retainedFailureReview) onDismiss()
        else onCancel()
      }
      return
    }
    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      onCancel()
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
    if (batchMode && (key.name === "left" || key.name === "h")) {
      setBatchCursorIndex((index) => Math.max(0, index - 1))
      setBatchTaskCursorIndex(0)
      return
    }
    if (batchMode && (key.name === "right" || key.name === "l")) {
      setBatchCursorIndex((index) => Math.min(Math.max(state.packetSummaries.length - 1, 0), index + 1))
      setBatchTaskCursorIndex(0)
      return
    }
    if (state.focusedPane !== "tasks") return
    const browsingInactivePacket = batchMode && batchCursorIndex !== state.activePacket?.index
    if (browsingInactivePacket && (key.name === "up" || key.name === "k")) {
      setBatchTaskCursorIndex((index) => Math.max(0, index - 1))
    } else if (browsingInactivePacket && (key.name === "down" || key.name === "j")) {
      const visibleCount = selectVisibleTasks(taskState).length
      setBatchTaskCursorIndex((index) => Math.min(Math.max(visibleCount - 1, 0), index + 1))
    } else if (key.name === "up" || key.name === "k") store.moveTask(-1)
    else if (key.name === "down" || key.name === "j") store.moveTask(1)
  })

  useEffect(() => {
    if (!taskState.selectedTaskId) return
    taskListRef.current?.scrollChildIntoView(taskRowId(taskState.selectedTaskId))
    const transcript = transcriptRef.current
    if (transcript) transcript.scrollTo(transcript.scrollHeight)
  }, [taskState.selectedTaskId, taskState.slug])

  useEffect(() => {
    if (state.packetSummaries.length === 0) return
    const index = state.stoppingPacket?.index ?? state.activePacket?.index ?? 0
    setBatchCursorIndex(index)
    setBatchTaskCursorIndex(0)
  }, [state.activePacket?.index, state.packetSummaries.length, state.stoppingPacket?.index])

  useEffect(() => {
    if (state.packetSummaries.length === 0) return
    const index = summaryOpen
      ? state.stoppingPacket?.index ?? state.activePacket?.index ?? 0
      : batchCursorIndex
    batchSummaryRef.current?.scrollChildIntoView(batchPacketRowId(index))
  }, [batchCursorIndex, state.activePacket?.index, state.packetSummaries.length, state.stoppingPacket?.index, summaryOpen])

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
    for (const task of taskState.tasks) {
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
      return
    }

    const timer = setInterval(() => {
      setSpinnerIndex((index) => (index + 1) % SPINNER_FRAMES.length)
      setClock(performance.now())
    }, SPINNER_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [hasRunningTasks, taskState.tasks])

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={colors.background}>
      {summaryOpen ? (
        retainedFailureReview
          ? <FailureReview state={state} width={width} height={height} />
          : <RunSummary state={state} width={width} height={height} batchSummaryRef={batchSummaryRef} />
      ) : (
        <LiveCockpit
          state={taskState}
          batchState={state}
          width={width}
          height={height}
          compact={compact}
          selectedTask={selectedTask}
          selectedTranscript={selectedTranscript}
          taskListRef={taskListRef}
          transcriptRef={transcriptRef}
          batchSummaryRef={batchSummaryRef}
          batchCursorIndex={batchCursorIndex}
          spinner={spinner}
          clock={clock}
          taskTimings={taskTimings.current}
        />
      )}
    </box>
  )
}

function FailureReview({ state, width, height }: { state: CockpitState; width: number; height: number }) {
  const packetIndex = state.stoppingPacket?.index ?? state.activePacket?.index ?? 0
  const taskState = state.batchStatus === null ? state : selectPacketTaskView(state, packetIndex, 0)
  const failedTask = taskState.tasks.find((task) => (
    task.status === "failed" || task.status === "blocked" || task.checkpoint?.state === "blocked"
  ))
  const detail = failedTask ? selectTaskFailureDetail(taskState, failedTask.id) : undefined
  const surfacedError = detail ?? "No surfaced task error was provided."
  const completed = taskState.tasks.filter((task) => isCompleted(task.status)).length
  const failed = taskState.tasks.filter((task) => task.status === "failed").length
  const blocked = taskState.tasks.filter((task) => task.status === "blocked").length
  const checkpointBlocked = taskState.tasks.filter((task) => task.checkpoint?.state === "blocked").length
  const delivered = Math.max(0, completed - checkpointBlocked)
  const panelWidth = Math.max(24, Math.min(width - 2, 100))
  const innerWidth = Math.max(panelWidth - 4, 18)
  const taskIdentity = failedTask
    ? `${taskState.slug}/${failedTask.id}`
    : (state.stoppingPacket?.slug ?? taskState.slug) || "unavailable"
  const heading = checkpointBlocked > 0
    ? `Execution Complete: ${delivered}/${taskState.tasks.length} delivered, ${checkpointBlocked} checkpoint blocked`
    : `Execution Complete: ${completed}/${taskState.tasks.length} succeeded, ${failed} failed${blocked > 0 ? `, ${blocked} blocked` : ""}`
  const packetOutcomes = state.packetSummaries.length > 0
    ? state.packetSummaries.map((summary) => `${summary.slug} ${summary.outcome}`).join(" · ")
    : null
  const panelHeight = Math.max(10, height - 3)
  const fixedRows = 10
    + (packetOutcomes ? 1 : 0)
    + (state.stoppingPacket ? 1 : 0)
    + (checkpointBlocked > 0 ? 1 : 0)
  const detailHeight = Math.max(2, panelHeight - fixedRows)
  return (
    <box width="100%" height="100%" flexDirection="column" paddingLeft={1} paddingTop={1}>
      <box
        width={panelWidth}
        height={panelHeight}
        flexShrink={0}
        flexDirection="column"
        borderStyle="single"
        borderColor={colors.danger}
        backgroundColor={colors.panel}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={colors.accentBright} wrapMode="none"><strong>{state.batchStatus === null ? "RUN.STATUS" : "RUN.STATUS · BATCH SEQUENCE"}</strong></text>
        <text fg={colors.danger} wrapMode="none"><strong>{fit(state.batchStatus === null ? heading : batchHeading(state), innerWidth)}</strong></text>
        {packetOutcomes ? <text fg={colors.muted} wrapMode="none">{fit(`PACKETS: ${packetOutcomes}`, innerWidth)}</text> : null}
        {state.stoppingPacket ? <text fg={colors.warning} wrapMode="none">{fit(`STOPPING PACKET: ${state.stoppingPacket.slug} (${state.stoppingPacket.outcome})`, innerWidth)}</text> : null}
        <text fg={colors.accentBright} wrapMode="none"><strong>RUN.FAILURES</strong></text>
        <text fg={colors.danger} wrapMode="none"><strong>{fit(`${failedTask ? failureLabel(failedTask) : "FAIL"} ${failedTask?.id ?? "unavailable"} · TASK: ${taskIdentity}`, innerWidth)}</strong></text>
        <text fg={colors.textStrong} wrapMode="none">{fit(`OUTCOME: FAILED · SUCCEEDED ${delivered} · FAILED ${failed} · BLOCKED ${blocked} · TOTAL ${taskState.tasks.length}`, innerWidth)}</text>
        {checkpointBlocked > 0 ? <text fg={colors.warning} wrapMode="none">CHECKPOINT DELIVERY: 0 created · {checkpointBlocked} blocked</text> : null}
        <text fg={colors.muted} wrapMode="none">{fit(state.batchStatus === null ? heading : state.finished?.message ?? "Batch failed", innerWidth)}</text>
        <text fg={colors.accentBright}><strong>ERROR</strong></text>
        <scrollbox
          id="failure-detail-scroll"
          height={detailHeight}
          scrollY
          focused
          viewportCulling
          contentOptions={{ flexDirection: "column" }}
        >
          <text fg={detail ? colors.danger : colors.warning} wrapMode="word" flexShrink={0}>{surfacedError}</text>
        </scrollbox>
        <text fg={colors.warning} wrapMode="word">Resolve the listed error, then rerun the task packet.</text>
      </box>
      <box height={1} marginTop={1} paddingLeft={1}>
        <text fg={colors.muted} wrapMode="none">[<span fg={colors.accent}>ESC</span>/<span fg={colors.accent}>Q</span>/<span fg={colors.accent}>CTRL+C</span>] DISMISS</text>
      </box>
    </box>
  )
}

function LiveCockpit({
  state,
  batchState,
  width,
  height,
  compact,
  selectedTask,
  selectedTranscript,
  taskListRef,
  transcriptRef,
  batchSummaryRef,
  batchCursorIndex,
  spinner,
  clock,
  taskTimings,
}: {
  state: CockpitState
  batchState: CockpitState
  width: number
  height: number
  compact: boolean
  selectedTask: CockpitTask | undefined
  selectedTranscript: readonly TranscriptEntry[]
  taskListRef: RefObject<ScrollBoxRenderable | null>
  transcriptRef: RefObject<ScrollBoxRenderable | null>
  batchSummaryRef: RefObject<ScrollBoxRenderable | null>
  batchCursorIndex: number
  spinner: string
  clock: number
  taskTimings: Map<string, TaskTiming>
}) {
  const batchMode = isBatchCockpit(state)
  const taskPanelWidth = compact ? "100%" : Math.max(30, Math.min(50, Math.floor(width * 0.28)))
  const taskPanelHeight = compact ? Math.max(8, Math.floor(height * 0.35)) : "100%"
  const taskWidth = typeof taskPanelWidth === "number" ? taskPanelWidth : Math.max(width - 2, 12)
  const mainDirection = compact ? "column" : "row"
  const taskProgress = taskProgressLabel(state)
  const progressWidth = Math.max(6, taskWidth - 4)
  const visibleTasks = selectVisibleTasks(state)
  const titleLimit = Math.max(10, taskWidth - 12)

  return (
    <>
      <TitleBar state={state} width={width} />
      {batchState.packetSummaries.length > 0 || batchState.batchStatus !== null
        ? <BatchSequenceSummary state={batchState} width={width} height={height} compact={compact} selectedIndex={batchCursorIndex} scrollRef={batchSummaryRef} />
        : null}
      <box height={1} backgroundColor={colors.background}>
        <text fg={colors.border} wrapMode="none">{clip("─".repeat(Math.max(width, 1)), width)}</text>
      </box>

      <box
        flexGrow={1}
        flexDirection={mainDirection}
        gap={1}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={batchMode ? 0 : 1}
        backgroundColor={colors.background}
      >
        <box
          width={taskPanelWidth}
          height={taskPanelHeight}
          flexDirection="column"
          borderStyle="single"
          borderColor={state.focusedPane === "tasks" ? colors.accent : colors.border}
          backgroundColor={colors.panel}
          paddingLeft={1}
          paddingRight={1}
        >
          <text fg={state.focusedPane === "tasks" ? colors.accent : colors.textStrong} wrapMode="none" flexShrink={0}>
            <strong>TASKS {taskProgress}</strong>
          </text>
          <text fg={colors.active} wrapMode="none" flexShrink={0}>{progressBar(state, progressWidth)}</text>
          <scrollbox
            id="task-scroll"
            ref={taskListRef}
            flexGrow={1}
            scrollY
            contentOptions={{ flexDirection: "column" }}
            viewportCulling
          >
            {state.tasks.length === 0 ? <text fg={colors.muted}>Waiting for task packet…</text> : null}
            {state.tasks.length > 0 && visibleTasks.length === 0 ? <text fg={colors.muted}>No unfinished tasks</text> : null}
            {visibleTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                selected={task.id === state.selectedTaskId}
                spinner={spinner}
                titleLimit={titleLimit}
                elapsed={taskElapsedText(task, taskTimings, clock)}
                width="100%"
              />
            ))}
          </scrollbox>
        </box>

        <box flexGrow={1} flexDirection="column" gap={1}>
          <TaskHeader state={state} task={selectedTask} transcript={selectedTranscript} width={width} dense={batchMode} />
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
          {!batchMode ? <TaskStatusStrip state={state} task={selectedTask} /> : null}
        </box>
      </box>

      {state.helpOpen ? <HelpOverlay width={width} height={height} batchMode={batchMode} /> : null}

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
  width,
}: {
  task: CockpitTask
  selected: boolean
  spinner: string
  titleLimit: number
  elapsed: string
  width: number | "100%"
}) {
  const running = task.status === "in_progress"
  const marker = running ? spinner : statusIcon(task.status)
  const checkpointText = checkpointDisplayText(task.checkpoint)
  return (
    <box
      id={taskRowId(task.id)}
      width={width}
      height={checkpointText ? 5 : 4}
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
      {checkpointText ? (
        <text fg={checkpointColor(task.checkpoint)} wrapMode="none">
          {fit(checkpointText, titleLimit + 8)}
        </text>
      ) : null}
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
  selectedIndex,
  scrollRef,
}: {
  state: CockpitState
  width: number
  height: number
  compact: boolean
  selectedIndex: number
  scrollRef: RefObject<ScrollBoxRenderable | null>
}) {
  const panelWidth = Math.max(24, width - 2)
  const guidance = batchRecoveryGuidance(state)
  const maxTabWidth = compact || height <= 24 ? 30 : 48

  return (
    <box
      height={1 + guidance.length}
      width={panelWidth}
      marginLeft={1}
      backgroundColor={colors.panel}
      flexDirection="column"
      flexShrink={0}
    >
      <scrollbox
        id="batch-sequence-scroll"
        ref={scrollRef}
        height={1}
        scrollX
        horizontalScrollbarOptions={{ visible: false }}
        contentOptions={{ flexDirection: "row" }}
        viewportCulling
      >
        {state.packetSummaries.map((summary, index) => (
          <BatchPacketTab
            key={`${summary.slug}-${index}`}
            state={state}
            summary={summary}
            index={index}
            maxWidth={maxTabWidth}
            selected={index === selectedIndex}
          />
        ))}
      </scrollbox>
      {guidance.map((line, index) => (
        <text key={`${line}-${index}`} fg={index === guidance.length - 1 ? colors.muted : state.stoppingPacket ? colors.warning : colors.muted} wrapMode="none" flexShrink={0}>
          {fit(line, panelWidth)}
        </text>
      ))}
    </box>
  )
}

function BatchPacketTab({
  state,
  summary,
  index,
  maxWidth,
  selected,
}: {
  state: CockpitState
  summary: PacketSummary
  index: number
  maxWidth: number
  selected: boolean
}) {
  const displayOutcome = batchPacketDisplayOutcome(state, summary, index)
  const status = batchPacketTabStatus(displayOutcome)
  const icon = batchPacketTabIcon(displayOutcome)
  const label = `${selected ? "> " : "  "}${icon} ${index + 1} ${summary.slug} ${status}`
  const width = Math.max(16, Math.min(maxWidth, label.length + 2))
  const running = displayOutcome === "running"
  return (
    <box
      id={batchPacketRowId(index)}
      width={width}
      height={1}
      flexShrink={0}
      backgroundColor={running ? colors.active : selected ? colors.surfaceElevated : colors.panel}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={running ? colors.background : selected ? colors.textStrong : batchPacketColor(displayOutcome)} wrapMode="none">
        <strong>{fit(label, Math.max(width - 2, 8))}</strong>
      </text>
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
  const checkpointEntries = Object.entries(state.checkpointOutcomes)
  const deliveryHeight = checkpointEntries.length > 0 ? checkpointEntries.length + 1 : 0
  const rowHeight = Math.max(1, Math.min(
    state.packetSummaries.length,
    height - guidance.length - messageHeight - deliveryHeight - 8,
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
        {checkpointEntries.length > 0 ? (
          <>
            <text fg={colors.accentBright} wrapMode="none"><strong>CHECKPOINT DELIVERY</strong></text>
            {checkpointEntries.map(([taskId, checkpoint]) => (
              <text key={`batch-delivery-${taskId}`} fg={checkpointColor(checkpoint)} wrapMode="none">
                {fit(`${taskId} · ${checkpointDisplayText(checkpoint) ?? "checkpoint state unavailable"}`, innerWidth)}
              </text>
            ))}
          </>
        ) : null}
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
  dense,
}: {
  state: CockpitState
  task: CockpitTask | undefined
  transcript: readonly TranscriptEntry[]
  width: number
  dense: boolean
}) {
  const innerWidth = Math.max(width - 12, 24)
  const title = task ? `${task.title.toUpperCase()}  [${task.type}]` : "TASK TRANSCRIPT"
  const mode = task && task.id === state.activeTaskId && state.followingActiveTask ? "FOLLOWING ACTIVE" : "INSPECTING HISTORY"
  const meta = transcript.length === 0 ? "No ACP transcript yet" : `${transcript.length} entries`
  const checkpoint = task ? selectTaskCheckpoint(state, task.id) : undefined
  const checkpointText = checkpointDisplayText(checkpoint)
  return (
    <box
      height={dense ? (checkpointText ? 5 : 4) : (checkpointText ? 6 : 5)}
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
      {!dense ? <text fg={colors.dim} wrapMode="none">{fit(meta, innerWidth)}</text> : null}
      {checkpointText ? <text fg={checkpointColor(checkpoint)} wrapMode="none">{fit(checkpointText, innerWidth)}</text> : null}
    </box>
  )
}

function TaskStatusStrip({ state, task }: { state: CockpitState; task: CockpitTask | undefined }) {
  const reason = task ? selectTaskReason(state, task.id) : undefined
  const label = task ? taskStatusText(task.status) : "Waiting for task"
  const color = task ? statusColor(task.status) : colors.muted
  const checkpoint = task ? selectTaskCheckpoint(state, task.id) : undefined
  const detail = checkpoint?.state === "blocked" ? checkpointDisplayText(checkpoint) : reason ?? checkpointDisplayText(checkpoint)
  const detailColor = checkpoint ? checkpointColor(checkpoint) : reason ? colors.danger : colors.dim
  return (
    <box height={detail ? 5 : 4} borderStyle="single" borderColor={color} backgroundColor={colors.panel} paddingLeft={1} paddingRight={1}>
      <text fg={color} wrapMode="none"><strong>{task ? `${statusIcon(task.status)} ${label}` : "› Waiting for task"}</strong></text>
      <text fg={detailColor} wrapMode="none">{fit(detail ?? "Read-only progress; no workflow controls", 120)}</text>
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
  const checkpointTasks = state.tasks.filter((task) => task.checkpoint !== null)
  const checkpointBlocked = checkpointTasks.filter((task) => task.checkpoint?.state === "blocked").length
  const checkpointCreated = checkpointTasks.filter((task) => task.checkpoint?.state === "created").length
  const delivered = completed - checkpointBlocked
  const failures = state.tasks.filter((task) => task.status === "failed" || task.status === "blocked" || task.checkpoint?.state === "blocked")
  const panelWidth = Math.max(24, Math.min(width - 4, 86))
  const innerWidth = Math.max(panelWidth - 4, 16)
  const failedRun = state.finished?.ok === false || failed > 0 || blocked > 0 || checkpointBlocked > 0
  const heading = checkpointBlocked > 0
    ? `Execution Complete: ${delivered}/${state.tasks.length} delivered, ${failed} failed${blocked > 0 ? `, ${blocked} blocked` : ""}, ${checkpointBlocked} checkpoint blocked`
    : failedRun
      ? `Execution Complete: ${completed}/${state.tasks.length} succeeded, ${failed} failed${blocked > 0 ? `, ${blocked} blocked` : ""}`
    : `All Tasks Complete: ${completed}/${state.tasks.length} succeeded`

  return (
    <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingTop={1}>
      <box width={panelWidth} borderStyle="single" borderColor={failedRun ? colors.warning : colors.accent} backgroundColor={colors.panel} paddingLeft={1} paddingRight={1}>
        <text fg={colors.accentBright} wrapMode="none"><strong>RUN.STATUS</strong></text>
        <text fg={failedRun ? colors.warning : colors.accent} wrapMode="none"><strong>{fit(heading, innerWidth)}</strong></text>
        <text fg={colors.active} wrapMode="none">{progressBar(state, innerWidth)}</text>
        <text> </text>
        <SummaryStat label="SUCCEEDED" value={String(delivered)} color={colors.success} />
        <SummaryStat label="FAILED" value={String(failed)} color={colors.danger} />
        <SummaryStat label="BLOCKED" value={String(blocked)} color={colors.warning} />
        <SummaryStat label="TOTAL" value={String(state.tasks.length)} color={colors.textStrong} />
        {checkpointTasks.length > 0 ? (
          <text fg={checkpointBlocked > 0 ? colors.warning : colors.muted} wrapMode="none">
            CHECKPOINT DELIVERY: {checkpointCreated} created · {checkpointBlocked} blocked
          </text>
        ) : null}
      </box>

      {failures.length > 0 ? (
        <box width={panelWidth} marginTop={1} borderStyle="single" borderColor={colors.danger} backgroundColor={colors.panel} paddingLeft={1} paddingRight={1}>
          <text fg={colors.accentBright} wrapMode="none"><strong>RUN.FAILURES</strong></text>
          {failures.map((task) => (
            <box key={task.id} flexDirection="column" flexShrink={0}>
              <text fg={colors.danger} wrapMode="none"><strong>{failureLabel(task)} {task.id}</strong><span fg={colors.muted}>  {failureStatusLabel(task)}</span></text>
              <text fg={colors.muted} wrapMode="none">{fit(`  ${selectTaskReason(state, task.id) ?? checkpointDisplayText(task.checkpoint) ?? "Task failed; inspect transcript"}`, innerWidth)}</text>
            </box>
          ))}
        </box>
      ) : null}

      {checkpointTasks.length > 0 ? (
        <box width={panelWidth} marginTop={1} borderStyle="single" borderColor={checkpointBlocked > 0 ? colors.warning : colors.accent} backgroundColor={colors.panel} paddingLeft={1} paddingRight={1}>
          <text fg={colors.accentBright} wrapMode="none"><strong>RUN.DELIVERY</strong></text>
          {checkpointTasks.map((task) => (
            <text key={`delivery-${task.id}`} fg={checkpointColor(task.checkpoint)} wrapMode="none">
              {fit(`${task.id} · ${checkpointDisplayText(task.checkpoint) ?? "checkpoint state unavailable"}`, innerWidth)}
            </text>
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
  const presentation = transcriptPresentation(entry)
  const subtitleColor = entry.kind === "error"
    ? colors.danger
    : entry.kind === "tool" || entry.kind === "tool_update"
      ? colors.muted
      : colors.text
  return (
    <text id={`transcript-entry-${entry.id}`} fg={transcriptColor(entry.kind)} wrapMode="word" flexShrink={0} marginBottom={1}>
      <strong>{transcriptIcon(entry.kind)} {presentation.label}{status}</strong>
      {presentation.subtitle ? <><br /><span fg={subtitleColor}>{presentation.subtitle}</span></> : null}
    </text>
  )
}

function HelpOverlay({ width, height, batchMode }: { width: number; height: number; batchMode: boolean }) {
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
      <text fg={colors.text}>
        {batchMode ? "← / → or h / l    Browse the parent packet strip" : "↑ / ↓ or j / k    Select a task while Tasks has focus"}
      </text>
      {batchMode ? <text fg={colors.text}>↑ / ↓ or j / k    Select a child task while Tasks has focus</text> : null}
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
    if (state.batchStatus === "failed" || state.batchStatus === "preflight_failed") {
      return hasCheckpointBlocked(state) ? "● batch FAILED · CHECKPOINT BLOCKED" : "● batch FAILED"
    }
    if (state.batchStatus === "completed") {
      return hasCheckpointBlocked(state) ? "● batch FAILED · CHECKPOINT BLOCKED" : "● batch COMPLETE"
    }
    if (state.batchStatus === "running") return "● batch RUNNING"
    return "● batch PREPARING"
  }
  if (state.finished) {
    if (state.finished.ok) return "● workflow COMPLETE"
    return hasCheckpointBlocked(state) ? "● workflow FAILED · CHECKPOINT BLOCKED" : "● workflow FAILED"
  }
  if (hasCheckpointBlocked(state)) return "● workflow CHECKPOINT BLOCKED"
  return state.activeTaskId ? "● workflow RUNNING" : "● workflow PREPARING"
}

function workflowStatusColor(state: CockpitState): string {
  if (state.batchStatus === "cancelled") return colors.warning
  if (state.batchStatus === "failed" || state.batchStatus === "preflight_failed" || state.finished?.ok === false || hasCheckpointBlocked(state)) return colors.danger
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
  if (hasCheckpointBlocked(state)) return "CHECKPOINT BLOCKED"
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

function batchPacketTabIcon(outcome: BatchDisplayOutcome): string {
  if (outcome === "running") return "●"
  if (outcome === "not_started") return "○"
  return batchPacketIcon(outcome)
}

function batchPacketTabStatus(outcome: BatchDisplayOutcome): string {
  switch (outcome) {
    case "running":
      return "RUNNING"
    case "succeeded":
      return "COMPLETED"
    case "failed":
      return "FAILED"
    case "cancelled":
      return "CANCELLED"
    case "not_started":
      return "PENDING"
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
  if (hasCheckpointBlocked(state)) return colors.danger
  if (state.batchStatus === "failed" || state.batchStatus === "preflight_failed") return colors.danger
  if (state.batchStatus === "completed") return colors.success
  return colors.accent
}

function batchRecoveryGuidance(state: CockpitState): readonly string[] {
  if (state.batchStatus === "preflight_failed") {
    return [
      "STOPPING PACKET: none · preflight_failed · no packets started",
      "RECOVERY: no automatic packet retry; fix the packet list and rerun manually",
    ]
  }

  const stopping = state.stoppingPacket
  if (!stopping && state.batchStatus !== "failed" && state.batchStatus !== "cancelled") return []

  if (!stopping) {
    return [
      `STOPPING PACKET: unavailable · ${state.batchStatus ?? "stopped"}`,
      `RECOVERY: ${state.batchStatus === "failed" ? "task retry exhausted; " : ""}no automatic packet retry; resolve the issue and rerun manually`,
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
    `RECOVERY: ${stopping.outcome === "failed" ? "task retry exhausted; " : ""}no automatic packet retry; ${action}`,
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
  const checkpointBlocked = state.tasks.filter((task) => task.checkpoint?.state === "blocked").length
  return `Tasks: ${completed}/${state.tasks.length} completed · ${running} running · ${failed} failed · ${blocked} blocked${checkpointBlocked > 0 ? ` · ${checkpointBlocked} checkpoint blocked` : ""}`
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
  if (isBatchCockpit(state) && state.focusedPane === "tasks") {
    return "FOCUS TASKS  [←→/HL] PACKET  [↑↓/JK] TASK  [TAB] FOCUS  [?] HELP  [Q] EXIT"
  }
  if (compact) return "FOCUS TASKS  [↑↓/JK] TASK  [TAB] FOCUS  [?] HELP  [Q] EXIT"
  if (state.focusedPane === "tasks") return "FOCUS TASKS  [↑↓/JK] TASK  [TAB] FOCUS  [?] HELP  [Q] EXIT"
  return "FOCUS TRANSCRIPT  [↑↓] LINE  [PG/HOME/END] SCROLL  [TAB] FOCUS  [?] HELP  [Q] EXIT"
}

function isBatchCockpit(state: CockpitState): boolean {
  return state.packetSummaries.length > 0 || state.batchStatus !== null
}

function isRetainedFailureReview(state: CockpitState): boolean {
  if (state.finished?.ok !== false) return false
  return state.batchStatus !== "cancelled" && state.batchStatus !== "preflight_failed"
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

function checkpointDisplayText(checkpoint: CockpitCheckpoint | undefined | null): string | undefined {
  if (!checkpoint) return undefined
  if (checkpoint.state === "active") return "Checkpoint delivery in progress"
  if (checkpoint.state === "created") {
    return checkpoint.commit === undefined
      ? "Local checkpoint created"
      : `Local checkpoint created: ${checkpoint.commit}`
  }
  return `Checkpoint blocked: ${checkpoint.reason}`
}

function checkpointColor(checkpoint: CockpitCheckpoint | undefined | null): string {
  if (checkpoint?.state === "created") return colors.success
  if (checkpoint?.state === "blocked") return colors.warning
  if (checkpoint?.state === "active") return colors.active
  return colors.dim
}

function failureLabel(task: CockpitTask): string {
  if (task.checkpoint?.state === "blocked") return "DELIVERY BLOCKED"
  if (task.status === "blocked") return "BLOCKED"
  return "FAIL"
}

function failureStatusLabel(task: CockpitTask): string {
  return task.checkpoint?.state === "blocked" ? "CHECKPOINT" : task.status.toUpperCase()
}

function hasCheckpointBlocked(state: CockpitState): boolean {
  return state.tasks.some((task) => task.checkpoint?.state === "blocked")
    || Object.values(state.checkpointOutcomes).some((checkpoint) => checkpoint.state === "blocked")
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

function isCompleted(status: TaskStatus): boolean {
  return status === "completed" || status === "done" || status === "finished"
}
