import { Readable, Writable } from "node:stream"
import { appendFile } from "node:fs/promises"
import * as acp from "@agentclientprotocol/sdk"

const stream = acp.ndJsonStream(
  Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as unknown as ReadableStream<Uint8Array>,
)

acp
  .agent({ name: "spec-finder-test-agent" })
  .onRequest(acp.methods.agent.initialize, () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
    agentInfo: { name: "spec-finder-test-agent", version: "1.0.0", title: "Test Agent" },
  }))
  .onRequest(acp.methods.agent.session.new, () => ({ sessionId: "test-session" }))
  .onRequest(acp.methods.agent.session.prompt, async (context) => {
    const prompt = context.params.prompt
      .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
      .map((block) => block.text)
      .join("\n")
    if (process.env.SPEC_FINDER_TEST_PROMPT_LOG) {
      await appendFile(process.env.SPEC_FINDER_TEST_PROMPT_LOG, `${prompt}\n--- TURN ---\n`)
    }
    await context.client.notify(acp.methods.client.session.update, {
      sessionId: context.params.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "mock turn started" },
      },
    })
    const permission = await context.client.request(acp.methods.client.session.requestPermission, {
      sessionId: context.params.sessionId,
      toolCall: {
        toolCallId: "mock-edit",
        title: "Mock edit",
        kind: "edit",
        status: "pending",
      },
      options: [
        { optionId: "allow", name: "Allow", kind: "allow_once" },
        { optionId: "reject", name: "Reject", kind: "reject_once" },
      ],
    })
    if (permission.outcome.outcome !== "selected" || permission.outcome.optionId !== "allow") {
      return { stopReason: "refusal" }
    }
    const reportPath = prompt.match(/Write the final report to (.+)\. The report MUST/)?.[1]
    if (reportPath) {
      await context.client.request(acp.methods.client.fs.writeTextFile, {
        sessionId: context.params.sessionId,
        path: reportPath,
        content: `# Final Report\n\nTask and outcome: completed.\n\nFiles changed: mock output.\n\nRequirements satisfied: all mock requirements.\n\nTests and exact results: ACP integration passed.\n\nUnresolved risks: none.\n\nFinal verdict: completed.\n`,
      })
    }
    return { stopReason: "end_turn" }
  })
  .connect(stream)
