import { describe, expect, test } from "bun:test"
import type { SessionUpdate } from "@agentclientprotocol/sdk"
import { DEFAULT_CONFIG } from "../src/config.ts"
import type { TaskFile, TaskStatus } from "../src/tasks.ts"
import {
  CockpitStore,
  selectSelectedTask,
  selectSelectedTranscript,
  selectTaskReason,
  selectTaskTranscript,
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

  test("keeps task activity and streamed session updates isolated", () => {
    const store = startedStore([task(1, "First"), task(2, "Second")])
    store.consume({ type: "activity", taskId: "task_01", message: "Inspecting task one" })
    store.consume({ type: "session_update", taskId: "task_02", update: message("message-2", "Task two") })
    store.consume({ type: "session_update", taskId: "task_02", update: message("message-2", " output") })
    store.consume({ type: "activity", taskId: "task_02", message: "Finished task two fixture" })

    expect(selectTaskTranscript(store.getSnapshot(), "task_01").map((entry) => entry.text)).toEqual([
      "Inspecting task one",
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
