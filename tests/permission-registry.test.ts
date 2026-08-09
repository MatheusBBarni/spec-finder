import { describe, expect, test } from "bun:test"
import { PassThrough } from "node:stream"
import type { RequestPermissionRequest } from "@agentclientprotocol/sdk"
import { createPermissionRegistry } from "../src/permission-registry.ts"

function terminal(): {
  input: PassThrough & { isTTY: boolean }
  output: PassThrough & { isTTY: boolean }
  text: () => string
} {
  const input = Object.assign(new PassThrough(), { isTTY: true })
  const output = Object.assign(new PassThrough(), { isTTY: true })
  let rendered = ""
  output.on("data", (chunk) => { rendered += chunk.toString() })
  return { input, output, text: () => rendered }
}

function request(title: string, options = [
  { optionId: "allow-once", name: "Allow once", kind: "allow_once" as const },
  { optionId: "allow-always", name: "Allow always", kind: "allow_always" as const },
  { optionId: "reject-once", name: "Reject once", kind: "reject_once" as const },
]): RequestPermissionRequest {
  return {
    sessionId: "session",
    toolCall: { toolCallId: title, title, kind: "edit", status: "pending" },
    options,
  }
}

describe("permission registry", () => {
  test("prefers once-scoped offered decisions without persisting always choices", async () => {
    const allow = createPermissionRegistry({ policy: "approve-all" })
    await expect(allow.request(request("allow"))).resolves.toEqual({ decision: "allowed", optionId: "allow-once" })

    const fallback = createPermissionRegistry({ policy: "approve-all" })
    await expect(fallback.request(request("fallback", [
      { optionId: "allow-always", name: "Allow always", kind: "allow_always" },
      { optionId: "reject-once", name: "Reject once", kind: "reject_once" },
    ]))).resolves.toEqual({ decision: "allowed", optionId: "allow-always" })

    const deny = createPermissionRegistry({ policy: "deny" })
    await expect(deny.request(request("deny"))).resolves.toEqual({ decision: "denied", optionId: "reject-once" })
    await expect(deny.request(request("deny-again"))).resolves.toEqual({ decision: "denied", optionId: "reject-once" })

    const host = createPermissionRegistry({ permission: "approve-all" })
    await expect(host.authorize(request("host"))).resolves.toMatchObject({ decision: "allowed" })
    await expect(host.authorizeWrite(request("host-write"))).resolves.toMatchObject({ decision: "allowed" })
    await expect(host.authorizeHostWrite(request("host-write-alias"))).resolves.toMatchObject({ decision: "allowed" })
    await expect(host.requestHostWrite(request("host-write-request"))).resolves.toMatchObject({ decision: "allowed" })
  })

  test("fails closed without an interactive terminal and never writes stdout", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: false })
    const output = Object.assign(new PassThrough(), { isTTY: false })
    let rendered = ""
    output.on("data", (chunk) => { rendered += chunk.toString() })
    const registry = createPermissionRegistry({ policy: "prompt", input, output })
    await expect(registry.request(request("noninteractive"))).resolves.toEqual({
      decision: "denied",
      optionId: "reject-once",
    })
    expect(rendered).toBe("")
  })

  test("supports concurrent interactive requests and assigns each input once", async () => {
    const io = terminal()
    const registry = createPermissionRegistry({ policy: "prompt", input: io.input, output: io.output })
    const first = registry.request(request("first"))
    const second = registry.request(request("second"))
    await Bun.sleep(1)
    io.input.write("1\n2\n")
    await expect(first).resolves.toEqual({ decision: "allowed", optionId: "allow-once" })
    await expect(second).resolves.toEqual({ decision: "allowed", optionId: "allow-always" })
    expect(io.text()).toContain("[exec] permission option 1: Allow once")
    expect(io.text()).not.toContain("raw")
    await registry.dispose()
  })

  test("settles every pending request exactly once during abort", async () => {
    const io = terminal()
    const registry = createPermissionRegistry({ policy: "prompt", input: io.input, output: io.output })
    const first = registry.request(request("first"))
    const second = registry.request(request("second"))
    await Bun.sleep(1)
    await registry.cancelPending()
    io.input.write("1\n1\n")
    await expect(first).resolves.toEqual({ decision: "cancelled" })
    await expect(second).resolves.toEqual({ decision: "cancelled" })
    expect(registry.pendingCount).toBe(0)
    expect(registry.aborted).toBe(true)
    await expect(registry.request(request("after-abort"))).resolves.toEqual({ decision: "cancelled" })
    await registry.cancelPending()
  })

  test("cancellation signal uses the same exactly-once settlement path", async () => {
    const io = terminal()
    const controller = new AbortController()
    const registry = createPermissionRegistry({ policy: "prompt", input: io.input, output: io.output, signal: controller.signal })
    const pending = registry.request(request("signal"))
    controller.abort()
    await expect(pending).resolves.toEqual({ decision: "cancelled" })
    expect(registry.pendingCount).toBe(0)
    await registry.dispose()
  })
})
