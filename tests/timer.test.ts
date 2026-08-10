import { describe, expect, test } from "bun:test"
import {
  advanceTaskTimer,
  beginTaskTimer,
  finishTaskTimer,
  formatTaskTimer,
  type TaskTimer,
} from "../src/ui/timer.ts"

describe("task timer", () => {
  test("formats pending and blocked rows as an em dash regardless of timer state", () => {
    const timer: TaskTimer = { kind: "finished", elapsedSeconds: 75 }

    expect(formatTaskTimer("pending", timer)).toBe("—")
    expect(formatTaskTimer("blocked", timer)).toBe("—")
  })

  test("formats active and terminal rows without a trustworthy baseline as unavailable", () => {
    const statuses = ["in_progress", "completed", "done", "finished", "failed"] as const

    for (const status of statuses) {
      expect(formatTaskTimer(status, undefined)).toBe("unavailable")
      expect(formatTaskTimer(status, { kind: "unavailable" })).toBe("unavailable")
    }

    expect(formatTaskTimer("in_progress", { kind: "running", startedAtMs: -1, elapsedSeconds: 0 })).toBe(
      "unavailable",
    )
  })

  test("starts at zero and preserves the first valid baseline across duplicate starts", () => {
    const started = beginTaskTimer(undefined, 1250)

    expect(started).toEqual({ kind: "running", startedAtMs: 1250, elapsedSeconds: 0 })
    expect(beginTaskTimer(started, 9000)).toBe(started)
  })

  test("rejects invalid baselines without inventing elapsed time", () => {
    expect(beginTaskTimer(undefined, -1)).toEqual({ kind: "unavailable" })
    expect(beginTaskTimer(undefined, Number.NaN)).toEqual({ kind: "unavailable" })
    expect(beginTaskTimer(undefined, Number.POSITIVE_INFINITY)).toEqual({ kind: "unavailable" })
    expect(advanceTaskTimer({ kind: "running", startedAtMs: -1, elapsedSeconds: 0 }, 5_000)).toEqual({
      kind: "unavailable",
    })
    expect(finishTaskTimer({ kind: "running", startedAtMs: -1, elapsedSeconds: 0 }, 5_000)).toEqual({
      kind: "unavailable",
    })
  })

  test("advances only when the displayed second changes and preserves prior state", () => {
    const started = beginTaskTimer(undefined, 1000)
    const sameSecond = advanceTaskTimer(started, 1999)
    const advanced = advanceTaskTimer(sameSecond, 2000)

    expect(sameSecond).toBe(started)
    expect(advanced).toEqual({ kind: "running", startedAtMs: 1000, elapsedSeconds: 1 })
    expect(started).toEqual({ kind: "running", startedAtMs: 1000, elapsedSeconds: 0 })
    expect(advanced).not.toBe(started)
  })

  test("clamps regressing clocks and ignores invalid ticks", () => {
    const started = beginTaskTimer(undefined, 0)
    const atThreeSeconds = advanceTaskTimer(started, 3000)

    expect(atThreeSeconds).toEqual({ kind: "running", startedAtMs: 0, elapsedSeconds: 3 })
    if (atThreeSeconds.kind !== "running") throw new Error("expected a running timer")
    expect(advanceTaskTimer(atThreeSeconds, 1000)).toBe(atThreeSeconds)
    expect(advanceTaskTimer(atThreeSeconds, -1)).toBe(atThreeSeconds)
    expect(advanceTaskTimer(atThreeSeconds, Number.NaN)).toBe(atThreeSeconds)
    expect(advanceTaskTimer(atThreeSeconds, Number.POSITIVE_INFINITY)).toBe(atThreeSeconds)
    expect(atThreeSeconds.elapsedSeconds).toBeGreaterThanOrEqual(0)
  })

  test("keeps terminal transitions idempotent and freezes the first observed value", () => {
    const started = beginTaskTimer(undefined, 100)
    const finished = finishTaskTimer(started, 65_100)

    expect(finished).toEqual({ kind: "finished", elapsedSeconds: 65 })
    expect(finishTaskTimer(finished, 120_000)).toBe(finished)
    expect(beginTaskTimer(finished, 130_000)).toBe(finished)

    const staleTerminal = finishTaskTimer(finished, 1)
    expect(staleTerminal).toBe(finished)
  })

  test("freezes the last trustworthy value when the terminal clock is invalid", () => {
    const started = beginTaskTimer(undefined, 1000)
    const advanced = advanceTaskTimer(started, 4000)

    expect(finishTaskTimer(advanced, -1)).toEqual({ kind: "finished", elapsedSeconds: 3 })
    expect(finishTaskTimer(advanced, Number.NaN)).toEqual({ kind: "finished", elapsedSeconds: 3 })
  })

  test("returns unavailable when a terminal transition has no baseline", () => {
    expect(finishTaskTimer(undefined, 5_000)).toEqual({ kind: "unavailable" })
    expect(finishTaskTimer({ kind: "unavailable" }, 5_000)).toEqual({ kind: "unavailable" })
  })

  test("formats total minutes without rolling over at one hour", () => {
    const cases = [
      [0, "00:00"],
      [1, "00:01"],
      [60, "01:00"],
      [3599, "59:59"],
      [3600, "60:00"],
      [7_265, "121:05"],
    ] as const

    for (const [elapsedSeconds, expected] of cases) {
      expect(formatTaskTimer("completed", { kind: "finished", elapsedSeconds })).toBe(expected)
    }
  })

  test("does not expose mutable timer results", () => {
    const started = beginTaskTimer(undefined, 10)
    const advanced = advanceTaskTimer(started, 1_010)
    const finished = finishTaskTimer(advanced, 2_010)

    expect(Object.isFrozen(started)).toBeTrue()
    expect(Object.isFrozen(advanced)).toBeTrue()
    expect(Object.isFrozen(finished)).toBeTrue()
  })
})
