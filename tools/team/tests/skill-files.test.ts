import { describe, test, expect } from "bun:test";
import { readFile } from "fs/promises";
import { join } from "path";

const SKILLS_DIR = join(import.meta.dir, "../../../.claude/skills/teamwork");

describe("teamwork skill files", () => {
  test("SKILL.md exists and has required sections", async () => {
    const content = await readFile(join(SKILLS_DIR, "SKILL.md"), "utf-8");

    expect(content).toContain("name: teamwork");
    expect(content).toContain("# Teamwork");
    expect(content).toContain("## Status");
    expect(content).toContain("## Quick Start");
    expect(content).toContain("team plan");
  });

  test("planning-team.md exists and has required sections", async () => {
    const content = await readFile(
      join(SKILLS_DIR, "planning-team.md"),
      "utf-8"
    );

    expect(content).toContain("# Planning Team");
    expect(content).toContain("## Team Structure");
    expect(content).toContain("## Workflow");
    expect(content).toContain("### Phase 1: Analysis");
    expect(content).toContain("### Phase 2: Review");
    expect(content).toContain("### Phase 3: Create Sub-Issues");
    expect(content).toContain("## Slice Quality Criteria");
    expect(content).toContain("## Context Management");
  });

  test("worker.md exists and has required sections", async () => {
    const content = await readFile(join(SKILLS_DIR, "worker.md"), "utf-8");

    expect(content).toContain("# Worker");
    expect(content).toContain("## Core Behaviors");
    expect(content).toContain("### 1. Read Assignment");
    expect(content).toContain("### 2. Execute in Small Steps");
    expect(content).toContain("### 3. Signal Progress");
    expect(content).toContain("### 4. Say \"Stuck\" Early");
    expect(content).toContain("### 5. Never Exit with Uncommitted Work");
    expect(content).toContain("## Planning Worker Specifics");
    expect(content).toContain("## Implementation Worker Specifics");
  });

  test("reviewer.md exists and has required sections", async () => {
    const content = await readFile(join(SKILLS_DIR, "reviewer.md"), "utf-8");

    expect(content).toContain("# Reviewer");
    expect(content).toContain("## Core Responsibilities");
    expect(content).toContain("### 1. Spawn Workers");
    expect(content).toContain("### 2. Review Worker Output");
    expect(content).toContain("### 3. Provide Specific Feedback");
    expect(content).toContain("### 4. Detect Stuck Situations");
    expect(content).toContain("### 5. Monitor Context");
    expect(content).toContain("### 6. Ensure Commits Happen");
    expect(content).toContain("### 7. Verify Tests Pass");
    expect(content).toContain("## Context Management");
    expect(content).toContain("## Quality Standards");
  });

  test("planning-team.md references worker and reviewer", async () => {
    const content = await readFile(
      join(SKILLS_DIR, "planning-team.md"),
      "utf-8"
    );

    expect(content).toContain("Reviewer");
    expect(content).toContain("Worker");
    expect(content).toContain("crun");
    expect(content).toContain("reviewer.md");
  });

  test("worker.md has TDD guidance", async () => {
    const content = await readFile(join(SKILLS_DIR, "worker.md"), "utf-8");

    expect(content).toContain("Write failing test first");
    expect(content).toContain("TDD");
    expect(content).toContain("bun test");
  });

  test("reviewer.md has stuck detection guidance", async () => {
    const content = await readFile(join(SKILLS_DIR, "reviewer.md"), "utf-8");

    expect(content).toContain("Stuck triggers");
    expect(content).toContain("Same error");
    expect(content).toContain("domain expert");
    expect(content).toContain("cctx");
  });
});
