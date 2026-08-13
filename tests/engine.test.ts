import { describe, expect, test } from "bun:test"
import { access, chmod, mkdir, mkdtemp, readFile, symlink, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_CONFIG, parseConfig } from "../src/config.ts"
import { runTaskPacket } from "../src/engine.ts"
import type { RunEvent } from "../src/events.ts"
import { runGit as runCheckpointGit } from "../src/checkpoints.ts"
import type { CheckpointServiceContract } from "../src/checkpoints.ts"
import { createGrokAuthMethodPreference } from "../src/providers.ts"

describe("task engine", () => {
  test("returns a typed no-work result for a valid all-complete packet without launching a provider", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-engine-no-work-"))
    const packet = join(root, ".spec-finder", "tasks", "demo")
    await mkdir(packet, { recursive: true })
    const statuses = ["completed", "done", "finished"] as const
    const taskPaths = statuses.map((status, index) => {
      const number = String(index + 1).padStart(2, "0")
      return { path: join(packet, `task_${number}.md`), number, status }
    })
    await Promise.all(taskPaths.map(({ path, number, status }) => writeFile(path, `---
status: ${status}
title: Terminal task ${number}
type: test
complexity: low
dependencies: []
---

# Task ${number}: Terminal task ${number}
`)))
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root,
      slug: "demo",
      config: parseConfig({ ...DEFAULT_CONFIG, auto_commit: false }),
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: "/provider-launch-must-not-run",
        args: [],
        env: {},
        authMethod: null,
      },
    })

    expect(result).toEqual({
      ok: true,
      completed: 0,
      failed: 0,
      blocked: 0,
      outcome: "no_work",
      reason: "all_tasks_complete",
    })
    expect(events.map((event) => event.type)).toEqual(["run_started", "run_finished"])
    expect(events).toContainEqual({
      type: "run_finished",
      ok: true,
      message: "No executable tasks: all tasks are already complete",
      outcome: "no_work",
      reason: "all_tasks_complete",
    })
    expect(events.some((event) => ["task_status", "activity", "session_update", "permission_requested", "checkpoint"].includes(event.type))).toBeFalse()
    for (const { path, status } of taskPaths) expect(await readFile(path, "utf8")).toContain(`status: ${status}`)
    await expect(access(join(packet, "reports"))).rejects.toThrow()
  })

  test("keeps an aborted all-complete packet on the cancelled path", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-engine-no-work-cancelled-"))
    const packet = join(root, ".spec-finder", "tasks", "demo")
    await mkdir(packet, { recursive: true })
    await writeFile(join(packet, "task_01.md"), `---
status: completed
title: Already complete
type: test
complexity: low
dependencies: []
---

# Task 01: Already complete
`)
    const controller = new AbortController()
    controller.abort()
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root,
      slug: "demo",
      config: DEFAULT_CONFIG,
      signal: controller.signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: "/cancelled-no-work-provider-must-not-run",
        args: [],
        env: {},
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: false, completed: 0, failed: 0, blocked: 0 })
    expect(events).toContainEqual({ type: "run_finished", ok: false, message: "run cancelled" })
    const finished = events.find((event) => event.type === "run_finished")
    expect(finished && "outcome" in finished).toBeFalse()
    expect(finished && "reason" in finished).toBeFalse()
  })

  test("keeps a taskless packet as an error without emitting a no-work event", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-engine-taskless-"))
    const packet = join(root, ".spec-finder", "tasks", "demo")
    await mkdir(packet, { recursive: true })
    const events: RunEvent[] = []

    await expect(runTaskPacket({
      root,
      slug: "demo",
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: "/taskless-provider-must-not-run",
        args: [],
        env: {},
        authMethod: null,
      },
    })).rejects.toThrow("no task_XX.md files found")
    expect(events).toEqual([])
  })

  test("keeps validation failures as errors without emitting a no-work event", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-engine-invalid-"))
    const packet = join(root, ".spec-finder", "tasks", "demo")
    await mkdir(packet, { recursive: true })
    await writeFile(join(packet, "task_01.md"), `---
status: completed
title: Invalid task
type: test
complexity: low
dependencies: []
---

# Task 01: Different title
`)
    const events: RunEvent[] = []

    await expect(runTaskPacket({
      root,
      slug: "demo",
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: "/invalid-packet-provider-must-not-run",
        args: [],
        env: {},
        authMethod: null,
      },
    })).rejects.toThrow("task packet is invalid")
    expect(events).toEqual([])
    await expect(access(join(packet, "memory"))).rejects.toThrow()
  })

  test("keeps Grok implementation and report turns in one fresh authenticated ACP session", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-engine-"))
    const packet = join(root, ".spec-finder", "tasks", "demo")
    await mkdir(packet, { recursive: true })
    const taskPath = join(packet, "task_01.md")
    const promptLog = join(root, "prompts.log")
    const processLog = join(root, "processes.log")
    const lifecycleLog = join(root, "lifecycle.log")
    const events: RunEvent[] = []
    await writeFile(taskPath, `---
status: pending
title: Build the mock
type: test
complexity: low
dependencies: []
---

# Task 01: Build the mock

## Requirements

1. Complete both ACP phases.
`)
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "grok",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    })

    const result = await runTaskPacket({
      root,
      slug: "demo",
      config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: {
          SPEC_FINDER_TEST_AUTH_METHODS: "cached_token",
          SPEC_FINDER_TEST_EXPECT_AUTH_METHOD: "cached_token",
          SPEC_FINDER_TEST_ADVERTISE_CLOSE: "1",
          SPEC_FINDER_TEST_REQUEST_PERMISSION: "1",
          SPEC_FINDER_TEST_PROMPT_LOG: promptLog,
          SPEC_FINDER_TEST_PROCESS_LOG: processLog,
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
          SPEC_FINDER_TEST_EMIT_REPORT_SESSION_INFO: "1",
        },
        authMethod: null,
        authPreference: createGrokAuthMethodPreference(false),
      },
    })

    expect(result).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    expect(events).toContainEqual({ type: "run_finished", ok: true, message: "1 task completed" })
    const finished = events.find((event) => event.type === "run_finished")
    expect(finished && "outcome" in finished).toBeFalse()
    expect(finished && "reason" in finished).toBeFalse()
    expect(await readFile(taskPath, "utf8")).toContain("status: completed")
    expect(await readFile(join(packet, "memory", "MEMORY.md"), "utf8")).toContain("## Shared Decisions")
    expect(await readFile(join(packet, "memory", "task_01.md"), "utf8")).toContain("- Build the mock")
    expect(await readFile(join(packet, "reports", "task_01.md"), "utf8")).toContain("Final verdict: completed")
    expect(await readFile(promptLog, "utf8")).toContain(`Use the sf-execute-task skill to execute ${taskPath}.`)
    expect(await readFile(promptLog, "utf8")).toContain("Use the sf-task-report skill if it is installed.")
    const processIds = (await readFile(processLog, "utf8")).trim().split("\n")
    expect(processIds).toHaveLength(2)
    expect(new Set(processIds).size).toBe(1)
    expect((await readFile(lifecycleLog, "utf8")).trim().split("\n")).toEqual([
      "initialize",
      "authenticate:cached_token",
      "session/new",
      "session/prompt",
      "session/prompt",
      "session/close",
    ])
    const updates = events.filter((event): event is Extract<RunEvent, { type: "session_update" }> => event.type === "session_update")
    expect(updates.length).toBeGreaterThan(0)
    expect(new Set(updates.map((event) => event.sessionId))).toEqual(new Set(["test-session"]))
    expect(new Set(updates.map((event) => event.phase))).toEqual(new Set(["implementation", "report"]))
    expect(updates.some((event) => event.update.sessionUpdate === "agent_message_chunk"
      && event.update.content.type === "text"
      && event.update.content.text === "permission response: allow")).toBeTrue()
    const reportMetadata = updates.find((event) => event.update.sessionUpdate === "session_info_update")
    expect(reportMetadata?.phase).toBe("report")
    expect(reportMetadata?.update).toMatchObject({ title: expect.stringContaining(root) })
    expect(events).toContainEqual({
      type: "task_status",
      taskId: "task_01",
      status: "completed",
      reportReference: ".spec-finder/tasks/demo/reports/task_01.md",
    })
  })

  test("keeps Cursor implementation and report turns in one fresh ACP session", async () => {
    const fixture = await createRetryFixture("Cursor session compatibility")
    const processLog = join(fixture.root, "cursor-processes.log")
    const lifecycleLog = join(fixture.root, "cursor-lifecycle.log")
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: {
          SPEC_FINDER_TEST_PROCESS_LOG: processLog,
          SPEC_FINDER_TEST_LIFECYCLE_LOG: lifecycleLog,
        },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    const processIds = (await readFile(processLog, "utf8")).trim().split("\n")
    expect(processIds).toHaveLength(2)
    expect(new Set(processIds).size).toBe(1)
    expect((await readFile(lifecycleLog, "utf8")).trim().split("\n")).toEqual([
      "initialize",
      "session/new",
      "session/prompt",
      "session/prompt",
    ])
    const updates = events.filter((event): event is Extract<RunEvent, { type: "session_update" }> => event.type === "session_update")
    expect(new Set(updates.map((event) => event.sessionId))).toEqual(new Set(["test-session"]))
    expect(new Set(updates.map((event) => event.phase))).toEqual(new Set(["implementation", "report"]))
  })

  test("omits a report reference when the accepted artifact resolves outside the workspace", async () => {
    const fixture = await createRetryFixture("External report reference")
    const externalReports = await mkdtemp(join(tmpdir(), "spec-finder-engine-external-report-"))
    await symlink(externalReports, join(fixture.root, ".spec-finder", "tasks", "demo", "reports"), "dir")
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: { SPEC_FINDER_TEST_EMIT_REPORT_SESSION_INFO: "1" },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    expect(await readFile(join(externalReports, "task_01.md"), "utf8")).toContain("Final verdict: completed")
    expect(events).toContainEqual({ type: "task_status", taskId: "task_01", status: "completed" })
    expect(events.some((event) => event.type === "task_status" && event.reportReference !== undefined)).toBeFalse()
  })

  test("retries a failed implementation once before continuing to the report phase", async () => {
    const fixture = await createRetryFixture("Retry implementation")
    const marker = join(fixture.root, "implementation-attempted")
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: {
          SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog,
          SPEC_FINDER_TEST_FAIL_FIRST_IMPLEMENTATION: marker,
        },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    const prompts = await readFile(fixture.promptLog, "utf8")
    expect(occurrences(prompts, "Use the sf-execute-task skill")).toBe(2)
    expect(occurrences(prompts, "You are the final-report phase")).toBe(1)
    expect(activityMessages(events)).toContain(
      "implementation attempt 1 failed: implementation stopped: refusal; retrying attempt 2/2",
    )
    expect(activityMessages(events)).toContain("implementation retry succeeded (attempt 2/2)")
  })

  test("replaces a crashed ACP process and retries the implementation once", async () => {
    const fixture = await createRetryFixture("Recover crashed implementation process")
    const marker = join(fixture.root, "implementation-process-exited")
    const processLog = join(fixture.root, "processes.log")
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: {
          SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog,
          SPEC_FINDER_TEST_PROCESS_LOG: processLog,
          SPEC_FINDER_TEST_EXIT_FIRST_IMPLEMENTATION: marker,
        },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    const prompts = await readFile(fixture.promptLog, "utf8")
    expect(occurrences(prompts, "Use the sf-execute-task skill")).toBe(2)
    expect(occurrences(prompts, "You are the final-report phase")).toBe(1)
    expect(prompts).toContain("This is continuation attempt 2/2")
    const processIds = (await readFile(processLog, "utf8")).trim().split("\n")
    expect(processIds).toHaveLength(3)
    expect(new Set(processIds).size).toBe(2)
    expect(activityMessages(events)).toContain(
      "implementation attempt 1 failed: ACP process ended before the task handoff completed (exit 25); retrying attempt 2/2",
    )
    expect(activityMessages(events)).toContain("implementation retry succeeded (attempt 2/2)")
  })

  test("retries a provider that exits during startup once and then fails the task", async () => {
    const fixture = await createRetryFixture("Exhaust crashed startup")
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: { SPEC_FINDER_TEST_EXIT_IMMEDIATELY: "1" },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: false, completed: 0, failed: 1, blocked: 0 })
    expect(activityMessages(events)).toContain(
      "implementation attempt 1 failed: ACP process ended before the task handoff completed (exit 23); retrying attempt 2/2",
    )
    expect(activityMessages(events).filter((message) => message.includes("retrying attempt"))).toHaveLength(1)
    expect(activityMessages(events)).toContain("ACP process ended before the task handoff completed (exit 23)")
    expect(events).toContainEqual({ type: "run_finished", ok: false, message: "1 failed · 0 blocked" })
  }, 2_000)

  test("retries only the report phase when the first report is incomplete", async () => {
    const fixture = await createRetryFixture("Retry report")
    const marker = join(fixture.root, "report-attempted")
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: {
          SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog,
          SPEC_FINDER_TEST_INCOMPLETE_FIRST_REPORT: marker,
        },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    const prompts = await readFile(fixture.promptLog, "utf8")
    expect(occurrences(prompts, "Use the sf-execute-task skill")).toBe(1)
    expect(occurrences(prompts, "You are the final-report phase")).toBe(2)
    expect(activityMessages(events).some((message) =>
      message.startsWith("final report attempt 1 failed: final report is missing or incomplete:")
      && message.endsWith("; retrying attempt 2/2")
    )).toBeTrue()
    expect(activityMessages(events)).toContain("final report retry succeeded (attempt 2/2)")
  })

  test("replaces a crashed ACP process and retries only the report handoff", async () => {
    const fixture = await createRetryFixture("Recover crashed report process")
    const marker = join(fixture.root, "report-process-exited")
    const processLog = join(fixture.root, "processes.log")
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: {
          SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog,
          SPEC_FINDER_TEST_PROCESS_LOG: processLog,
          SPEC_FINDER_TEST_EXIT_FIRST_REPORT: marker,
        },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    const prompts = await readFile(fixture.promptLog, "utf8")
    expect(occurrences(prompts, "Use the sf-execute-task skill")).toBe(1)
    expect(occurrences(prompts, "You are the final-report phase")).toBe(2)
    const processIds = (await readFile(processLog, "utf8")).trim().split("\n")
    expect(processIds).toHaveLength(3)
    expect(new Set(processIds).size).toBe(2)
    expect(activityMessages(events)).toContain(
      "final report attempt 1 failed: ACP process ended before the task handoff completed (exit 24); retrying attempt 2/2",
    )
    expect(activityMessages(events)).toContain("final report retry succeeded (attempt 2/2)")
  })

  test("persists an exhausted report handoff and retries only that handoff on the next run", async () => {
    const fixture = await createRetryFixture("Resume report handoff")
    const firstEvents: RunEvent[] = []

    const blocked = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => firstEvents.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: {
          SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog,
          SPEC_FINDER_TEST_FAIL_REPORT: "1",
        },
        authMethod: null,
      },
    })

    expect(blocked).toEqual({ ok: false, completed: 0, failed: 0, blocked: 1 })
    const blockedTask = await readFile(join(fixture.root, ".spec-finder", "tasks", "demo", "task_01.md"), "utf8")
    expect(blockedTask).toContain("status: blocked")
    expect(blockedTask).toContain("handoff:\n  phase: report")
    expect(blockedTask).toContain('error: "report stopped: refusal"')
    expect(activityMessages(firstEvents)).toContain(
      "final report handoff blocked: report stopped: refusal; rerun retries the report without rerunning implementation",
    )
    expect(firstEvents.some((event) => event.type === "task_status" && event.status === "completed")).toBeFalse()
    expect(firstEvents.some((event) => event.type === "task_status" && event.reportReference !== undefined)).toBeFalse()

    const resumedEvents: RunEvent[] = []
    const resumed = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => resumedEvents.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: { SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog },
        authMethod: null,
      },
    })

    expect(resumed).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    const prompts = await readFile(fixture.promptLog, "utf8")
    expect(occurrences(prompts, "Use the sf-execute-task skill")).toBe(1)
    expect(occurrences(prompts, "You are the final-report phase")).toBe(3)
    expect(prompts).toContain("A prior ACP run completed the implementation phase and persisted this report handoff")
    const completedTask = await readFile(join(fixture.root, ".spec-finder", "tasks", "demo", "task_01.md"), "utf8")
    expect(completedTask).toContain("status: completed")
    expect(completedTask).not.toContain("handoff:")
    expect(activityMessages(resumedEvents)).toContain(
      "resuming final report handoff; verified implementation will not rerun",
    )
  })

  test("preserves checkpoint attribution while a blocked report handoff is resumed", async () => {
    const fixture = await createGitPacketFixture(["Resume checkpointed report handoff"])
    const firstEvents: RunEvent[] = []

    const blocked = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => firstEvents.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: {
          SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog,
          SPEC_FINDER_TEST_FAIL_REPORT: "1",
        },
        authMethod: null,
      },
    })

    expect(blocked).toEqual({ ok: false, completed: 0, failed: 0, blocked: 1 })
    const blockedTask = await readFile(join(fixture.packet, "task_01.md"), "utf8")
    expect(blockedTask).toContain("state: active")
    expect(blockedTask).toContain(".spec-finder/tasks/demo/task_01.md")

    const resumedEvents: RunEvent[] = []
    const resumed = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => resumedEvents.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: { SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog },
        authMethod: null,
      },
    })

    expect(resumed).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    const prompts = await readFile(fixture.promptLog, "utf8")
    expect(occurrences(prompts, "Use the sf-execute-task skill")).toBe(1)
    expect(occurrences(prompts, "You are the final-report phase")).toBe(3)
    expect(await readFile(join(fixture.packet, "task_01.md"), "utf8")).not.toContain("checkpoint:")
    const commits = await runCheckpointGit(["rev-list", "--count", "HEAD"], fixture.root)
    expect(commits.stdout.trim()).toBe("2")
    const status = await runCheckpointGit(["status", "--porcelain"], fixture.root)
    expect(status.stdout).toContain("?? .spec-finder/tasks/demo/memory/")
    expect(status.stdout).not.toContain("task_01.md")
    expect(status.stdout).not.toContain("reports/")
  })

  test("does not retry or misclassify a cancelled report handoff", async () => {
    const fixture = await createRetryFixture("Cancel report handoff")
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: {
          SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog,
          SPEC_FINDER_TEST_CANCEL_REPORT: "1",
        },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: false, completed: 0, failed: 0, blocked: 0 })
    const prompts = await readFile(fixture.promptLog, "utf8")
    expect(occurrences(prompts, "Use the sf-execute-task skill")).toBe(1)
    expect(occurrences(prompts, "You are the final-report phase")).toBe(1)
    const task = await readFile(join(fixture.root, ".spec-finder", "tasks", "demo", "task_01.md"), "utf8")
    expect(task).toContain("status: in_progress")
    expect(task).toContain("handoff:\n  phase: report")
    expect(task).not.toContain("error:")
    expect(activityMessages(events)).toContain("report stopped: cancelled")
    expect(events).toContainEqual({ type: "run_finished", ok: false, message: "run cancelled" })
  })

  test("retries once before emitting the final read-only permission failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-engine-"))
    const packet = join(root, ".spec-finder", "tasks", "demo")
    await mkdir(packet, { recursive: true })
    await writeFile(join(packet, "task_01.md"), `---
status: pending
title: Request permission
type: test
complexity: low
dependencies: []
---

# Task 01: Request permission
`)
    const fixture = join(import.meta.dir, "fixtures", "mock-agent.ts")
    const config = parseConfig({
      ...DEFAULT_CONFIG,
      provider: "cursor",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "prompt",
    })
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root,
      slug: "demo",
      config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: true,
      providerLaunch: {
        command: process.execPath,
        args: [fixture],
        env: { SPEC_FINDER_TEST_REQUEST_PERMISSION: "1" },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: false, completed: 0, failed: 1, blocked: 0 })
    const noticeIndex = events.findIndex((event) =>
      event.type === "activity" && event.message.includes("cockpit is read-only")
    )
    const retryIndex = events.findIndex((event) =>
      event.type === "activity" && event.message.includes("retrying attempt 2/2")
    )
    const failureIndex = events.findIndex((event) =>
      event.type === "activity" && event.message === "implementation stopped: refusal"
    )
    expect(noticeIndex).toBeGreaterThan(-1)
    expect(retryIndex).toBeGreaterThan(noticeIndex)
    expect(failureIndex).toBeGreaterThan(retryIndex)
    expect(events.filter((event) =>
      event.type === "activity" && event.message.includes("cockpit is read-only")
    )).toHaveLength(2)
    expect(events.some((event) => event.type === "permission_requested")).toBe(false)
    expect(events.some((event) => event.type === "task_status" && event.reportReference !== undefined)).toBeFalse()
  })

  test("branches on auto_commit and orders begin before in_progress and complete after completed", async () => {
    const fixture = await createRetryFixture("Checkpoint ordering")
    const timeline: string[] = []
    const service = recordingCheckpointService(timeline)
    const events: RunEvent[] = []
    const config = parseConfig({ ...fixture.config, auto_commit: true })

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config,
      signal: new AbortController().signal,
      emit: (event) => {
        events.push(event)
        if (event.type === "task_status") timeline.push("status:" + event.status)
      },
      interactivePermissions: false,
      checkpointService: service,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: { SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    expect(timeline).toEqual(["begin", "status:in_progress", "status:completed", "complete"])
    expect(events).toContainEqual({ type: "checkpoint", taskId: "task_01", state: "created", commit: "test-commit" })
  })

  test("delivers a completed active checkpoint without rerunning implementation", async () => {
    const fixture = await createRetryFixture("Recover active checkpoint")
    const taskPath = join(fixture.root, ".spec-finder", "tasks", "demo", "task_01.md")
    await writeFile(taskPath, `---
status: completed
title: Recover active checkpoint
type: test
complexity: low
dependencies: []
checkpoint:
  state: active
  base_head: ${"a".repeat(40)}
  baseline_digest: ${"b".repeat(64)}
  paths:
    - .spec-finder/tasks/demo/task_01.md
---

# Task 01: Recover active checkpoint
`)
    const calls: string[] = []
    const service: CheckpointServiceContract = {
      begin: async () => {
        calls.push("begin")
        return { state: "blocked", message: "begin not expected" }
      },
      complete: async () => {
        calls.push("complete")
        return { state: "created", commit: "recovered-commit" }
      },
      retry: async () => {
        calls.push("retry")
        return { state: "blocked", message: "retry not expected" }
      },
      preserve: async () => {
        calls.push("preserve")
        return { state: "blocked", message: "preserve not expected" }
      },
    }
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: parseConfig({ ...fixture.config, auto_commit: true }),
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      checkpointService: service,
      providerLaunch: {
        command: "/checkpoint-recovery-must-not-launch-acp",
        args: [],
        env: {},
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    expect(calls).toEqual(["complete"])
    expect(events).toContainEqual({
      type: "checkpoint",
      taskId: "task_01",
      state: "created",
      commit: "recovered-commit",
    })
    expect(events.some((event) => event.type === "task_status" && event.status === "in_progress")).toBeFalse()
  })

  test("does not call the checkpoint service when auto_commit is disabled", async () => {
    const fixture = await createRetryFixture("Checkpoint disabled")
    let calls = 0
    const service: CheckpointServiceContract = {
      begin: async () => {
        calls += 1
        throw new Error("checkpoint service should not be called")
      },
      complete: async () => {
        calls += 1
        throw new Error("checkpoint service should not be called")
      },
      retry: async () => {
        calls += 1
        throw new Error("checkpoint service should not be called")
      },
      preserve: async () => {
        calls += 1
        throw new Error("checkpoint service should not be called")
      },
    }

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: () => {},
      interactivePermissions: false,
      checkpointService: service,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: { SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog },
        authMethod: null,
      },
    })

    expect(result.ok).toBeTrue()
    expect(calls).toBe(0)
  })
  test("stops downstream tasks when checkpoint delivery is blocked", async () => {
    const fixture = await createPacketFixture(["First checkpoint", "Downstream task"])
    const events: RunEvent[] = []
    const service: CheckpointServiceContract = {
      begin: async () => ({ state: "created", message: "baseline" }),
      preserve: async () => ({ state: "created", message: "recovery state" }),
      complete: async ({ task }) => task.id === "task_01"
        ? { state: "blocked", message: "hook refused checkpoint" }
        : { state: "created", commit: "unused" },
      retry: async () => ({ state: "blocked", message: "retry not expected" }),
    }

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      checkpointService: service,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: { SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: false, completed: 1, failed: 0, blocked: 1 })
    expect(events).toContainEqual({ type: "checkpoint", taskId: "task_01", state: "blocked", reason: "hook refused checkpoint" })
    expect(await readFile(join(fixture.packet, "task_02.md"), "utf8")).toContain("status: pending")
    expect(await readFile(fixture.promptLog, "utf8")).not.toContain("Downstream task")
  })

  test("retries blocked delivery without another ACP turn and then starts downstream work", async () => {
    const fixture = await createGitPacketFixture(["Recoverable checkpoint", "Downstream task"])
    const hook = join(fixture.root, ".git", "hooks", "pre-commit")
    await writeFile(hook, "#!/bin/sh\nprintf 'checkpoint hook refused\\n' >&2\nexit 1\n")
    await chmod(hook, 0o755)
    const firstEvents: RunEvent[] = []

    const first = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => firstEvents.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: { SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog },
        authMethod: null,
      },
    })

    expect(first).toEqual({ ok: false, completed: 1, failed: 0, blocked: 1 })
    expect(firstEvents).toContainEqual(expect.objectContaining({
      type: "checkpoint",
      taskId: "task_01",
      state: "blocked",
    }))
    const firstPromptCount = occurrences(await readFile(fixture.promptLog, "utf8"), "Use the sf-execute-task skill")
    expect(firstPromptCount).toBe(1)
    await unlink(hook)

    const resumedEvents: RunEvent[] = []
    const resumed = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => resumedEvents.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: { SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog },
        authMethod: null,
      },
    })

    expect(resumed).toEqual({ ok: true, completed: 2, failed: 0, blocked: 0 })
    expect(resumedEvents).toContainEqual(expect.objectContaining({
      type: "checkpoint",
      taskId: "task_01",
      state: "created",
    }))
    const prompts = await readFile(fixture.promptLog, "utf8")
    expect(occurrences(prompts, "Use the sf-execute-task skill")).toBe(2)
    expect(occurrences(prompts, "Task 01: Recoverable checkpoint")).toBe(1)
    expect(prompts).toContain("Task 02: Downstream task")
    expect(await readFile(join(fixture.packet, "task_02.md"), "utf8")).toContain("status: completed")
  })

  test("allows leftover current-packet task status when capturing the checkpoint baseline", async () => {
    const fixture = await createGitPacketFixture(["Resume leftover status"])
    await writeFile(join(fixture.packet, "task_01.md"), `---
status: in_progress
title: Resume leftover status
type: test
complexity: low
dependencies: []
---

# Task 01: Resume leftover status
`)
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: { SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    expect(activityMessages(events).some((message) => message.includes("pre-existing Git changes"))).toBeFalse()
    expect(await readFile(join(fixture.packet, "task_01.md"), "utf8")).toContain("status: completed")
    expect(occurrences(await readFile(fixture.promptLog, "utf8"), "Use the sf-execute-task skill")).toBe(1)
  })

  test("keeps unstaged tracked residue in the checkpoint baseline", async () => {
    const fixture = await createGitPacketFixture(["Tracked residue"])
    await writeFile(join(fixture.root, "README.md"), "tracked residue\n")
    await runGitCommand(fixture.root, ["add", "--", "README.md"])
    await runGitCommand(fixture.root, ["commit", "-m", "tracked residue"])
    await writeFile(join(fixture.root, "README.md"), "unstaged tracked residue\n")
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: { SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: true, completed: 1, failed: 0, blocked: 0 })
    expect(activityMessages(events).some((message) => message.includes("pre-existing Git changes"))).toBeFalse()
    expect(await readFile(join(fixture.root, "README.md"), "utf8")).toBe("unstaged tracked residue\n")
    expect(await readFile(join(fixture.packet, "task_01.md"), "utf8")).toContain("status: completed")
    const status = await runCheckpointGit(["status", "--porcelain"], fixture.root)
    expect(status.stdout).toContain(" M README.md")
    expect(status.stdout).not.toContain("task_01.md")
  })

  test("still blocks checkpoint preparation when unrelated Git changes exist", async () => {
    const fixture = await createGitPacketFixture(["Dirty unrelated"])
    await writeFile(join(fixture.root, "unrelated.txt"), "nope\n")
    const events: RunEvent[] = []

    const result = await runTaskPacket({
      root: fixture.root,
      slug: "demo",
      config: fixture.config,
      signal: new AbortController().signal,
      emit: (event) => events.push(event),
      interactivePermissions: false,
      providerLaunch: {
        command: process.execPath,
        args: [fixture.agent],
        env: { SPEC_FINDER_TEST_PROMPT_LOG: fixture.promptLog },
        authMethod: null,
      },
    })

    expect(result).toEqual({ ok: false, completed: 0, failed: 0, blocked: 1 })
    expect(activityMessages(events).some((message) => (
      message.includes("checkpoint pre-memory baseline blocked")
      && message.includes("pre-existing Git changes")
    ))).toBeTrue()
    expect(await access(fixture.promptLog).then(() => true, () => false)).toBeFalse()
  })
})

function recordingCheckpointService(timeline: string[]): CheckpointServiceContract {
  return {
    begin: async () => {
      timeline.push("begin")
      return { state: "created", message: "baseline" }
    },
    complete: async () => {
      timeline.push("complete")
      return { state: "created", commit: "test-commit" }
    },
    retry: async () => ({ state: "created", commit: "test-commit" }),
    preserve: async () => ({ state: "created", message: "recovery state" }),
  }
}

async function createPacketFixture(titles: string[]): Promise<{
  root: string
  packet: string
  promptLog: string
  agent: string
  config: ReturnType<typeof parseConfig>
}> {
  const root = await mkdtemp(join(tmpdir(), "spec-finder-engine-packet-"))
  const packet = join(root, ".spec-finder", "tasks", "demo")
  await mkdir(packet, { recursive: true })
  const logDirectory = await mkdtemp(join(tmpdir(), "spec-finder-engine-log-"))
  await Promise.all(titles.map(async (title, index) => {
    const number = String(index + 1).padStart(2, "0")
    const dependency = index === 0 ? "[]" : "[task_" + String(index).padStart(2, "0") + "]"
    const source = [
      "---",
      "status: pending",
      "title: " + title,
      "type: test",
      "complexity: low",
      "dependencies: " + dependency,
      "---",
      "",
      "# Task " + number + ": " + title,
      "",
    ].join("\n")
    await writeFile(join(packet, "task_" + number + ".md"), source)
  }))
  return {
    root,
    packet,
    promptLog: join(logDirectory, "prompts.log"),
    agent: join(import.meta.dir, "fixtures", "mock-agent.ts"),
    config: parseConfig({
      ...DEFAULT_CONFIG,
      provider: "cursor",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
      auto_commit: true,
    }),
  }
}

async function createGitPacketFixture(titles: string[]): Promise<Awaited<ReturnType<typeof createPacketFixture>>> {
  const fixture = await createPacketFixture(titles)
  await runGitCommand(fixture.root, ["init", "-q"])
  await runGitCommand(fixture.root, ["config", "user.name", "Spec Finder Test"])
  await runGitCommand(fixture.root, ["config", "user.email", "spec-finder@example.test"])
  await runGitCommand(fixture.root, ["add", "--", ".spec-finder/tasks/demo"])
  await runGitCommand(fixture.root, ["commit", "-m", "initial"])
  return fixture
}

async function runGitCommand(root: string, args: readonly string[]): Promise<void> {
  const result = await runCheckpointGit(args, root)
  if (result.exitCode !== 0) throw new Error("git " + args.join(" ") + " failed: " + (result.stderr || result.stdout))
}

async function createRetryFixture(title: string): Promise<{
  root: string
  promptLog: string
  agent: string
  config: ReturnType<typeof parseConfig>
}> {
  const root = await mkdtemp(join(tmpdir(), "spec-finder-engine-retry-"))
  const packet = join(root, ".spec-finder", "tasks", "demo")
  await mkdir(packet, { recursive: true })
  await writeFile(join(packet, "task_01.md"), `---
status: pending
title: ${title}
type: test
complexity: low
dependencies: []
---

# Task 01: ${title}
`)
  return {
    root,
    promptLog: join(root, "prompts.log"),
    agent: join(import.meta.dir, "fixtures", "mock-agent.ts"),
    config: parseConfig({
      ...DEFAULT_CONFIG,
      provider: "cursor",
      model: "auto",
      reasoning: "auto",
      speed: "auto",
      permissions: "approve-all",
    }),
  }
}

function occurrences(value: string, needle: string): number {
  return value.split(needle).length - 1
}

function activityMessages(events: readonly RunEvent[]): string[] {
  return events.flatMap((event) => event.type === "activity" ? [event.message] : [])
}
