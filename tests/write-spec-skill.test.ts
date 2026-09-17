import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SPECS_DIR } from "../src/paths.ts"

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

const skillDir = join(import.meta.dir, "..", "skills", "sf-write-spec")

describe("sf-write-spec contract", () => {
  test("encodes one-file AI-spec practices as hard gates and required output sections", async () => {
    const skill = await readFile(join(skillDir, "SKILL.md"), "utf8")
    const doctrine = await readFile(join(skillDir, "references", "doctrine.md"), "utf8")
    const spec = await readFile(join(skillDir, "references", "spec-template.md"), "utf8")
    const quality = await readFile(join(skillDir, "references", "quality-bar.md"), "utf8")
    const body = `${skill}\n${doctrine}\n${spec}\n${quality}`

    expect(skill).toContain("<HARD-GATE>")
    expect(skill).toContain("sf-write-spec")
    expect(skill).toContain("This is not `sf-idea-factory`, `sf-create-prd`, `sf-create-techspec`, and `sf-create-tasks` run in sequence.")
    expect(skill).toContain("Write exactly one file")
    expect(skill).toContain("NEVER write or replace `.spec-finder/tasks/`")
    expect(skill).toContain("Do not point to `spec-finder run <slug>` or `sf-execute-task`")
    expect(doctrine).toContain("Single output only")
    expect(quality).toContain("NO RUNNER PACKET OUTPUT")

    for (const needle of [
      "Given/When/Then",
      "works correctly",
      "Out of Scope",
      "Always",
      "Ask first",
      "Never",
      ".spec-finder/specs/<slug>-spec.md",
      "whole-draft",
      "complete implementation prompt",
      "Current System",
      "quality-bar.md",
    ]) {
      expect(body).toContain(needle)
    }

    for (const forbidden of [
      "references/prd-template.md",
      "references/techspec-template.md",
      "references/tasks-index-template.md",
      "Product (`_prd.md`)",
      "Technical (`_techspec.md`)",
      "Slices (`_tasks.md` and `task_NN.md`)",
      "../sf-create-tasks/references/task-template.md",
      "plus a runner packet",
    ]) {
      expect(body).not.toContain(forbidden)
    }

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
    expect(skill).toContain("against `.spec-finder/specs/<slug>-spec.md`")
    expect(quality).toContain("This bar applies only to `.spec-finder/specs/<slug>-spec.md`")
    expect(quality).toContain("every template token must be replaced")

    expect(skill).toContain("references/quality-bar.md")
  })

  test("writes only the agent-executable spec at .spec-finder/specs/<slug>-spec.md from the shipped template", async () => {
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
    expect(body).not.toContain(`.spec-finder/tasks/${slug}/`)
    expect(body).not.toContain("Runner packet")
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
})
