import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const skillDir = join(import.meta.dir, "..", "skills", "sf-tdd-write-spec")

describe("sf-tdd-write-spec contract", () => {
  test("ships a self-contained one-file spec authoring workflow with public-seam red-green slices", async () => {
    const skill = await readFile(join(skillDir, "SKILL.md"), "utf8")
    const doctrine = await readFile(join(skillDir, "references", "tdd-doctrine.md"), "utf8")
    const template = await readFile(join(skillDir, "references", "spec-template.md"), "utf8")
    const quality = await readFile(join(skillDir, "references", "quality-bar.md"), "utf8")
    const body = `${skill}\n${doctrine}\n${template}\n${quality}`

    expect(skill).toContain("name: sf-tdd-write-spec")
    expect(skill).toContain("Write exactly one file")
    expect(skill).toContain(".spec-finder/specs/<slug>-spec.md")
    expect(skill).toContain("Read `references/tdd-doctrine.md`")
    expect(skill).toContain("NEVER require")
    expect(skill).toContain("external `tdd` skill")
    expect(skill).toContain("one failing public-seam test")
    expect(skill).toContain("same focused command")
    expect(skill).toContain("one vertical slice at a time")
    expect(skill).toContain("confirm the proposed public seams")
    expect(skill).toContain("implementation-coupled")
    expect(skill).toContain("tautological")
    expect(skill).toContain("horizontal slicing")

    expect(doctrine).toContain("Red before green")
    expect(doctrine).toContain("Tests live at seams")
    expect(doctrine).toContain("Expected values")
    expect(doctrine).toContain("Mock at system boundaries only")
    expect(doctrine).not.toContain("/Users/")

    expect(template).toContain("## TDD Execution")
    expect(template).toContain("## Public Test Seams")
    expect(template).toContain("**Red:**")
    expect(template).toContain("**Green:**")
    expect(template).toContain("## Slices")
    expect(quality).toContain("NO GREEN WITHOUT AN OBSERVED RED")
    expect(quality).toContain("NO EXTERNAL TDD SKILL DEPENDENCY")

    for (const forbidden of [
      ".spec-finder/tasks/<slug>/",
      "_prd.md",
      "_techspec.md",
      "_tasks.md",
      "task_NN.md",
    ]) {
      expect(body).not.toContain(forbidden)
    }
  })
})
