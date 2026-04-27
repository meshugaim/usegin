import { describe, expect, test } from "bun:test";
import { banner, buildRecord } from "./it";

describe("dx zettel it (zettleit v0)", () => {
  test("buildRecord captures thought + iso ts + cwd + pid", () => {
    const r = buildRecord("  hello world  ");
    expect(r.thought).toBe("hello world");
    expect(r.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(r.cwd).toBe(process.cwd());
    expect(r.pid).toBe(process.pid);
  });

  test("buildRecord propagates CLAUDE_SESSION_ID when set", () => {
    const prev = process.env.CLAUDE_SESSION_ID;
    process.env.CLAUDE_SESSION_ID = "test-session-xyz";
    try {
      expect(buildRecord("x").session_id).toBe("test-session-xyz");
    } finally {
      if (prev === undefined) delete process.env.CLAUDE_SESSION_ID;
      else process.env.CLAUDE_SESSION_ID = prev;
    }
  });

  test("buildRecord session_id is null when env unset", () => {
    const prev = process.env.CLAUDE_SESSION_ID;
    delete process.env.CLAUDE_SESSION_ID;
    try {
      expect(buildRecord("x").session_id).toBeNull();
    } finally {
      if (prev !== undefined) process.env.CLAUDE_SESSION_ID = prev;
    }
  });

  test("banner is the trigger marker active Claude reads — must contain marker, thought, and skill pointer", () => {
    const rec = buildRecord("the thought");
    const out = banner(rec);
    // Marker — load-bearing for the active session to recognize the trigger.
    expect(out).toContain("[ZETTLEIT]");
    // Thought verbatim.
    expect(out).toContain("Thought: the thought");
    // Procedure must point at the existing primitives, not duplicate the discipline.
    expect(out).toContain("dx zettel list");
    expect(out).toContain("dx zettel add");
    expect(out).toContain("dx zettel show");
    expect(out).toContain(".claude/skills/zettel-capture/SKILL.md");
  });
});
