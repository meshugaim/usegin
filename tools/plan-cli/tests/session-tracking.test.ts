import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  getActor,
  resetActorCache,
  parseActorBlock,
  addActorToDescription,
  addActorToComment,
  getToday,
} from "../src/lib/session-tracking";

describe("session-tracking", () => {
  const originalSessionId = process.env.CLAUDE_SESSION_ID;

  beforeEach(() => {
    resetActorCache();
  });

  afterEach(() => {
    if (originalSessionId !== undefined) {
      process.env.CLAUDE_SESSION_ID = originalSessionId;
    } else {
      delete process.env.CLAUDE_SESSION_ID;
    }
    resetActorCache();
  });

  describe("getActor", () => {
    it("returns claude:<short-id> when CLAUDE_SESSION_ID is set", () => {
      process.env.CLAUDE_SESSION_ID = "abc12345-1234-5678-9abc-def012345678";
      expect(getActor()).toBe("claude:abc12345");
    });

    it("returns gh:<login> when no session ID (falls back to git config)", () => {
      delete process.env.CLAUDE_SESSION_ID;
      const actor = getActor();
      // Should resolve to gh:something from git config
      expect(actor).toMatch(/^gh:/);
    });

    it("caches the result across calls", () => {
      process.env.CLAUDE_SESSION_ID = "abc12345-1234-5678-9abc-def012345678";
      const first = getActor();
      // Change env — should still return cached value
      process.env.CLAUDE_SESSION_ID = "zzz99999-1234-5678-9abc-def012345678";
      expect(getActor()).toBe(first);
    });
  });

  describe("parseActorBlock", () => {
    it("returns empty block when no metadata present", () => {
      const { block, descriptionWithoutBlock } = parseActorBlock("Just a description");
      expect(block.created).toBeNull();
      expect(block.contributed).toEqual([]);
      expect(descriptionWithoutBlock).toBe("Just a description");
    });

    it("parses created actor", () => {
      const desc = `Some content\n\n<!-- actors:\ncreated: claude:abc12345 (2026-03-30)\n-->`;
      const { block, descriptionWithoutBlock } = parseActorBlock(desc);
      expect(block.created).toEqual({ actor: "claude:abc12345", date: "2026-03-30" });
      expect(block.contributed).toEqual([]);
      expect(descriptionWithoutBlock).toBe("Some content");
    });

    it("parses gh actor", () => {
      const desc = `Content\n\n<!-- actors:\ncreated: gh:oria-ai (2026-03-30)\n-->`;
      const { block } = parseActorBlock(desc);
      expect(block.created).toEqual({ actor: "gh:oria-ai", date: "2026-03-30" });
    });

    it("parses contributed actors", () => {
      const desc = `Content\n\n<!-- actors:\ncreated: claude:abc12345 (2026-03-30)\ncontributed: gh:oria-ai (2026-03-30), claude:def67890 (2026-04-01)\n-->`;
      const { block } = parseActorBlock(desc);
      expect(block.created).toEqual({ actor: "claude:abc12345", date: "2026-03-30" });
      expect(block.contributed).toEqual([
        { actor: "gh:oria-ai", date: "2026-03-30" },
        { actor: "claude:def67890", date: "2026-04-01" },
      ]);
    });

    it("preserves content after block", () => {
      const desc = `Before\n\n<!-- actors:\ncreated: claude:abc12345 (2026-03-30)\n-->\n\nAfter`;
      const { descriptionWithoutBlock } = parseActorBlock(desc);
      expect(descriptionWithoutBlock).toBe("Before\n\nAfter");
    });
  });

  describe("addActorToDescription", () => {
    it("adds claude actor to empty description", () => {
      process.env.CLAUDE_SESSION_ID = "abc12345-1234-5678-9abc-def012345678";
      const result = addActorToDescription(undefined, "created");
      expect(result).toContain("<!-- actors:");
      expect(result).toContain("created: claude:abc12345");
    });

    it("adds actor to existing description", () => {
      process.env.CLAUDE_SESSION_ID = "abc12345-1234-5678-9abc-def012345678";
      const result = addActorToDescription("My issue description", "created");
      expect(result).toStartWith("My issue description");
      expect(result).toContain("created: claude:abc12345");
    });

    it("adds contributed actor to existing block", () => {
      process.env.CLAUDE_SESSION_ID = "def67890-1234-5678-9abc-def012345678";
      const desc = `Content\n\n<!-- actors:\ncreated: claude:abc12345 (2026-03-30)\n-->`;
      const result = addActorToDescription(desc, "contributed");
      expect(result).toContain("created: claude:abc12345 (2026-03-30)");
      expect(result).toContain("contributed: claude:def67890");
    });

    it("adds gh actor when no session ID", () => {
      delete process.env.CLAUDE_SESSION_ID;
      const result = addActorToDescription("Content", "created");
      expect(result).toContain("created: gh:");
    });

    it("deduplicates same actor on same date", () => {
      process.env.CLAUDE_SESSION_ID = "def67890-1234-5678-9abc-def012345678";
      const today = getToday();
      const desc = `Content\n\n<!-- actors:\ncreated: claude:abc12345 (2026-03-30)\ncontributed: claude:def67890 (${today})\n-->`;
      const result = addActorToDescription(desc, "contributed");
      const matches = result.match(/claude:def67890/g);
      expect(matches).toHaveLength(1);
    });

    it("allows same actor on different dates", () => {
      process.env.CLAUDE_SESSION_ID = "def67890-1234-5678-9abc-def012345678";
      const desc = `Content\n\n<!-- actors:\ncreated: claude:abc12345 (2026-03-30)\ncontributed: claude:def67890 (2026-03-29)\n-->`;
      const result = addActorToDescription(desc, "contributed");
      const matches = result.match(/claude:def67890/g);
      expect(matches).toHaveLength(2);
    });

    it("mixes claude and gh actors", () => {
      delete process.env.CLAUDE_SESSION_ID;
      const desc = `Content\n\n<!-- actors:\ncreated: claude:abc12345 (2026-03-30)\n-->`;
      const result = addActorToDescription(desc, "contributed");
      expect(result).toContain("created: claude:abc12345");
      expect(result).toContain("contributed: gh:");
    });
  });

  describe("addActorToComment", () => {
    it("appends claude actor as HTML comment", () => {
      process.env.CLAUDE_SESSION_ID = "abc12345-1234-5678-9abc-def012345678";
      const result = addActorToComment("My comment");
      expect(result).toBe("My comment\n<!-- actor: claude:abc12345 -->");
    });

    it("appends gh actor when no session ID", () => {
      delete process.env.CLAUDE_SESSION_ID;
      const result = addActorToComment("My comment");
      expect(result).toMatch(/^My comment\n<!-- actor: gh:.+ -->$/);
    });
  });
});
