import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { getTeamKey } from "../src/lib/identifier";

/**
 * Regression test for ENG-2776: `plan create` defaults to wrong team
 *
 * Bug: create.ts and labels.ts used `opts.team ?? process.env.PLAN_TEAM`
 * which resolves to undefined when both are absent, falling through to
 * getDefaultTeam() — nondeterministic Linear API order (returned PRO).
 *
 * Fix: both commands now use getTeamKey() which returns PLAN_TEAM ?? "ENG".
 */

describe("plan create default team (ENG-2776)", () => {
  const originalPlanTeam = process.env.PLAN_TEAM;

  beforeEach(() => {
    delete process.env.PLAN_TEAM;
  });

  afterEach(() => {
    if (originalPlanTeam !== undefined) {
      process.env.PLAN_TEAM = originalPlanTeam;
    } else {
      delete process.env.PLAN_TEAM;
    }
  });

  it("defaults to 'ENG' when PLAN_TEAM env var is not set", () => {
    expect(getTeamKey()).toBe("ENG");
  });

  it("respects PLAN_TEAM env var when set", () => {
    process.env.PLAN_TEAM = "PRO";
    expect(getTeamKey()).toBe("PRO");
  });
});
