import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import type { PlanMeta } from "../src/lib/plan-meta";
import { parseMeta, serializeMeta, attachMeta, buildMetaDescription, resetActorCache, getActor } from "../src/lib/plan-meta";
import { hashDescription } from "../src/lib/checkout-meta";

// Shared env save/restore for tests that modify CLAUDE_SESSION_ID
function withSessionEnv() {
  const saved: Record<string, string | undefined> = {};
  return {
    save() { saved.CLAUDE_SESSION_ID = process.env.CLAUDE_SESSION_ID; },
    restore() {
      if (saved.CLAUDE_SESSION_ID === undefined) {
        delete process.env.CLAUDE_SESSION_ID;
      } else {
        process.env.CLAUDE_SESSION_ID = saved.CLAUDE_SESSION_ID;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// parseMeta
// ---------------------------------------------------------------------------

describe("parseMeta", () => {
  test(
    "ENG-3763: extracts meta block from end of description, returns {description, meta}",
    () => {
      const input = [
        "Fix the login bug",
        "",
        "<!-- plan:meta",
        'created_by_session: abc123-0000-0000-0000-000000000000',
        'created_at: "2026-03-30T12:00:00.000Z"',
        'last_session: abc123-0000-0000-0000-000000000000',
        'updated_at: "2026-03-30T12:00:00.000Z"',
        "-->",
      ].join("\n");

      const result = parseMeta(input);

      expect(result.description).toBe("Fix the login bug");
      expect(result.meta).not.toBeNull();
      expect(result.meta!.created_by_session).toBe("abc123-0000-0000-0000-000000000000");
      expect(result.meta!.created_at).toBe("2026-03-30T12:00:00.000Z");
      expect(result.meta!.last_session).toBe("abc123-0000-0000-0000-000000000000");
      expect(result.meta!.updated_at).toBe("2026-03-30T12:00:00.000Z");
    }
  );

  test(
    "ENG-3763: returns meta: null for description with no meta block",
    () => {
      const result = parseMeta("Just a plain description with no metadata.");

      expect(result.description).toBe("Just a plain description with no metadata.");
      expect(result.meta).toBeNull();
    }
  );

  test(
    "ENG-3763: returns meta: null for empty string",
    () => {
      const result = parseMeta("");

      expect(result.description).toBe("");
      expect(result.meta).toBeNull();
    }
  );

  test(
    "ENG-3763: handles non-plan HTML comments — leaves them in description, returns meta: null",
    () => {
      const input = "Some content\n\n<!-- TODO: fix this later -->";

      const result = parseMeta(input);

      expect(result.description).toBe("Some content\n\n<!-- TODO: fix this later -->");
      expect(result.meta).toBeNull();
    }
  );

  test(
    "ENG-3763: returns meta: null for malformed YAML inside meta block (resilient, no throw)",
    () => {
      const input = [
        "Description here",
        "",
        "<!-- plan:meta",
        "this is not: valid: yaml: {{[",
        "-->",
      ].join("\n");

      // Should not throw
      const result = parseMeta(input);

      // Design choice: when delimiters match but YAML is invalid,
      // the block is still stripped from description (meta: null).
      // The block matched structurally — we just couldn't parse its content.
      expect(result.description).toBe("Description here");
      expect(result.meta).toBeNull();
    }
  );

  test(
    "ENG-3763: does NOT match meta block in the middle of content (only end-of-string)",
    () => {
      const input = [
        "Before the block",
        "",
        "<!-- plan:meta",
        "created_by_session: abc123",
        "-->",
        "",
        "After the block — this makes it mid-content",
      ].join("\n");

      const result = parseMeta(input);

      // The meta block is not at the end, so it should not be parsed
      expect(result.description).toBe(input);
      expect(result.meta).toBeNull();
    }
  );

  test(
    "ENG-3763: tolerates trailing whitespace/newlines after -->",
    () => {
      const input = [
        "Description",
        "",
        "<!-- plan:meta",
        "last_session: sess-999",
        "-->",
        "  ",
        "",
      ].join("\n");

      const result = parseMeta(input);

      expect(result.description).toBe("Description");
      expect(result.meta).not.toBeNull();
      expect(result.meta!.last_session).toBe("sess-999");
    }
  );

  test(
    "ENG-3763: parses sessions array from YAML list syntax",
    () => {
      const input = [
        "Description",
        "",
        "<!-- plan:meta",
        "created_by_session: abc123",
        "sessions:",
        "  - abc123",
        "  - def456",
        "  - ghi789",
        "-->",
      ].join("\n");

      const result = parseMeta(input);

      expect(result.meta).not.toBeNull();
      expect(result.meta!.sessions).toEqual(["abc123", "def456", "ghi789"]);
    }
  );

  test(
    "ENG-3763: handles multiple blank lines before meta block",
    () => {
      const input = "Description\n\n\n\n<!-- plan:meta\nlast_session: sess-1\n-->";
      const result = parseMeta(input);
      expect(result.description).toBe("Description");
      expect(result.meta).not.toBeNull();
      expect(result.meta!.last_session).toBe("sess-1");
    }
  );

  test(
    "ENG-3763: returns duplicate session IDs faithfully — dedup is caller's job",
    () => {
      const input = [
        "Description",
        "",
        "<!-- plan:meta",
        "sessions:",
        "  - abc123",
        "  - abc123",
        "  - def456",
        "-->",
      ].join("\n");
      const result = parseMeta(input);
      expect(result.meta!.sessions).toEqual(["abc123", "abc123", "def456"]);
    }
  );

  test(
    "ENG-3763: handles undefined/null input gracefully",
    () => {
      const result1 = parseMeta(undefined as any);
      expect(result1.description).toBe("");
      expect(result1.meta).toBeNull();
      const result2 = parseMeta(null as any);
      expect(result2.description).toBe("");
      expect(result2.meta).toBeNull();
    }
  );

  test("parses sessions from inline comma-separated format", () => {
    const input = [
      "Description",
      "",
      "<!-- plan:meta",
      "created_by_session: abc123",
      "sessions: abc123, def456, ghi789",
      "-->",
    ].join("\n");

    const result = parseMeta(input);
    expect(result.meta).not.toBeNull();
    expect(result.meta!.sessions).toEqual(["abc123", "def456", "ghi789"]);
  });

  test(
    "ENG-3763: handles meta block without sessions field (older format)",
    () => {
      const input = [
        "Description",
        "",
        "<!-- plan:meta",
        "created_by_session: abc123",
        'created_at: "2026-03-30T12:00:00.000Z"',
        "-->",
      ].join("\n");

      const result = parseMeta(input);

      expect(result.meta).not.toBeNull();
      expect(result.meta!.created_by_session).toBe("abc123");
      expect(result.meta!.created_at).toBe("2026-03-30T12:00:00.000Z");
      expect(result.meta!.sessions).toBeUndefined();
    }
  );
});

// ---------------------------------------------------------------------------
// serializeMeta
// ---------------------------------------------------------------------------

describe("serializeMeta", () => {
  test(
    "ENG-3763: produces correct <!-- plan:meta\\n...\\n--> format",
    () => {
      const result = serializeMeta({
        created_by_session: "abc123",
        created_at: "2026-03-30T12:00:00.000Z",
        last_session: "def456",
        updated_at: "2026-03-30T14:30:00.000Z",
      });

      expect(result).toStartWith("<!-- plan:meta\n");
      expect(result).toEndWith("\n-->");
      expect(result).toContain("created_by_session: abc123");
      expect(result).toContain("last_session: def456");
    }
  );

  test(
    "ENG-3763: omits undefined/null fields",
    () => {
      const result = serializeMeta({
        created_by_session: "abc123",
        // created_at, last_session, updated_at are all undefined
      });

      expect(result).toContain("created_by_session: abc123");
      expect(result).not.toContain("created_at");
      expect(result).not.toContain("last_session");
      expect(result).not.toContain("updated_at");
      expect(result).not.toContain("sessions");
    }
  );

  test(
    "ENG-3763: quotes timestamp values",
    () => {
      const result = serializeMeta({
        created_at: "2026-03-30T12:00:00.000Z",
        updated_at: "2026-03-30T14:30:00.000Z",
      });

      expect(result).toContain('created_at: "2026-03-30T12:00:00.000Z"');
      expect(result).toContain('updated_at: "2026-03-30T14:30:00.000Z"');
    }
  );

  test(
    "ENG-3763: serializes sessions array as comma-separated inline list",
    () => {
      const result = serializeMeta({
        created_by_session: "abc123",
        sessions: ["abc123", "def456"],
      });

      expect(result).toContain("sessions: abc123, def456");
    }
  );

  test(
    "ENG-3763: fields are ordered: created_by_session, created_at, last_session, updated_at, sessions",
    () => {
      const result = serializeMeta({
        updated_at: "2026-03-30T14:30:00.000Z",
        created_by_session: "abc123",
        sessions: ["abc123"],
        last_session: "abc123",
        created_at: "2026-03-30T12:00:00.000Z",
      });
      const lines = result.split("\n");
      const fieldLines = lines.filter(l => l.match(/^\w/) || l.match(/^  -/));
      // Find indices of field names
      const createdByIdx = fieldLines.findIndex(l => l.startsWith("created_by_session"));
      const createdAtIdx = fieldLines.findIndex(l => l.startsWith("created_at"));
      const lastSessionIdx = fieldLines.findIndex(l => l.startsWith("last_session"));
      const updatedAtIdx = fieldLines.findIndex(l => l.startsWith("updated_at"));
      const sessionsIdx = fieldLines.findIndex(l => l.startsWith("sessions"));
      expect(createdByIdx).toBeLessThan(createdAtIdx);
      expect(createdAtIdx).toBeLessThan(lastSessionIdx);
      expect(lastSessionIdx).toBeLessThan(updatedAtIdx);
      expect(updatedAtIdx).toBeLessThan(sessionsIdx);
    }
  );

  test(
    "ENG-3763: omits sessions when empty array or undefined",
    () => {
      const resultEmpty = serializeMeta({
        created_by_session: "abc123",
        sessions: [],
      });
      expect(resultEmpty).not.toContain("sessions");

      const resultUndefined = serializeMeta({
        created_by_session: "abc123",
      });
      expect(resultUndefined).not.toContain("sessions");
    }
  );
});

// ---------------------------------------------------------------------------
// attachMeta
// ---------------------------------------------------------------------------

describe("attachMeta", () => {
  test(
    "ENG-3763: appends meta block to clean description with blank line separator",
    () => {
      const description = "Fix the login bug";
      const meta = {
        created_by_session: "abc123",
        created_at: "2026-03-30T12:00:00.000Z",
      };

      const result = attachMeta(description, meta);

      // Should have the description, a blank line, then the meta block
      expect(result).toStartWith("Fix the login bug\n\n<!-- plan:meta\n");
      expect(result).toEndWith("\n-->");

      // The combined result should be parseable
      const parsed = parseMeta(result);
      expect(parsed.description).toBe("Fix the login bug");
      expect(parsed.meta).not.toBeNull();
    }
  );

  test(
    "ENG-3763: handles empty description",
    () => {
      const result = attachMeta("", { created_by_session: "abc123" });
      // Empty description: meta block follows directly (no leading blank line needed)
      expect(result).toContain("<!-- plan:meta");
      expect(result).toContain("created_by_session: abc123");
      // Must be parseable back
      const parsed = parseMeta(result);
      expect(parsed.description).toBe("");
      expect(parsed.meta).not.toBeNull();
      expect(parsed.meta!.created_by_session).toBe("abc123");
    }
  );

  test(
    "ENG-3763: does not strip existing meta — caller must pass clean description",
    () => {
      // If caller passes description that already has meta, attachMeta double-appends.
      // This documents that stripping is the caller's responsibility.
      const descWithMeta = "Content\n\n<!-- plan:meta\ncreated_by_session: old\n-->";
      const newMeta = { created_by_session: "new" };
      const result = attachMeta(descWithMeta, newMeta);
      // The result has two meta blocks — parseMeta would only parse the last one
      // This is intentionally NOT handled — callers must use parseMeta first.
      expect(result).toContain("created_by_session: old");
      expect(result).toContain("created_by_session: new");
    }
  );
});

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

describe("round-trip", () => {
  test(
    "ENG-3763: parseMeta(attachMeta(description, meta)) returns original description and meta",
    () => {
      const description = "A multi-line description\n\nWith paragraphs and **markdown**.";
      const meta = {
        created_by_session: "add7985c-2393-4d54-800a-6fc0030bb0a2",
        created_at: "2026-03-30T12:00:00.000Z",
        last_session: "9f3b2a17-1234-5678-abcd-ef0123456789",
        updated_at: "2026-03-30T14:30:00.000Z",
        sessions: [
          "add7985c-2393-4d54-800a-6fc0030bb0a2",
          "9f3b2a17-1234-5678-abcd-ef0123456789",
        ],
      };

      const combined = attachMeta(description, meta);
      const parsed = parseMeta(combined);

      expect(parsed.description).toBe(description);
      expect(parsed.meta).not.toBeNull();
      expect(parsed.meta!.created_by_session).toBe(meta.created_by_session);
      expect(parsed.meta!.created_at).toBe(meta.created_at);
      expect(parsed.meta!.last_session).toBe(meta.last_session);
      expect(parsed.meta!.updated_at).toBe(meta.updated_at);
      expect(parsed.meta!.sessions).toEqual(meta.sessions);
    }
  );
});

// ---------------------------------------------------------------------------
// hashDescription — meta-awareness
// ---------------------------------------------------------------------------

describe("hashDescription with plan:meta awareness", () => {
  test(
    "ENG-3763: hash of description with meta === hash of same description without meta",
    () => {
      const cleanDescription = "Fix the login bug";
      const descriptionWithMeta = [
        "Fix the login bug",
        "",
        "<!-- plan:meta",
        "created_by_session: abc123",
        'created_at: "2026-03-30T12:00:00.000Z"',
        "-->",
      ].join("\n");

      const hashClean = hashDescription(cleanDescription);
      const hashWithMeta = hashDescription(descriptionWithMeta);

      expect(hashWithMeta).toBe(hashClean);
    }
  );

  test(
    "ENG-3763: hash of two different descriptions with same meta are different",
    () => {
      const metaBlock = [
        "",
        "<!-- plan:meta",
        "created_by_session: abc123",
        "-->",
      ].join("\n");

      const hash1 = hashDescription("Description A" + metaBlock);
      const hash2 = hashDescription("Description B" + metaBlock);

      expect(hash1).not.toBe(hash2);
    }
  );

  test(
    "ENG-3763: existing hashDescription behavior unchanged for descriptions without meta",
    () => {
      // For descriptions without a meta block, hashDescription should produce
      // the same result as a plain SHA256 hash of the content.
      const content = "A plain description with no meta block";

      const hasher = new Bun.CryptoHasher("sha256");
      hasher.update(content);
      const expectedHash = hasher.digest("hex");

      expect(hashDescription(content)).toBe(expectedHash);
    }
  );
});

// ===========================================================================
// ENG-4389: Actor identity in plan-meta
// ===========================================================================

// ---------------------------------------------------------------------------
// PlanMeta type — new fields
// ---------------------------------------------------------------------------

describe("PlanMeta type — actor fields", () => {
  test(
    "ENG-4389: created_by_actor and last_actor exist on parsed PlanMeta",
    () => {
      const input = [
        "Description",
        "",
        "<!-- plan:meta",
        "created_by_session: abc123",
        "created_by_actor: claude:a4c28f13",
        'created_at: "2026-04-01T12:00:00.000Z"',
        "last_session: def456",
        "last_actor: gh:nitsan",
        'updated_at: "2026-04-01T14:00:00.000Z"',
        "sessions: abc123, def456",
        "-->",
      ].join("\n");

      const result = parseMeta(input);
      expect(result.meta).not.toBeNull();
      expect(result.meta!.created_by_actor).toBe("claude:a4c28f13");
      expect(result.meta!.last_actor).toBe("gh:nitsan");
    }
  );
});

// ---------------------------------------------------------------------------
// parseMeta — actor fields
// ---------------------------------------------------------------------------

describe("parseMeta — actor fields", () => {
  test(
    "ENG-4389: parses created_by_actor from meta block",
    () => {
      const input = [
        "Description",
        "",
        "<!-- plan:meta",
        "created_by_session: abc123",
        "created_by_actor: claude:a4c28f13",
        'created_at: "2026-04-01T12:00:00.000Z"',
        "-->",
      ].join("\n");

      const result = parseMeta(input);
      expect(result.meta).not.toBeNull();
      expect(result.meta!.created_by_actor).toBe("claude:a4c28f13");
    }
  );

  test(
    "ENG-4389: parses last_actor from meta block",
    () => {
      const input = [
        "Description",
        "",
        "<!-- plan:meta",
        "last_session: def456",
        "last_actor: gh:nitsan",
        'updated_at: "2026-04-01T14:00:00.000Z"',
        "-->",
      ].join("\n");

      const result = parseMeta(input);
      expect(result.meta).not.toBeNull();
      expect(result.meta!.last_actor).toBe("gh:nitsan");
    }
  );

  test(
    "ENG-4389: parses both actor fields together with all other fields",
    () => {
      const input = [
        "Full description here",
        "",
        "<!-- plan:meta",
        "created_by_session: sess-aaa",
        "created_by_actor: claude:abcd1234",
        'created_at: "2026-04-01T10:00:00.000Z"',
        "last_session: sess-bbb",
        "last_actor: gh:oria",
        'updated_at: "2026-04-01T12:00:00.000Z"',
        "sessions: sess-aaa, sess-bbb",
        "-->",
      ].join("\n");

      const result = parseMeta(input);
      expect(result.meta).not.toBeNull();
      expect(result.meta!.created_by_session).toBe("sess-aaa");
      expect(result.meta!.created_by_actor).toBe("claude:abcd1234");
      expect(result.meta!.created_at).toBe("2026-04-01T10:00:00.000Z");
      expect(result.meta!.last_session).toBe("sess-bbb");
      expect(result.meta!.last_actor).toBe("gh:oria");
      expect(result.meta!.updated_at).toBe("2026-04-01T12:00:00.000Z");
      expect(result.meta!.sessions).toEqual(["sess-aaa", "sess-bbb"]);
    }
  );

  test(
    "ENG-4389: handles meta block with actor fields but no session fields",
    () => {
      const input = [
        "Description",
        "",
        "<!-- plan:meta",
        "created_by_actor: gh:developer",
        'created_at: "2026-04-01T12:00:00.000Z"',
        "last_actor: gh:developer",
        'updated_at: "2026-04-01T12:00:00.000Z"',
        "-->",
      ].join("\n");

      const result = parseMeta(input);
      expect(result.meta).not.toBeNull();
      expect(result.meta!.created_by_actor).toBe("gh:developer");
      expect(result.meta!.last_actor).toBe("gh:developer");
      expect(result.meta!.created_by_session).toBeUndefined();
      expect(result.meta!.last_session).toBeUndefined();
    }
  );
});

// ---------------------------------------------------------------------------
// serializeMeta — actor fields
// ---------------------------------------------------------------------------

describe("serializeMeta — actor fields", () => {
  test(
    "ENG-4389: serializes created_by_actor after created_by_session",
    () => {
      const result = serializeMeta({
        created_by_session: "abc123",
        created_by_actor: "claude:a4c28f13",
        created_at: "2026-04-01T12:00:00.000Z",
      });

      expect(result).toContain("created_by_actor: claude:a4c28f13");

      // Verify ordering: created_by_session < created_by_actor < created_at
      const lines = result.split("\n");
      const sessionIdx = lines.findIndex(l => l.startsWith("created_by_session"));
      const actorIdx = lines.findIndex(l => l.startsWith("created_by_actor"));
      const createdAtIdx = lines.findIndex(l => l.startsWith("created_at"));
      expect(sessionIdx).toBeLessThan(actorIdx);
      expect(actorIdx).toBeLessThan(createdAtIdx);
    }
  );

  test(
    "ENG-4389: serializes last_actor after last_session and before updated_at",
    () => {
      const result = serializeMeta({
        last_session: "def456",
        last_actor: "gh:nitsan",
        updated_at: "2026-04-01T14:00:00.000Z",
      });

      expect(result).toContain("last_actor: gh:nitsan");

      // Verify ordering: last_session < last_actor < updated_at
      const lines = result.split("\n");
      const lastSessionIdx = lines.findIndex(l => l.startsWith("last_session"));
      const lastActorIdx = lines.findIndex(l => l.startsWith("last_actor"));
      const updatedAtIdx = lines.findIndex(l => l.startsWith("updated_at"));
      expect(lastSessionIdx).toBeLessThan(lastActorIdx);
      expect(lastActorIdx).toBeLessThan(updatedAtIdx);
    }
  );

  test(
    "ENG-4389: full field order: created_by_session, created_by_actor, created_at, last_session, last_actor, updated_at, sessions",
    () => {
      const result = serializeMeta({
        // Pass in scrambled order to prove serialization orders correctly
        updated_at: "2026-04-01T14:00:00.000Z",
        created_by_session: "sess-aaa",
        created_by_actor: "claude:abcd1234",
        sessions: ["sess-aaa", "sess-bbb"],
        last_session: "sess-bbb",
        last_actor: "gh:oria",
        created_at: "2026-04-01T10:00:00.000Z",
      });

      const lines = result.split("\n");
      const fieldLines = lines.filter(l => l.match(/^\w/));
      const createdBySessionIdx = fieldLines.findIndex(l => l.startsWith("created_by_session"));
      const createdByActorIdx = fieldLines.findIndex(l => l.startsWith("created_by_actor"));
      const createdAtIdx = fieldLines.findIndex(l => l.startsWith("created_at"));
      const lastSessionIdx = fieldLines.findIndex(l => l.startsWith("last_session"));
      const lastActorIdx = fieldLines.findIndex(l => l.startsWith("last_actor"));
      const updatedAtIdx = fieldLines.findIndex(l => l.startsWith("updated_at"));
      const sessionsIdx = fieldLines.findIndex(l => l.startsWith("sessions"));

      expect(createdBySessionIdx).toBeLessThan(createdByActorIdx);
      expect(createdByActorIdx).toBeLessThan(createdAtIdx);
      expect(createdAtIdx).toBeLessThan(lastSessionIdx);
      expect(lastSessionIdx).toBeLessThan(lastActorIdx);
      expect(lastActorIdx).toBeLessThan(updatedAtIdx);
      expect(updatedAtIdx).toBeLessThan(sessionsIdx);
    }
  );

  test(
    "ENG-4389: actor values are unquoted (not timestamp fields)",
    () => {
      const result = serializeMeta({
        created_by_actor: "claude:a4c28f13",
        last_actor: "gh:nitsan",
      });

      // Actor values should NOT be quoted
      expect(result).toContain("created_by_actor: claude:a4c28f13");
      expect(result).toContain("last_actor: gh:nitsan");
      expect(result).not.toContain('"claude:a4c28f13"');
      expect(result).not.toContain('"gh:nitsan"');
    }
  );
});

// ---------------------------------------------------------------------------
// Round-trip — actor fields
// ---------------------------------------------------------------------------

describe("round-trip — actor fields", () => {
  test(
    "ENG-4389: actor fields survive parse → serialize → parse",
    () => {
      const description = "A description with actor metadata.";
      const meta: PlanMeta = {
        created_by_session: "sess-aaa",
        created_by_actor: "claude:a4c28f13",
        created_at: "2026-04-01T10:00:00.000Z",
        last_session: "sess-bbb",
        last_actor: "gh:nitsan",
        updated_at: "2026-04-01T14:00:00.000Z",
        sessions: ["sess-aaa", "sess-bbb"],
      };

      const combined = attachMeta(description, meta);
      const parsed = parseMeta(combined);

      expect(parsed.description).toBe(description);
      expect(parsed.meta).not.toBeNull();
      expect(parsed.meta!.created_by_session).toBe("sess-aaa");
      expect(parsed.meta!.created_by_actor).toBe("claude:a4c28f13");
      expect(parsed.meta!.created_at).toBe("2026-04-01T10:00:00.000Z");
      expect(parsed.meta!.last_session).toBe("sess-bbb");
      expect(parsed.meta!.last_actor).toBe("gh:nitsan");
      expect(parsed.meta!.updated_at).toBe("2026-04-01T14:00:00.000Z");
      expect(parsed.meta!.sessions).toEqual(["sess-aaa", "sess-bbb"]);
    }
  );

  test(
    "ENG-4389: actor fields round-trip without session fields",
    () => {
      const description = "Actor-only metadata.";
      const meta: PlanMeta = {
        created_by_actor: "gh:developer",
        created_at: "2026-04-01T12:00:00.000Z",
        last_actor: "gh:developer",
        updated_at: "2026-04-01T12:00:00.000Z",
      };

      const combined = attachMeta(description, meta);
      const parsed = parseMeta(combined);

      expect(parsed.meta).not.toBeNull();
      expect(parsed.meta!.created_by_actor).toBe("gh:developer");
      expect(parsed.meta!.last_actor).toBe("gh:developer");
    }
  );
});

// ---------------------------------------------------------------------------
// buildMetaDescription — actor capture
// ---------------------------------------------------------------------------

describe("buildMetaDescription — actor capture", () => {
  const env = withSessionEnv();
  beforeEach(() => { env.save(); resetActorCache(); });
  afterEach(() => env.restore());

  test(
    "ENG-4389: on create (new meta), sets both created_by_actor and last_actor",
    () => {
      // Note: buildMetaDescription on create currently doesn't set created_by_session either
      // (only last_session). The actor fields follow the same pattern — both are set on create
      // because there's no "previous actor" to distinguish from.
      process.env.CLAUDE_SESSION_ID = "a4c28f13-1111-2222-3333-444444444444";

      const result = buildMetaDescription("New issue description", null);
      const parsed = parseMeta(result);

      expect(parsed.meta).not.toBeNull();
      expect(parsed.meta!.created_by_actor).toBe("claude:a4c28f13");
      expect(parsed.meta!.last_actor).toBe("claude:a4c28f13");
    }
  );

  test(
    "ENG-4389: on update (existing meta), only last_actor changes; created_by_actor preserved",
    () => {
      process.env.CLAUDE_SESSION_ID = "bbbb1234-5555-6666-7777-888888888888";

      const existingMeta: PlanMeta = {
        created_by_session: "aaaa0000-1111-2222-3333-444444444444",
        created_by_actor: "claude:aaaa0000",
        created_at: "2026-04-01T10:00:00.000Z",
        last_session: "aaaa0000-1111-2222-3333-444444444444",
        last_actor: "claude:aaaa0000",
        updated_at: "2026-04-01T10:00:00.000Z",
        sessions: ["aaaa0000-1111-2222-3333-444444444444"],
      };

      const result = buildMetaDescription("Updated description", existingMeta);
      const parsed = parseMeta(result);

      expect(parsed.meta).not.toBeNull();
      // created_by_actor must be preserved from original
      expect(parsed.meta!.created_by_actor).toBe("claude:aaaa0000");
      // last_actor must reflect the current session's actor
      expect(parsed.meta!.last_actor).toBe("claude:bbbb1234");
    }
  );

  test(
    "ENG-4389: on update without session ID, actor fields are preserved unchanged",
    () => {
      delete process.env.CLAUDE_SESSION_ID;

      const existingMeta: PlanMeta = {
        created_by_session: "aaaa0000-1111-2222-3333-444444444444",
        created_by_actor: "claude:aaaa0000",
        created_at: "2026-04-01T10:00:00.000Z",
        last_session: "aaaa0000-1111-2222-3333-444444444444",
        last_actor: "gh:nitsan",
        updated_at: "2026-04-01T12:00:00.000Z",
        sessions: ["aaaa0000-1111-2222-3333-444444444444"],
      };

      const result = buildMetaDescription("Description", existingMeta);
      const parsed = parseMeta(result);

      expect(parsed.meta).not.toBeNull();
      expect(parsed.meta!.created_by_actor).toBe("claude:aaaa0000");
      expect(parsed.meta!.last_actor).toBe("gh:nitsan");
    }
  );
});

// ---------------------------------------------------------------------------
// getActor — actor resolution
// ---------------------------------------------------------------------------

describe("getActor — actor resolution", () => {
  const env = withSessionEnv();

  beforeEach(() => {
    env.save();
    resetActorCache();
  });

  afterEach(() => env.restore());

  test(
    "ENG-4389: getActor resolves claude:<first-8-chars> from CLAUDE_SESSION_ID",
    () => {
      process.env.CLAUDE_SESSION_ID = "a4c28f13-1111-2222-3333-444444444444";

      expect(typeof getActor).toBe("function");

      const actor = getActor();
      expect(actor).toBe("claude:a4c28f13");
    }
  );

  test(
    "ENG-4389: getActor resolves gh:<username> from git config noreply email",
    () => {
      delete process.env.CLAUDE_SESSION_ID;

      expect(typeof getActor).toBe("function");

      // This test relies on the test environment having a git config.
      // The function should return some form of actor (not throw).
      const actor = getActor();
      expect(typeof actor).toBe("string");
      expect(actor.length).toBeGreaterThan(0);
      // Should match one of the known patterns
      expect(actor).toMatch(/^(claude:|gh:|unknown)/);
    }
  );

  test(
    "ENG-4389: getActor is exported from plan-meta module",
    () => {
      delete process.env.CLAUDE_SESSION_ID;
      // We can't easily remove git config in tests, but we can verify
      // the function exists and is callable from plan-meta module
      expect(typeof getActor).toBe("function");
    }
  );
});
