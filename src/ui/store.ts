import type { RequestPermissionRequest, RequestPermissionResponse, SessionUpdate } from "@agentclientprotocol/sdk"
import type { SpecFinderConfig } from "../config.ts"
import type { RunEvent, RunEventListener } from "../events.ts"
import type { TaskFile, TaskStatus } from "../tasks.ts"

export interface CockpitTask {
  id: string
  title: string
  complexity: string
  status: TaskStatus
}

export interface PendingPermission {
  request: RequestPermissionRequest
  respond: (response: RequestPermissionResponse) => void
  selectedIndex: number
}

export interface CockpitState {
  slug: string
  config: SpecFinderConfig | null
  tasks: CockpitTask[]
  activeTaskId: string | null
  activity: string[]
  permission: PendingPermission | null
  finished: { ok: boolean; message: string } | null
}

const INITIAL_STATE: CockpitState = {
  slug: "",
  config: null,
  tasks: [],
  activeTaskId: null,
  activity: [],
  permission: null,
  finished: null,
}

function describeUpdate(update: SessionUpdate): string | null {
  switch (update.sessionUpdate) {
    case "agent_message_chunk":
      return update.content.type === "text" ? update.content.text : `[${update.content.type}]`
    case "agent_thought_chunk":
      return update.content.type === "text" ? `thought: ${update.content.text}` : "thought"
    case "tool_call":
      return `tool: ${update.title} (${update.status})`
    case "tool_call_update":
      return `tool ${update.toolCallId}: ${update.status ?? "updated"}`
    case "plan":
      return `plan: ${update.entries.map((entry) => entry.content).join(" · ")}`
    default:
      return null
  }
}

export class CockpitStore {
  private state: CockpitState = INITIAL_STATE
  private listeners = new Set<() => void>()

  getSnapshot = (): CockpitState => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private set(next: CockpitState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }

  listener: RunEventListener = (event) => this.consume(event)

  consume(event: RunEvent): void {
    switch (event.type) {
      case "run_started":
        this.set({
          ...INITIAL_STATE,
          slug: event.slug,
          config: event.config,
          tasks: event.tasks.map(toCockpitTask),
          activity: [`Starting ${event.slug}`],
        })
        break
      case "task_status":
        this.set({
          ...this.state,
          activeTaskId: event.status === "in_progress" ? event.taskId : this.state.activeTaskId === event.taskId ? null : this.state.activeTaskId,
          tasks: this.state.tasks.map((task) => task.id === event.taskId ? { ...task, status: event.status } : task),
        })
        break
      case "activity":
        this.append(event.taskId ? `${event.taskId}: ${event.message}` : event.message)
        break
      case "session_update": {
        const line = describeUpdate(event.update)
        if (line) this.append(`${event.taskId}: ${line}`)
        break
      }
      case "runtime_option":
        this.append(`${event.name} ${event.requested}: ${event.outcome}${event.detail ? ` (${event.detail})` : ""}`)
        break
      case "permission_requested":
        this.set({ ...this.state, permission: { request: event.request, respond: event.respond, selectedIndex: 0 } })
        break
      case "run_finished":
        this.set({ ...this.state, finished: { ok: event.ok, message: event.message }, activeTaskId: null })
        break
    }
  }

  movePermission(delta: number): void {
    const permission = this.state.permission
    if (!permission) return
    const count = permission.request.options.length
    const selectedIndex = Math.max(0, Math.min(count - 1, permission.selectedIndex + delta))
    this.set({ ...this.state, permission: { ...permission, selectedIndex } })
  }

  selectPermission(): void {
    const permission = this.state.permission
    const option = permission?.request.options[permission.selectedIndex]
    if (!permission || !option) return
    this.set({ ...this.state, permission: null })
    permission.respond({ outcome: { outcome: "selected", optionId: option.optionId } })
  }

  cancelPermission(): void {
    const permission = this.state.permission
    if (!permission) return
    this.set({ ...this.state, permission: null })
    permission.respond({ outcome: { outcome: "cancelled" } })
  }

  private append(message: string): void {
    const trimmed = message.trim()
    if (!trimmed) return
    this.set({ ...this.state, activity: [...this.state.activity, trimmed].slice(-250) })
  }
}

function toCockpitTask(task: TaskFile): CockpitTask {
  return {
    id: task.id,
    title: task.frontmatter.title,
    complexity: task.frontmatter.complexity,
    status: task.frontmatter.status,
  }
}

