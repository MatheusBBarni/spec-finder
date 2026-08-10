import { describe, expect, test } from "bun:test"
import type { SessionUpdate } from "@agentclientprotocol/sdk"
import { DEFAULT_CONFIG } from "../src/config.ts"
import type { TaskFile, TaskStatus } from "../src/tasks.ts"
import {
  CockpitStore,
  selectPacketTaskView,
  selectSelectedTask,
  selectSelectedTranscript,
  selectTaskCheckpoint,
  selectTaskFailureDetail,
  selectTaskReason,
  selectTaskTranscript,
  selectUnfinishedTasks,
  selectVisibleTasks,
} from "../src/ui/store.ts"

describe("cockpit store", () => {
  test("initializes task-scoped state and follows the first active task", () => {
    const store = startedStore([
      task(1, "Inspect packet"),
      task(2, "Implement cockpit", ["task_01.md"]),
    ])
    const initialized = store.getSnapshot()

    expect(initialized.activeTaskId).toBeNull()
    expect(initialized.selectedTaskId).toBe("task_01")
    expect(initialized.followingActiveTask).toBeTrue()
    expect(initialized.focusedPane).toBe("tasks")
    expect(initialized.helpOpen).toBeFalse()
    expect(Object.keys(initialized.transcripts)).toEqual(["task_01", "task_02"])
    expect(initialized.transcripts.task_01).toEqual([])
    expect(initialized.tasks[1]?.dependencies).toEqual(["task_01"])

    store.consume({ type: "task_status", taskId: "task_01", status: "in_progress" })
    expect(store.getSnapshot()).toMatchObject({
      activeTaskId: "task_01",
      selectedTaskId: "task_01",
      followingActiveTask: true,
    })
    expect(selectSelectedTask(store.getSnapshot())?.id).toBe("task_01")
  })

  test("hides tasks completed before opening and retains tasks completed during the session", () => {
    const store = startedStore([
      task(1, "Previously completed", [], "completed"),
      task(2, "Also complete", [], "done"),
      task(3, "First remaining"),
      task(4, "Second remaining"),
    ])

    expect(store.getSnapshot().tasks).toHaveLength(4)
    expect(store.getSnapshot().selectedTaskId).toBe("task_03")
    expect(selectVisibleTasks(store.getSnapshot()).map((task) => task.id)).toEqual(["task_03", "task_04"])

    store.moveTask(1)
    expect(store.getSnapshot().selectedTaskId).toBe("task_04")
    store.moveTask(-1)
    expect(store.getSnapshot().selectedTaskId).toBe("task_03")

    store.consume({ type: "task_status", taskId: "task_03", status: "completed" })
    expect(store.getSnapshot()).toMatchObject({ selectedTaskId: "task_03", followingActiveTask: false })
    expect(selectUnfinishedTasks(store.getSnapshot()).map((task) => task.id)).toEqual(["task_04"])
    expect(selectVisibleTasks(store.getSnapshot()).map((task) => task.id)).toEqual(["task_03", "task_04"])

    store.moveTask(1)
    expect(store.getSnapshot().selectedTaskId).toBe("task_04")
    store.moveTask(-1)
    expect(store.getSnapshot().selectedTaskId).toBe("task_03")

    const reopenedStore = startedStore([
      task(1, "Previously completed", [], "completed"),
      task(2, "Also complete", [], "done"),
      task(3, "Completed this session", [], "completed"),
      task(4, "Second remaining"),
    ])
    expect(reopenedStore.getSnapshot().selectedTaskId).toBe("task_04")
    expect(selectVisibleTasks(reopenedStore.getSnapshot()).map((task) => task.id)).toEqual(["task_04"])
  })

  test("keeps manual inspection separate when execution advances", () => {
    const store = startedStore([task(1, "First"), task(2, "Second"), task(3, "Third")])
    store.consume({ type: "task_status", taskId: "task_01", status: "in_progress" })
    store.selectTask("task_03")

    expect(store.getSnapshot()).toMatchObject({
      activeTaskId: "task_01",
      selectedTaskId: "task_03",
      followingActiveTask: false,
    })

    store.consume({ type: "task_status", taskId: "task_01", status: "completed" })
    store.consume({ type: "task_status", taskId: "task_02", status: "in_progress" })
    expect(store.getSnapshot()).toMatchObject({
      activeTaskId: "task_02",
      selectedTaskId: "task_03",
      followingActiveTask: false,
    })

    store.selectTask("task_02")
    expect(store.getSnapshot()).toMatchObject({ selectedTaskId: "task_02", followingActiveTask: true })
  })

  test("retains only safe completed report references and appends labelled outcome detail", () => {
    const store = startedStore([task(1, "Report task")])
    const initial = store.getSnapshot()
    const reference = ".spec-finder/tasks/demo/reports/task_01.md"

    store.consume({ type: "task_status", taskId: "task_01", status: "completed", reportReference: reference })

    expect(initial.tasks[0]?.reportReference).toBeUndefined()
    expect(initial.transcripts.task_01).toEqual([])
    expect(store.getSnapshot().tasks[0]).toMatchObject({ status: "completed", reportReference: reference })
    expect(selectTaskTranscript(store.getSnapshot(), "task_01").map((entry) => entry.text)).toEqual([
      "Task completed",
      `Report: ${reference}`,
    ])
  })

  test("omits malformed or non-completed report references without changing lifecycle semantics", () => {
    const invalidReferences = [
      "",
      " /reports/task_01.md",
      "/reports/task_01.md",
      "../reports/task_01.md",
      "reports/../task_01.md",
      "reports//task_01.md",
      "reports/./task_01.md",
      "C:\\reports\\task_01.md",
      "C:reports/task_01.md",
      "\\\\server\\share\\task_01.md",
      "reports/task_01\n.md",
      "reports\\task_01.md",
    ]

    for (const reportReference of invalidReferences) {
      const store = startedStore([task(1, "Report task")])
      store.consume({ type: "task_status", taskId: "task_01", status: "completed", reportReference })
      const state = store.getSnapshot()
      expect(state.tasks[0]?.reportReference).toBeUndefined()
      expect(selectTaskTranscript(state, "task_01").map((entry) => entry.text)).toEqual(["Task completed"])
    }

    for (const status of ["failed", "blocked"] as const) {
      const store = startedStore([task(1, "Report task")])
      store.consume({ type: "task_status", taskId: "task_01", status, reportReference: "reports/task_01.md" })
      const state = store.getSnapshot()
      expect(state.tasks[0]).toMatchObject({ status })
      expect(state.tasks[0]?.reportReference).toBeUndefined()
      expect(selectTaskTranscript(state, "task_01").map((entry) => entry.text)).not.toContain("Report: reports/task_01.md")
    }
  })

  test("keeps task activity and streamed session updates isolated", () => {
    const store = startedStore([task(1, "First"), task(2, "Second")])
    store.consume({ type: "activity", taskId: "task_01", message: "Inspecting task one" })
    store.consume({
      type: "session_update",
      taskId: "task_01",
      sessionId: "reused-session",
      phase: "implementation",
      update: message("phase-message", "Implementation"),
    })
    store.consume({
      type: "session_update",
      taskId: "task_01",
      sessionId: "reused-session",
      phase: "implementation",
      update: message("phase-message", " output"),
    })
    store.consume({
      type: "session_update",
      taskId: "task_01",
      sessionId: "reused-session",
      phase: "report",
      update: message("phase-message", "Report output"),
    })
    store.consume({ type: "session_update", taskId: "task_02", sessionId: "test-session", update: message("message-2", "Task two") })
    store.consume({ type: "session_update", taskId: "task_02", sessionId: "test-session", update: message("message-2", " output") })
    store.consume({ type: "activity", taskId: "task_02", message: "Finished task two fixture" })

    expect(selectTaskTranscript(store.getSnapshot(), "task_01").map((entry) => entry.text)).toEqual([
      "Inspecting task one",
      "Implementation output",
      "Report output",
    ])
    expect(selectTaskTranscript(store.getSnapshot(), "task_02").map((entry) => entry.text)).toEqual([
      "Task two output",
      "Finished task two fixture",
    ])
    expect(selectTaskTranscript(store.getSnapshot(), "missing")).toEqual([])
  })

  test("retains immutable task history beyond the old 250-entry cap", () => {
    const store = startedStore([task(1, "Long task")])
    store.consume({ type: "activity", taskId: "task_01", message: "Activity 0" })
    const earlySnapshot = store.getSnapshot()

    for (let index = 1; index < 300; index += 1) {
      store.consume({ type: "activity", taskId: "task_01", message: `Activity ${index}` })
    }

    const history = selectTaskTranscript(store.getSnapshot(), "task_01")
    expect(history).toHaveLength(300)
    expect(history[0]?.text).toBe("Activity 0")
    expect(history.at(-1)?.text).toBe("Activity 299")
    expect(earlySnapshot.transcripts.task_01).toHaveLength(1)
  })

  test("upgrades failed reasons and explains failed dependencies", () => {
    const store = startedStore([
      task(1, "Dependency"),
      task(2, "Dependent", ["task_01"]),
    ])

    store.consume({ type: "task_status", taskId: "task_01", status: "failed" })
    expect(selectTaskReason(store.getSnapshot(), "task_01")).toBe("Task failed; see latest activity")

    store.consume({
      type: "activity",
      taskId: "task_01",
      message: "Provider connection failed\nAdditional transport detail",
    })
    expect(selectTaskReason(store.getSnapshot(), "task_01")).toBe("Provider connection failed")
    expect(selectTaskFailureDetail(store.getSnapshot(), "task_01")).toBe(
      "Provider connection failed\nAdditional transport detail",
    )
    expect(selectTaskTranscript(store.getSnapshot(), "task_01").map((entry) => entry.kind)).toEqual([
      "error",
      "error",
      "error",
    ])

    store.consume({ type: "task_status", taskId: "task_02", status: "blocked" })
    expect(selectTaskReason(store.getSnapshot(), "task_02")).toBe("Blocked because dependency task_01 failed")
    expect(selectTaskTranscript(store.getSnapshot(), "task_02").at(-1)).toMatchObject({
      kind: "error",
      text: "Blocked because dependency task_01 failed",
    })
  })

  test("keeps the exact failure detail separate from the safe compact reason", () => {
    const store = startedStore([task(1, "Report failure")])
    const unsafeActivity = "final report failed at /Users/alice/spec-finder/reports/task_01.md\u001B[31m\nadditional detail"
    store.consume({ type: "task_status", taskId: "task_01", status: "failed" })
    const beforeActivity = store.getSnapshot()
    store.consume({ type: "activity", taskId: "task_01", message: unsafeActivity })

    const state = store.getSnapshot()
    const reason = selectTaskReason(state, "task_01")
    const detail = selectTaskFailureDetail(state, "task_01")
    const transcript = selectTaskTranscript(state, "task_01").map((entry) => entry.text).join("\n")

    expect(reason).toContain("[path redacted]")
    expect(detail).toBe(unsafeActivity)
    expect(beforeActivity.taskFailureDetails).toEqual({})
    expect(state.taskFailureDetails).not.toBe(beforeActivity.taskFailureDetails)
    expect(transcript).not.toContain("/Users/alice/spec-finder")
    expect(transcript).not.toContain("\u001B")
    expect(state.tasks[0]?.status).toBe("failed")
  })

  test("leaves missing failure activity explicit and does not synthesize detail", () => {
    const store = startedStore([task(1, "Missing detail")])
    store.consume({ type: "task_status", taskId: "task_01", status: "failed" })
    store.consume({ type: "run_finished", ok: false, message: "1 failed · 0 blocked" })

    expect(selectTaskFailureDetail(store.getSnapshot(), "task_01")).toBeUndefined()
    expect(store.getSnapshot().taskFailureDetails).toEqual({})
    expect(selectTaskReason(store.getSnapshot(), "task_01")).toBe("Task failed; see latest activity")
  })

  test("captures failure activity only for failed tasks and clears it on lifecycle resets", () => {
    const store = startedStore([task(1, "Retryable")])
    store.consume({ type: "task_status", taskId: "task_01", status: "failed" })
    expect(selectTaskFailureDetail(store.getSnapshot(), "task_01")).toBeUndefined()
    store.consume({
      type: "activity",
      taskId: "task_01",
      message: "  First line\nSecond line  ",
    })
    expect(selectTaskFailureDetail(store.getSnapshot(), "task_01")).toBe("First line\nSecond line")

    store.consume({ type: "task_status", taskId: "task_01", status: "completed" })
    expect(selectTaskFailureDetail(store.getSnapshot(), "task_01")).toBeUndefined()

    store.consume({ type: "task_status", taskId: "task_01", status: "blocked" })
    store.consume({
      type: "activity",
      taskId: "task_01",
      message: "final report handoff blocked: provider detail",
    })
    expect(selectTaskFailureDetail(store.getSnapshot(), "task_01")).toBeUndefined()

    store.consume({ type: "task_status", taskId: "task_01", status: "failed" })
    store.consume({ type: "activity", taskId: "task_01", message: "Later failure" })
    store.consume({ type: "task_status", taskId: "task_01", status: "in_progress" })
    expect(selectTaskFailureDetail(store.getSnapshot(), "task_01")).toBeUndefined()

    store.consume({ type: "run_started", slug: "next", config: DEFAULT_CONFIG, tasks: [task(1, "Fresh task")] })
    expect(selectTaskFailureDetail(store.getSnapshot(), "task_01")).toBeUndefined()
  })

  test("clears stale detail when a batch packet starts again", () => {
    const store = new CockpitStore()
    store.consume({ type: "batch_started", slugs: ["alpha"] })
    store.consume({
      type: "batch_packet_started",
      slug: "alpha",
      index: 0,
      total: 1,
      tasks: [task(1, "Retryable packet task")],
    })
    store.consume({ type: "task_status", taskId: "alpha/task_01", status: "failed" })
    store.consume({ type: "activity", taskId: "alpha/task_01", message: "stale packet detail" })
    expect(selectTaskFailureDetail(store.getSnapshot(), "task_01")).toBe("stale packet detail")

    store.consume({
      type: "batch_packet_started",
      slug: "alpha",
      index: 0,
      total: 1,
      tasks: [task(1, "Retryable packet task")],
    })
    expect(selectTaskFailureDetail(store.getSnapshot(), "task_01")).toBeUndefined()
  })

  test("surfaces an explicit report-handoff reason for a blocked task", () => {
    const store = startedStore([task(1, "Report handoff")])
    store.consume({ type: "task_status", taskId: "task_01", status: "blocked" })
    store.consume({
      type: "activity",
      taskId: "task_01",
      message: "final report handoff blocked: ACP turn aborted; rerun retries the report without rerunning implementation",
    })

    expect(selectTaskReason(store.getSnapshot(), "task_01")).toBe(
      "final report handoff blocked: ACP turn aborted; rerun retries the report without rerunning implementation",
    )
    expect(selectTaskTranscript(store.getSnapshot(), "task_01").at(-1)).toMatchObject({
      kind: "error",
      text: "final report handoff blocked: ACP turn aborted; rerun retries the report without rerunning implementation",
    })
  })

  test("projects checkpoint delivery independently from lifecycle status", () => {
    const store = startedStore([
      task(1, "Created checkpoint", [], "completed"),
      task(2, "Blocked delivery"),
      task(3, "Still running"),
    ])
    const commit = "a".repeat(40)

    store.consume({ type: "checkpoint", taskId: "task_01", state: "created", commit })
    store.consume({ type: "task_status", taskId: "task_02", status: "completed" })
    store.consume({
      type: "checkpoint",
      taskId: "task_02",
      state: "blocked",
      reason: "hook refused local commit",
    })
    store.consume({ type: "task_status", taskId: "task_03", status: "in_progress" })

    const state = store.getSnapshot()
    expect(state.tasks[0]).toMatchObject({
      status: "completed",
      checkpoint: { state: "created", commit },
    })
    expect(state.tasks[1]).toMatchObject({
      status: "completed",
      checkpoint: { state: "blocked", reason: "hook refused local commit" },
    })
    expect(selectTaskCheckpoint(state, "task_01")).toEqual({ state: "created", commit })
    expect(selectTaskReason(state, "task_02")).toBe("hook refused local commit")
    expect(selectTaskFailureDetail(state, "task_02")).toBe("hook refused local commit")
    expect(selectTaskTranscript(state, "task_02").at(-1)).toMatchObject({
      kind: "error",
      text: "Checkpoint blocked: hook refused local commit",
    })
    expect(state.tasks.map((candidate) => candidate.status)).toEqual(["completed", "completed", "in_progress"])
    expect(selectVisibleTasks(state).map((candidate) => candidate.id)).toEqual(["task_02", "task_03"])
  })

  test("bounds checkpoint-blocked reasons while keeping mixed navigation truthful", () => {
    const store = startedStore([
      task(1, "Completed"),
      task(2, "Blocked delivery"),
      task(3, "Pending"),
    ])
    store.consume({ type: "task_status", taskId: "task_01", status: "completed" })
    store.consume({ type: "task_status", taskId: "task_02", status: "completed" })
    store.consume({
      type: "checkpoint",
      taskId: "task_02",
      state: "blocked",
      reason: `${"unsafe ".repeat(300)}hook refused`,
    })
    store.consume({ type: "task_status", taskId: "task_03", status: "in_progress" })

    const state = store.getSnapshot()
    const reason = selectTaskReason(state, "task_02")
    expect(reason).toBeDefined()
    expect(selectTaskCheckpoint(state, "task_02")?.state).toBe("blocked")
    const checkpointReason = selectTaskCheckpoint(state, "task_02")
    expect(checkpointReason?.state === "blocked" ? checkpointReason.reason.length : 0).toBeLessThanOrEqual(1024)
    expect(reason!.length).toBeLessThanOrEqual(1044)
    expect(reason).toContain("unsafe")
    expect(selectVisibleTasks(state).map((candidate) => candidate.id)).toEqual(["task_01", "task_02", "task_03"])
    expect(state.tasks.map((candidate) => candidate.status)).toEqual(["completed", "completed", "in_progress"])
    expect(state.selectedTaskId).toBe("task_03")
    store.moveTask(-1)
    expect(store.getSnapshot().selectedTaskId).toBe("task_02")
  })

  test("bounds view navigation and exposes focus, follow, help, and transcript selectors", () => {
    const store = startedStore([task(1, "First"), task(2, "Second"), task(3, "Third")])
    store.consume({ type: "task_status", taskId: "task_02", status: "in_progress" })
    store.consume({ type: "activity", taskId: "task_02", message: "Live output" })

    store.moveTask(-20)
    expect(store.getSnapshot()).toMatchObject({ selectedTaskId: "task_01", followingActiveTask: false })
    store.moveTask(20)
    expect(store.getSnapshot()).toMatchObject({ selectedTaskId: "task_03", followingActiveTask: false })
    store.selectTask("not-a-task")
    expect(store.getSnapshot()).toMatchObject({ selectedTaskId: "task_02", followingActiveTask: true })
    expect(selectSelectedTranscript(store.getSnapshot()).map((entry) => entry.text)).toEqual(["Live output"])

    store.setFollowingActiveTask(false)
    expect(store.getSnapshot().followingActiveTask).toBeFalse()
    store.setFollowingActiveTask(true)
    expect(store.getSnapshot()).toMatchObject({ selectedTaskId: "task_02", followingActiveTask: true })

    store.setFocusedPane("transcript")
    expect(store.getSnapshot().focusedPane).toBe("transcript")
    store.toggleFocusedPane()
    expect(store.getSnapshot().focusedPane).toBe("tasks")
    store.toggleHelp()
    expect(store.getSnapshot().helpOpen).toBeTrue()
    store.setHelpOpen(false)
    expect(store.getSnapshot().helpOpen).toBeFalse()
  })

  test("keeps run metadata separate and discards it with each store instance", () => {
    const firstStore = startedStore([task(1, "First")])
    firstStore.consume({ type: "activity", message: "Run-level notice" })
    firstStore.consume({ type: "runtime_option", name: "model", requested: "gpt-5", outcome: "applied" })
    firstStore.consume({ type: "runtime_option", name: "reasoning", requested: "auto", outcome: "default" })
    firstStore.consume({
      type: "runtime_option",
      name: "speed",
      requested: "fast",
      outcome: "unsupported",
      detail: "provider does not expose speed",
    })
    firstStore.consume({ type: "activity", taskId: "task_01", message: "Task-only notice" })
    firstStore.consume({ type: "run_finished", ok: false, message: "1 failed · 0 blocked" })

    expect(firstStore.getSnapshot().runActivity.map((entry) => entry.text)).toEqual([
      "Starting demo",
      "Run-level notice",
    ])
    expect(firstStore.getSnapshot().runtimeOptions.speed).toEqual({
      requested: "fast",
      outcome: "unsupported",
      detail: "provider does not expose speed",
    })
    expect(firstStore.getSnapshot().runtimeOptions.model).toEqual({ requested: "gpt-5", outcome: "applied" })
    expect(firstStore.getSnapshot().runtimeOptions.reasoning).toEqual({ requested: "auto", outcome: "default" })
    expect(firstStore.getSnapshot().finished).toEqual({ ok: false, message: "1 failed · 0 blocked" })
    expect(selectTaskTranscript(firstStore.getSnapshot(), "task_01")).toHaveLength(1)

    const freshStore = new CockpitStore()
    expect(freshStore.getSnapshot()).toMatchObject({
      slug: "",
      tasks: [],
      transcripts: {},
      runActivity: [],
      runtimeOptions: {},
      finished: null,
    })
  })

  test("keeps permission events outside the final read-only view state", () => {
    const store = startedStore([task(1, "Demo")])
    let responded = false
    store.consume({
      type: "permission_requested",
      request: {
        sessionId: "s1",
        toolCall: { toolCallId: "t1", title: "Write file", status: "pending" },
        options: [
          { optionId: "allow", name: "Allow", kind: "allow_once" },
          { optionId: "deny", name: "Deny", kind: "reject_once" },
        ],
      },
      respond: () => {
        responded = true
      },
    })

    expect(responded).toBeFalse()
    expect("permission" in store.getSnapshot()).toBeFalse()
    expect("activity" in store.getSnapshot()).toBeFalse()
    expect("movePermission" in store).toBeFalse()
    expect("selectPermission" in store).toBeFalse()
    expect("cancelPermission" in store).toBeFalse()
  })

  test("starts a batch projection without applying the singular store reset", () => {
    const store = new CockpitStore()
    store.setFocusedPane("transcript")
    store.setFollowingActiveTask(false)

    store.consume({
      type: "batch_started",
      slugs: ["alpha", "beta", "gamma"],
      total: 3,
      config: DEFAULT_CONFIG,
    })

    expect(store.getSnapshot()).toMatchObject({
      batchStatus: "running",
      activePacket: null,
      packetSummaries: [
        { slug: "alpha", outcome: "not_started" },
        { slug: "beta", outcome: "not_started" },
        { slug: "gamma", outcome: "not_started" },
      ],
      notStartedPackets: [
        { slug: "alpha", outcome: "not_started" },
        { slug: "beta", outcome: "not_started" },
        { slug: "gamma", outcome: "not_started" },
      ],
      focusedPane: "transcript",
      followingActiveTask: false,
    })
  })

  test("retains ordered packet outcomes while switching active detail", () => {
    const store = new CockpitStore()
    store.consume({ type: "batch_started", slugs: ["alpha", "beta", "gamma"] })
    store.consume({
      type: "batch_packet_started",
      slug: "alpha",
      index: 0,
      total: 3,
      tasks: [task(1, "Alpha task")],
    })
    store.consume({ type: "task_status", taskId: "alpha/task_01", status: "in_progress" })
    store.consume({ type: "activity", taskId: "alpha/task_01", message: "Alpha output" })
    store.consume({ type: "batch_packet_finished", slug: "alpha", index: 0, outcome: "succeeded", detail: "completed" })

    store.consume({
      type: "batch_packet_started",
      slug: "beta",
      index: 1,
      total: 3,
      tasks: [task(1, "Beta task")],
    })

    const state = store.getSnapshot()
    expect(state.activePacket).toEqual({ slug: "beta", index: 1, total: 3 })
    expect(state.slug).toBe("beta")
    expect(state.packetSummaries).toEqual([
      { slug: "alpha", outcome: "succeeded", detail: "completed" },
      { slug: "beta", outcome: "not_started" },
      { slug: "gamma", outcome: "not_started" },
    ])
    expect(Object.keys(state.transcripts)).toEqual(["alpha/task_01", "beta/task_01"])
    expect(selectTaskTranscript(state, "task_01")).toEqual([])
  })

  test("qualifies repeated task IDs and keeps inactive packet events out of the projection", () => {
    const store = new CockpitStore()
    store.consume({ type: "batch_started", slugs: ["alpha", "beta"] })
    store.consume({
      type: "batch_packet_started",
      slug: "alpha",
      index: 0,
      total: 2,
      tasks: [task(1, "Alpha task")],
    })
    store.consume({ type: "task_status", taskId: "alpha/task_01", status: "failed" })
    store.consume({
      type: "activity",
      taskId: "alpha/task_01",
      message: "Alpha failure\nalpha transport detail",
    })
    store.consume({
      type: "session_update",
      taskId: "alpha/task_01",
      sessionId: "reused-session",
      phase: "implementation",
      update: message("alpha-session", "Alpha session output"),
    })
    const alphaSnapshot = store.getSnapshot()

    store.consume({ type: "batch_packet_finished", slug: "alpha", index: 0, outcome: "failed", detail: "stopped" })
    store.consume({
      type: "batch_packet_started",
      slug: "beta",
      index: 1,
      total: 2,
      tasks: [task(1, "Beta task")],
    })
    store.consume({ type: "task_status", taskId: "beta/task_01", status: "failed" })
    store.consume({
      type: "activity",
      taskId: "beta/task_01",
      message: "Beta failure\nbeta transport detail",
    })
    store.consume({
      type: "session_update",
      taskId: "alpha/task_01",
      sessionId: "reused-session",
      phase: "report",
      update: message("stale-session", "stale alpha session"),
    })
    store.consume({
      type: "session_update",
      taskId: "beta/task_01",
      sessionId: "reused-session",
      phase: "report",
      update: message("beta-session", "Beta session output"),
    })
    store.consume({ type: "activity", taskId: "task_01", message: "bare stale event" })
    store.consume({ type: "activity", taskId: "alpha/task_01", message: "stale alpha event" })

    expect(Object.keys(alphaSnapshot.transcripts)).toEqual(["alpha/task_01"])
    expect(selectTaskReason(alphaSnapshot, "task_01")).toBe("Alpha failure")
    expect(selectTaskFailureDetail(alphaSnapshot, "task_01")).toBe("Alpha failure\nalpha transport detail")
    expect(Object.keys(store.getSnapshot().transcripts)).toEqual(["alpha/task_01", "beta/task_01"])
    expect(selectTaskReason(store.getSnapshot(), "task_01")).toBe("Beta failure")
    expect(selectTaskFailureDetail(store.getSnapshot(), "task_01")).toBe("Beta failure\nbeta transport detail")
    expect(selectTaskTranscript(store.getSnapshot(), "task_01").map((entry) => entry.text)).toContain("Beta failure")
    expect(selectTaskTranscript(store.getSnapshot(), "task_01").map((entry) => entry.text)).toContain("Beta session output")
    expect(selectTaskTranscript(store.getSnapshot(), "task_01").map((entry) => entry.text)).not.toContain("bare stale event")
    expect(selectTaskTranscript(store.getSnapshot(), "task_01").map((entry) => entry.text)).not.toContain("stale alpha event")
    expect(selectTaskTranscript(store.getSnapshot(), "task_01").map((entry) => entry.text)).not.toContain("stale alpha session")
  })

  test("projects preflighted tasks for a parent packet before that packet starts", () => {
    const store = new CockpitStore()
    store.consume({
      type: "batch_started",
      slugs: ["active", "later"],
      packets: [
        { slug: "active", index: 0, outcome: "not_started", tasks: [task(1, "Active child")] },
        {
          slug: "later",
          index: 1,
          outcome: "not_started",
          tasks: [task(1, "Later child one"), task(2, "Later child two")],
        },
      ],
    })
    store.consume({
      type: "batch_packet_started",
      slug: "active",
      index: 0,
      total: 2,
      tasks: [task(1, "Active child")],
    })

    const firstView = selectPacketTaskView(store.getSnapshot(), 1, 0)
    const secondView = selectPacketTaskView(store.getSnapshot(), 1, 1)

    expect(firstView.slug).toBe("later")
    expect(firstView.tasks.map((entry) => entry.title)).toEqual(["Later child one", "Later child two"])
    expect(firstView.selectedTaskId).toBe("task_01")
    expect(firstView.activeTaskId).toBeNull()
    expect(firstView.followingActiveTask).toBeFalse()
    expect(secondView.selectedTaskId).toBe("task_02")
    expect(store.getSnapshot().activePacket?.slug).toBe("active")
  })

  test("retains already-complete detail and terminal stopped-packet metadata", () => {
    const store = new CockpitStore()
    store.consume({ type: "batch_started", slugs: ["complete", "cancelled", "later"] })
    store.consume({ type: "batch_packet_started", slug: "complete", index: 0, total: 3, tasks: [] })
    store.consume({
      type: "batch_packet_finished",
      slug: "complete",
      index: 0,
      outcome: "succeeded",
      detail: "already_complete",
    })
    store.consume({ type: "batch_packet_started", slug: "cancelled", index: 1, total: 3, tasks: [task(1, "Cancelled task")] })
    store.consume({ type: "batch_packet_finished", slug: "cancelled", index: 1, outcome: "cancelled", detail: "stopped" })
    store.consume({
      type: "batch_finished",
      ok: false,
      status: "cancelled",
      packets: [
        { slug: "complete", outcome: "succeeded", detail: "already_complete" },
        { slug: "cancelled", outcome: "cancelled", detail: "stopped" },
        { slug: "later", outcome: "not_started" },
      ],
      stoppingSlug: "cancelled",
    })

    expect(store.getSnapshot()).toMatchObject({
      batchStatus: "cancelled",
      packetSummaries: [
        { slug: "complete", outcome: "succeeded", detail: "already_complete" },
        { slug: "cancelled", outcome: "cancelled", detail: "stopped" },
        { slug: "later", outcome: "not_started" },
      ],
      stoppingPacket: { slug: "cancelled", index: 1, outcome: "cancelled" },
      notStartedPackets: [{ slug: "later", outcome: "not_started" }],
    })
    expect(store.getSnapshot().finished).toEqual({
      ok: false,
      message: "Batch cancelled at cancelled; later packets were not started",
    })
  })

  test("retains final transcript inspection and ignores late nested lifecycle events", () => {
    const store = new CockpitStore()
    store.consume({ type: "batch_started", slugs: ["alpha"], total: 1, config: DEFAULT_CONFIG })
    store.consume({
      type: "batch_packet_started",
      slug: "alpha",
      index: 0,
      total: 1,
      tasks: [task(1, "Final task")],
    })
    store.consume({ type: "task_status", taskId: "alpha/task_01", status: "in_progress" })
    store.consume({ type: "activity", taskId: "alpha/task_01", message: "retained final output" })
    store.consume({ type: "task_status", taskId: "alpha/task_01", status: "completed" })

    expect(store.getSnapshot().selectedTaskId).toBe("task_01")
    expect(selectUnfinishedTasks(store.getSnapshot())).toEqual([])
    expect(selectSelectedTranscript(store.getSnapshot()).map((entry) => entry.text)).toEqual([
      "retained final output",
      "Task completed",
    ])

    store.consume({
      type: "batch_packet_finished",
      slug: "alpha",
      index: 0,
      outcome: "succeeded",
      detail: "completed",
    })
    store.consume({
      type: "batch_finished",
      ok: true,
      status: "completed",
      packets: [{ slug: "alpha", outcome: "succeeded", detail: "completed" }],
    })
    const terminalState = store.getSnapshot()

    store.consume({ type: "run_started", slug: "late", config: DEFAULT_CONFIG, tasks: [task(1, "Late reset")] })
    store.consume({ type: "run_finished", ok: false, message: "late nested finish" })
    store.consume({ type: "activity", taskId: "alpha/task_01", message: "late terminal output" })

    expect(store.getSnapshot()).toBe(terminalState)
    expect(selectSelectedTranscript(store.getSnapshot()).map((entry) => entry.text)).not.toContain("late terminal output")
  })
})

function startedStore(tasks: TaskFile[]): CockpitStore {
  const store = new CockpitStore()
  store.consume({ type: "run_started", slug: "demo", config: DEFAULT_CONFIG, tasks })
  return store
}

function task(
  number: number,
  title: string,
  dependencies: string[] = [],
  status: TaskStatus = "pending",
): TaskFile {
  const id = `task_${String(number).padStart(2, "0")}`
  return {
    id,
    number,
    path: `/tmp/${id}.md`,
    body: `# Task ${number}: ${title}`,
    source: "",
    frontmatter: { status, title, type: "frontend", complexity: "medium", dependencies },
  }
}

function message(messageId: string, text: string): SessionUpdate {
  return {
    sessionUpdate: "agent_message_chunk",
    messageId,
    content: { type: "text", text },
  }
}
