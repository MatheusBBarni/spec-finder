import type { RequestPermissionRequest, RequestPermissionResponse, SessionUpdate } from "@agentclientprotocol/sdk"
import type { SpecFinderConfig } from "./config.ts"
import type { TaskFile, TaskStatus } from "./tasks.ts"

export type RunEvent =
  | { type: "run_started"; slug: string; config: SpecFinderConfig; tasks: TaskFile[] }
  | { type: "task_status"; taskId: string; status: TaskStatus }
  | { type: "activity"; taskId?: string; message: string }
  | { type: "session_update"; taskId: string; update: SessionUpdate }
  | { type: "runtime_option"; name: "model" | "reasoning" | "speed"; requested: string; outcome: "applied" | "default" | "unsupported"; detail?: string }
  | { type: "permission_requested"; request: RequestPermissionRequest; respond: (response: RequestPermissionResponse) => void }
  | { type: "run_finished"; ok: boolean; message: string }

export type RunEventListener = (event: RunEvent) => void
