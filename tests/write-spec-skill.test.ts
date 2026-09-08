import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ensurePacketMemory } from "../src/memory.ts"
import { SPECS_DIR } from "../src/paths.ts"
import { loadTaskPacket, parseTask, validateTasks } from "../src/tasks.ts"

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

const skillDir = join(import.meta.dir, "..", "skills", "sf-write-spec")
const taskTemplatePath = join(import.meta.dir, "..", "skills", "sf-create-tasks", "references", "task-template.md")

async function fillTaskTemplate(slug: string, number: string, title: string, dependencies: string[] = []): Promise<string> {
  const template = await readFile(taskTemplatePath, "utf8")
  const dependencyList = dependencies.length === 0 ? "[]" : `[${dependencies.join(", ")}]`
  return template
    .replaceAll("<slug>", slug)
    .replaceAll("[Imperative task title]", title)
    .replace("type: [frontend, backend, docs, test, infra, refactor, chore, bugfix, spike, or repository-defined type]", "type: backend")
    .replace("complexity: [low, medium, high, or critical]", "complexity: medium")
    .replace("dependencies: []", `dependencies: ${dependencyList}`)
    .replaceAll("Task NN:", `Task ${number}:`)
    .replaceAll("task_NN.md", `task_${number}.md`)
    .replace(/^Replace `[^`]+` with the current packet slug before writing the task\.[^\n]*\n\n/m, "")
}

describe("sf-write-spec packet contract", () => {
  test("encodes the defining AI-spec practices as hard gates and required output sections", async () => {
    const skill = await readFile(join(skillDir, "SKILL.md"), "utf8")
    const doctrine = await readFile(join(skillDir, "references", "doctrine.md"), "utf8")
    const spec = await readFile(join(skillDir, "references", "spec-template.md"), "utf8")
    const prd = await readFile(join(skillDir, "references", "prd-template.md"), "utf8")
    const techspec = await readFile(join(skillDir, "references", "techspec-template.md"), "utf8")
    const quality = await readFile(join(skillDir, "references", "quality-bar.md"), "utf8")
    const body = `${skill}\n${doctrine}\n${spec}\n${prd}\n${techspec}\n${quality}`

    expect(skill).toContain("<HARD-GATE>")
    expect(skill).toContain("sf-write-spec")
    expect(skill).toContain("This is not `sf-idea-factory`, `sf-create-prd`, `sf-create-techspec`, and `sf-create-tasks` run in sequence.")

    for (const needle of [
      "Given/When/Then",
      "works correctly",
      "Out of Scope",
      "Always",
      "Ask first",
      "Never",
      "_prd.md",
      "_techspec.md",
      "task_NN.md",
      ".spec-finder/specs/<slug>-spec.md",
      "whole-draft",
      "complete implementation prompt",
      "Current System",
      "quality-bar.md",

    ]) {
      expect(body).toContain(needle)
    }

    expect(prd).toContain("## Out of Scope")
    expect(prd.indexOf("## Out of Scope")).toBeLessThan(prd.indexOf("## In Scope"))
    expect(prd).toContain("**Given**")
    expect(prd).toContain("**When**")
    expect(prd).toContain("**Then**")
    expect(techspec).toContain("## Agent Boundaries")
    expect(techspec).toContain("### Always")
    expect(techspec).toContain("### Ask first")
    expect(techspec).toContain("### Never")
    expect(techspec).toContain("## Failure and Edge Cases")
    expect(techspec).toContain("## Relevant Files and Patterns")
    expect(techspec).toContain("**Gates:**")
    expect(skill).toContain("../sf-create-tasks/references/task-template.md")
    expect(skill).toContain(".spec-finder/specs/<slug>-spec.md")
    expect(spec).toContain("## Execution")
    expect(spec).toContain("## Problem")
    expect(spec).toContain("## Out of Scope")
    expect(spec.indexOf("## Out of Scope")).toBeLessThan(spec.indexOf("## In Scope"))
    expect(spec).toContain("## Acceptance")
    expect(spec).toContain("## Contracts")
    expect(spec).toContain("## Agent Boundaries")
    expect(spec).toContain("### Always")
    expect(spec).toContain("### Ask first")
    expect(spec).toContain("### Never")
    expect(spec).toContain("## Failure and Edge Cases")
    expect(spec).toContain("## Relevant Files and Patterns")
    expect(spec).toContain("## Verification")
    expect(spec).toContain("## Slices")
    expect(spec).toContain("**Focused:**")
    expect(spec).toContain("**Repository gate:**")
    expect(spec).toContain("## Current System")
    expect(spec).toContain("## Output")
    expect(spec).toContain("Read first because")
    expect(spec).toContain("current evidence, not the fix")
    expect(spec).toContain("Valid:")
    expect(spec).toContain("Invalid:")
    expect(doctrine).toContain("The spec is the prompt")
    expect(quality).toContain("NO PROMPT WITHOUT CURRENT-SYSTEM EVIDENCE")
    expect(skill).toContain("against `.spec-finder/specs/<slug>-spec.md` only")
    expect(quality).toContain("This bar applies only to `.spec-finder/specs/<slug>-spec.md`")
    expect(quality).toContain("every template token must be replaced")

    expect(skill).toContain("references/quality-bar.md")

  })

  test("writes the agent-executable spec at .spec-finder/specs/<slug>-spec.md from the shipped template", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-write-spec-file-"))
    roots.push(root)
    const slug = "write-spec-demo"
    const template = await readFile(join(skillDir, "references", "spec-template.md"), "utf8")
    const filled = template.replaceAll("<slug>", slug).replaceAll("[Feature]", "Write spec demo")
    const specPath = join(root, ".spec-finder", SPECS_DIR, `${slug}-spec.md`)
    await mkdir(join(root, ".spec-finder", SPECS_DIR), { recursive: true })
    await writeFile(specPath, filled)

    expect(specPath.endsWith(`.spec-finder/specs/${slug}-spec.md`)).toBe(true)
    const body = await readFile(specPath, "utf8")
    expect(body).toContain(`.spec-finder/specs/${slug}-spec.md`)
    expect(body).toContain(`.spec-finder/tasks/${slug}/`)
    expect(body).not.toContain("<slug>")
    expect(body).toContain("## Execution")
    expect(body).toContain("**Given**")
    expect(body).toContain("**When**")
    expect(body).toContain("**Then**")
    expect(body).toContain("### Always")
    expect(body).toContain("### Ask first")
    expect(body).toContain("### Never")
    expect(body).toContain("## Failure and Edge Cases")


    expect(body).toContain("## Current System")
    expect(body).toContain("## Output")
    expect(body).toContain("Read first because")

  })

  test("a packet from this path loads through the shipped task parser and memory writer", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-write-spec-"))
    roots.push(root)
    const slug = "write-spec-demo"
    const directory = join(root, ".spec-finder", "tasks", slug)
    await mkdir(directory, { recursive: true })

    const prdTemplate = await readFile(join(skillDir, "references", "prd-template.md"), "utf8")
    const techspecTemplate = await readFile(join(skillDir, "references", "techspec-template.md"), "utf8")
    const indexTemplate = await readFile(join(skillDir, "references", "tasks-index-template.md"), "utf8")
    const first = await fillTaskTemplate(slug, "01", "Expose dry-run without writing files")
    const second = await fillTaskTemplate(slug, "02", "Resume after interrupt skips completed work", ["task_01"])

    const specTemplate = await readFile(join(skillDir, "references", "spec-template.md"), "utf8")
    const specDir = join(root, ".spec-finder", SPECS_DIR)
    await mkdir(specDir, { recursive: true })
    await writeFile(
      join(specDir, `${slug}-spec.md`),
      specTemplate.replaceAll("<slug>", slug).replaceAll("[Feature]", "Write spec demo"),
    )
    await writeFile(join(directory, "_prd.md"), prdTemplate.replaceAll("<slug>", slug))
    await writeFile(join(directory, "_techspec.md"), techspecTemplate.replaceAll("<slug>", slug))
    await writeFile(join(directory, "_tasks.md"), indexTemplate.replaceAll("[Feature]", "Write spec demo"))
    await writeFile(join(directory, "task_01.md"), first)
    await writeFile(join(directory, "task_02.md"), second)

    expect(first).toContain(`.spec-finder/tasks/${slug}/_prd.md`)
    expect(first).toContain(`.spec-finder/tasks/${slug}/_techspec.md`)
    expect(first).not.toContain("<slug>")
    expect(second).not.toContain("<slug>")

    const parsed = parseTask(join(directory, "task_01.md"), first)
    expect(parsed.frontmatter).toMatchObject({
      status: "pending",
      title: "Expose dry-run without writing files",
      type: "backend",
      complexity: "medium",
      dependencies: [],
    })
    expect(parsed.id).toBe("task_01")

    const packet = await loadTaskPacket(root, slug)
    expect(packet.directory).toBe(directory)
    expect(packet.tasks.map((task) => task.id)).toEqual(["task_01", "task_02"])
    expect(validateTasks(packet.tasks)).toEqual([])
    expect(packet.tasks[1]!.frontmatter.dependencies).toEqual(["task_01"])

    await ensurePacketMemory(directory, packet.tasks)
    expect(await readFile(join(directory, "memory", "MEMORY.md"), "utf8")).toContain("# Workflow Memory")
    expect(await readFile(join(directory, "memory", "task_01.md"), "utf8")).toContain("task_01")
    expect(await readFile(join(directory, "memory", "task_02.md"), "utf8")).toContain("task_02")
    expect(await readFile(join(root, ".spec-finder", SPECS_DIR, `${slug}-spec.md`), "utf8"))
      .toContain(`.spec-finder/specs/${slug}-spec.md`)
  })
})
