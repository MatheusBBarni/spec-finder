import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const skillDir = join(import.meta.dir, "..", "skills", "sf-write-spec")

describe("sf-write-spec contract", () => {
  test("encodes an adaptive agent-executable spec with bounded implementation questions", async () => {
    const skill = await readFile(join(skillDir, "SKILL.md"), "utf8")
    const doctrine = await readFile(join(skillDir, "references", "doctrine.md"), "utf8")
    const spec = await readFile(join(skillDir, "references", "spec-template.md"), "utf8")
    const quality = await readFile(join(skillDir, "references", "quality-bar.md"), "utf8")
    const body = `${skill}\n${doctrine}\n${spec}\n${quality}`

    expect(skill).toContain("<HARD-GATE>")
    expect(skill).toContain("sf-write-spec")
    expect(skill).toContain("This is not `sf-idea-factory`, `sf-create-prd`, `sf-create-techspec`, and `sf-create-tasks` run in sequence.")
    expect(skill).toContain("Write exactly one file")
    expect(skill).toContain(".spec-finder/tasks/<slug>/_spec.md")
    expect(skill).toContain("Do not point to `spec-finder run <slug>` or `sf-execute-task`")
    expect(doctrine).toContain("Single output only")
    expect(skill).toContain("approved `.spec-finder/tasks/<slug>/_prd.md`")
    expect(skill).toContain("Copy this path and point an agent at it:")
    expect(skill).toContain("PRD:")
    expect(skill).toContain("Stop and offer `sf-create-prd`")
    expect(skill).toContain("sf-tdd-write-spec")
    expect(doctrine).toContain("Core plus conditional")
    expect(quality).toContain("NO RUNNER PACKET OUTPUT")

    for (const needle of [
      "Given/When/Then",
      "works correctly",
      "Out of Scope",
      "Always",
      "Ask first",
      "Never",
      ".spec-finder/tasks/<slug>/_spec.md",
      "whole-draft",
      "complete implementation prompt",
      "Problem and Delta",
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

    expect(spec).toContain("## Implementation")
    expect(spec).toContain("at most 6 implementation questions")
    expect(spec).toContain("Ask exactly one question at a time")
    expect(spec).toContain("A. (Recommended)")
    expect(spec).toContain("Reply with the letter (for example, A), or the letter plus context.")
    expect(spec).toContain("## Problem and Delta")
    expect(spec).toContain("## Scope")
    expect(spec).toContain("### Out")
    expect(spec).toContain("### In")
    expect(spec).toContain("### Preserve")
    expect(spec).toContain("## Acceptance")
    expect(spec).toContain("## Repository Anchors")
    expect(spec).toContain("## Verification")
    expect(spec).toContain("## Output")
    expect(spec).toContain("## Contract Changes")
    expect(spec).toContain("## Milestones")
    expect(spec).toContain("Delete this section when")
    expect(spec).toContain("**Focused:**")
    expect(spec).toContain("**Repository gate:**")
    expect(spec).toContain("Valid:")
    expect(spec).toContain("Invalid:")
    expect(spec).not.toContain("## Execution")
    expect(spec).not.toContain("## Current System")
    expect(spec).not.toContain("### Current excerpts")
    expect(doctrine).toContain("The spec is the prompt")
    expect(quality).toContain("NO PROMPT WITHOUT CURRENT-SYSTEM EVIDENCE")
    expect(quality).toContain("Core sections")
    expect(quality).toContain("Conditional sections")
    expect(quality).toContain("every template token must be replaced")

    expect(skill).toContain("references/quality-bar.md")
  })

})
