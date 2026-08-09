import { describe, expect, test } from "bun:test"
import { PassThrough } from "node:stream"
import { DEFAULT_CONFIG } from "../src/config.ts"
import { runCommand, resolveSetupOptions } from "../src/commands.ts"
import type { BatchResult } from "../src/batch.ts"
import type { SetupPickerInput } from "../src/ui/setup-picker.ts"

class FakeTtyInput extends PassThrough implements SetupPickerInput {
  isTTY = true
  isRaw = false
  readonly rawModes: boolean[] = []

  setRawMode(mode: boolean): void {
    this.isRaw = mode
    this.rawModes.push(mode)
  }
}

function terminalHarness(): {
  input: FakeTtyInput
  output: PassThrough
  text: () => string
} {
  const input = new FakeTtyInput()
  const output = new PassThrough()
  let rendered = ""
  output.on("data", (chunk) => { rendered += chunk.toString() })
  return { input, output, text: () => rendered }
}

function commandOutput(isTTY = false): {
  output: PassThrough & { isTTY: boolean }
  text: () => string
} {
  const output = Object.assign(new PassThrough(), { isTTY })
  let rendered = ""
  output.on("data", (chunk) => { rendered += chunk.toString() })
  return { output, text: () => rendered }
}

async function waitForText(text: () => string, expected: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (text().includes(expected)) return
    await Bun.sleep(5)
  }
  throw new Error(`setup picker did not render ${JSON.stringify(expected)}`)
}

describe("setup command options", () => {
  test("keeps every repeated --agent selection and accepts explicit non-interactive choices", async () => {
    await expect(resolveSetupOptions([
      "--agent", "claude",
      "--agent", "cursor",
      "--agent", "claude",
      "--global",
      "--symlink",
    ], { interactive: false })).resolves.toEqual({
      targets: ["claude", "cursor", "claude"],
      scope: "global",
      mode: "symlink",
    })
  })

  test("uses all, local, and copy defaults without a terminal", async () => {
    await expect(resolveSetupOptions([], { interactive: false })).resolves.toEqual({
      targets: ["claude", "codex", "cursor"],
      scope: "local",
      mode: "copy",
    })
  })

  test("prompts only for setup choices omitted from flags", async () => {
    const terminal = terminalHarness()
    const resolution = resolveSetupOptions(["--agent", "codex", "--local"], {
      interactive: true,
      input: terminal.input,
      output: terminal.output,
    })
    await waitForText(terminal.text, "Choose skill installation mode")
    terminal.input.write("\u001B[B")
    terminal.input.write("\r")
    const options = await resolution

    expect(options).toEqual({ targets: ["codex"], scope: "local", mode: "symlink" })
    expect(terminal.text()).not.toContain("Select providers")
    expect(terminal.text()).not.toContain("Choose installation scope")
  })

  test("uses arrows, Space, and Enter across all interactive setup choices", async () => {
    const terminal = terminalHarness()
    const resolution = resolveSetupOptions([], {
      interactive: true,
      input: terminal.input,
      output: terminal.output,
    })

    await waitForText(terminal.text, "Select providers")
    terminal.input.write("\u001B[B\u001B[B")
    terminal.input.write(" ")
    terminal.input.write("\r")

    await waitForText(terminal.text, "Choose installation scope")
    terminal.input.write("\u001B[B")
    terminal.input.write("\r")

    await waitForText(terminal.text, "Choose skill installation mode")
    terminal.input.write("\u001B[B")
    terminal.input.write("\r")

    await expect(resolution).resolves.toEqual({
      targets: ["claude", "codex"],
      scope: "global",
      mode: "symlink",
    })
    expect(terminal.input.rawModes).toEqual([true, false, true, false, true, false])
    expect(terminal.input.isPaused()).toBe(true)
    expect(terminal.text()).toContain("↑/↓ move · Space toggle · Enter confirm · Esc cancel")
  })

  test("requires one provider and restores raw mode after cancellation", async () => {
    const terminal = terminalHarness()
    const resolution = resolveSetupOptions(["--local", "--copy"], {
      interactive: true,
      input: terminal.input,
      output: terminal.output,
    })

    await waitForText(terminal.text, "Select providers")
    terminal.input.write(" ")
    terminal.input.write("\u001B[B ")
    terminal.input.write("\u001B[B ")
    terminal.input.write("\r")
    await waitForText(terminal.text, "Select at least one provider before continuing")
    terminal.input.write("\u001B")

    await expect(resolution).rejects.toThrow("setup cancelled")
    expect(terminal.input.rawModes).toEqual([true, false])
    expect(terminal.input.isPaused()).toBe(true)
  })

  test("rejects conflicting flags and missing providers", async () => {
    await expect(resolveSetupOptions(["--global", "--local"], { interactive: false }))
      .rejects.toThrow("setup accepts either --global or --local, not both")
    await expect(resolveSetupOptions(["--symlink", "--copy"], { interactive: false }))
      .rejects.toThrow("setup accepts either --symlink or --copy, not both")
    await expect(resolveSetupOptions(["--agent"], { interactive: false }))
      .rejects.toThrow("setup requires a provider after --agent")
  })
})

describe("run command batch integration", () => {
  test("routes validated batch arguments once with shared signal/config and deterministic success output", async () => {
    const terminal = commandOutput()
    const signals: AbortSignal[] = []
    const configs: typeof DEFAULT_CONFIG[] = []
    let calls = 0
    const result = await runCommand(["--multiple", "alpha,beta", "--no-ui", "--model", "batch-model"], {
      root: "/tmp/spec-finder-command-test",
      output: terminal.output,
      loadConfig: async () => DEFAULT_CONFIG,
      runBatch: async (options) => {
        calls += 1
        signals.push(options.signal)
        configs.push(options.config)
        options.onEvent?.({ type: "batch_started", slugs: options.slugs, total: options.slugs.length, config: options.config })
        options.onEvent?.({ type: "batch_packet_started", slug: "alpha", index: 0, total: 2, tasks: [] })
        options.onEvent?.({ type: "run_finished", ok: true, message: "nested packet result" })
        options.onEvent?.({ type: "batch_packet_finished", slug: "alpha", index: 0, outcome: "succeeded", detail: "completed" })
        options.onEvent?.({ type: "batch_packet_started", slug: "beta", index: 1, total: 2, tasks: [] })
        options.onEvent?.({ type: "batch_packet_finished", slug: "beta", index: 1, outcome: "succeeded", detail: "already_complete" })
        const batchResult: BatchResult = {
          ok: true,
          status: "completed",
          packets: [
            { slug: "alpha", outcome: "succeeded", detail: "completed" },
            { slug: "beta", outcome: "succeeded", detail: "already_complete" },
          ],
        }
        options.onEvent?.({ type: "batch_finished", ...batchResult })
        return batchResult
      },
    })

    expect(result).toBe(0)
    expect(calls).toBe(1)
    expect(signals).toHaveLength(1)
    expect(configs).toEqual([{ ...DEFAULT_CONFIG, model: "batch-model" }])
    expect(terminal.text()).toContain("batch: packet 1/2 started: alpha")
    expect(terminal.text()).toContain("batch: packet outcome: beta succeeded (already complete)")
    expect(terminal.text()).toContain("batch: aggregate succeeded (exit 0)")
    expect(terminal.text()).not.toContain("nested packet result")
    expect(terminal.text()).not.toContain("run_finished")
  })

  test("prints the stopping packet, later not-started packets, and no-retry guidance", async () => {
    const terminal = commandOutput()
    const batchResult: BatchResult = {
      ok: false,
      status: "failed",
      stoppingSlug: "beta",
      packets: [
        { slug: "alpha", outcome: "succeeded", detail: "completed" },
        { slug: "beta", outcome: "failed", detail: "stopped" },
        { slug: "gamma", outcome: "not_started" },
      ],
    }
    const result = await runCommand(["--multiple", "alpha,beta,gamma", "--no-ui"], {
      root: "/tmp/spec-finder-command-test",
      output: terminal.output,
      loadConfig: async () => DEFAULT_CONFIG,
      runBatch: async (options) => {
        options.onEvent?.({ type: "batch_started", slugs: options.slugs, total: 3 })
        options.onEvent?.({ type: "batch_packet_started", slug: "alpha", index: 0, total: 3, tasks: [] })
        options.onEvent?.({ type: "batch_packet_finished", slug: "alpha", index: 0, outcome: "succeeded", detail: "completed" })
        options.onEvent?.({ type: "batch_packet_started", slug: "beta", index: 1, total: 3, tasks: [] })
        options.onEvent?.({ type: "batch_packet_finished", slug: "beta", index: 1, outcome: "failed", detail: "stopped" })
        options.onEvent?.({ type: "batch_finished", ...batchResult })
        return batchResult
      },
    })

    expect(result).toBe(1)
    expect(terminal.text()).toContain("batch: packet outcome: gamma not_started")
    expect(terminal.text()).toContain("batch: stopping packet: beta (failed)")
    expect(terminal.text()).toContain("batch: no automatic retry; resolve the issue and rerun manually")
    expect(terminal.text()).toContain("batch: aggregate failed (exit 1)")
  })

  test("maps cancellation and preflight aggregate results to exit 1", async () => {
    const terminal = commandOutput()
    const cancelled: BatchResult = {
      ok: false,
      status: "cancelled",
      stoppingSlug: "beta",
      packets: [
        { slug: "alpha", outcome: "succeeded", detail: "completed" },
        { slug: "beta", outcome: "cancelled", detail: "stopped" },
        { slug: "gamma", outcome: "not_started" },
      ],
    }
    const cancellationExit = await runCommand(["--multiple", "alpha,beta,gamma", "--no-ui"], {
      root: "/tmp/spec-finder-command-test",
      output: terminal.output,
      loadConfig: async () => DEFAULT_CONFIG,
      runBatch: async (options) => {
        options.onEvent?.({ type: "batch_finished", ...cancelled })
        return cancelled
      },
    })
    expect(cancellationExit).toBe(1)
    expect(terminal.text()).toContain("batch: stopping packet: beta (cancelled)")

    const preflightTerminal = commandOutput()
    const preflight: BatchResult = {
      ok: false,
      status: "preflight_failed",
      packets: [
        { slug: "alpha", outcome: "not_started" },
        { slug: "missing", outcome: "not_started" },
      ],
    }
    const preflightExit = await runCommand(["--multiple", "alpha,missing", "--no-ui"], {
      root: "/tmp/spec-finder-command-test",
      output: preflightTerminal.output,
      loadConfig: async () => DEFAULT_CONFIG,
      runBatch: async (options) => {
        options.onEvent?.({
          type: "batch_finished",
          ...preflight,
          message: "batch preflight failed:\n- packet missing: task packet not found",
        })
        return preflight
      },
    })
    expect(preflightExit).toBe(1)
    expect(preflightTerminal.text()).toContain("batch: preflight failed; no packets started")
    expect(preflightTerminal.text()).toContain("packet missing: task packet not found")
    expect(preflightTerminal.text()).not.toContain("batch: starting")
    expect(preflightTerminal.text()).toContain("batch: packet outcome: missing not_started")
  })

  test("rejects invalid batch grammar before config, renderer, or coordinator start", async () => {
    let configCalls = 0
    let rendererCalls = 0
    let coordinatorCalls = 0
    await expect(runCommand(["--multiple", "alpha", "--multiple", "beta"], {
      output: commandOutput().output,
      loadConfig: async () => {
        configCalls += 1
        return DEFAULT_CONFIG
      },
      startCockpit: async () => {
        rendererCalls += 1
        return { close: () => undefined }
      },
      runBatch: async () => {
        coordinatorCalls += 1
        return { ok: true, status: "completed", packets: [] }
      },
    })).rejects.toThrow("--multiple may be provided only once")
    expect(configCalls).toBe(0)
    expect(rendererCalls).toBe(0)
    expect(coordinatorCalls).toBe(0)
  })

  test("closes one renderer after a thrown coordinator error and keeps the single-run branch intact", async () => {
    const output = commandOutput(true)
    let closeCalls = 0
    await expect(runCommand(["--multiple", "alpha,beta"], {
      root: "/tmp/spec-finder-command-test",
      output: output.output,
      noUi: false,
      loadConfig: async () => DEFAULT_CONFIG,
      startCockpit: async () => ({ close: () => { closeCalls += 1 } }),
      runBatch: async () => { throw new Error("preflight exploded") },
    })).rejects.toThrow("preflight exploded")
    expect(closeCalls).toBe(1)

    const singleOutput = commandOutput()
    const singleCalls: string[] = []
    const singleExit = await runCommand(["single-packet", "--no-ui"], {
      root: "/tmp/spec-finder-command-test",
      output: singleOutput.output,
      loadConfig: async () => DEFAULT_CONFIG,
      runTaskPacket: async (options) => {
        singleCalls.push(options.slug)
        options.emit({ type: "activity", taskId: "task_01", message: "single packet activity" })
        options.emit({ type: "run_finished", ok: true, message: "single packet complete" })
        return { ok: true, completed: 1, failed: 0, blocked: 0 }
      },
    })
    expect(singleExit).toBe(0)
    expect(singleCalls).toEqual(["single-packet"])
    expect(singleOutput.text()).toContain("task_01: single packet activity")
    expect(singleOutput.text()).toContain("ok: single packet complete")
  })
})
