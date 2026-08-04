import type { SpecFinderConfig } from "../config.ts"
import type { RunEvent, RunEventListener } from "../events.ts"
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
  readonly complexity: string
  readonly status: TaskStatus
  readonly dependencies: readonly string[]
}

export interface RuntimeOptionOutcome {
  readonly requested: string
  readonly outcome: "applied" | "default" | "unsupported"
  readonly detail?: string
}

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
        this.sequence = 0
        const tasks = event.tasks.map(toCockpitTask)
        const transcripts = Object.fromEntries(tasks.map((task) => [task.id, [] as readonly TranscriptEntry[]]))
        const runActivity = appendTranscriptLines([], "activity", `Starting ${event.slug}`, this.nextSequence())
        this.set({
          ...createInitialState(),
          slug: event.slug,
          config: event.config,
          tasks,
          selectedTaskId: tasks[0]?.id ?? null,
          transcripts,
          runActivity,
        })
        break
      }
      case "task_status":
        this.consumeTaskStatus(event.taskId, event.status)
        break
      case "activity":
        if (event.taskId) this.consumeTaskActivity(event.taskId, event.message)
        else this.consumeRunActivity(event.message)
        break
      case "session_update":
        this.consumeSessionUpdate(event.taskId, event.update)
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
        this.set({ ...this.state, finished: { ok: event.ok, message: event.message }, activeTaskId: null })
        break
    }
  }

  selectTask(taskId: string): void {
    const fallbackId = this.state.activeTaskId ?? this.state.tasks[0]?.id ?? null
    const selectedTaskId = this.state.tasks.some((task) => task.id === taskId) ? taskId : fallbackId
    if (selectedTaskId === null) return
    const followingActiveTask = selectedTaskId === this.state.activeTaskId
    if (selectedTaskId === this.state.selectedTaskId && followingActiveTask === this.state.followingActiveTask) return
    this.set({ ...this.state, selectedTaskId, followingActiveTask })
  }

  moveTask(delta: number): void {
    if (this.state.tasks.length === 0 || !Number.isFinite(delta) || delta === 0) return
    const currentIndex = this.state.tasks.findIndex((task) => task.id === this.state.selectedTaskId)
    const startIndex = currentIndex < 0 ? 0 : currentIndex
    const nextIndex = Math.max(0, Math.min(this.state.tasks.length - 1, startIndex + Math.trunc(delta)))
    const taskId = this.state.tasks[nextIndex]?.id
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
    const tasks = this.state.tasks.map((task) => task.id === taskId ? { ...task, status } : task)
    const activeTaskId = status === "in_progress"
      ? taskId
      : this.state.activeTaskId === taskId ? null : this.state.activeTaskId
    const selectedTaskId = status === "in_progress" && this.state.followingActiveTask
      ? taskId
      : this.state.selectedTaskId
    let transcripts = this.state.transcripts
    let taskReasons = this.state.taskReasons

    if (isCompleted(status)) {
      transcripts = appendTaskLines(transcripts, taskId, "outcome", "Task completed", this.nextSequence())
      taskReasons = withoutKey(taskReasons, taskId)
    } else if (status === "failed") {
      const reason = formatTaskReason(status, undefined, [])
      transcripts = reason
        ? appendTaskLines(transcripts, taskId, "error", reason, this.nextSequence())
        : transcripts
      taskReasons = reason ? { ...taskReasons, [taskId]: reason } : withoutKey(taskReasons, taskId)
    } else if (status === "blocked") {
      const failedDependencyIds = findFailedDependencies(tasks, taskId)
      const reason = formatTaskReason(status, undefined, failedDependencyIds)
      transcripts = reason
        ? appendTaskLines(transcripts, taskId, "error", reason, this.nextSequence())
        : transcripts
      taskReasons = reason ? { ...taskReasons, [taskId]: reason } : withoutKey(taskReasons, taskId)
    } else {
      taskReasons = withoutKey(taskReasons, taskId)
    }

    taskReasons = refreshBlockedReasons(tasks, taskReasons)
    this.set({ ...this.state, tasks, activeTaskId, selectedTaskId, transcripts, taskReasons })
  }

  private consumeTaskActivity(taskId: string, message: string): void {
    const trimmed = message.trim()
    if (!trimmed || !(taskId in this.state.transcripts)) return
    const failed = this.state.tasks.find((task) => task.id === taskId)?.status === "failed"
    const kind = failed ? "error" : "activity"
    const transcripts = appendTaskLines(this.state.transcripts, taskId, kind, trimmed, this.nextSequence())
    const taskReasons = failed
      ? { ...this.state.taskReasons, [taskId]: formatTaskReason("failed", trimmed, []) ?? trimmed }
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

  private consumeSessionUpdate(taskId: string, update: Extract<RunEvent, { type: "session_update" }>["update"]): void {
    const current = this.state.transcripts[taskId]
    if (!current) return
    const next = applySessionUpdate(current, update, this.nextSequence())
    this.set({
      ...this.state,
      transcripts: { ...this.state.transcripts, [taskId]: next },
    })
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

export function selectSelectedTask(state: CockpitState): CockpitTask | undefined {
  return state.selectedTaskId ? selectTask(state, state.selectedTaskId) : undefined
}

export function selectTaskTranscript(state: CockpitState, taskId: string): readonly TranscriptEntry[] {
  return state.transcripts[taskId] ?? []
}

export function selectSelectedTranscript(state: CockpitState): readonly TranscriptEntry[] {
  return state.selectedTaskId ? selectTaskTranscript(state, state.selectedTaskId) : []
}

export function selectTaskReason(state: CockpitState, taskId: string): string | undefined {
  return state.taskReasons[taskId]
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
): Readonly<Record<string, string>> {
  let next = reasons
  for (const task of tasks) {
    if (task.status !== "blocked") continue
    const reason = formatTaskReason(task.status, undefined, findFailedDependencies(tasks, task.id))
    if (reason && next[task.id] !== reason) next = { ...next, [task.id]: reason }
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

function toCockpitTask(task: TaskFile): CockpitTask {
  return {
    id: task.id,
    title: task.frontmatter.title,
    complexity: task.frontmatter.complexity,
    status: task.frontmatter.status,
    dependencies: task.frontmatter.dependencies.map((dependency) => dependency.replace(/\.md$/u, "")),
  }
}
