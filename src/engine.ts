import { access, mkdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import type { SpecFinderConfig } from "./config.ts"
import type { RunEventListener } from "./events.ts"
import type { ProviderLaunch } from "./providers.ts"
import { runAcpTurn } from "./acp-client.ts"
import { executionOrder, loadTaskPacket, updateTaskStatus, validateTasks, type TaskFile } from "./tasks.ts"

const REPORT_DIRECTORY = "reports"

export interface RunOptions {
  root: string
  slug: string
  config: SpecFinderConfig
  signal: AbortSignal
  emit: RunEventListener
  interactivePermissions: boolean
  providerLaunch?: ProviderLaunch
}

export interface RunResult {
  ok: boolean
  completed: number
  failed: number
  blocked: number
}

export async function runTaskPacket(options: RunOptions): Promise<RunResult> {
  const packet = await loadTaskPacket(options.root, options.slug)
  const issues = validateTasks(packet.tasks)
  if (issues.length > 0) {
    throw new Error(`task packet is invalid:\n${issues.map((issue) => `- ${relative(options.root, issue.path)}: ${issue.message}`).join("\n")}`)
  }
  const ordered = executionOrder(packet.tasks)
  options.emit({ type: "run_started", slug: options.slug, config: options.config, tasks: packet.tasks })

  const failedIds = new Set<string>()
  let completed = 0
  let failed = 0
  let blocked = 0

  for (let current of ordered) {
    if (options.signal.aborted) throw new Error("run cancelled")
    const dependencyFailed = current.frontmatter.dependencies.some((dependency) => failedIds.has(dependency.replace(/\.md$/, "")))
    if (dependencyFailed) {
      current = await updateTaskStatus(current, "blocked")
      failedIds.add(current.id)
      blocked += 1
      options.emit({ type: "task_status", taskId: current.id, status: "blocked" })
      continue
    }

    current = await updateTaskStatus(current, "in_progress")
    options.emit({ type: "task_status", taskId: current.id, status: "in_progress" })
    options.emit({ type: "activity", taskId: current.id, message: "implementation session starting" })

    try {
      const implementation = await runAcpTurn({
        root: options.root,
        config: options.config,
        prompt: implementationPrompt(options.root, packet.directory, current),
        taskId: current.id,
        signal: options.signal,
        emit: options.emit,
        interactivePermissions: options.interactivePermissions,
        ...(options.providerLaunch ? { providerLaunch: options.providerLaunch } : {}),
      })
      if (!successfulStop(implementation.stopReason)) throw new Error(`implementation stopped: ${implementation.stopReason}`)

      const reportDirectory = join(packet.directory, REPORT_DIRECTORY)
      const reportPath = join(reportDirectory, `${current.id}.md`)
      await mkdir(reportDirectory, { recursive: true })
      options.emit({ type: "activity", taskId: current.id, message: "final report session starting" })
      const report = await runAcpTurn({
        root: options.root,
        config: options.config,
        prompt: reportPrompt(options.root, packet.directory, current, reportPath),
        taskId: current.id,
        signal: options.signal,
        emit: options.emit,
        interactivePermissions: options.interactivePermissions,
        ...(options.providerLaunch ? { providerLaunch: options.providerLaunch } : {}),
      })
      if (!successfulStop(report.stopReason)) throw new Error(`report stopped: ${report.stopReason}`)
      await assertReport(reportPath)

      current = await updateTaskStatus(current, "completed")
      completed += 1
      options.emit({ type: "task_status", taskId: current.id, status: "completed" })
    } catch (error) {
      current = await updateTaskStatus(current, "failed")
      failedIds.add(current.id)
      failed += 1
      options.emit({ type: "task_status", taskId: current.id, status: "failed" })
      options.emit({ type: "activity", taskId: current.id, message: error instanceof Error ? error.message : String(error) })
      break
    }
  }

  const ok = failed === 0 && blocked === 0 && !options.signal.aborted
  options.emit({
    type: "run_finished",
    ok,
    message: ok ? `${completed} task${completed === 1 ? "" : "s"} completed` : `${failed} failed · ${blocked} blocked`,
  })
  return { ok, completed, failed, blocked }
}

function implementationPrompt(root: string, packetDirectory: string, task: TaskFile): string {
  const prd = join(packetDirectory, "_prd.md")
  const techspec = join(packetDirectory, "_techspec.md")
  return `You are executing a Spec Finder implementation task in ${root}.

Read the complete task at ${task.path}. Read ${prd} and ${techspec} when they exist, plus every ADR referenced by the task. Treat the task requirements and repository instructions as authoritative.

Implement only this task. Preserve unrelated work. Run the task's required focused tests and the repository's relevant verification gate. Do not mark task frontmatter complete and do not write the final report; Spec Finder owns both lifecycle phases.

Task:
${task.source}`
}

function reportPrompt(root: string, packetDirectory: string, task: TaskFile, reportPath: string): string {
  return `You are the final-report phase for ${task.id} in ${root}.

Read ${task.path}, ${join(packetDirectory, "_prd.md")}, ${join(packetDirectory, "_techspec.md")}, relevant ADRs, the current git diff, and all verification evidence produced for this task. Re-run focused verification if the evidence is incomplete or stale.

Write the final report to ${reportPath}. The report MUST include: task and outcome; files changed; requirements satisfied; tests and exact results; unresolved risks or follow-ups; and a final verdict of completed, failed, or blocked. Be factual and never claim a test passed without terminal evidence. Do not change the task frontmatter status; Spec Finder owns it.

Use the sf-task-report skill if it is installed.`
}

function successfulStop(reason: string): boolean {
  return !["cancelled", "refusal", "max_tokens"].includes(reason)
}

async function assertReport(path: string): Promise<void> {
  await access(path)
  const report = await readFile(path, "utf8")
  if (report.trim().length < 120) throw new Error(`final report is missing or incomplete: ${path}`)
}
