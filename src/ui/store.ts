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
import type { TaskFile, TaskStatus } from "../tasks.ts"
import {
  appendTranscriptLines,
  applySessionUpdate,
  type TranscriptEntry,
} from "./transcript.ts"

export type CockpitPane = "tasks" | "transcript"
export type RuntimeOptionName = Extract<RunEvent, { type: "runtime_option" }>["name"]

export interface CockpitTask {
  readonly id: string
  readonly title: string
  readonly type: string
  readonly complexity: string
  readonly status: TaskStatus
  readonly dependencies: readonly string[]
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
  readonly activePacket: ActivePacketContext | null
  readonly stoppingPacket: StoppingPacketContext | null
  readonly notStartedPackets: readonly PacketSummary[]
}

function createInitialState(): CockpitState {
  return {
    slug: "",
    config: null,
    tasks: [],
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
        if (this.state.batchStatus === "running") break
        this.sequence = 0
        const tasks = event.tasks.map(toCockpitTask)
        const transcripts = Object.fromEntries(tasks.map((task) => [task.id, [] as readonly TranscriptEntry[]]))
        const runActivity = appendTranscriptLines([], "activity", `Starting ${event.slug}`, this.nextSequence())
        this.set({
          ...createInitialState(),
          slug: event.slug,
          config: event.config,
          tasks,
          selectedTaskId: firstUnfinishedTaskId(tasks),
          transcripts,
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
      case "run_finished":
        if (this.state.batchStatus === "running") break
        this.set({ ...this.state, finished: { ok: event.ok, message: event.message }, activeTaskId: null })
        break
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
    const detail = event.config === undefined ? this.state.config : event.config
    const runActivity = appendTranscriptLines(
      [],
      "activity",
      slugs.length === 0 ? "Starting batch" : `Starting batch (${slugs.length} packets)`,
      this.nextSequence(),
    )

    this.set({
      ...this.state,
      slug: "",
      config: detail,
      tasks: [],
      activeTaskId: null,
      selectedTaskId: null,
      transcripts: {},
      taskReasons: {},
      runActivity,
      runtimeOptions: {},
      finished: null,
      batchStatus: "running",
      packetSummaries,
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
    const activePacket: ActivePacketContext = {
      slug,
      index,
      total: packet?.total ?? event.total ?? this.state.packetSummaries.length,
    }
    const transcripts = Object.fromEntries(
      tasks.map((task) => [qualifiedTaskKey(slug, task.id), [] as readonly TranscriptEntry[]]),
    )
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
      activeTaskId: null,
      selectedTaskId: firstUnfinishedTaskId(tasks),
      transcripts,
      taskReasons: {},
      runtimeOptions: {},
      finished: null,
      batchStatus: "running",
      packetSummaries,
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
    const status = normalizeBatchStatus(event.status ?? event.outcome ?? event.result?.status)
      ?? (event.ok ? "completed" : "failed")
    const stoppingPacket = event.stoppingPacket
      ? event.stoppingPacket
      : event.stoppingSlug
        ? stoppingPacketFromSummaries(packetSummaries, event.stoppingSlug, this.state.activePacket)
        : this.state.stoppingPacket
    const message = event.message ?? formatBatchFinishedMessage(status, stoppingPacket, packetSummaries)
    this.set({
      ...this.state,
      batchStatus: status,
      packetSummaries,
      stoppingPacket,
      notStartedPackets: packetSummaries.filter((summary) => summary.outcome === "not_started"),
      finished: { ok: event.ok, message },
      activeTaskId: null,
    })
  }

  selectTask(taskId: string): void {
    const tasks = unfinishedTasks(this.state.tasks)
    const activeTaskId = tasks.some((task) => task.id === this.state.activeTaskId)
      ? this.state.activeTaskId
      : null
    const fallbackId = activeTaskId ?? firstUnfinishedTaskId(tasks)
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
    const tasks = unfinishedTasks(this.state.tasks)
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
    const activeTaskId = status === "in_progress"
      ? localTaskId
      : this.state.activeTaskId === localTaskId ? null : this.state.activeTaskId
    const remainingTasks = unfinishedTasks(tasks)
    const selectedTaskId = status === "in_progress" && this.state.followingActiveTask
      ? localTaskId
      : remainingTasks.some((task) => task.id === this.state.selectedTaskId)
        ? this.state.selectedTaskId
        : firstUnfinishedTaskId(remainingTasks)
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
    this.set({ ...this.state, tasks, activeTaskId, selectedTaskId, transcripts, taskReasons })
  }

  private consumeTaskActivity(taskId: string, message: string): void {
    const localTaskId = this.localTaskId(taskId)
    if (!localTaskId) return
    const transcriptKey = this.taskKey(localTaskId)
    const trimmed = message.trim()
    if (!trimmed || !(transcriptKey in this.state.transcripts)) return
    const failed = this.state.tasks.find((task) => task.id === localTaskId)?.status === "failed"
    const kind = failed ? "error" : "activity"
    const transcripts = appendTaskLines(this.state.transcripts, transcriptKey, kind, trimmed, this.nextSequence())
    const taskReasons = failed
      ? { ...this.state.taskReasons, [transcriptKey]: formatTaskReason("failed", trimmed, []) ?? trimmed }
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
    const activePacket = this.state.activePacket
    if (!activePacket) return null

    const separator = taskId.indexOf("/")
    const qualifier = separator < 0 ? undefined : taskId.slice(0, separator)
    const localTaskId = separator < 0 ? taskId : taskId.slice(separator + 1)
    if (qualifier !== undefined && qualifier !== activePacket.slug) return null
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

/**
 * The runner retains completed tasks for truthful counts and summaries, while
 * the navigator is reserved for work that can still need attention.
 */
export function selectUnfinishedTasks(state: CockpitState): readonly CockpitTask[] {
  return unfinishedTasks(state.tasks)
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

export function selectTaskReason(state: CockpitState, taskId: string): string | undefined {
  const key = state.activePacket ? qualifiedTaskKey(state.activePacket.slug, taskId) : taskId
  return state.taskReasons[key]
}

export function formatTaskReason(
  status: TaskStatus,
  activity: string | undefined,
  failedDependencyIds: readonly string[],
): string | undefined {
  if (status === "failed") return firstMeaningfulLine(activity) ?? "Task failed; see latest activity"
  if (status !== "blocked") return undefined
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
  return tasks.filter((task) => !isCompleted(task.status))
}

function firstUnfinishedTaskId(tasks: readonly CockpitTask[]): string | null {
  return unfinishedTasks(tasks)[0]?.id ?? null
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
  }
}
