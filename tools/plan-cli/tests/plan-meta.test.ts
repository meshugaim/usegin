import { describe, test, expect } from "bun:test";

/**
 * Failing tests for the plan-meta module (ENG-3763).
 *
 * The module under test (`../src/lib/plan-meta.ts`) does not exist yet.
 * Every test uses `test.failing` so CI stays green while the RED phase
 * documents the expected behavior.
 */

// Lazy import — module doesn't exist yet (TDD red phase).
// Every test.failing catches the ModuleNotFound error as the expected failure.
// Convert to static import once plan-meta.ts is created in the green phase.
async function getPlanMeta() {
  return await import("../src/lib/plan-meta");
}

// ---------------------------------------------------------------------------
// parseMeta
// ---------------------------------------------------------------------------

describe("parseMeta", () => {
  test.failing(
    "ENG-3763: extracts meta block from end of description, returns {description, meta}",
    async () => {
      const { parseMeta } = await getPlanMeta();

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

  test.failing(
    "ENG-3763: returns meta: null for description with no meta block",
    async () => {
      const { parseMeta } = await getPlanMeta();

      const result = parseMeta("Just a plain description with no metadata.");

      expect(result.description).toBe("Just a plain description with no metadata.");
      expect(result.meta).toBeNull();
    }
  );

  test.failing(
    "ENG-3763: returns meta: null for empty string",
    async () => {
      const { parseMeta } = await getPlanMeta();

      const result = parseMeta("");

      expect(result.description).toBe("");
      expect(result.meta).toBeNull();
    }
  );

  test.failing(
    "ENG-3763: handles non-plan HTML comments — leaves them in description, returns meta: null",
    async () => {
      const { parseMeta } = await getPlanMeta();

      const input = "Some content\n\n<!-- TODO: fix this later -->";

      const result = parseMeta(input);

      expect(result.description).toBe("Some content\n\n<!-- TODO: fix this later -->");
      expect(result.meta).toBeNull();
    }
  );

  test.failing(
    "ENG-3763: returns meta: null for malformed YAML inside meta block (resilient, no throw)",
    async () => {
      const { parseMeta } = await getPlanMeta();

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

  test.failing(
    "ENG-3763: does NOT match meta block in the middle of content (only end-of-string)",
    async () => {
      const { parseMeta } = await getPlanMeta();

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

  test.failing(
    "ENG-3763: tolerates trailing whitespace/newlines after -->",
    async () => {
      const { parseMeta } = await getPlanMeta();

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

  test.failing(
    "ENG-3763: parses sessions array from YAML list syntax",
    async () => {
      const { parseMeta } = await getPlanMeta();

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

  test.failing(
    "ENG-3763: handles multiple blank lines before meta block",
    async () => {
      const { parseMeta } = await getPlanMeta();
      const input = "Description\n\n\n\n<!-- plan:meta\nlast_session: sess-1\n-->";
      const result = parseMeta(input);
      expect(result.description).toBe("Description");
      expect(result.meta).not.toBeNull();
      expect(result.meta!.last_session).toBe("sess-1");
    }
  );

  test.failing(
    "ENG-3763: returns duplicate session IDs faithfully — dedup is caller's job",
    async () => {
      const { parseMeta } = await getPlanMeta();
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

  test.failing(
    "ENG-3763: handles undefined/null input gracefully",
    async () => {
      const { parseMeta } = await getPlanMeta();
      const result1 = parseMeta(undefined as any);
      expect(result1.description).toBe("");
      expect(result1.meta).toBeNull();
      const result2 = parseMeta(null as any);
      expect(result2.description).toBe("");
      expect(result2.meta).toBeNull();
    }
  );

  test.failing(
    "ENG-3763: handles meta block without sessions field (older format)",
    async () => {
      const { parseMeta } = await getPlanMeta();

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
  test.failing(
    "ENG-3763: produces correct <!-- plan:meta\\n...\\n--> format",
    async () => {
      const { serializeMeta } = await getPlanMeta();

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

  test.failing(
    "ENG-3763: omits undefined/null fields",
    async () => {
      const { serializeMeta } = await getPlanMeta();

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

  test.failing(
    "ENG-3763: quotes timestamp values",
    async () => {
      const { serializeMeta } = await getPlanMeta();

      const result = serializeMeta({
        created_at: "2026-03-30T12:00:00.000Z",
        updated_at: "2026-03-30T14:30:00.000Z",
      });

      expect(result).toContain('created_at: "2026-03-30T12:00:00.000Z"');
      expect(result).toContain('updated_at: "2026-03-30T14:30:00.000Z"');
    }
  );

  test.failing(
    "ENG-3763: serializes sessions array as YAML - value list",
    async () => {
      const { serializeMeta } = await getPlanMeta();

      const result = serializeMeta({
        created_by_session: "abc123",
        sessions: ["abc123", "def456"],
      });

      expect(result).toContain("sessions:");
      expect(result).toContain("  - abc123");
      expect(result).toContain("  - def456");
    }
  );

  test.failing(
    "ENG-3763: fields are ordered: created_by_session, created_at, last_session, updated_at, sessions",
    async () => {
      const { serializeMeta } = await getPlanMeta();
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

  test.failing(
    "ENG-3763: omits sessions when empty array or undefined",
    async () => {
      const { serializeMeta } = await getPlanMeta();

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
  test.failing(
    "ENG-3763: appends meta block to clean description with blank line separator",
    async () => {
      const { attachMeta, parseMeta } = await getPlanMeta();

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

  test.failing(
    "ENG-3763: handles empty description",
    async () => {
      const { attachMeta, parseMeta } = await getPlanMeta();
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

  test.failing(
    "ENG-3763: does not strip existing meta — caller must pass clean description",
    async () => {
      const { attachMeta, parseMeta } = await getPlanMeta();
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
  test.failing(
    "ENG-3763: parseMeta(attachMeta(description, meta)) returns original description and meta",
    async () => {
      const { parseMeta, attachMeta } = await getPlanMeta();

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
  test.failing(
    "ENG-3763: hash of description with meta === hash of same description without meta",
    async () => {
      const { hashDescription } = await import("../src/lib/checkout-meta");

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
    async () => {
      const { hashDescription } = await import("../src/lib/checkout-meta");

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
    async () => {
      const { hashDescription } = await import("../src/lib/checkout-meta");

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
