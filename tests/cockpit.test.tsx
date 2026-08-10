import { describe, expect, test } from "bun:test"
import type { SessionUpdate } from "@agentclientprotocol/sdk"
import type { ScrollBoxRenderable } from "@opentui/core"
import { KeyCodes, setRendererCapabilities } from "@opentui/core/testing"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"
import { DEFAULT_CONFIG, type SpecFinderConfig } from "../src/config.ts"
import type { TaskFile, TaskStatus } from "../src/tasks.ts"
import { App } from "../src/ui/App.tsx"
import { createCockpitSessionController } from "../src/ui/cockpit.tsx"
import { CockpitStore } from "../src/ui/store.ts"
import { formatTaskTimer } from "../src/ui/timer.ts"

type TestScreen = Awaited<ReturnType<typeof testRender>>

describe("read-only progress cockpit", () => {
  test("renders honest timer placeholders and observed durations", () => {
    let now = 1_000
    const store = startedStore([
      task(1, "Pending"),
      task(2, "Blocked"),
      task(3, "Running"),
      task(4, "Completed without observation"),
      task(5, "Observed complete"),
    ], DEFAULT_CONFIG, () => now)
    store.consume({ type: "task_status", taskId: "task_02", status: "blocked" })
    store.consume({ type: "task_status", taskId: "task_03", status: "in_progress" })
    store.consume({ type: "task_status", taskId: "task_04", status: "completed" })
    store.consume({ type: "task_status", taskId: "task_05", status: "in_progress" })
    now = 3_500
    store.tick()
    store.consume({ type: "task_status", taskId: "task_05", status: "completed" })

    const snapshot = store.getSnapshot()
    const timer = (taskId: string) => {
      const task = snapshot.tasks.find((candidate) => candidate.id === taskId)
      if (!task) throw new Error(`missing task ${taskId}`)
      return formatTaskTimer(task.status, snapshot.taskTimers[taskId])
    }
    expect(timer("task_01")).toBe("—")
    expect(timer("task_02")).toBe("—")
    expect(timer("task_03")).toBe("00:02")
    expect(timer("task_04")).toBe("unavailable")
    expect(timer("task_05")).toBe("00:02")
  })

  test("renders frozen final values beside pending and blocked placeholders", async () => {
    let now = 1_000
    const store = startedStore([
      task(1, "Observed complete"),
      task(2, "Observed failure"),
      task(3, "Still pending"),
      task(4, "Dependency blocked"),
    ], DEFAULT_CONFIG, () => now)
    store.consume({ type: "task_status", taskId: "task_01", status: "in_progress" })
    store.consume({ type: "task_status", taskId: "task_02", status: "in_progress" })
    store.consume({ type: "task_status", taskId: "task_04", status: "blocked" })
    now = 3_500
    store.tick()
    store.consume({ type: "task_status", taskId: "task_01", status: "completed" })
    store.consume({ type: "task_status", taskId: "task_02", status: "failed" })

    const screen = await render(store, 120, 40)
    try {
      const frame = screen.captureCharFrame()
      expect(frame).toContain("✓ task_01")
      expect(frame).toContain("✗ task_02")
      expect(frame).toContain("frontend · 00:02")
      expect(frame).toContain("frontend · —")
    } finally {
      await destroy(screen)
    }
  })

  test("advances the active timer without changing another live renderer request", async () => {
    const store = startedStore([task(1, "Timed task")])
    const screen = await render(store, 80, 24)
    screen.renderer.requestLive()

    try {
      await mutate(screen, () => {
        store.consume({ type: "task_status", taskId: "task_01", status: "pending" })
      })
      expect(screen.renderer.liveRequestCount).toBe(1)

      await mutate(screen, () => {
        store.consume({ type: "task_status", taskId: "task_01", status: "in_progress" })
      })
      expect(screen.renderer.liveRequestCount).toBe(2)
      expect(screen.captureCharFrame()).toContain("frontend · 00:00")

      await act(async () => {
        await Bun.sleep(1_100)
      })
      const frame = await screen.waitForFrame((value) => value.includes("frontend · 00:01"))
      expect(frame).toContain("frontend · 00:01")

      await mutate(screen, () => {
        store.consume({ type: "task_status", taskId: "task_01", status: "completed" })
      })
      expect(screen.renderer.liveRequestCount).toBe(1)
    } finally {
      screen.renderer.dropLive()
      await destroy(screen)
    }
  })

  test("drops its live request and stops timer updates when the renderer unmounts", async () => {
    let now = 1_000
    const store = startedStore([task(1, "Timed task")], DEFAULT_CONFIG, () => now)
    store.consume({ type: "task_status", taskId: "task_01", status: "in_progress" })
    const screen = await render(store, 80, 24)

    try {
      expect(screen.renderer.liveRequestCount).toBe(1)
      now = 2_500
      await act(async () => {
        await Bun.sleep(180)
      })
      await screen.renderOnce()
      const running = store.getSnapshot().taskTimers.task_01
      expect(running?.kind).toBe("running")
      if (running?.kind !== "running") throw new Error("expected a running timer")
      expect(running.elapsedSeconds).toBe(1)
    } finally {
      await destroy(screen)
    }

    expect(screen.renderer.liveRequestCount).toBe(0)
    const afterUnmount = store.getSnapshot().taskTimers.task_01
    now = 5_500
    await act(async () => {
      await Bun.sleep(180)
    })
    expect(store.getSnapshot().taskTimers.task_01).toBe(afterUnmount)
  })

  test("keeps selection, focus, follow mode, and transcript scroll stable during timer ticks", async () => {
    let now = 1_000
    const store = startedStore([
      task(1, "Active task"),
      task(2, "Inspected task"),
    ], DEFAULT_CONFIG, () => now)
    store.consume({ type: "task_status", taskId: "task_01", status: "in_progress" })
    for (let index = 0; index < 120; index += 1) {
      store.consume({ type: "activity", taskId: "task_02", message: `INSPECTED-LINE-${index}` })
    }
    const screen = await render(store, 120, 40)

    try {
      await press(screen, KeyCodes.ARROW_DOWN)
      await pressTab(screen)
      const transcript = renderable<ScrollBoxRenderable>(screen, "transcript-scroll")
      await press(screen, KeyCodes.HOME)
      expect(transcript.scrollTop).toBe(0)
      expect(store.getSnapshot()).toMatchObject({
        selectedTaskId: "task_02",
        focusedPane: "transcript",
        followingActiveTask: false,
      })

      now = 3_500
      await act(async () => {
        store.tick()
        await Promise.resolve()
      })
      await screen.renderOnce()

      expect(transcript.scrollTop).toBe(0)
      expect(store.getSnapshot()).toMatchObject({
        selectedTaskId: "task_02",
        focusedPane: "transcript",
        followingActiveTask: false,
      })
      const frame = screen.captureCharFrame()
      expect(frame).toContain("frontend · 00:02")
      expect(frame).toContain("TRANSCRIPT · task_02 · INSPECTING HISTORY")
    } finally {
      await destroy(screen)
    }
  })

  test("renders orientation, truthful option outcomes, task semantics, and selected history at required sizes", async () => {
    const store = startedStore([
      task(1, "Inspect packet", [], "completed"),
      task(2, "Render progress cockpit"),
      task(3, "Blocked follow-up", ["task_02"]),
    ], { ...DEFAULT_CONFIG, model: "gpt-5", reasoning: "auto", speed: "fast" })
    store.consume({ type: "task_status", taskId: "task_02", status: "in_progress" })
    store.consume({ type: "activity", taskId: "task_02", message: "Selected task transcript" })
    store.consume({ type: "runtime_option", name: "model", requested: "gpt-5", outcome: "applied" })
    store.consume({ type: "runtime_option", name: "reasoning", requested: "auto", outcome: "default" })
    store.consume({
      type: "runtime_option",
      name: "speed",
      requested: "fast",
      outcome: "unsupported",
      detail: "provider does not expose speed",
    })

    for (const [width, height] of [[80, 24], [120, 40], [200, 60]] as const) {
      const screen = await render(store, width, height)
      try {
        const frame = screen.captureCharFrame()
        expect(frame).toContain("SPEC FINDER · demo · ACP COCKPIT")
        expect(frame).toContain("codex - gpt-5 (applied) - provider default - fast (unsupported)")
        expect(frame).toContain("workflow RUNNING")
        expect(frame).toContain("TASKS 1/3")
        expect(frame).toContain("codex")
        expect(frame).toContain("gpt-5")
        expect(frame).toContain("frontend · 00:00")
        expect(frame).toMatch(/frontend · \d{2}:\d{2}/)
        expect(frame).not.toContain("task_01")
        expect(frame).toMatch(/> [⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s+task_02/)
        expect(frame).toContain("TRANSCRIPT · task_02 · FOLLOWING ACTIVE")
        expect(frame).toContain("Selected task transcript")
        expect(frame).not.toContain("entries · codex")
        const lines = frame.split("\n")
        const titleLine = lines.findIndex((line) => line.includes("SPEC FINDER · demo · ACP COCKPIT"))
        const identityLine = lines.findIndex((line) => line.includes("codex - gpt-5 (applied) - provider default - fast (unsupported)"))
        expect(identityLine).toBe(titleLine + 1)
      } finally {
        await destroy(screen)
      }
    }
  })

  test("renders ordered batch summaries beside active packet detail", async () => {
    const store = startedBatchStore(["alpha", "beta", "gamma"], 0, [task(1, "Alpha task", [], "completed")])
    store.consume({ type: "batch_packet_finished", slug: "alpha", index: 0, outcome: "succeeded", detail: "already_complete" })
    store.consume({ type: "batch_packet_started", slug: "beta", index: 1, total: 3, tasks: [task(1, "Beta task")] })
    store.consume({ type: "task_status", taskId: "beta/task_01", status: "in_progress" })
    store.consume({ type: "activity", taskId: "beta/task_01", message: "ACTIVE-BETA-TRANSCRIPT" })

    const screen = await render(store, 120, 40)
    try {
      const frame = screen.captureCharFrame()
      expect(frame).toContain("✓ 1 alpha COMPLETED")
      expect(frame).toContain("● 2 beta RUNNING")
      expect(frame).toContain("○ 3 gamma PENDING")
      expect(frame).not.toContain("BATCH SEQUENCE")
      expect(frame).not.toContain("PACKET 1")
      expect(frame).toContain("TRANSCRIPT · task_01 · FOLLOWING ACTIVE")
      expect(frame).toContain("ACTIVE-BETA-TRANSCRIPT")
    } finally {
      await destroy(screen)
    }
  })

  test("lays out only parent packets horizontally and keeps child tasks in the vertical sidebar", async () => {
    const slugs = Array.from({ length: 8 }, (_, index) => `packet-${String(index + 1).padStart(2, "0")}`)
    const tasks = Array.from({ length: 8 }, (_, index) => task(index + 1, `Batch task ${index + 1}`))
    const packetTasks = slugs.map((_, index) => index === 0
      ? tasks
      : [task(1, `Packet ${index + 1} child one`), task(2, `Packet ${index + 1} child two`)])
    const store = startedBatchStore(slugs, 0, tasks, DEFAULT_CONFIG, packetTasks)
    for (let index = 1; index <= tasks.length; index += 1) {
      store.consume({
        type: "activity",
        taskId: `packet-01/${taskId(index)}`,
        message: `BATCH-TRANSCRIPT-${taskId(index)}`,
      })
    }

    const screen = await render(store, 120, 40)
    try {
      let frame = screen.captureCharFrame()
      const packetLines = frame.split("\n")
      const packetLineIndex = packetLines.findIndex((line) => line.includes("packet-01") && line.includes("packet-02"))
      const packetLine = packetLines[packetLineIndex]
      expect(packetLine).toContain("packet-02")
      expect(packetLine).not.toContain("┌")
      expect(packetLine).not.toContain("PACKET")
      const taskLine = frame.split("\n").find((line) => line.includes("task_01"))
      expect(taskLine).not.toContain("task_02")
      expect(frame).toContain("[←→/HL] PACKET  [↑↓/JK] TASK")

      for (let index = 0; index < 6; index += 1) await press(screen, KeyCodes.ARROW_DOWN)
      expect(store.getSnapshot().selectedTaskId).toBe("task_07")
      expect(screen.captureCharFrame()).toContain("BATCH-TRANSCRIPT-task_07")

      for (let index = 0; index < 6; index += 1) await press(screen, KeyCodes.ARROW_RIGHT)
      const batchScroll = renderable<ScrollBoxRenderable>(screen, "batch-sequence-scroll")
      frame = screen.captureCharFrame()
      expect(store.getSnapshot().selectedTaskId).toBe("task_07")
      expect(batchScroll.scrollLeft).toBeGreaterThan(0)
      expect(frame).toContain("packet-07")
      expect(frame).toContain("PACKET 7 CHILD ONE")
      expect(frame).not.toContain("BATCH-TRANSCRIPT-task_07")

      await press(screen, KeyCodes.ARROW_DOWN)
      frame = screen.captureCharFrame()
      expect(frame).toContain("PACKET 7 CHILD TWO")
      expect(frame).toContain("TRANSCRIPT · task_02 · INSPECTING HISTORY")

      await press(screen, KeyCodes.ARROW_LEFT)
      expect(store.getSnapshot().selectedTaskId).toBe("task_07")
      expect(screen.captureCharFrame()).toContain("packet-06")
      expect(screen.captureCharFrame()).toContain("PACKET 6 CHILD ONE")

      await press(screen, "?")
      expect(screen.captureCharFrame()).toContain("Browse the parent packet strip")
      expect(screen.captureCharFrame()).toContain("Select a child task while Tasks has focus")
    } finally {
      await destroy(screen)
    }
  })

  test("shows the failed packet diagnostic and approved recovery guidance", async () => {
    const store = startedBatchStore(["alpha", "beta", "gamma"], 0, [task(1, "Alpha task")])
    store.consume({ type: "batch_packet_finished", slug: "alpha", index: 0, outcome: "succeeded", detail: "completed" })
    store.consume({ type: "batch_packet_started", slug: "beta", index: 1, total: 3, tasks: [task(1, "Beta task")] })
    store.consume({ type: "task_status", taskId: "beta/task_01", status: "failed" })
    store.consume({ type: "activity", taskId: "beta/task_01", message: "Beta provider failed" })
    store.consume({ type: "batch_packet_finished", slug: "beta", index: 1, outcome: "failed", detail: "stopped" })
    store.consume({
      type: "batch_finished",
      ok: false,
      status: "failed",
      stoppingSlug: "beta",
      packets: [
        { slug: "alpha", outcome: "succeeded", detail: "completed" },
        { slug: "beta", outcome: "failed", detail: "stopped" },
        { slug: "gamma", outcome: "not_started" },
      ],
    })

    const screen = await render(store, 120, 40)
    try {
      const summary = screen.captureCharFrame()
      expect(summary).toContain("RUN.STATUS · BATCH SEQUENCE")
      expect(summary).toContain("POSITION 2/3")
      expect(summary).toContain("failed")
      expect(summary).toContain("STOPPING PACKET: beta")
      expect(summary).toContain("gamma not_started")
      expect(summary).toContain("TASK: beta/task_01")
      expect(summary).toContain("Beta provider failed")
      expect(summary).toContain("Resolve the listed error, then rerun the task packet.")
    } finally {
      await destroy(screen)
    }
  })

  test("keeps cancellation and later not-started labels readable in compact reduced-color frames", async () => {
    const store = startedBatchStore(["alpha", "beta", "gamma"], 0, [task(1, "Alpha task")])
    store.consume({ type: "batch_packet_finished", slug: "alpha", index: 0, outcome: "succeeded", detail: "completed" })
    store.consume({ type: "batch_packet_started", slug: "beta", index: 1, total: 3, tasks: [task(1, "Beta task")] })
    store.consume({ type: "batch_packet_finished", slug: "beta", index: 1, outcome: "cancelled", detail: "stopped" })
    store.consume({
      type: "batch_finished",
      ok: false,
      status: "cancelled",
      stoppingSlug: "beta",
      packets: [
        { slug: "alpha", outcome: "succeeded", detail: "completed" },
        { slug: "beta", outcome: "cancelled", detail: "stopped" },
        { slug: "gamma", outcome: "not_started" },
      ],
    })

    const screen = await testRender(<App store={store} onCancel={() => {}} onDismiss={() => {}} />, { width: 70, height: 20, exitOnCtrlC: false })
    try {
      setRendererCapabilities(screen.renderer, { rgb: false, ansi256: false })
      await screen.renderOnce()
      const frame = screen.captureCharFrame()
      expect(frame).toContain("CANCELLED")
      expect(frame).toContain("⊘")
      expect(frame).toContain("cancelled")
      expect(frame).toContain("not_started")
      expect(frame).toContain("no automatic packet retry")
      expect(frame).toContain("rerun manually")
      expect(screen.captureSpans().cols).toBe(70)
      assertNoControls(frame)
    } finally {
      await destroy(screen)
    }
  })

  test("bounds long batch summaries and retains final transcript inspection", async () => {
    const slugs = Array.from({ length: 30 }, (_, index) => `packet-${String(index + 1).padStart(2, "0")}`)
    const activeIndex = 15
    const activeSlug = slugs[activeIndex]!
    const reportReference = ".spec-finder/tasks/demo/reports/task_01.md"
    const store = startedBatchStore(slugs, activeIndex, [task(1, "Inspectable final task")])
    store.consume({ type: "task_status", taskId: `${activeSlug}/task_01`, status: "in_progress" })
    store.consume({ type: "activity", taskId: `${activeSlug}/task_01`, message: "RETAINED-FINAL-TRANSCRIPT" })
    store.consume({ type: "task_status", taskId: `${activeSlug}/task_01`, status: "completed", reportReference })

    const screen = await render(store, 80, 24)
    try {
      let frame = screen.captureCharFrame()
      expect(frame).not.toContain("BATCH 30 PACKETS")
      expect(frame).toContain("TRANSCRIPT · task_01 · INSPECTING HISTORY")
      expect(frame).toContain("Task completed")
      expect(frame).toContain("FOCUS TASKS")

      await pressTab(screen)
      await press(screen, KeyCodes.HOME)
      expect(screen.captureCharFrame()).toContain("RETAINED-FINAL-TRANSCRIPT")

      const packets = slugs.map((slug, index) => ({
        slug,
        outcome: "succeeded" as const,
        detail: index === activeIndex ? "completed" as const : "already_complete" as const,
      }))
      await mutate(screen, () => {
        store.consume({
          type: "batch_packet_finished",
          slug: activeSlug,
          index: activeIndex,
          outcome: "succeeded",
          detail: "completed",
        })
        store.consume({ type: "batch_finished", ok: true, status: "completed", packets })
      })

      frame = screen.captureCharFrame()
      expect(frame).toContain("RUN.STATUS · BATCH SEQUENCE")
      expect(frame).toContain("[ESC] BACK")
      expect(frame).not.toContain("Report:")
      expect(frame).not.toContain(reportReference)
      const batchScroll = renderable<ScrollBoxRenderable>(screen, "batch-run-scroll")
      expect(batchScroll.scrollHeight).toBeGreaterThan(8)

      await press(screen, KeyCodes.HOME)
      expect(screen.captureCharFrame()).toContain("packet-01")
      await press(screen, KeyCodes.END)
      expect(screen.captureCharFrame()).toContain("packet-30")

      await pressEscape(screen)
      frame = screen.captureCharFrame()
      expect(frame).toContain("TRANSCRIPT · task_01 · INSPECTING HISTORY")
      expect(frame).toContain("RETAINED-FINAL-TRANSCRIPT")
    } finally {
      await destroy(screen)
    }
  })

  test("hides tasks already completed when opening the cockpit", async () => {
    const store = startedStore([
      task(1, "Completed first", [], "completed"),
      task(2, "Completed second", [], "finished"),
      task(3, "First unfinished"),
      task(4, "Second unfinished"),
    ])
    const screen = await render(store, 120, 40)

    try {
      const frame = screen.captureCharFrame()
      expect(store.getSnapshot().selectedTaskId).toBe("task_03")
      expect(frame).toContain("TASKS 2/4")
      expect(frame).toContain("task_03")
      expect(frame).toContain("task_04")
      expect(frame).not.toContain("task_01")
      expect(frame).not.toContain("task_02")
    } finally {
      await destroy(screen)
    }
  })

  test("keeps a task visible and navigable after it completes until the cockpit reopens", async () => {
    const store = startedStore([
      task(1, "Completes during this session"),
      task(2, "Still pending"),
    ])
    store.consume({ type: "activity", taskId: "task_01", message: "RETAINED-COMPLETED-TRANSCRIPT" })
    const screen = await render(store, 120, 40)

    try {
      await mutate(screen, () => {
        store.consume({ type: "task_status", taskId: "task_01", status: "completed" })
      })

      let frame = screen.captureCharFrame()
      expect(store.getSnapshot().selectedTaskId).toBe("task_01")
      expect(frame).toContain("✓ task_01")
      expect(frame).toContain("task_02")
      expect(frame).toContain("RETAINED-COMPLETED-TRANSCRIPT")

      await press(screen, KeyCodes.ARROW_DOWN)
      expect(store.getSnapshot().selectedTaskId).toBe("task_02")
      await press(screen, KeyCodes.ARROW_UP)
      expect(store.getSnapshot().selectedTaskId).toBe("task_01")
      frame = screen.captureCharFrame()
      expect(frame).toContain("RETAINED-COMPLETED-TRANSCRIPT")
      expect(frame).toContain("Task completed")
    } finally {
      await destroy(screen)
    }

    const reopenedStore = startedStore([
      task(1, "Completes during this session", [], "completed"),
      task(2, "Still pending"),
    ])
    const reopenedScreen = await render(reopenedStore, 120, 40)
    try {
      const frame = reopenedScreen.captureCharFrame()
      expect(reopenedStore.getSnapshot().selectedTaskId).toBe("task_02")
      expect(frame).not.toContain("task_01")
      expect(frame).toContain("task_02")
    } finally {
      await destroy(reopenedScreen)
    }
  })

  test("renders a text-labelled report outcome and safe reference in live and terminal frames", async () => {
    const reference = ".spec-finder/tasks/demo/reports/task_01.md"
    const maliciousPrompt = "Final report prompt: /Users/alice/spec-finder/report.md\u001b[31m"
    const store = startedStore([task(1, "Report outcome")])
    store.consume({
      type: "activity",
      taskId: "task_01",
      message: "final report handoff starting in active ACP session",
    })
    store.consume({
      type: "session_update",
      taskId: "task_01",
      sessionId: "test-session",
      phase: "report",
      update: {
        sessionUpdate: "session_info_update",
        title: maliciousPrompt,
        _meta: { prompt: maliciousPrompt, reportPath: "/Users/alice/spec-finder/report.md", verdict: "blocked" },
      } as unknown as SessionUpdate,
    })
    store.consume({ type: "task_status", taskId: "task_01", status: "completed", reportReference: reference })

    const screen = await render(store, 120, 40)
    try {
      let frame = screen.captureCharFrame()
      expect(frame).toContain("final report handoff starting")
      expect(frame).toContain("Task completed")
      expect(frame).toContain(`Report: ${reference}`)
      expect(frame).not.toContain(maliciousPrompt)
      expect(frame).not.toContain("/Users/alice/spec-finder")
      expect(frame).not.toContain("blocked")
      expect(frame).not.toContain("reference unavailable")

      await mutate(screen, () => {
        store.consume({ type: "run_finished", ok: true, message: "1 task completed" })
      })
      frame = screen.captureCharFrame()
      expect(frame).toContain("RUN.REPORTS")
      expect(frame).toContain(`Report: ${reference}`)
      expect(frame).toContain("All Tasks Complete: 1/1 succeeded")
      expect(frame).not.toContain(maliciousPrompt)
      expect(frame).not.toContain("/Users/alice/spec-finder")
      expect(frame).not.toContain("reference unavailable")
    } finally {
      await destroy(screen)
    }
  })

  test("renders completion without an unavailable-report placeholder", async () => {
    const store = startedStore([task(1, "Completion without shortcut")])
    store.consume({ type: "activity", taskId: "task_01", message: "final report handoff starting" })
    store.consume({ type: "task_status", taskId: "task_01", status: "completed" })

    const screen = await render(store, 120, 40)
    try {
      let frame = screen.captureCharFrame()
      expect(frame).toContain("Task completed")
      expect(frame).not.toContain("Report:")
      expect(frame).not.toContain("reference unavailable")

      await mutate(screen, () => {
        store.consume({ type: "run_finished", ok: true, message: "1 task completed" })
      })
      frame = screen.captureCharFrame()
      expect(frame).toContain("All Tasks Complete: 1/1 succeeded")
      expect(frame).not.toContain("RUN.REPORTS")
      expect(frame).not.toContain("Report:")
      expect(frame).not.toContain("reference unavailable")
    } finally {
      await destroy(screen)
    }
  })

  test("renders report failure as a labelled recovery outcome without provider blocked metadata", async () => {
    const store = startedStore([task(1, "Report failure")])
    store.consume({
      type: "session_update",
      taskId: "task_01",
      sessionId: "test-session",
      phase: "report",
      update: {
        sessionUpdate: "session_info_update",
        title: "provider says blocked /Users/alice/spec-finder/report.md",
        _meta: { verdict: "blocked", path: "/Users/alice/spec-finder/report.md" },
      } as unknown as SessionUpdate,
    })
    store.consume({ type: "task_status", taskId: "task_01", status: "failed" })
    store.consume({
      type: "activity",
      taskId: "task_01",
      message: "final report failed: report provider stopped; rerun the report phase",
    })

    const screen = await render(store, 120, 40)
    try {
      const frame = screen.captureCharFrame()
      expect(frame).toContain("Task failed")
      expect(frame).toContain("final report failed")
      expect(frame).toContain("rerun the report phase")
      expect(frame).not.toContain("Task completed")
      expect(frame).not.toContain("Report:")
      expect(frame).not.toContain("blocked")
      expect(frame).not.toContain("/Users/alice/spec-finder")
      expect(frame).not.toContain("reference unavailable")
    } finally {
      await destroy(screen)
    }
  })

  test("keeps report labels readable in reduced-color frames", async () => {
    const reference = ".spec-finder/tasks/demo/reports/task_01.md"
    const store = startedStore([task(1, "Reduced-color report")])
    store.consume({ type: "activity", taskId: "task_01", message: "final report handoff starting" })
    store.consume({ type: "task_status", taskId: "task_01", status: "completed", reportReference: reference })
    const screen = await testRender(<App store={store} onCancel={() => {}} onDismiss={() => {}} />, { width: 80, height: 24, exitOnCtrlC: false })

    try {
      setRendererCapabilities(screen.renderer, { rgb: false, ansi256: false })
      await screen.renderOnce()
      const frame = screen.captureCharFrame()
      expect(frame).toContain("Task completed")
      expect(frame).toContain("Report: .spec-finder/tasks/demo/reports/")
      expect(frame).toContain("task_01.md")
      expect(screen.captureSpans().cols).toBe(80)
      assertNoControls(frame)
    } finally {
      await destroy(screen)
    }
  })

  test("keeps one blank row between transcript messages", async () => {
    const store = startedStore([task(1, "Compact transcript")])
    store.consume({ type: "activity", taskId: "task_01", message: "FIRST-MESSAGE" })
    store.consume({ type: "activity", taskId: "task_01", message: "SECOND-MESSAGE" })
    const screen = await render(store, 120, 40)

    try {
      const lines = screen.captureCharFrame().split("\n")
      const firstIndex = lines.findIndex((line) => line.includes("FIRST-MESSAGE"))
      const secondIndex = lines.findIndex((line) => line.includes("SECOND-MESSAGE"))
      expect(firstIndex).toBeGreaterThanOrEqual(0)
      expect(secondIndex).toBe(firstIndex + 3)
    } finally {
      await destroy(screen)
    }
  })

  test("reduces streamed ACP prose to one concise update", async () => {
    const store = startedStore([task(1, "Whitespace fixture")])
    store.consume({ type: "session_update", taskId: "task_01", sessionId: "test-session", update: {
      sessionUpdate: "agent_message_chunk",
      messageId: "whitespace",
      content: { type: "text", text: `Implementation is complete.${"\n".repeat(8)}Changed files:\n- src/ui/App.tsx\n- tests/cockpit.test.tsx` },
    } })
    const screen = await render(store, 120, 40)

    try {
      const frame = screen.captureCharFrame()
      expect(frame).toContain("Implementation is complete.")
      expect(frame).not.toContain("Changed files")
      expect(frame).not.toContain("src/ui/App.tsx")
      expect(frame).not.toContain("tests/cockpit.test.tsx")
    } finally {
      await destroy(screen)
    }
  })

  test("keeps the columns directly below the header", async () => {
    const store = startedStore([task(1, "Adjacent columns")])
    const screen = await render(store, 120, 40)

    try {
      const lines = screen.captureCharFrame().split("\n")
      const separator = lines.findIndex((line) => line.includes("─".repeat(20)))
      expect(separator).toBeGreaterThanOrEqual(0)
      expect(lines[separator + 2]).toContain("┌")
      expect(lines[separator + 2]).toContain("┐")
      expect(screen.captureCharFrame()).not.toContain("╭")

      const panelBottom = lines.findIndex((line, index) => index > separator
        && (line.match(/└/gu)?.length ?? 0) >= 2
        && (line.match(/┘/gu)?.length ?? 0) >= 2)
      const footer = lines.findIndex((line) => line.includes("FOCUS TASKS"))
      expect(panelBottom).toBeGreaterThan(separator)
      expect(footer).toBe(panelBottom + 1)
    } finally {
      await destroy(screen)
    }
  })

  test("keeps the completion meter in the fixed header above the task scroller", async () => {
    const store = startedStore([
      task(1, "First task"),
      task(2, "Second task"),
      task(3, "Third task"),
    ])
    const screen = await render(store, 120, 40)

    try {
      const lines = screen.captureCharFrame().split("\n")
      const headerLine = lines.findIndex((line) => line.includes("TASKS 0/3"))
      const progressLine = lines.findIndex((line) => line.includes("░".repeat(10)))
      const firstTaskLine = lines.findIndex((line) => line.includes("> · task_01"))
      expect(headerLine).toBeGreaterThanOrEqual(0)
      expect(progressLine).toBe(headerLine + 1)
      expect(firstTaskLine).toBeGreaterThan(progressLine)
    } finally {
      await destroy(screen)
    }
  })

  test("selects only the matching task transcript and keeps manual inspection separate from active progress", async () => {
    const store = startedStore([task(1, "First"), task(2, "Second")])
    store.consume({ type: "task_status", taskId: "task_01", status: "in_progress" })
    store.consume({ type: "activity", taskId: "task_01", message: "ONLY-FIRST-HISTORY" })
    store.consume({ type: "activity", taskId: "task_02", message: "ONLY-SECOND-HISTORY" })
    const screen = await render(store, 120, 40)

    try {
      expect(screen.captureCharFrame()).toContain("ONLY-FIRST-HISTORY")
      expect(screen.captureCharFrame()).not.toContain("ONLY-SECOND-HISTORY")

      await press(screen, KeyCodes.ARROW_DOWN)
      expect(store.getSnapshot()).toMatchObject({ selectedTaskId: "task_02", followingActiveTask: false })
      expect(screen.captureCharFrame()).toContain("TRANSCRIPT · task_02 · INSPECTING HISTORY")
      expect(screen.captureCharFrame()).toContain("ONLY-SECOND-HISTORY")
      expect(screen.captureCharFrame()).not.toContain("ONLY-FIRST-HISTORY")

      await mutate(screen, () => {
        store.consume({ type: "task_status", taskId: "task_01", status: "completed" })
        store.consume({ type: "task_status", taskId: "task_02", status: "in_progress" })
      })
      expect(store.getSnapshot()).toMatchObject({ activeTaskId: "task_02", selectedTaskId: "task_02" })
    } finally {
      await destroy(screen)
    }
  })

  test("scrolls a long task navigator into view and maps j/k selection to the correct transcript", async () => {
    const tasks = Array.from({ length: 24 }, (_, index) => task(index + 1, `Task title ${index + 1}`))
    const store = startedStore(tasks)
    for (let index = 1; index <= tasks.length; index += 1) {
      store.consume({ type: "activity", taskId: taskId(index), message: `TRANSCRIPT-FOR-${taskId(index)}` })
    }
    const screen = await render(store, 80, 24)

    try {
      for (let index = 0; index < 20; index += 1) await press(screen, "j")
      const taskScroll = renderable<ScrollBoxRenderable>(screen, "task-scroll")
      expect(store.getSnapshot().selectedTaskId).toBe("task_21")
      expect(taskScroll.scrollTop).toBeGreaterThan(0)
      expect(screen.captureCharFrame()).toContain("task_21")
      expect(screen.captureCharFrame()).toContain("TRANSCRIPT-FOR-task_21")

      await press(screen, "k")
      expect(store.getSnapshot().selectedTaskId).toBe("task_20")
      expect(screen.captureCharFrame()).toContain("TRANSCRIPT-FOR-task_20")
    } finally {
      await destroy(screen)
    }
  })

  test("routes focus and supports transcript line, page, start, end, and sticky-tail scrolling", async () => {
    const store = startedStore([task(1, "Long transcript")])
    store.consume({ type: "task_status", taskId: "task_01", status: "in_progress" })
    for (let index = 0; index < 300; index += 1) {
      store.consume({ type: "activity", taskId: "task_01", message: `HISTORY-LINE-${String(index).padStart(3, "0")}` })
    }
    const screen = await render(store, 120, 40)

    try {
      const transcript = renderable<ScrollBoxRenderable>(screen, "transcript-scroll")
      expect(transcript.scrollTop).toBeGreaterThan(0)
      expect(screen.captureCharFrame()).toContain("HISTORY-LINE-299")

      await pressTab(screen)
      expect(store.getSnapshot().focusedPane).toBe("transcript")
      await press(screen, KeyCodes.HOME)
      expect(transcript.scrollTop).toBe(0)
      expect(screen.captureCharFrame()).toContain("HISTORY-LINE-000")

      await press(screen, KeyCodes.ARROW_DOWN)
      const afterLine = transcript.scrollTop
      expect(afterLine).toBeGreaterThan(0)
      await press(screen, "\u001b[6~")
      const afterPage = transcript.scrollTop
      expect(afterPage).toBeGreaterThan(afterLine)
      await press(screen, "\u001b[5~")
      expect(transcript.scrollTop).toBeLessThan(afterPage)

      await press(screen, KeyCodes.END)
      expect(screen.captureCharFrame()).toContain("HISTORY-LINE-299")
      await mutate(screen, () => store.consume({ type: "activity", taskId: "task_01", message: "LIVE-TAIL-300" }))
      expect(screen.captureCharFrame()).toContain("LIVE-TAIL-300")

      await press(screen, KeyCodes.HOME)
      await mutate(screen, () => store.consume({ type: "activity", taskId: "task_01", message: "OFFSCREEN-TAIL-301" }))
      expect(transcript.scrollTop).toBe(0)
      expect(screen.captureCharFrame()).not.toContain("OFFSCREEN-TAIL-301")

      await press(screen, KeyCodes.END)
      await mutate(screen, () => store.consume({ type: "activity", taskId: "task_01", message: "RESUMED-TAIL-302" }))
      expect(screen.captureCharFrame()).toContain("RESUMED-TAIL-302")

      await pressTab(screen, { shift: true })
      expect(store.getSnapshot().focusedPane).toBe("tasks")
    } finally {
      await destroy(screen)
    }
  })

  test("shows failed and blocked reasons through symbols, labels, summary, and transcript text", async () => {
    const store = startedStore([
      task(1, "Provider task"),
      task(2, "Dependent task", ["task_01"]),
    ])
    store.consume({ type: "task_status", taskId: "task_01", status: "failed" })
    store.consume({ type: "activity", taskId: "task_01", message: "Provider connection failed\nTransport detail" })
    store.consume({ type: "task_status", taskId: "task_02", status: "blocked" })
    const screen = await render(store, 120, 40)

    try {
      let frame = screen.captureCharFrame()
      expect(frame).toContain("✗ task_01")
      expect(frame).toContain("Provider connection failed")
      expect(frame).toContain("! task_02")
      expect(frame).toContain("Task failed")

      await press(screen, KeyCodes.ARROW_DOWN)
      frame = screen.captureCharFrame()
      expect(frame).toContain("TRANSCRIPT · task_02")
      expect(frame).toContain("Blocked because dependency")
      expect(frame).toContain("✗ Error")
    } finally {
      await destroy(screen)
    }
  })

  test("renders report-handoff recovery without describing verified implementation as failed", async () => {
    const store = startedStore([task(1, "Report handoff")])
    store.consume({ type: "task_status", taskId: "task_01", status: "blocked" })
    store.consume({
      type: "activity",
      taskId: "task_01",
      message: "final report handoff blocked: ACP turn aborted; rerun retries the report without rerunning implementation",
    })
    const screen = await render(store, 120, 40)

    try {
      const frame = screen.captureCharFrame()
      expect(frame).toContain("! task_01")
      expect(frame).toContain("final report handoff blocked")
      expect(frame).toContain("rerun retries the report")
      expect(frame).not.toContain("Task failed; see latest activity")
    } finally {
      await destroy(screen)
    }
  })

  test("renders a local checkpoint reference without implying review or remote delivery", async () => {
    const store = startedStore([task(1, "Created checkpoint")])
    const commit = "a".repeat(40)
    store.consume({ type: "task_status", taskId: "task_01", status: "completed" })
    store.consume({ type: "checkpoint", taskId: "task_01", state: "created", commit })
    store.consume({ type: "run_finished", ok: true, message: "1 task completed" })
    const screen = await render(store, 120, 40)

    try {
      const frame = screen.captureCharFrame()
      expect(frame).toContain("RUN.DELIVERY")
      expect(frame).toContain(`Local checkpoint created: ${commit}`)
      expect(frame).toContain("CHECKPOINT DELIVERY: 1 created · 0 blocked")
      expect(frame.toLowerCase()).not.toContain("reviewed")
      expect(frame.toLowerCase()).not.toContain("merged")
      expect(frame.toLowerCase()).not.toContain("push")
    } finally {
      await destroy(screen)
    }
  })

  test("renders checkpoint-blocked delivery as an unsuccessful plain-text outcome", async () => {
    const store = startedStore([task(1, "Blocked checkpoint")])
    store.consume({ type: "task_status", taskId: "task_01", status: "completed" })
    store.consume({
      type: "checkpoint",
      taskId: "task_01",
      state: "blocked",
      reason: "hook refused local commit; resolve Git state and rerun",
    })
    store.consume({ type: "run_finished", ok: false, message: "0 failed · 1 blocked" })
    const screen = await render(store, 120, 40)

    try {
      const frame = screen.captureCharFrame()
      expect(frame).toContain("Execution Complete: 0/1 delivered")
      expect(frame).toContain("checkpoint blocked")
      expect(frame).toContain("DELIVERY BLOCKED task_01")
      expect(frame).toContain("hook refused local commit; resolve Git state and rerun")
      expect(frame).toContain("CHECKPOINT DELIVERY: 0 created · 1 blocked")
      expect(frame).not.toContain("SUCCEEDED 1")
    } finally {
      await destroy(screen)
    }
  })

  test("shows a Compozy-style run status and failure summary after completion", async () => {
    const store = startedStore([
      task(1, "Provider task"),
      task(2, "Completed task"),
    ])
    store.consume({ type: "task_status", taskId: "task_01", status: "in_progress" })
    store.consume({ type: "task_status", taskId: "task_01", status: "failed" })
    store.consume({ type: "activity", taskId: "task_01", message: "Provider connection failed" })
    store.consume({ type: "task_status", taskId: "task_02", status: "completed" })
    store.consume({ type: "run_finished", ok: false, message: "1 failed · 0 blocked" })
    const screen = await render(store, 120, 40)

    try {
      const summary = screen.captureCharFrame()
      expect(summary).toContain("RUN.STATUS")
      expect(summary).toContain("Execution Complete: 1/2 succeeded, 1 failed")
      expect(summary).toContain("RUN.FAILURES")
      expect(summary).toContain("FAIL task_01")
      expect(summary).toContain("Provider connection failed")
      expect(summary).toContain("DISMISS")
      expect(summary).toContain("Resolve the listed error, then rerun the task packet.")
    } finally {
      await destroy(screen)
    }
  })

  test("renders a persistent typed no-work summary with plain-text reason, counts, and exit guidance", async () => {
    const store = startedStore([
      task(1, "Completed one", [], "completed"),
      task(2, "Completed two", [], "done"),
      task(3, "Completed three", [], "finished"),
    ])
    store.consume({
      type: "run_finished",
      ok: true,
      message: "No executable tasks: all tasks are already complete",
      outcome: "no_work",
      reason: "all_tasks_complete",
    })
    const screen = await testRender(<App store={store} onCancel={() => {}} onDismiss={() => {}} />, {
      width: 80,
      height: 24,
      exitOnCtrlC: false,
    })

    try {
      await screen.renderOnce()
      await act(async () => { await Promise.resolve() })
      await screen.renderOnce()
      let frame = screen.captureCharFrame()
      expect(frame).toContain("NO EXECUTABLE TASKS")
      expect(frame).toContain("All tasks are already complete")
      expect(frame).toContain("Tasks 3/3 complete")
      expect(frame).toContain("Q")
      expect(frame).toContain("CTRL+C")
      assertNoControls(frame)

      await pressEscape(screen)
      expect(screen.captureCharFrame()).toContain("NO EXECUTABLE TASKS")

      setRendererCapabilities(screen.renderer, { rgb: false, ansi256: false })
      await screen.renderOnce()
      frame = screen.captureCharFrame()
      expect(frame).toContain("NO EXECUTABLE TASKS")
      expect(frame).toContain("All tasks are already complete")
      expect(frame).toContain("Tasks 3/3 complete")
      expect(frame).toContain("CTRL+C")
      assertNoControls(frame)
    } finally {
      await destroy(screen)
    }
  })

  test("signals and cancels exactly once from both no-work exit keys", async () => {
    for (const key of ["q", "ctrl-c"] as const) {
      const store = startedStore([task(1, "Completed", [], "completed")])
      store.consume({
        type: "run_finished",
        ok: true,
        message: "No executable tasks: all tasks are already complete",
        outcome: "no_work",
        reason: "all_tasks_complete",
      })
      let cancelled = 0
      let exited = 0
      const screen = await testRender(
        <App
          store={store}
          onCancel={() => { cancelled += 1 }}
          onDismiss={() => {}}
          onExit={() => { exited += 1 }}
        />,
        { width: 80, height: 24, exitOnCtrlC: false },
      )

      try {
        await screen.renderOnce()
        await act(async () => { await Promise.resolve() })
        await screen.renderOnce()
        expect(screen.captureCharFrame()).toContain("NO EXECUTABLE TASKS")
        await act(async () => {
          if (key === "q") screen.mockInput.pressKey("q")
          else screen.mockInput.pressCtrlC()
          await Promise.resolve()
        })
        expect({ key, cancelled, exited }).toEqual({ key, cancelled: 1, exited: 1 })
        expect(screen.renderer.isDestroyed).toBeFalse()
      } finally {
        await destroy(screen)
      }
    }
  })

  test("dismisses a settled failure with Esc, q, or Ctrl+C without cancelling or destroying the renderer", async () => {
    for (const key of ["escape", "q", "ctrl-c"] as const) {
      const store = startedStore([task(1, "Failed task")])
      store.consume({ type: "task_status", taskId: "task_01", status: "failed" })
      store.consume({ type: "activity", taskId: "task_01", message: "Failure detail" })
      store.consume({ type: "run_finished", ok: false, message: "1 failed" })
      let cancelled = 0
      let dismissed = 0
      const screen = await testRender(
        <App
          store={store}
          onCancel={() => { cancelled += 1 }}
          onDismiss={() => { dismissed += 1 }}
        />,
        { width: 80, height: 24, exitOnCtrlC: false },
      )
      await screen.renderOnce()
      await act(async () => { await Promise.resolve() })
      await screen.renderOnce()
      expect(screen.captureCharFrame()).toContain("RUN.FAILURES")

      await act(async () => {
        if (key === "escape") screen.mockInput.pressEscape()
        else if (key === "q") screen.mockInput.pressKey("q")
        else screen.mockInput.pressCtrlC()
        if (key === "escape") await Bun.sleep(100)
        else await Promise.resolve()
      })

      expect({ key, dismissed }).toEqual({ key, dismissed: 1 })
      expect(cancelled).toBe(0)
      expect(screen.renderer.isDestroyed).toBeFalse()
      await destroy(screen)
    }
  })

  test("keeps complete multiline failure details scrollable and makes missing details explicit", async () => {
    const store = startedStore([task(1, "Long failure")])
    store.consume({ type: "task_status", taskId: "task_01", status: "failed" })
    store.consume({
      type: "activity",
      taskId: "task_01",
      message: Array.from({ length: 30 }, (_, index) => `DIAGNOSTIC-${String(index).padStart(2, "0")} complete detail`).join("\n"),
    })
    store.consume({ type: "run_finished", ok: false, message: "1 failed" })
    const screen = await render(store, 80, 24)
    try {
      const detailScroll = renderable<ScrollBoxRenderable>(screen, "failure-detail-scroll")
      expect(detailScroll.scrollHeight).toBeGreaterThan(detailScroll.height)
      expect(screen.captureCharFrame()).toContain("DIAGNOSTIC-00 complete detail")
      await press(screen, KeyCodes.END)
      expect(screen.captureCharFrame()).toContain("DIAGNOSTIC-29 complete detail")
      expect(screen.captureCharFrame()).toContain("Resolve the listed error, then rerun the task packet.")
    } finally {
      await destroy(screen)
    }

    const missingStore = startedStore([task(1, "Missing detail")])
    missingStore.consume({ type: "task_status", taskId: "task_01", status: "failed" })
    missingStore.consume({ type: "run_finished", ok: false, message: "1 failed" })
    const missingScreen = await render(missingStore, 80, 24)
    try {
      expect(missingScreen.captureCharFrame()).toContain("No surfaced task error was provided.")
    } finally {
      await destroy(missingScreen)
    }
  })

  test("renders every normalized ACP category with a readable symbol and label", async () => {
    const store = startedStore([task(1, "Category fixture")])
    const updates: SessionUpdate[] = [
      {
        sessionUpdate: "agent_message_chunk",
        messageId: "message",
        content: { type: "text", text: "Agent response" },
      },
      {
        sessionUpdate: "agent_thought_chunk",
        messageId: "thought",
        content: { type: "text", text: "Reasoning detail" },
      },
      {
        sessionUpdate: "plan",
        entries: [{ content: "Inspect source", priority: "high", status: "in_progress" }],
      },
      {
        sessionUpdate: "tool_call",
        toolCallId: "tool-main",
        title: "Read configuration",
        kind: "read",
        status: "completed",
      },
      {
        sessionUpdate: "tool_call_update",
        toolCallId: "tool-early",
        status: "in_progress",
        content: [{ type: "content", content: { type: "text", text: "Opening file" } }],
      },
      {
        sessionUpdate: "provider_status_update",
        detail: "Waiting for capacity",
      } as unknown as SessionUpdate,
    ]
    updates.forEach((update) => store.consume({ type: "session_update", taskId: "task_01", sessionId: "test-session", update }))
    store.consume({ type: "activity", taskId: "task_01", message: "Runtime activity" })
    const screen = await render(store, 120, 60)

    try {
      const frame = screen.captureCharFrame()
      expect(frame).toContain("● Agent")
      expect(frame).toContain("◇ Thought")
      expect(frame).toContain("≡ Plan")
      expect(frame).toContain("◆ Action · completed")
      expect(frame).toContain("↻ Action · in progress")
      expect(frame).toContain("Reading project context")
      expect(frame).toContain("· Activity")
      expect(frame).toContain("? Provider status update")
      expect(frame).toContain("Waiting for capacity")
      expect(frame).not.toContain("Read configuration")
      expect(frame).not.toContain("tool-early")
    } finally {
      await destroy(screen)
    }
  })

  test("renders only concise action status without command or file details", async () => {
    const store = startedStore([task(1, "Terminal output")])
    store.consume({ type: "session_update", taskId: "task_01", sessionId: "test-session", update: {
      sessionUpdate: "tool_call",
      toolCallId: "exec-1",
      title: "rtk cat package.json",
      kind: "execute",
      status: "completed",
      content: [{ type: "terminal", terminalId: "exec-1" }],
      rawInput: {
        command: "rtk cat package.json",
        cwd: "/workspace/spec-finder",
      },
      rawOutput: {
        exit_code: 0,
        formatted_output: '{\n  "name": "spec-finder"\n}',
      },
    } })
    const screen = await render(store, 160, 40)

    try {
      const frame = screen.captureCharFrame()
      expect(frame).toContain("◆ Action · completed")
      expect(frame).toContain("Reading project context")
      expect(frame).not.toContain("rtk cat package.json")
      expect(frame).not.toContain("Working directory")
      expect(frame).not.toContain("Exit code")
      expect(frame).not.toContain('"name": "spec-finder"')
      expect(frame).not.toContain("formatted_output")
      expect(frame).not.toContain("\\n")
    } finally {
      await destroy(screen)
    }
  })

  test("renders compact fallback and reduced-color semantics without permission or workflow controls", async () => {
    const store = startedStore([task(1, "Read-only task")])
    store.consume({ type: "task_status", taskId: "task_01", status: "failed" })
    store.consume({ type: "activity", taskId: "task_01", message: "Visible failure reason" })
    let responded = false
    store.consume({
      type: "permission_requested",
      request: {
        sessionId: "session",
        toolCall: { toolCallId: "tool", title: "Write protected file", status: "pending" },
        options: [{ optionId: "allow", name: "Allow once", kind: "allow_once" }],
      },
      respond: () => {
        responded = true
      },
    })
    const compactScreen = await render(store, 70, 20)
    try {
      const frame = compactScreen.captureCharFrame()
      expect(frame).toContain("SPEC FINDER · demo")
      expect(frame).toContain("task_01")
      expect(frame).toContain("✗ task_01")
      expect(frame).toContain("frontend · unavailable")
      assertNoControls(frame)
      expect(responded).toBeFalse()
    } finally {
      await destroy(compactScreen)
    }

    const reducedScreen = await testRender(<App store={store} onCancel={() => {}} onDismiss={() => {}} />, { width: 80, height: 24, exitOnCtrlC: false })
    try {
      setRendererCapabilities(reducedScreen.renderer, { rgb: false, ansi256: false })
      await reducedScreen.renderOnce()
      const frame = reducedScreen.captureCharFrame()
      expect(frame).toContain("✗ task_01")
      expect(frame).toContain("frontend · unavailable")
      expect(frame).toContain("Visible failure reason")
      expect(reducedScreen.captureSpans().cols).toBe(80)
      assertNoControls(frame)
    } finally {
      await destroy(reducedScreen)
    }
  })

  test("toggles contextual help and preserves q and Ctrl+C as the only terminal escape hatches", async () => {
    const store = startedStore([task(1, "Demo")])
    const screen = await render(store, 120, 40)
    try {
      await press(screen, "?")
      const help = screen.captureCharFrame()
      expect(store.getSnapshot().helpOpen).toBeTrue()
      expect(help).toContain("READ-ONLY COCKPIT HELP")
      expect(help).toContain("Shift+Tab")
      expect(help).toContain("PageUp / PageDown")
      expect(help).toContain("View only")
      expect(help).toContain("observation, not an automatic stall verdict")
      assertNoControls(help)

      await press(screen, "?")
      expect(store.getSnapshot().helpOpen).toBeFalse()
      expect(screen.captureCharFrame()).not.toContain("READ-ONLY COCKPIT HELP")
    } finally {
      await destroy(screen)
    }

    for (const key of ["q", "ctrl-c"] as const) {
      let cancelled = 0
      const exitScreen = await testRender(<App store={store} onCancel={() => { cancelled += 1 }} onDismiss={() => {}} />, { width: 80, height: 24, exitOnCtrlC: false })
      await exitScreen.renderOnce()
      await act(async () => {
        if (key === "q") exitScreen.mockInput.pressKey("q")
        else exitScreen.mockInput.pressCtrlC()
        await Promise.resolve()
      })
      expect(cancelled).toBe(1)
      expect(exitScreen.renderer.isDestroyed).toBeFalse()
      await destroy(exitScreen)
    }
  })
})

describe("cockpit session lifecycle", () => {
  test("resolves dismissal and closes the renderer idempotently", async () => {
    let closeCalls = 0
    const session = createCockpitSessionController(() => { closeCalls += 1 })
    let dismissed = false
    const waiting = session.waitForDismissal().then(() => { dismissed = true })

    await Promise.resolve()
    expect(dismissed).toBeFalse()
    session.dismiss()
    session.dismiss()
    await waiting
    expect(dismissed).toBeTrue()

    session.close()
    session.close()
    expect(closeCalls).toBe(1)
  })

  test("resolves the one-shot exit wait idempotently", async () => {
    const session = createCockpitSessionController(() => undefined)
    let exited = false
    const waiting = session.waitForExit().then(() => { exited = true })

    await Promise.resolve()
    expect(exited).toBeFalse()
    session.signalExit()
    session.signalExit()
    await waiting
    expect(exited).toBeTrue()
  })

  test("close releases a pending dismissal wait", async () => {
    const session = createCockpitSessionController(() => undefined)
    const waiting = session.waitForDismissal()
    const exit = session.waitForExit()
    session.close()
    await expect(waiting).resolves.toBeUndefined()
    await expect(exit).resolves.toBeUndefined()
  })
})

function startedStore(
  tasks: TaskFile[],
  config: SpecFinderConfig = DEFAULT_CONFIG,
  now?: () => number,
): CockpitStore {
  const store = new CockpitStore(now)
  store.consume({ type: "run_started", slug: "demo", config, tasks })
  return store
}

function startedBatchStore(
  slugs: string[],
  activeIndex: number,
  tasks: TaskFile[],
  config: SpecFinderConfig = DEFAULT_CONFIG,
  packetTasks: readonly (readonly TaskFile[])[] = [],
): CockpitStore {
  const store = new CockpitStore()
  store.consume({
    type: "batch_started",
    slugs,
    total: slugs.length,
    config,
    packets: slugs.map((slug, index) => ({
      slug,
      index,
      outcome: "not_started",
      tasks: packetTasks[index] ?? (index === activeIndex ? tasks : []),
    })),
  })
  const slug = slugs[activeIndex]
  if (slug === undefined) throw new Error(`missing batch slug at index ${activeIndex}`)
  store.consume({ type: "batch_packet_started", slug, index: activeIndex, total: slugs.length, config, tasks })
  return store
}

function task(
  number: number,
  title: string,
  dependencies: string[] = [],
  status: TaskStatus = "pending",
): TaskFile {
  const id = taskId(number)
  return {
    id,
    number,
    path: `/tmp/${id}.md`,
    body: `# Task ${number}: ${title}`,
    source: "",
    frontmatter: { status, title, type: "frontend", complexity: "medium", dependencies },
  }
}

function taskId(number: number): string {
  return `task_${String(number).padStart(2, "0")}`
}

async function render(store: CockpitStore, width: number, height: number): Promise<TestScreen> {
  const screen = await testRender(<App store={store} onCancel={() => {}} onDismiss={() => {}} />, { width, height, exitOnCtrlC: false })
  await screen.renderOnce()
  return screen
}

async function mutate(screen: TestScreen, update: () => void): Promise<void> {
  await act(async () => {
    update()
    await Promise.resolve()
  })
  await screen.renderOnce()
}

async function press(
  screen: TestScreen,
  key: Parameters<TestScreen["mockInput"]["pressKey"]>[0],
  modifiers?: Parameters<TestScreen["mockInput"]["pressKey"]>[1],
): Promise<void> {
  await act(async () => {
    screen.mockInput.pressKey(key, modifiers)
    await Promise.resolve()
  })
  await screen.renderOnce()
}

async function pressTab(
  screen: TestScreen,
  modifiers?: Parameters<TestScreen["mockInput"]["pressTab"]>[0],
): Promise<void> {
  await act(async () => {
    screen.mockInput.pressTab(modifiers)
    await Promise.resolve()
  })
  await screen.renderOnce()
}

async function pressEscape(screen: TestScreen): Promise<void> {
  await act(async () => {
    screen.mockInput.pressEscape()
    await new Promise((resolve) => setTimeout(resolve, 100))
  })
  await screen.renderOnce()
}

function renderable<T>(screen: TestScreen, id: string): T {
  const value = screen.renderer.root.findDescendantById(id)
  if (!value) throw new Error(`missing renderable ${id}`)
  return value as T
}

async function destroy(screen: TestScreen): Promise<void> {
  if (screen.renderer.isDestroyed) return
  await act(async () => screen.renderer.destroy())
}

function assertNoControls(frame: string): void {
  expect(frame).not.toContain("PERMISSION REQUIRED")
  expect(frame).not.toContain("Allow once")
  expect(frame).not.toContain("Enter confirm")
  expect(frame).not.toContain("Retry task")
  expect(frame).not.toContain("Edit task")
  expect(frame).not.toContain("Reorder task")
}
