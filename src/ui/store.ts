import type { SpecFinderConfig } from "../config.ts"
import type {
  BatchEventStatus,
  BatchFinishedEvent,
  BatchPacketFinishedEvent,
  BatchPacketStartedEvent,
  BatchStartedEvent,
  RunEvent,
  RunEventListener,
} from "../events.ts"
import type { PacketOutcome, PacketSummary } from "../batch.ts"
import type { CheckpointRecord, TaskFile, TaskStatus } from "../tasks.ts"
import {
  appendTranscriptLines,
  applySessionUpdate,
  type TranscriptEntry,
} from "./transcript.ts"

export type CockpitPane = "tasks" | "transcript"
export type RuntimeOptionName = Extract<RunEvent, { type: "runtime_option" }>["name"]

export type CockpitCheckpoint =
  | { readonly state: "active" }
  | { readonly state: "created"; readonly commit?: string }
  | { readonly state: "blocked"; readonly reason: string }

export interface CockpitTask {
  readonly id: string
  readonly title: string
  readonly type: string
  readonly complexity: string
  readonly status: TaskStatus
  readonly dependencies: readonly string[]
  /** Checkpoint delivery is independent from the task lifecycle status. */
  readonly checkpoint: CockpitCheckpoint | null
}

export interface RuntimeOptionOutcome {
  readonly requested: string
  readonly outcome: "applied" | "default" | "unsupported"
  readonly detail?: string
}

export interface ActivePacketContext {
  readonly slug: string
  readonly index: number
  readonly total: number
}

export interface StoppingPacketContext {
  readonly slug: string
  readonly index: number
  readonly outcome: "failed" | "cancelled"
}

export type CockpitBatchStatus = BatchEventStatus | null

export interface CockpitState {
  readonly slug: string
  readonly config: Readonly<SpecFinderConfig> | null
  readonly tasks: readonly CockpitTask[]
  readonly visibleTaskIds: readonly string[]
  /** Preserves delivery outcomes after a batch advances to another packet. */
  readonly checkpointOutcomes: Readonly<Record<string, CockpitCheckpoint>>
  readonly activeTaskId: string | null
  readonly selectedTaskId: string | null
  readonly focusedPane: CockpitPane
  readonly followingActiveTask: boolean
  readonly helpOpen: boolean
  readonly transcripts: Readonly<Record<string, readonly TranscriptEntry[]>>
  readonly taskReasons: Readonly<Record<string, string>>
  readonly runActivity: readonly TranscriptEntry[]
  readonly runtimeOptions: Readonly<Partial<Record<RuntimeOptionName, RuntimeOptionOutcome>>>
  readonly finished: Readonly<{ ok: boolean; message: string }> | null
  readonly batchStatus: CockpitBatchStatus
  readonly packetSummaries: readonly PacketSummary[]
  /** Read-only task snapshots retained for every packet tab. */
  readonly packetTasks: Readonly<Record<string, readonly CockpitTask[]>>
  /** Session-stable visibility keeps completed tasks until the cockpit reopens. */
  readonly packetVisibleTaskIds: Readonly<Record<string, readonly string[]>>
  readonly activePacket: ActivePacketContext | null
  readonly stoppingPacket: StoppingPacketContext | null
  readonly notStartedPackets: readonly PacketSummary[]
}

function createInitialState(): CockpitState {
  return {
    slug: "",
    config: null,
    tasks: [],
    visibleTaskIds: [],
    checkpointOutcomes: {},
    activeTaskId: null,
    selectedTaskId: null,
    focusedPane: "tasks",
    followingActiveTask: true,
    helpOpen: false,
    transcripts: {},
    taskReasons: {},
    runActivity: [],
    runtimeOptions: {},
    finished: null,
    batchStatus: null,
    packetSummaries: [],
    packetTasks: {},
    packetVisibleTaskIds: {},
    activePacket: null,
    stoppingPacket: null,
    notStartedPackets: [],
  }
}

export class CockpitStore {
  private state: CockpitState = createInitialState()
  private listeners = new Set<() => void>()
  private sequence = 0

  getSnapshot = (): CockpitState => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private set(next: CockpitState): void {
    if (next === this.state) return
    this.state = next
    for (const listener of this.listeners) listener()
  }

  listener: RunEventListener = (event) => this.consume(event)

  consume(event: RunEvent): void {
    switch (event.type) {
      case "run_started": {
        // A packet engine nested inside a batch still emits its legacy
        // lifecycle events. They must not reset the batch projection.
        if (this.state.batchStatus !== null) break
        this.sequence = 0
        const tasks = event.tasks.map(toCockpitTask)
        const visibleTaskIds = unfinishedTasks(tasks).map((task) => task.id)
        const transcripts = Object.fromEntries(tasks.map((task) => [task.id, [] as readonly TranscriptEntry[]]))
        const checkpointOutcomes = checkpointOutcomeRecord(tasks)
        const runActivity = appendTranscriptLines([], "activity", `Starting ${event.slug}`, this.nextSequence())
        this.set({
          ...createInitialState(),
          slug: event.slug,
          config: event.config,
          tasks,
          visibleTaskIds,
          selectedTaskId: visibleTaskIds[0] ?? null,
          transcripts,
          checkpointOutcomes,
          taskReasons: checkpointReasons(tasks),
          runActivity,
        })
        break
      }
      case "batch_started":
        this.consumeBatchStarted(event)
        break
      case "batch_packet_started":
        this.consumeBatchPacketStarted(event)
        break
      case "batch_packet_finished":
        this.consumeBatchPacketFinished(event)
        break
      case "batch_finished":
        this.consumeBatchFinished(event)
        break
      case "task_status":
        this.consumeTaskStatus(event.taskId, event.status)
        break
      case "checkpoint":
        this.consumeCheckpoint(event.taskId, event)
        break
      case "activity":
        if (event.taskId) this.consumeTaskActivity(event.taskId, event.message)
        else this.consumeRunActivity(event.message)
        break
      case "session_update":
        this.consumeSessionUpdate(event.taskId, event.sessionId, event.update)
        break
      case "runtime_option": {
        const detail = event.detail === undefined ? {} : { detail: event.detail }
        this.set({
          ...this.state,
          runtimeOptions: {
            ...this.state.runtimeOptions,
            [event.name]: { requested: event.requested, outcome: event.outcome, ...detail },
          },
        })
        break
      }
      case "permission_requested":
        // TUI permission prompts are cancelled before reaching the read-only store.
        // Preserve the raw event contract for non-TUI consumers without creating
        // a second permission-control path in the cockpit.
        break
      case "run_finished": {
        if (this.state.batchStatus !== null) break
        const blockedDelivery = hasCheckpointBlocked(this.state)
        const message = blockedDelivery && event.ok
          ? `${event.message}; checkpoint delivery blocked`
          : event.message
        this.set({
          ...this.state,
          finished: { ok: event.ok && !blockedDelivery, message },
          activeTaskId: null,
        })
        break
      }
    }
  }

  private consumeBatchStarted(event: BatchStartedEvent): void {
    this.sequence = 0
    const slugs = event.slugs
      ?? event.packetSlugs
      ?? event.packets?.map((packet) => packet.slug)
      ?? event.summaries?.map((summary) => summary.slug)
      ?? []
    const packetSummaries = slugs.map((slug): PacketSummary => ({ slug, outcome: "not_started" }))
    const packetTasks = Object.fromEntries(slugs.map((slug, index) => {
      const descriptor = event.packets?.find((packet) => packet.slug === slug || packet.index === index)
      return [slug, (descriptor?.tasks ?? []).map(toCockpitTask)]
    }))
    const packetVisibleTaskIds = Object.fromEntries(Object.entries(packetTasks).map(([slug, tasks]) => (
      [slug, unfinishedTasks(tasks).map((task) => task.id)]
    )))
    const firstSlug = slugs[0]
    const tasks = firstSlug ? packetTasks[firstSlug] ?? [] : []
    const visibleTaskIds = firstSlug ? packetVisibleTaskIds[firstSlug] ?? [] : []
    const transcripts = Object.fromEntries(Object.entries(packetTasks).flatMap(([slug, tasks]) => (
      tasks.map((task) => [qualifiedTaskKey(slug, task.id), [] as readonly TranscriptEntry[]])
    )))
    const taskReasons = Object.fromEntries(Object.entries(packetTasks).flatMap(([slug, tasks]) => (
      Object.entries(checkpointReasons(tasks, (task) => qualifiedTaskKey(slug, task.id)))
    )))
    const checkpointOutcomes = Object.fromEntries(Object.entries(packetTasks).flatMap(([slug, tasks]) => (
      Object.entries(checkpointOutcomeRecord(tasks, (task) => qualifiedTaskKey(slug, task.id)))
    )))
    const detail = event.config === undefined ? this.state.config : event.config
    const runActivity = appendTranscriptLines(
      [],
      "activity",
      slugs.length === 0 ? "Starting batch" : `Starting batch (${slugs.length} packets)`,
      this.nextSequence(),
    )

    this.set({
      ...this.state,
      slug: firstSlug ?? "",
      config: detail,
      tasks,
      visibleTaskIds,
      checkpointOutcomes,
      activeTaskId: null,
      selectedTaskId: visibleTaskIds[0] ?? null,
      transcripts,
      taskReasons,
      runActivity,
      runtimeOptions: {},
      finished: null,
      batchStatus: "running",
      packetSummaries,
      packetTasks,
      packetVisibleTaskIds,
      activePacket: null,
      stoppingPacket: null,
      notStartedPackets: packetSummaries,
    })
  }

  private consumeBatchPacketStarted(event: BatchPacketStartedEvent): void {
    const packet = event.packet
    const slug = packet?.slug ?? event.slug
    const index = packet?.index ?? event.index
    const tasks = (event.tasks ?? event.taskFiles ?? []).map(toCockpitTask)
    const visibleTaskIds = unfinishedTasks(tasks).map((task) => task.id)
    const activePacket: ActivePacketContext = {
      slug,
      index,
      total: packet?.total ?? event.total ?? this.state.packetSummaries.length,
    }
    const transcripts = {
      ...this.state.transcripts,
      ...Object.fromEntries(tasks.map((task) => [
        qualifiedTaskKey(slug, task.id),
        this.state.transcripts[qualifiedTaskKey(slug, task.id)] ?? [] as readonly TranscriptEntry[],
      ])),
    }
    const packetCheckpointOutcomes = checkpointOutcomeRecord(tasks, (task) => qualifiedTaskKey(slug, task.id))
    const packetTasks = { ...this.state.packetTasks, [slug]: tasks }
    const packetVisibleTaskIds = { ...this.state.packetVisibleTaskIds, [slug]: visibleTaskIds }
    const packetSummaries = this.state.packetSummaries.map((summary, index) => (
      summary.slug === slug || index === activePacket.index
        ? { ...summary, slug, outcome: "not_started" as const }
        : summary
    ))

    this.set({
      ...this.state,
      slug,
      config: event.config ?? this.state.config,
      tasks,
      visibleTaskIds,
      checkpointOutcomes: { ...this.state.checkpointOutcomes, ...packetCheckpointOutcomes },
      activeTaskId: null,
      selectedTaskId: visibleTaskIds[0] ?? null,
      transcripts,
      taskReasons: {
        ...this.state.taskReasons,
        ...checkpointReasons(tasks, (task) => qualifiedTaskKey(slug, task.id)),
      },
      runtimeOptions: {},
      finished: null,
      batchStatus: "running",
      packetSummaries,
      packetTasks,
      packetVisibleTaskIds,
      activePacket,
      stoppingPacket: null,
      notStartedPackets: packetSummaries.filter((summary) => summary.outcome === "not_started"),
    })
  }

  private consumeBatchPacketFinished(event: BatchPacketFinishedEvent): void {
    const summary = event.summary ?? event.result
    const outcome = event.outcome ?? summary?.outcome ?? "not_started"
    const packetSummaries = updatePacketSummary(
      this.state.packetSummaries,
      event.index,
      event.slug,
      summary ?? { slug: event.slug, outcome, ...(event.detail ? { detail: event.detail } : {}) },
    )
    const stoppingPacket = outcome === "failed" || outcome === "cancelled"
      ? {
          slug: event.slug,
          index: event.index,
          outcome,
        }
      : this.state.stoppingPacket
    this.set({
      ...this.state,
      activeTaskId: null,
      packetSummaries,
      stoppingPacket,
      notStartedPackets: packetSummaries.filter((summary) => summary.outcome === "not_started"),
    })
  }

  private consumeBatchFinished(event: BatchFinishedEvent): void {
    const packetSummaries = event.packets
      ? clonePacketSummaries(event.packets)
      : event.summaries
        ? clonePacketSummaries(event.summaries)
        : event.result
          ? clonePacketSummaries(event.result.packets)
          : this.state.packetSummaries
    const blockedDelivery = hasCheckpointBlocked(this.state)
    const normalizedStatus = normalizeBatchStatus(event.status ?? event.outcome ?? event.result?.status)
      ?? (event.ok ? "completed" : "failed")
    const status = blockedDelivery && normalizedStatus === "completed" ? "failed" : normalizedStatus
    const stoppingPacket = event.stoppingPacket
      ? event.stoppingPacket
      : event.stoppingSlug
        ? stoppingPacketFromSummaries(packetSummaries, event.stoppingSlug, this.state.activePacket)
        : this.state.stoppingPacket
    const baseMessage = event.message ?? formatBatchFinishedMessage(status, stoppingPacket, packetSummaries)
    const message = blockedDelivery && event.ok
      ? `${baseMessage}; checkpoint delivery blocked`
      : baseMessage
    this.set({
      ...this.state,
      batchStatus: status,
      packetSummaries,
      stoppingPacket,
      notStartedPackets: packetSummaries.filter((summary) => summary.outcome === "not_started"),
      finished: { ok: event.ok && !blockedDelivery, message },
      activeTaskId: null,
    })
  }

  selectTask(taskId: string): void {
    const tasks = sessionVisibleTasks(this.state)
    const activeTaskId = tasks.some((task) => task.id === this.state.activeTaskId)
      ? this.state.activeTaskId
      : null
    const fallbackId = activeTaskId ?? tasks[0]?.id ?? null
    const selectedTaskId = tasks.some((task) => task.id === taskId) ? taskId : fallbackId
    if (selectedTaskId === null) {
      if (this.state.selectedTaskId === null && !this.state.followingActiveTask) return
      this.set({ ...this.state, selectedTaskId: null, followingActiveTask: false })
      return
    }
    const followingActiveTask = selectedTaskId === this.state.activeTaskId
    if (selectedTaskId === this.state.selectedTaskId && followingActiveTask === this.state.followingActiveTask) return
    this.set({ ...this.state, selectedTaskId, followingActiveTask })
  }

  moveTask(delta: number): void {
    const tasks = sessionVisibleTasks(this.state)
    if (tasks.length === 0 || !Number.isFinite(delta) || delta === 0) return
    const currentIndex = tasks.findIndex((task) => task.id === this.state.selectedTaskId)
    const startIndex = currentIndex < 0 ? 0 : currentIndex
    const nextIndex = Math.max(0, Math.min(tasks.length - 1, startIndex + Math.trunc(delta)))
    const taskId = tasks[nextIndex]?.id
    if (taskId) this.selectTask(taskId)
  }

  setFocusedPane(focusedPane: CockpitPane): void {
    if (focusedPane === this.state.focusedPane) return
    this.set({ ...this.state, focusedPane })
  }

  toggleFocusedPane(): void {
    this.set({ ...this.state, focusedPane: this.state.focusedPane === "tasks" ? "transcript" : "tasks" })
  }

  setFollowingActiveTask(followingActiveTask: boolean): void {
    const selectedTaskId = followingActiveTask && this.state.activeTaskId
      ? this.state.activeTaskId
      : this.state.selectedTaskId
    if (followingActiveTask === this.state.followingActiveTask && selectedTaskId === this.state.selectedTaskId) return
    this.set({ ...this.state, followingActiveTask, selectedTaskId })
  }

  setHelpOpen(helpOpen: boolean): void {
    if (helpOpen === this.state.helpOpen) return
    this.set({ ...this.state, helpOpen })
  }

  toggleHelp(): void {
    this.set({ ...this.state, helpOpen: !this.state.helpOpen })
  }

  private consumeTaskStatus(taskId: string, status: TaskStatus): void {
    const localTaskId = this.localTaskId(taskId)
    if (!localTaskId) return
    const transcriptKey = this.taskKey(localTaskId)
    const tasks = this.state.tasks.map((task) => task.id === localTaskId ? { ...task, status } : task)
    const packetTasks = this.state.activePacket
      ? { ...this.state.packetTasks, [this.state.activePacket.slug]: tasks }
      : this.state.packetTasks
    const activeTaskId = status === "in_progress"
      ? localTaskId
      : this.state.activeTaskId === localTaskId ? null : this.state.activeTaskId
    const visibleTasks = sessionVisibleTasks({ ...this.state, tasks })
    const selectedTaskId = status === "in_progress" && this.state.followingActiveTask
      ? localTaskId
      : visibleTasks.some((task) => task.id === this.state.selectedTaskId)
        ? this.state.selectedTaskId
        : visibleTasks[0]?.id ?? null
    let transcripts = this.state.transcripts
    let taskReasons = this.state.taskReasons

    if (isCompleted(status)) {
      transcripts = appendTaskLines(transcripts, transcriptKey, "outcome", "Task completed", this.nextSequence())
      taskReasons = withoutKey(taskReasons, transcriptKey)
    } else if (status === "failed") {
      const reason = formatTaskReason(status, undefined, [])
      transcripts = reason
        ? appendTaskLines(transcripts, transcriptKey, "error", reason, this.nextSequence())
        : transcripts
      taskReasons = reason ? { ...taskReasons, [transcriptKey]: reason } : withoutKey(taskReasons, transcriptKey)
    } else if (status === "blocked") {
      const failedDependencyIds = findFailedDependencies(tasks, localTaskId)
      const reason = formatTaskReason(status, undefined, failedDependencyIds)
      transcripts = reason
        ? appendTaskLines(transcripts, transcriptKey, "error", reason, this.nextSequence())
        : transcripts
      taskReasons = reason ? { ...taskReasons, [transcriptKey]: reason } : withoutKey(taskReasons, transcriptKey)
    } else {
      taskReasons = withoutKey(taskReasons, transcriptKey)
    }

    taskReasons = refreshBlockedReasons(tasks, taskReasons, (id) => this.taskKey(id))
    taskReasons = refreshCheckpointReasons(tasks, taskReasons, (id) => this.taskKey(id))
    this.set({ ...this.state, tasks, packetTasks, activeTaskId, selectedTaskId, transcripts, taskReasons })
  }

  private consumeCheckpoint(
    taskId: string,
    event: Extract<RunEvent, { type: "checkpoint" }>,
  ): void {
    const localTaskId = this.localTaskId(taskId)
    if (!localTaskId) return
    const task = this.state.tasks.find((candidate) => candidate.id === localTaskId)
    if (!task) return
    const transcriptKey = this.taskKey(localTaskId)
    const checkpoint: CockpitCheckpoint = event.state === "created"
      ? event.commit === undefined
        ? { state: "created" }
        : { state: "created", commit: event.commit }
      : { state: "blocked", reason: boundedCheckpointReason(event.reason) }
    const tasks = this.state.tasks.map((candidate) => candidate.id === localTaskId
      ? { ...candidate, checkpoint }
      : candidate)
    const packetTasks = this.state.activePacket
      ? { ...this.state.packetTasks, [this.state.activePacket.slug]: tasks }
      : this.state.packetTasks
    const checkpointOutcomes = { ...this.state.checkpointOutcomes, [transcriptKey]: checkpoint }
    if (checkpoint.state === "created") {
      const detail = checkpoint.commit === undefined
        ? "Local checkpoint created"
        : `Local checkpoint created: ${checkpoint.commit}`
      const transcripts = appendTaskLines(this.state.transcripts, transcriptKey, "outcome", detail, this.nextSequence())
      const taskReasons = withoutKey(this.state.taskReasons, transcriptKey)
      this.set({ ...this.state, tasks, packetTasks, checkpointOutcomes, transcripts, taskReasons })
      return
    }

    const detail = `Checkpoint blocked: ${checkpoint.reason}`
    const transcripts = appendTaskLines(this.state.transcripts, transcriptKey, "error", detail, this.nextSequence())
    const taskReasons = { ...this.state.taskReasons, [transcriptKey]: checkpoint.reason }
    this.set({ ...this.state, tasks, packetTasks, checkpointOutcomes, transcripts, taskReasons })
  }

  private consumeTaskActivity(taskId: string, message: string): void {
    const localTaskId = this.localTaskId(taskId)
    if (!localTaskId) return
    const transcriptKey = this.taskKey(localTaskId)
    const trimmed = message.trim()
    if (!trimmed || !(transcriptKey in this.state.transcripts)) return
    const status = this.state.tasks.find((task) => task.id === localTaskId)?.status
    const unsuccessful = status === "failed" || status === "blocked"
    const kind = unsuccessful ? "error" : "activity"
    const transcripts = appendTaskLines(this.state.transcripts, transcriptKey, kind, trimmed, this.nextSequence())
    const taskReasons = unsuccessful
      ? { ...this.state.taskReasons, [transcriptKey]: formatTaskReason(status, trimmed, []) ?? trimmed }
      : this.state.taskReasons
    this.set({ ...this.state, transcripts, taskReasons })
  }

  private consumeRunActivity(message: string): void {
    const trimmed = message.trim()
    if (!trimmed) return
    this.set({
      ...this.state,
      runActivity: appendTranscriptLines(this.state.runActivity, "activity", trimmed, this.nextSequence()),
    })
  }

  private consumeSessionUpdate(taskId: string, sessionId: string, update: Extract<RunEvent, { type: "session_update" }>["update"]): void {
    const localTaskId = this.localTaskId(taskId)
    if (!localTaskId) return
    const transcriptKey = this.taskKey(localTaskId)
    const current = this.state.transcripts[transcriptKey]
    if (!current) return
    const next = applySessionUpdate(current, update, this.nextSequence(), sessionId)
    this.set({
      ...this.state,
      transcripts: { ...this.state.transcripts, [transcriptKey]: next },
    })
  }

  private localTaskId(taskId: string): string | null {
    if (this.state.batchStatus === null) return taskId
    if (this.state.batchStatus !== "running") return null
    const activePacket = this.state.activePacket
    if (!activePacket) return null

    const separator = taskId.indexOf("/")
    if (separator < 1) return null
    const qualifier = taskId.slice(0, separator)
    const localTaskId = taskId.slice(separator + 1)
    if (qualifier !== activePacket.slug) return null
    return this.state.tasks.some((task) => task.id === localTaskId) ? localTaskId : null
  }

  private taskKey(taskId: string): string {
    return this.state.activePacket
      ? qualifiedTaskKey(this.state.activePacket.slug, taskId)
      : taskId
  }

  private nextSequence(): number {
    const sequence = this.sequence
    this.sequence += 1
    return sequence
  }
}

export function selectTask(state: CockpitState, taskId: string): CockpitTask | undefined {
  return state.tasks.find((task) => task.id === taskId)
}

/** The runner retains completed tasks for truthful counts and summaries. */
export function selectUnfinishedTasks(state: CockpitState): readonly CockpitTask[] {
  return unfinishedTasks(state.tasks)
}

/**
 * Tasks visible when the current packet cockpit opened. Completing a task does
 * not remove it from this session, so its final transcript stays navigable.
 */
export function selectVisibleTasks(state: CockpitState): readonly CockpitTask[] {
  return sessionVisibleTasks(state)
}

export function selectSelectedTask(state: CockpitState): CockpitTask | undefined {
  return state.selectedTaskId ? selectTask(state, state.selectedTaskId) : undefined
}

export function selectTaskTranscript(state: CockpitState, taskId: string): readonly TranscriptEntry[] {
  const key = state.activePacket ? qualifiedTaskKey(state.activePacket.slug, taskId) : taskId
  return state.transcripts[key] ?? []
}

export function selectSelectedTranscript(state: CockpitState): readonly TranscriptEntry[] {
  return state.selectedTaskId ? selectTaskTranscript(state, state.selectedTaskId) : []
}

/**
 * Projects one parent packet into the existing read-only task/detail layout.
 * The runtime-owned active packet remains unchanged in the source state.
 */
export function selectPacketTaskView(
  state: CockpitState,
  packetIndex: number,
  selectedTaskIndex: number,
): CockpitState {
  if (state.batchStatus === null || packetIndex === state.activePacket?.index) return state
  const summary = state.packetSummaries[packetIndex]
  if (!summary) return state

  const tasks = state.packetTasks[summary.slug] ?? []
  const visibleTaskIds = state.packetVisibleTaskIds[summary.slug] ?? unfinishedTasks(tasks).map((task) => task.id)
  const visibleTasks = tasks.filter((task) => visibleTaskIds.includes(task.id))
  const boundedIndex = Math.max(0, Math.min(Math.max(visibleTasks.length - 1, 0), Math.trunc(selectedTaskIndex)))

  return {
    ...state,
    slug: summary.slug,
    tasks,
    visibleTaskIds,
    activeTaskId: null,
    selectedTaskId: visibleTasks[boundedIndex]?.id ?? null,
    followingActiveTask: false,
    activePacket: {
      slug: summary.slug,
      index: packetIndex,
      total: state.packetSummaries.length,
    },
  }
}

export function selectTaskReason(state: CockpitState, taskId: string): string | undefined {
  const key = state.activePacket ? qualifiedTaskKey(state.activePacket.slug, taskId) : taskId
  return state.taskReasons[key]
}

export function selectTaskCheckpoint(state: CockpitState, taskId: string): CockpitCheckpoint | undefined {
  const task = selectTask(state, taskId)
  if (task?.checkpoint) return task.checkpoint
  const key = state.activePacket ? qualifiedTaskKey(state.activePacket.slug, taskId) : taskId
  return state.checkpointOutcomes[key]
}

export function formatTaskReason(
  status: TaskStatus,
  activity: string | undefined,
  failedDependencyIds: readonly string[],
): string | undefined {
  if (status === "failed") return firstMeaningfulLine(activity) ?? "Task failed; see latest activity"
  if (status !== "blocked") return undefined
  const explicit = firstMeaningfulLine(activity)
  if (explicit) return explicit
  if (failedDependencyIds.length === 0) return "Task blocked; see dependency status"
  if (failedDependencyIds.length === 1) return `Blocked because dependency ${failedDependencyIds[0]} failed`
  const last = failedDependencyIds.at(-1)
  return `Blocked because dependencies ${failedDependencyIds.slice(0, -1).join(", ")} and ${last} failed`
}

function appendTaskLines(
  transcripts: Readonly<Record<string, readonly TranscriptEntry[]>>,
  taskId: string,
  kind: "activity" | "error" | "outcome",
  text: string,
  sequence: number,
): Readonly<Record<string, readonly TranscriptEntry[]>> {
  const current = transcripts[taskId]
  if (!current) return transcripts
  return { ...transcripts, [taskId]: appendTranscriptLines(current, kind, text, sequence) }
}

function refreshBlockedReasons(
  tasks: readonly CockpitTask[],
  reasons: Readonly<Record<string, string>>,
  keyForTask: (taskId: string) => string = (taskId) => taskId,
): Readonly<Record<string, string>> {
  let next = reasons
  for (const task of tasks) {
    if (task.status !== "blocked") continue
    const reason = formatTaskReason(task.status, undefined, findFailedDependencies(tasks, task.id))
    const key = keyForTask(task.id)
    if (reason && next[key] !== reason) next = { ...next, [key]: reason }
  }
  return next
}

function refreshCheckpointReasons(
  tasks: readonly CockpitTask[],
  reasons: Readonly<Record<string, string>>,
  keyForTask: (taskId: string) => string = (taskId) => taskId,
): Readonly<Record<string, string>> {
  let next = reasons
  for (const task of tasks) {
    if (task.checkpoint?.state !== "blocked") continue
    const key = keyForTask(task.id)
    const reason = task.checkpoint.reason
    if (next[key] !== reason) next = { ...next, [key]: reason }
  }
  return next
}

function findFailedDependencies(tasks: readonly CockpitTask[], taskId: string): string[] {
  const task = tasks.find((candidate) => candidate.id === taskId)
  if (!task) return []
  const statusById = new Map(tasks.map((candidate) => [candidate.id, candidate.status]))
  return task.dependencies.filter((dependency) => {
    const status = statusById.get(dependency)
    return status === "failed" || status === "blocked"
  })
}

function withoutKey(
  record: Readonly<Record<string, string>>,
  key: string,
): Readonly<Record<string, string>> {
  if (!(key in record)) return record
  return Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key))
}

function firstMeaningfulLine(message: string | undefined): string | undefined {
  return message?.split(/\r?\n/u).map((line) => line.trim()).find(Boolean)
}

function isCompleted(status: TaskStatus): boolean {
  return status === "completed" || status === "done" || status === "finished"
}

function unfinishedTasks(tasks: readonly CockpitTask[]): readonly CockpitTask[] {
  return tasks.filter((task) => !isCompleted(task.status) || task.checkpoint?.state === "blocked" || task.checkpoint?.state === "active")
}

function sessionVisibleTasks(state: Pick<CockpitState, "tasks" | "visibleTaskIds">): readonly CockpitTask[] {
  const visibleTaskIds = new Set(state.visibleTaskIds)
  return state.tasks.filter((task) => visibleTaskIds.has(task.id))
}

function qualifiedTaskKey(slug: string, taskId: string): string {
  return `${slug}/${taskId}`
}

function clonePacketSummaries(summaries: readonly PacketSummary[]): readonly PacketSummary[] {
  return summaries.map((summary) => ({ ...summary }))
}

function updatePacketSummary(
  summaries: readonly PacketSummary[],
  index: number,
  slug: string,
  summary: PacketSummary,
): readonly PacketSummary[] {
  const next = [...summaries]
  const targetIndex = index >= 0 && index < next.length
    ? index
    : next.findIndex((candidate) => candidate.slug === slug)
  if (targetIndex < 0) {
    next.push({ ...summary, slug })
    return next
  }
  next[targetIndex] = { ...summary, slug }
  return next
}

function normalizeBatchStatus(status: BatchEventStatus | PacketOutcome | undefined): CockpitBatchStatus {
  switch (status) {
    case "running":
    case "completed":
    case "failed":
    case "cancelled":
    case "preflight_failed":
      return status
    case "succeeded":
      return "completed"
    case "not_started":
    case undefined:
      return null
  }
}

function stoppingPacketFromSummaries(
  summaries: readonly PacketSummary[],
  slug: string,
  activePacket: ActivePacketContext | null,
): StoppingPacketContext | null {
  const summary = summaries.find((candidate) => candidate.slug === slug)
  if (!summary || (summary.outcome !== "failed" && summary.outcome !== "cancelled")) return null
  return {
    slug,
    index: activePacket?.slug === slug ? activePacket.index : summaries.indexOf(summary),
    outcome: summary.outcome,
  }
}

function formatBatchFinishedMessage(
  status: CockpitBatchStatus,
  stoppingPacket: StoppingPacketContext | null,
  summaries: readonly PacketSummary[],
): string {
  if (status === "preflight_failed") return "Batch preflight failed; no packets started"
  if (status === "cancelled") {
    return stoppingPacket
      ? `Batch cancelled at ${stoppingPacket.slug}; later packets were not started`
      : "Batch cancelled; no later packets were started"
  }
  if (status === "failed") {
    return stoppingPacket
      ? `Batch failed at ${stoppingPacket.slug}; later packets were not started`
      : "Batch failed"
  }
  if (status === "completed") {
    const count = summaries.filter((summary) => summary.outcome === "succeeded").length
    return `${count} packet${count === 1 ? "" : "s"} succeeded`
  }
  return "Batch status unavailable"
}

function toCockpitTask(task: TaskFile): CockpitTask {
  return {
    id: task.id,
    title: task.frontmatter.title,
    type: task.frontmatter.type,
    complexity: task.frontmatter.complexity,
    status: task.frontmatter.status,
    dependencies: task.frontmatter.dependencies.map((dependency) => dependency.replace(/\.md$/u, "")),
    checkpoint: toCockpitCheckpoint(task.frontmatter.checkpoint),
  }
}

function toCockpitCheckpoint(record: CheckpointRecord | undefined): CockpitCheckpoint | null {
  if (!record) return null
  if (record.state === "active") return { state: "active" }
  return { state: "blocked", reason: boundedCheckpointReason(record.error) }
}

function checkpointOutcomeRecord(
  tasks: readonly CockpitTask[],
  keyForTask: (task: CockpitTask) => string = (task) => task.id,
): Readonly<Record<string, CockpitCheckpoint>> {
  return Object.fromEntries(tasks.flatMap((task) => task.checkpoint
    ? [[keyForTask(task), task.checkpoint] as const]
    : []))
}

function checkpointReasons(
  tasks: readonly CockpitTask[],
  keyForTask: (task: CockpitTask) => string = (task) => task.id,
): Readonly<Record<string, string>> {
  return Object.fromEntries(tasks.flatMap((task) => task.checkpoint?.state === "blocked"
    ? [[keyForTask(task), task.checkpoint.reason] as const]
    : []))
}

function boundedCheckpointReason(reason: string): string {
  const normalized = reason.replace(/[\r\n\s]+/gu, " ").trim()
  return normalized.length <= 1024 ? normalized : `${normalized.slice(0, 1023)}…`
}

function hasCheckpointBlocked(
  state: Pick<CockpitState, "tasks" | "checkpointOutcomes">,
): boolean {
  return state.tasks.some((task) => task.checkpoint?.state === "blocked")
    || Object.values(state.checkpointOutcomes).some((checkpoint) => checkpoint.state === "blocked")
}
