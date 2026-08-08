import { describe, expect, test } from "bun:test"
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEFAULT_CONFIG } from "../src/config.ts"
import {
  runBatch,
  parseMultipleArgs,
  type BatchResult,
  type BatchRunOptions,
  type PacketRunner,
} from "../src/batch.ts"

describe("batch argument parsing", () => {
  test("accepts one ordered comma-separated list", () => {
    expect(parseMultipleArgs(["--multiple", "alpha,beta"]).mode).toBe("batch")
    expect(parseMultipleArgs(["--multiple", "alpha,beta"])).toEqual({
      mode: "batch",
      slugs: ["alpha", "beta"],
      runtimeArgs: [],
    })
  })

  test("preserves runtime option tokens in their declared order", () => {
    expect(parseMultipleArgs([
      "--speed", "fast",
      "--multiple", "alpha,beta",
      "--provider", "codex",
      "--model", "gpt-5.6-sol",
      "--reasoning", "max",
      "--no-ui",
    ])).toEqual({
      mode: "batch",
      slugs: ["alpha", "beta"],
      runtimeArgs: [
        "--speed", "fast",
        "--provider", "codex",
        "--model", "gpt-5.6-sol",
        "--reasoning", "max",
        "--no-ui",
      ],
    })
  })

  test("keeps the legacy argument path untouched when batch mode is absent", () => {
    expect(parseMultipleArgs(["single-packet", "--no-ui", "--provider", "codex"])).toEqual({
      mode: "single",
      args: ["single-packet", "--no-ui", "--provider", "codex"],
    })
  })

  test.each([
    ["empty entry", ["--multiple", "alpha,,beta"], "empty_slug"],
    ["duplicate entry", ["--multiple", "alpha,beta,alpha"], "duplicate_slug"],
    ["malformed slug", ["--multiple", "alpha/../beta"], "invalid_slug"],
    ["option-like list value", ["--multiple", "--no-ui"], "option_like_value"],
    ["option-like list entry", ["--multiple", "alpha,--no-ui"], "option_like_value"],
    ["missing list value", ["--multiple"], "missing_multiple_value"],
    ["positional slug", ["alpha", "--multiple", "beta"], "positional_slug"],
    ["repeated option", ["--multiple", "alpha", "--multiple", "beta"], "repeated_multiple"],
    ["unknown option", ["--multiple", "alpha", "--verbose"], "unknown_option"],
    ["missing runtime value", ["--multiple", "alpha", "--model", "--no-ui"], "missing_runtime_value"],
  ] as const)("rejects %s before producing a batch", (_label, args, code) => {
    const result = parseMultipleArgs(args)
    expect(result.mode).toBe("error")
    if (result.mode !== "error") throw new Error("expected a parse error")
    expect(result.error.code).toBe(code)
    expect(result.error.message.length).toBeGreaterThan(0)
    expect(result).not.toHaveProperty("slugs")
  })
})

describe("batch contracts", () => {
  test("keep aggregate result and runner contracts independent from single-run events", () => {
    const result: BatchResult = {
      ok: true,
      status: "completed",
      packets: [
        { slug: "alpha", outcome: "succeeded", detail: "completed" },
        { slug: "beta", outcome: "succeeded", detail: "already_complete" },
      ],
    }
    const runner: PacketRunner = async () => ({ ok: true, completed: 1, failed: 0, blocked: 0 })
    const options: BatchRunOptions = {
      slugs: ["alpha", "beta"],
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      packetRunner: runner,
    }

    expect(result.packets.map((packet) => packet.slug)).toEqual(options.slugs)
    expect(options.packetRunner).toBe(runner)
  })
})

describe("batch preflight and serial coordination", () => {
  test("runs every preflighted packet in declared order with shared signal and config", async () => {
    const root = await createRoot()
    await createPacket(root, "alpha")
    await createPacket(root, "beta")
    await createPacket(root, "gamma")
    const controller = new AbortController()
    const calls: Array<{ slug: string; signal: AbortSignal; config: typeof DEFAULT_CONFIG }> = []
    const runner: PacketRunner = async (options) => {
      calls.push({ slug: options.slug, signal: options.signal, config: options.config })
      return { ok: true, completed: 1, failed: 0, blocked: 0 }
    }

    const result = await runBatch({
      root,
      slugs: ["alpha", "beta", "gamma"],
      config: DEFAULT_CONFIG,
      signal: controller.signal,
      packetRunner: runner,
    })

    expect(calls.map((call) => call.slug)).toEqual(["alpha", "beta", "gamma"])
    expect(calls.every((call) => call.signal === controller.signal)).toBe(true)
    expect(calls.every((call) => call.config === DEFAULT_CONFIG)).toBe(true)
    expect(result).toEqual({
      ok: true,
      status: "completed",
      packets: [
        { slug: "alpha", outcome: "succeeded", detail: "completed" },
        { slug: "beta", outcome: "succeeded", detail: "completed" },
        { slug: "gamma", outcome: "succeeded", detail: "completed" },
      ],
    })
  })

  test("preflights the complete sequence and starts zero runners on a later unknown packet", async () => {
    const root = await createRoot()
    const alpha = await createPacket(root, "alpha")
    const calls: string[] = []
    const runner: PacketRunner = async (options) => {
      calls.push(options.slug)
      return { ok: true, completed: 1, failed: 0, blocked: 0 }
    }

    const result = await runBatch({
      root,
      slugs: ["alpha", "missing"],
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      packetRunner: runner,
    })

    expect(calls).toEqual([])
    expect(result).toEqual({
      ok: false,
      status: "preflight_failed",
      packets: [
        { slug: "alpha", outcome: "not_started" },
        { slug: "missing", outcome: "not_started" },
      ],
    })
    await expectMissing(join(alpha, "memory"))
  })

  test("rejects duplicate packet slugs before invoking the runner", async () => {
    const root = await createRoot()
    await createPacket(root, "alpha")
    const calls: string[] = []
    const runner: PacketRunner = async (options) => {
      calls.push(options.slug)
      return { ok: true, completed: 1, failed: 0, blocked: 0 }
    }

    const result = await runBatch({
      root,
      slugs: ["alpha", "alpha"],
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      packetRunner: runner,
    })

    expect(calls).toEqual([])
    expect(result.status).toBe("preflight_failed")
    expect(result.packets).toEqual([
      { slug: "alpha", outcome: "not_started" },
      { slug: "alpha", outcome: "not_started" },
    ])
  })

  test("stops after a failed middle packet and marks later packets not started", async () => {
    const root = await createRoot()
    await createPacket(root, "alpha")
    await createPacket(root, "beta")
    await createPacket(root, "gamma")
    const calls: string[] = []
    const runner: PacketRunner = async (options) => {
      calls.push(options.slug)
      return options.slug === "beta"
        ? { ok: false, completed: 0, failed: 1, blocked: 0 }
        : { ok: true, completed: 1, failed: 0, blocked: 0 }
    }

    const result = await runBatch({
      root,
      slugs: ["alpha", "beta", "gamma"],
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      packetRunner: runner,
    })

    expect(calls).toEqual(["alpha", "beta"])
    expect(result).toEqual({
      ok: false,
      status: "failed",
      stoppingSlug: "beta",
      packets: [
        { slug: "alpha", outcome: "succeeded", detail: "completed" },
        { slug: "beta", outcome: "failed", detail: "stopped" },
        { slug: "gamma", outcome: "not_started" },
      ],
    })
  })

  test("normalizes shared abort and ACP cancellation to cancelled", async () => {
    const root = await createRoot()
    await createPacket(root, "alpha")
    await createPacket(root, "beta")
    await createPacket(root, "gamma")
    const controller = new AbortController()
    const calls: string[] = []
    const runner: PacketRunner = async (options) => {
      calls.push(options.slug)
      if (options.slug === "alpha") {
        controller.abort()
        throw new Error("run cancelled")
      }
      return { ok: true, completed: 1, failed: 0, blocked: 0 }
    }

    const result = await runBatch({
      root,
      slugs: ["alpha", "beta", "gamma"],
      config: DEFAULT_CONFIG,
      signal: controller.signal,
      packetRunner: runner,
    })

    expect(calls).toEqual(["alpha"])
    expect(result.status).toBe("cancelled")
    expect(result.stoppingSlug).toBe("alpha")
    expect(result.packets).toEqual([
      { slug: "alpha", outcome: "cancelled", detail: "stopped" },
      { slug: "beta", outcome: "not_started" },
      { slug: "gamma", outcome: "not_started" },
    ])

    const acpController = new AbortController()
    const acpResult = await runBatch({
      root,
      slugs: ["alpha", "beta"],
      config: DEFAULT_CONFIG,
      signal: acpController.signal,
      packetRunner: async ({ emit }) => {
        emit({ type: "activity", taskId: "task_01", message: "implementation stopped: cancelled" })
        return { ok: false, completed: 0, failed: 1, blocked: 0 }
      },
    })
    expect(acpResult.status).toBe("cancelled")
    expect(acpResult.packets).toEqual([
      { slug: "alpha", outcome: "cancelled", detail: "stopped" },
      { slug: "beta", outcome: "not_started" },
    ])
  })

  test("keeps provider, permission, and report failures as failed", async () => {
    const root = await createRoot()
    await createPacket(root, "alpha")
    await createPacket(root, "beta")
    const result = await runBatch({
      root,
      slugs: ["alpha", "beta"],
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      packetRunner: async () => {
        throw new Error("permission refused")
      },
    })

    expect(result.status).toBe("failed")
    expect(result.packets).toEqual([
      { slug: "alpha", outcome: "failed", detail: "stopped" },
      { slug: "beta", outcome: "not_started" },
    ])

    const providerResult = await runBatch({
      root,
      slugs: ["alpha", "beta"],
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      packetRunner: async () => {
        throw new Error("provider request cancelled by upstream")
      },
    })
    expect(providerResult.status).toBe("failed")

    const refusalResult = await runBatch({
      root,
      slugs: ["alpha", "beta"],
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      packetRunner: async ({ emit }) => {
        emit({ type: "activity", taskId: "task_01", message: "permission request cancelled because the cockpit is read-only" })
        emit({ type: "activity", taskId: "task_01", message: "implementation stopped: refusal" })
        return { ok: false, completed: 0, failed: 1, blocked: 0 }
      },
    })
    expect(refusalResult.status).toBe("failed")
    expect(refusalResult.packets[0]).toEqual({ slug: "alpha", outcome: "failed", detail: "stopped" })
  })

  test("reports an empty execution order as already complete while preserving success", async () => {
    const root = await createRoot()
    await createPacket(root, "complete", "completed")
    const calls: string[] = []
    const result = await runBatch({
      root,
      slugs: ["complete"],
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      packetRunner: async (options) => {
        calls.push(options.slug)
        return { ok: true, completed: 0, failed: 0, blocked: 0 }
      },
    })

    expect(calls).toEqual(["complete"])
    expect(result).toEqual({
      ok: true,
      status: "completed",
      packets: [{ slug: "complete", outcome: "succeeded", detail: "already_complete" }],
    })
  })

  test("keeps the default runner compatible with the packet engine", async () => {
    const root = await createRoot()
    await createPacket(root, "alpha", "completed")
    await createPacket(root, "beta", "completed")
    const events: string[] = []

    const result = await runBatch({
      root,
      slugs: ["alpha", "beta"],
      config: DEFAULT_CONFIG,
      signal: new AbortController().signal,
      onEvent: (event) => {
        if (event.type === "run_started" || event.type === "run_finished") events.push(event.type)
      },
    })

    expect(result.ok).toBe(true)
    expect(result.packets.map((packet) => packet.detail)).toEqual(["already_complete", "already_complete"])
    expect(events).toEqual(["run_started", "run_finished", "run_started", "run_finished"])
  })

  test("does full read-only preflight before an already-aborted sequence starts", async () => {
    const root = await createRoot()
    const alpha = await createPacket(root, "alpha")
    await createPacket(root, "beta")
    const controller = new AbortController()
    controller.abort()
    const calls: string[] = []

    const result = await runBatch({
      root,
      slugs: ["alpha", "beta"],
      config: DEFAULT_CONFIG,
      signal: controller.signal,
      packetRunner: async (options) => {
        calls.push(options.slug)
        return { ok: true, completed: 1, failed: 0, blocked: 0 }
      },
    })

    expect(calls).toEqual([])
    expect(result).toEqual({
      ok: false,
      status: "cancelled",
      packets: [
        { slug: "alpha", outcome: "not_started" },
        { slug: "beta", outcome: "not_started" },
      ],
    })
    await expectMissing(join(alpha, "memory"))
  })
})

async function createRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "spec-finder-batch-"))
}

async function createPacket(root: string, slug: string, status: "pending" | "completed" = "pending"): Promise<string> {
  const directory = join(root, ".spec-finder", "tasks", slug)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, "task_01.md"), `---
status: ${status}
title: Build ${slug}
type: test
complexity: low
dependencies: []
---

# Task 01: Build ${slug}

## Requirements

1. Exercise the batch coordinator.
`)
  return directory
}

async function expectMissing(path: string): Promise<void> {
  let exists = true
  try {
    await access(path)
  } catch {
    exists = false
  }
  expect(exists).toBe(false)
}
