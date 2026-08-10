import type { RequestPermissionRequest, RequestPermissionResponse, SessionUpdate } from "@agentclientprotocol/sdk"
import type { BatchResult, PacketOutcome, PacketSummary } from "./batch.ts"
import type { SpecFinderConfig } from "./config.ts"
import type { TaskFile, TaskStatus } from "./tasks.ts"

export type BatchEventStatus = "running" | BatchResult["status"]

export type AcpTurnPhase = "implementation" | "report"

export type BatchStartedEvent = {
  type: "batch_started"
  /** Declared packet order. */
  slugs?: readonly string[]
  packetSlugs?: readonly string[]
  /** Alias accepted by adapters that already hold packet descriptors. */
  packets?: ReadonlyArray<{
    slug: string
    index?: number
    outcome?: PacketOutcome
    detail?: NonNullable<PacketSummary["detail"]>
    /** Read-only preflight snapshot used for browsing before execution starts. */
    tasks?: readonly TaskFile[]
  }>
  summaries?: readonly PacketSummary[]
  total?: number
  config?: SpecFinderConfig
}

export type BatchPacketStartedEvent = {
  type: "batch_packet_started"
  slug: string
  index: number
  total?: number
  config?: SpecFinderConfig
  /** Packet tasks seed the active detailed projection. */
  tasks?: readonly TaskFile[]
  taskFiles?: readonly TaskFile[]
  packet?: { slug: string; index: number; total?: number }
}

export type BatchPacketFinishedEvent = {
  type: "batch_packet_finished"
  slug: string
  index: number
  outcome?: PacketOutcome
  detail?: NonNullable<PacketSummary["detail"]>
  summary?: PacketSummary
  result?: PacketSummary
  message?: string
}

export type BatchFinishedEvent = {
  type: "batch_finished"
  ok: boolean
  status?: BatchEventStatus
  outcome?: BatchResult["status"] | PacketOutcome
  packets?: readonly PacketSummary[]
  summaries?: readonly PacketSummary[]
  result?: BatchResult
  stoppingSlug?: string
  stoppingPacket?: { slug: string; index: number; outcome: "failed" | "cancelled" }
  message?: string
}

export type CheckpointEvent =
  | { type: "checkpoint"; taskId: string; state: "created"; commit?: string }
  | { type: "checkpoint"; taskId: string; state: "blocked"; reason: string }

export type RunEvent =
  | { type: "run_started"; slug: string; config: SpecFinderConfig; tasks: TaskFile[] }
  | { type: "task_status"; taskId: string; status: TaskStatus }
  | CheckpointEvent
  | { type: "activity"; taskId?: string; message: string }
  | { type: "session_update"; taskId: string; sessionId: string; phase?: AcpTurnPhase; update: SessionUpdate }
  | { type: "runtime_option"; name: "model" | "reasoning" | "speed"; requested: string; outcome: "applied" | "default" | "unsupported"; detail?: string }
  | { type: "permission_requested"; request: RequestPermissionRequest; respond: (response: RequestPermissionResponse) => void }
  | { type: "run_finished"; ok: boolean; message: string }
  | BatchStartedEvent
  | BatchPacketStartedEvent
  | BatchPacketFinishedEvent
  | BatchFinishedEvent

export type RunEventListener = (event: RunEvent) => void
