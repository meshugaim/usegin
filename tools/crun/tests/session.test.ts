import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { findSessionPath, getFirstUserMessage, getPromptPreview } from "../src/session";
import { homedir } from "os";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";

describe("session utilities", () => {
  // Create temp session for testing
  const testProjectDir = join(homedir(), ".claude/projects/test-crun-project");
  const testSessionId = "test-session-12345678";
  const testSessionPath = join(testProjectDir, `${testSessionId}.jsonl`);

  const testSessionContent = `{"type":"snapshot"}
{"type":"user","message":{"role":"user","content":"Hello, this is a test prompt"}}
{"type":"assistant","message":{"role":"assistant","content":"Hello! I received your test prompt."}}
{"type":"user","message":{"role":"user","content":"Second message"}}
`;

  beforeAll(async () => {
    await mkdir(testProjectDir, { recursive: true });
    await writeFile(testSessionPath, testSessionContent);
  });

  afterAll(async () => {
    await rm(testProjectDir, { recursive: true, force: true });
  });

  describe("findSessionPath", () => {
    it("finds session path for existing session", async () => {
      const path = await findSessionPath(testSessionId);
      expect(path).toBe(testSessionPath);
    });

    it("returns null for non-existent session", async () => {
      const path = await findSessionPath("non-existent-session-id");
      expect(path).toBeNull();
    });
  });

  describe("getFirstUserMessage", () => {
    it("extracts first user message from session", async () => {
      const message = await getFirstUserMessage(testSessionPath);
      expect(message).toBe("Hello, this is a test prompt");
    });

    it("returns null for non-existent file", async () => {
      const message = await getFirstUserMessage("/non/existent/path.jsonl");
      expect(message).toBeNull();
    });
  });

  describe("getPromptPreview", () => {
    it("returns truncated prompt for existing session", async () => {
      const preview = await getPromptPreview(testSessionId, 20);
      expect(preview).toBe("Hello, this is a ...");
    });

    it("returns full prompt if shorter than max", async () => {
      const preview = await getPromptPreview(testSessionId, 100);
      expect(preview).toBe("Hello, this is a test prompt");
    });

    it("returns null for non-existent session", async () => {
      const preview = await getPromptPreview("non-existent-session-id");
      expect(preview).toBeNull();
    });
  });
});

describe("session with array content", () => {
  const testProjectDir = join(homedir(), ".claude/projects/test-crun-array");
  const testSessionId = "test-session-array";
  const testSessionPath = join(testProjectDir, `${testSessionId}.jsonl`);

  // Content with array-style message content
  const testSessionContent = `{"type":"snapshot"}
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Array content message"}]}}
`;

  beforeAll(async () => {
    await mkdir(testProjectDir, { recursive: true });
    await writeFile(testSessionPath, testSessionContent);
  });

  afterAll(async () => {
    await rm(testProjectDir, { recursive: true, force: true });
  });

  it("handles array content format", async () => {
    const message = await getFirstUserMessage(testSessionPath);
    expect(message).toBe("Array content message");
  });
});
