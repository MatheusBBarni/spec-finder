type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "done"
  | "finished"
  | "failed"
  | "blocked"

export type MonotonicNow = () => number

export type TaskTimer =
  | {
      readonly kind: "running"
      readonly startedAtMs: number
      readonly elapsedSeconds: number
    }
  | {
      readonly kind: "finished"
      readonly elapsedSeconds: number
    }
  | {
      readonly kind: "unavailable"
    }

const unavailableTimer: TaskTimer = Object.freeze({ kind: "unavailable" })

export const systemNow: MonotonicNow = () => performance.now()

export function beginTaskTimer(previous: TaskTimer | undefined, nowMs: number): TaskTimer {
  if (previous !== undefined) return previous
  if (!isValidClock(nowMs)) return unavailableTimer
  return Object.freeze({
    kind: "running",
    startedAtMs: nowMs,
    elapsedSeconds: 0,
  })
}

export function advanceTaskTimer(previous: TaskTimer, nowMs: number): TaskTimer {
  if (previous.kind !== "running") return previous
  if (!isValidClock(previous.startedAtMs) || !isValidElapsedSeconds(previous.elapsedSeconds)) return unavailableTimer

  const elapsedSeconds = elapsedAt(previous, nowMs)
  if (elapsedSeconds === undefined || elapsedSeconds <= previous.elapsedSeconds) return previous

  return Object.freeze({
    kind: "running",
    startedAtMs: previous.startedAtMs,
    elapsedSeconds,
  })
}

export function finishTaskTimer(previous: TaskTimer | undefined, nowMs: number): TaskTimer {
  if (previous === undefined) return unavailableTimer
  if (previous.kind !== "running") return previous
  if (!isValidClock(previous.startedAtMs) || !isValidElapsedSeconds(previous.elapsedSeconds)) return unavailableTimer

  const elapsedSeconds = elapsedAt(previous, nowMs) ?? previous.elapsedSeconds

  return Object.freeze({
    kind: "finished",
    elapsedSeconds,
  })
}

export function formatTaskTimer(status: TaskStatus, timer: TaskTimer | undefined): string {
  if (status === "pending" || status === "blocked") return "—"
  if (timer === undefined || timer.kind === "unavailable") return "unavailable"
  if (timer.kind === "running" && !isValidClock(timer.startedAtMs)) return "unavailable"
  if (!isValidElapsedSeconds(timer.elapsedSeconds)) return "unavailable"

  const totalSeconds = Math.floor(timer.elapsedSeconds)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function isValidClock(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

function isValidElapsedSeconds(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

function elapsedAt(timer: Extract<TaskTimer, { kind: "running" }>, nowMs: number): number | undefined {
  if (!isValidClock(timer.startedAtMs) || !isValidClock(nowMs) || !isValidElapsedSeconds(timer.elapsedSeconds)) {
    return undefined
  }

  const elapsedMilliseconds = nowMs - timer.startedAtMs
  if (!Number.isFinite(elapsedMilliseconds)) return undefined

  const observedSeconds = Math.floor(Math.max(0, elapsedMilliseconds) / 1000)
  return Math.max(timer.elapsedSeconds, observedSeconds)
}
