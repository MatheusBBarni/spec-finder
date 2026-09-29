import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const skillDir = join(import.meta.dir, "..", "skills", "sf-create-prd")

describe("sf-create-prd contract", () => {
  test("accepts a thin task and hands off to a normal spec, a TDD spec, or a TechSpec", async () => {
    const skill = await readFile(join(skillDir, "SKILL.md"), "utf8")

    expect(skill).toContain("thin or poorly written task")
    expect(skill).toContain("sf-write-spec")
    expect(skill).toContain("sf-tdd-write-spec")
    expect(skill).toContain("sf-create-techspec")
    expect(skill).toContain(".spec-finder/tasks/<slug>/_prd.md")
    expect(skill).toContain("## Implementation Spec")
    expect(skill).toContain("run the bundled `humanizer` skill")
    expect(skill).toContain("skills/humanizer/SKILL.md")
    expect(skill).toContain("Do not ask the next-artifact question until that file passes.")
    expect(skill).toContain("NEVER write `.spec-finder/specs/`")
    expect(skill).toContain("A. (Recommended) Normal spec")
    expect(skill).toContain("B. TDD spec")
    expect(skill).toContain("C. Packet TechSpec")
    expect(skill).not.toContain("Point to `sf-create-techspec` as the next step.")
  })
})
