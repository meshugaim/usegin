import { describe, test, expect } from "bun:test";
import { readFile } from "fs/promises";
import { join } from "path";

const SKILLS_DIR = join(import.meta.dir, "../../../.claude/skills/teamwork");

describe("impl-team.md skill file", () => {
  test("exists and has required sections", async () => {
    const content = await readFile(join(SKILLS_DIR, "impl-team.md"), "utf-8");

    expect(content).toContain("# Implementation Team");
    expect(content).toContain("## Team Structure");
    expect(content).toContain("## Workflow");
    expect(content).toContain("### Phase 1: Tests");
    expect(content).toContain("### Phase 2: Implementation");
    expect(content).toContain("### Phase 3: Verification");
  });

  test("has tight feedback loops section", async () => {
    const content = await readFile(join(SKILLS_DIR, "impl-team.md"), "utf-8");

    expect(content).toContain("## Tight Feedback Loops");
    expect(content).toContain("spawn → review → feedback → spawn");
    expect(content).toContain("After every small step");
    expect(content).toContain("not all tests at end");
  });

  test("has stuck detection in workflow", async () => {
    const content = await readFile(join(SKILLS_DIR, "impl-team.md"), "utf-8");

    expect(content).toContain("If worker stuck");
    expect(content).toContain("Spawn domain expert");
    expect(content).toContain("HALT");
  });

  test("has comprehensive test suite running guidance", async () => {
    const content = await readFile(join(SKILLS_DIR, "impl-team.md"), "utf-8");

    expect(content).toContain("## Running Tests");
    expect(content).toContain("bun test");
    expect(content).toContain("Frontend");
    expect(content).toContain("Backend");
    expect(content).toContain("E2E");
  });

  test("references reviewer and worker", async () => {
    const content = await readFile(join(SKILLS_DIR, "impl-team.md"), "utf-8");

    expect(content).toContain("Reviewer");
    expect(content).toContain("Worker");
    expect(content).toContain("crun");
  });

  test("has TDD workflow", async () => {
    const content = await readFile(join(SKILLS_DIR, "impl-team.md"), "utf-8");

    expect(content).toContain("TDD");
    expect(content).toContain("failing tests");
    expect(content).toContain("Commit");
  });

  test("has context management guidance", async () => {
    const content = await readFile(join(SKILLS_DIR, "impl-team.md"), "utf-8");

    expect(content).toContain("cctx");
    expect(content).toContain("context");
    expect(content).toContain("handoff");
  });
});

describe("domain-expert.md skill file", () => {
  test("exists and has required sections", async () => {
    const content = await readFile(
      join(SKILLS_DIR, "domain-expert.md"),
      "utf-8"
    );

    expect(content).toContain("# Domain Expert");
    expect(content).toContain("## When to Spawn");
    expect(content).toContain("## What Expert Receives");
    expect(content).toContain("## Expert Process");
    expect(content).toContain("## Output");
  });

  test("has comprehensive context guidance", async () => {
    const content = await readFile(
      join(SKILLS_DIR, "domain-expert.md"),
      "utf-8"
    );

    expect(content).toContain("comprehensive context");
    expect(content).toContain("not minimal");
    expect(content).toContain("Explore agent");
    expect(content).toContain("Task tool");
  });

  test("emphasizes expert does not implement", async () => {
    const content = await readFile(
      join(SKILLS_DIR, "domain-expert.md"),
      "utf-8"
    );

    expect(content).toContain("Does NOT");
    expect(content).toContain("Provide specific, actionable guidance");
    expect(content).toContain("only advises");
  });

  test("has examples of when to use expert", async () => {
    const content = await readFile(
      join(SKILLS_DIR, "domain-expert.md"),
      "utf-8"
    );

    expect(content).toContain("Worker stuck");
    expect(content).toContain("architecture");
    expect(content).toContain("patterns");
  });

  test("references reviewer spawning pattern", async () => {
    const content = await readFile(
      join(SKILLS_DIR, "domain-expert.md"),
      "utf-8"
    );

    expect(content).toContain("Spawned by reviewer");
    expect(content).toContain("crun");
  });
});
