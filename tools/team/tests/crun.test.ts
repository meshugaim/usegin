import { describe, test, expect } from "bun:test";
import {
  buildPlanningReviewerPrompt,
  buildReviewerNoteToSelf,
  buildImplReviewerPrompt,
  buildImplReviewerNoteToSelf,
} from "../src/crun";

describe("Planning team prompt builders", () => {
  test("buildPlanningReviewerPrompt includes issue ID", () => {
    const prompt = buildPlanningReviewerPrompt("ENG-999");

    expect(prompt).toContain("ENG-999");
  });

  test("buildPlanningReviewerPrompt references skill files", () => {
    const prompt = buildPlanningReviewerPrompt("ENG-999");

    expect(prompt).toContain(".claude/skills/teamwork/reviewer.md");
    expect(prompt).toContain(".claude/skills/teamwork/planning-team.md");
  });

  test("buildPlanningReviewerPrompt mentions plan show command", () => {
    const prompt = buildPlanningReviewerPrompt("ENG-999");

    expect(prompt).toContain("plan show ENG-999");
  });

  test("buildPlanningReviewerPrompt describes planning team role", () => {
    const prompt = buildPlanningReviewerPrompt("ENG-999");

    expect(prompt).toContain("Planning Team");
    expect(prompt).toContain("vertical slices");
    expect(prompt).toContain("Linear sub-issues");
  });

  test("buildReviewerNoteToSelf includes issue ID", () => {
    const note = buildReviewerNoteToSelf("ENG-888");

    expect(note).toContain("ENG-888");
    expect(note).toContain("sub-issues");
  });
});

describe("Implementation team prompt builders", () => {
  test("buildImplReviewerPrompt includes issue ID", () => {
    const prompt = buildImplReviewerPrompt("ENG-777");

    expect(prompt).toContain("ENG-777");
  });

  test("buildImplReviewerPrompt references skill files", () => {
    const prompt = buildImplReviewerPrompt("ENG-777");

    expect(prompt).toContain(".claude/skills/teamwork/reviewer.md");
    expect(prompt).toContain(".claude/skills/teamwork/impl-team.md");
  });

  test("buildImplReviewerPrompt mentions plan show command", () => {
    const prompt = buildImplReviewerPrompt("ENG-777");

    expect(prompt).toContain("plan show ENG-777");
  });

  test("buildImplReviewerPrompt describes implementation team role", () => {
    const prompt = buildImplReviewerPrompt("ENG-777");

    expect(prompt).toContain("Implementation Team");
    expect(prompt).toContain("TDD");
    expect(prompt).toContain("failing tests");
  });

  test("buildImplReviewerPrompt emphasizes key principles", () => {
    const prompt = buildImplReviewerPrompt("ENG-777");

    expect(prompt).toContain("Tests before implementation");
    expect(prompt).toContain("Tight feedback loops");
    expect(prompt).toContain("One test at a time");
    expect(prompt).toContain("Quality over speed");
  });

  test("buildImplReviewerPrompt mentions stuck detection", () => {
    const prompt = buildImplReviewerPrompt("ENG-777");

    expect(prompt).toContain("stuck");
    expect(prompt).toContain("expert");
  });

  test("buildImplReviewerNoteToSelf includes issue ID", () => {
    const note = buildImplReviewerNoteToSelf("ENG-666");

    expect(note).toContain("ENG-666");
    expect(note).toContain("TDD");
    expect(note).toContain("tests passing");
  });
});
