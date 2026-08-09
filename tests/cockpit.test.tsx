import { describe, expect, test } from "bun:test"
import type { SessionUpdate } from "@agentclientprotocol/sdk"
import type { ScrollBoxRenderable } from "@opentui/core"
import { KeyCodes, setRendererCapabilities } from "@opentui/core/testing"
import { testRender } from "@opentui/react/test-utils"
import { act } from "react"
import { DEFAULT_CONFIG, type SpecFinderConfig } from "../src/config.ts"
import type { TaskFile, TaskStatus } from "../src/tasks.ts"
import { App, taskElapsedText, type TaskTiming } from "../src/ui/App.tsx"
import { CockpitStore } from "../src/ui/store.ts"

type TestScreen = Awaited<ReturnType<typeof testRender>>

describe("read-only progress cockpit", () => {
  test("renders honest timer placeholders and observed durations", () => {
    const store = startedStore([
      task(1, "Pending"),
      task(2, "Blocked", [], "blocked"),
      task(3, "Running", [], "in_progress"),
      task(4, "Completed", [], "completed"),
      task(5, "Observed complete", [], "completed"),
    ])
    const tasks = store.getSnapshot().tasks
    const timings = new Map<string, TaskTiming>([
      ["task_03", { startedAt: 1_000 }],
      ["task_05", { startedAt: 1_000, elapsedMs: 2_500 }],
    ])

    expect(taskElapsedText(tasks[0]!, timings, 5_000)).toBe("—")
    expect(taskElapsedText(tasks[1]!, timings, 5_000)).toBe("—")
    expect(taskElapsedText(tasks[2]!, timings, 3_500)).toBe("00:02")
    expect(taskElapsedText(tasks[3]!, timings, 5_000)).toBe("unavailable")
    expect(taskElapsedText(tasks[4]!, timings, 5_000)).toBe("00:02")
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
      expect(frame).toContain("BATCH SEQUENCE")
      expect(frame).toContain("POSITION 2/3")
      expect(frame).toContain("ACTIVE PACKET: beta")
      expect(frame).toContain("alpha")
      expect(frame).toContain("succeeded")
      expect(frame).toContain("already complete")
      expect(frame).toContain("beta")
      expect(frame).toContain("running")
      expect(frame).toContain("gamma")
      expect(frame).toContain("not_started")
      expect(frame).toContain("TRANSCRIPT · task_01 · FOLLOWING ACTIVE")
      expect(frame).toContain("ACTIVE-BETA-TRANSCRIPT")
    } finally {
      await destroy(screen)
    }
  })

  test("makes a failed stopping packet and manual no-retry guidance explicit", async () => {
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
      expect(summary).toContain("no automatic retry")
      expect(summary).toContain("rerun manually")

      await pressEscape(screen)
      const live = screen.captureCharFrame()
      expect(live).toContain("ACTIVE PACKET: beta")
      expect(live).toContain("TRANSCRIPT · task_01 · INSPECTING HISTORY")
      expect(live).toContain("Beta provider failed")
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

    const screen = await testRender(<App store={store} onCancel={() => {}} />, { width: 70, height: 20 })
    try {
      setRendererCapabilities(screen.renderer, { rgb: false, ansi256: false })
      await screen.renderOnce()
      const frame = screen.captureCharFrame()
      expect(frame).toContain("CANCELLED")
      expect(frame).toContain("⊘")
      expect(frame).toContain("cancelled")
      expect(frame).toContain("not_started")
      expect(frame).toContain("no automatic retry")
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
    const store = startedBatchStore(slugs, activeIndex, [task(1, "Inspectable final task")])
    store.consume({ type: "task_status", taskId: `${activeSlug}/task_01`, status: "in_progress" })
    store.consume({ type: "activity", taskId: `${activeSlug}/task_01`, message: "RETAINED-FINAL-TRANSCRIPT" })
    store.consume({ type: "task_status", taskId: `${activeSlug}/task_01`, status: "completed" })

    const screen = await render(store, 80, 24)
    try {
      let frame = screen.captureCharFrame()
      expect(frame).toContain("BATCH 30 PACKETS")
      expect(frame).toContain(activeSlug)
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

  test("hides completed rows and selects the first unfinished task when reopening", async () => {
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

  test("keeps transcript entries compact without blank rows between messages", async () => {
    const store = startedStore([task(1, "Compact transcript")])
    store.consume({ type: "activity", taskId: "task_01", message: "FIRST-MESSAGE" })
    store.consume({ type: "activity", taskId: "task_01", message: "SECOND-MESSAGE" })
    const screen = await render(store, 120, 40)

    try {
      const lines = screen.captureCharFrame().split("\n")
      const firstIndex = lines.findIndex((line) => line.includes("FIRST-MESSAGE"))
      const secondIndex = lines.findIndex((line) => line.includes("SECOND-MESSAGE"))
      expect(firstIndex).toBeGreaterThanOrEqual(0)
      expect(secondIndex).toBe(firstIndex + 2)
    } finally {
      await destroy(screen)
    }
  })

  test("collapses repeated blank lines from streamed ACP text", async () => {
    const store = startedStore([task(1, "Whitespace fixture")])
    store.consume({ type: "session_update", taskId: "task_01", sessionId: "test-session", update: {
      sessionUpdate: "agent_message_chunk",
      messageId: "whitespace",
      content: { type: "text", text: `before${"\n".repeat(8)}after` },
    } })
    const screen = await render(store, 120, 40)

    try {
      const lines = screen.captureCharFrame().split("\n")
      const beforeIndex = lines.findIndex((line) => line.includes("before"))
      const afterIndex = lines.findIndex((line) => line.includes("after"))
      expect(beforeIndex).toBeGreaterThanOrEqual(0)
      expect(afterIndex).toBe(beforeIndex + 2)
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
      expect(summary).toContain("[ESC] BACK")

      await pressEscape(screen)
      expect(screen.captureCharFrame()).toContain("TRANSCRIPT · task_01")
    } finally {
      await destroy(screen)
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
      expect(frame).toContain("◆ Tool · Read configuration · completed")
      expect(frame).toContain("↻ Tool update · tool-early · in progress")
      expect(frame).toContain("· Activity")
      expect(frame).toContain("? Provider status update")
    } finally {
      await destroy(screen)
    }
  })

  test("renders executed command results without escaped ACP payload fields", async () => {
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
      expect(frame).toContain("◆ Tool · rtk cat package.json · completed")
      expect(frame).toContain("Working directory: /workspace/spec-finder")
      expect(frame).toContain("Exit code: 0")
      expect(frame).toContain('"name": "spec-finder"')
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
      assertNoControls(frame)
      expect(responded).toBeFalse()
    } finally {
      await destroy(compactScreen)
    }

    const reducedScreen = await testRender(<App store={store} onCancel={() => {}} />, { width: 80, height: 24 })
    try {
      setRendererCapabilities(reducedScreen.renderer, { rgb: false, ansi256: false })
      await reducedScreen.renderOnce()
      const frame = reducedScreen.captureCharFrame()
      expect(frame).toContain("✗ task_01")
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
      assertNoControls(help)

      await press(screen, "?")
      expect(store.getSnapshot().helpOpen).toBeFalse()
      expect(screen.captureCharFrame()).not.toContain("READ-ONLY COCKPIT HELP")
    } finally {
      await destroy(screen)
    }

    for (const key of ["q", "ctrl-c"] as const) {
      let cancelled = 0
      const exitScreen = await testRender(<App store={store} onCancel={() => { cancelled += 1 }} />, { width: 80, height: 24 })
      await exitScreen.renderOnce()
      await act(async () => {
        if (key === "q") exitScreen.mockInput.pressKey("q")
        else exitScreen.mockInput.pressCtrlC()
        await Promise.resolve()
      })
      expect(cancelled).toBe(1)
      expect(exitScreen.renderer.isDestroyed).toBeTrue()
    }
  })
})

function startedStore(tasks: TaskFile[], config: SpecFinderConfig = DEFAULT_CONFIG): CockpitStore {
  const store = new CockpitStore()
  store.consume({ type: "run_started", slug: "demo", config, tasks })
  return store
}

function startedBatchStore(
  slugs: string[],
  activeIndex: number,
  tasks: TaskFile[],
  config: SpecFinderConfig = DEFAULT_CONFIG,
): CockpitStore {
  const store = new CockpitStore()
  store.consume({ type: "batch_started", slugs, total: slugs.length, config })
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
  const screen = await testRender(<App store={store} onCancel={() => {}} />, { width, height })
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
