import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { REFINEMENTS_DIR } from "../src/paths.ts"

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

const skillDir = join(import.meta.dir, "..", "skills", "sf-refinement")

describe("sf-refinement contract", () => {
  test("encodes one-file tracker-agnostic refinement as hard gates and required output sections", async () => {
    const skill = await readFile(join(skillDir, "SKILL.md"), "utf8")
    const doctrine = await readFile(join(skillDir, "references", "doctrine.md"), "utf8")
    const template = await readFile(join(skillDir, "references", "refinement-template.md"), "utf8")
    const quality = await readFile(join(skillDir, "references", "quality-bar.md"), "utf8")
    const protocol = await readFile(join(skillDir, "references", "question-protocol.md"), "utf8")
    const body = `${skill}\n${doctrine}\n${template}\n${quality}\n${protocol}`

    expect(skill).toContain("name: sf-refinement")
    expect(skill).toContain("<HARD-GATE>")
    expect(skill).toContain("Write exactly one file")
    expect(skill).toContain(".spec-finder/refinements/<task_slug>.md")
    expect(skill).toContain("NEVER write or replace `.spec-finder/tasks/` or `.spec-finder/specs/`")
    expect(skill).toContain("NEVER vendor-lock intake or output")
    expect(skill).toContain("NEVER require Portuguese or any other language")
    expect(skill).toContain("NEVER create, update, or close tickets in an issue tracker")
    expect(skill).toContain("digested-requirements")
    expect(skill).toContain("Jira")
    expect(skill).toContain("Linear")
    expect(skill).toContain("GitHub")
    expect(skill).toContain("GitLab")
    expect(doctrine).toContain("Single output only")
    expect(doctrine).toContain("Tracker-agnostic intake")
    expect(doctrine).toContain("Language is inherited")
    expect(quality).toContain("NO RUNNER PACKET OUTPUT")
    expect(quality).toContain("NO LANGUAGE MANDATE")
    expect(quality).toContain("NO TRACKER VENDOR LOCK")
    expect(template).toContain("## Source")
    expect(template).toContain("## Digested requirements")
    expect(template).toContain("## Tickets")
    expect(template).toContain("## Test scenarios")
    expect(template).toContain("## Verification")
    expect(template).toContain(".spec-finder/refinements/<task_slug>.md")
    expect(protocol).toContain("Approve digested requirements")
    expect(protocol).toContain("Approve and write the refinement")

    for (const needle of [
      "Given",
      "When",
      "Then",
      "whole-draft",
      "user flow",
      "Read first",
      "Do not",
    ]) {
      expect(body).toContain(needle)
    }

    for (const forbidden of [
      "PRD Digerida",
      "Critérios de Aceitação",
      "Como [persona]",
      "O que NÃO fazer",
      "Quer que eu crie no Jira",
      "issueTypeName",
      "digibee.atlassian.net",
      "DST-1234",
      ".spec-finder/specs/<slug>-spec.md",
      "_prd.md",
      "_techspec.md",
      "task_NN.md",
    ]) {
      expect(body).not.toContain(forbidden)
    }
  })

  test("writes only the refinement at .spec-finder/refinements/<task_slug>.md from the shipped template", async () => {
    const root = await mkdtemp(join(tmpdir(), "spec-finder-refinement-file-"))
    roots.push(root)
    const slug = "import-openapi"
    const template = await readFile(join(skillDir, "references", "refinement-template.md"), "utf8")
    const filled = template
      .replaceAll("<task_slug>", slug)
      .replaceAll("[Title]", "Import OpenAPI")
    const refinementPath = join(root, ".spec-finder", REFINEMENTS_DIR, `${slug}.md`)
    await mkdir(join(root, ".spec-finder", REFINEMENTS_DIR), { recursive: true })
    await writeFile(refinementPath, filled)

    expect(refinementPath.endsWith(`.spec-finder/refinements/${slug}.md`)).toBe(true)
    const body = await readFile(refinementPath, "utf8")
    expect(body).toContain(`.spec-finder/refinements/${slug}.md`)
    expect(body).not.toContain("<task_slug>")
    expect(body).not.toContain(".spec-finder/tasks/")
    expect(body).not.toContain(".spec-finder/specs/")
    expect(body).toContain("## Source")
    expect(body).toContain("## Digested requirements")
    expect(body).toContain("## Tickets")
    expect(body).toContain("## Test scenarios")
    expect(body).toContain("## Verification")
    expect(body).toContain("**Given**")
    expect(body).toContain("**When**")
    expect(body).toContain("**Then**")
  })
})
