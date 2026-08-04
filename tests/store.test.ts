import { describe, expect, test } from "bun:test"
import { DEFAULT_CONFIG } from "../src/config.ts"
import { CockpitStore } from "../src/ui/store.ts"

describe("cockpit store", () => {
  test("projects task status and permission decisions", () => {
    const store = new CockpitStore()
    store.consume({
      type: "run_started",
      slug: "demo",
      config: DEFAULT_CONFIG,
      tasks: [{
        id: "task_01",
        number: 1,
        path: "/tmp/task_01.md",
        body: "# Task 1: Demo",
        source: "",
        frontmatter: { status: "pending", title: "Demo", type: "backend", complexity: "low", dependencies: [] },
      }],
    })
    store.consume({ type: "task_status", taskId: "task_01", status: "in_progress" })
    expect(store.getSnapshot().activeTaskId).toBe("task_01")

    let selected = ""
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
      respond: (response) => {
        if (response.outcome.outcome === "selected") selected = response.outcome.optionId
      },
    })
    store.movePermission(1)
    store.selectPermission()
    expect(selected).toBe("deny")
    expect(store.getSnapshot().permission).toBeNull()
  })
})

