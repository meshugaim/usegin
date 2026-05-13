import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { parseSessionContext, getContextWindow, getRemainingContext } from "../src/lib/context";
import { join } from "path";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";

describe("getContextWindow", () => {
  it("returns correct window for known models", () => {
    expect(getContextWindow("claude-opus-4-5-20251101")).toBe(200000);
    expect(getContextWindow("claude-sonnet-4-5-20250514")).toBe(200000);
  });

  it("returns 1M for current-gen models", () => {
    expect(getContextWindow("claude-opus-4-7")).toBe(1000000);
    expect(getContextWindow("claude-sonnet-4-7")).toBe(1000000);
    expect(getContextWindow("claude-opus-4-6")).toBe(1000000);
    expect(getContextWindow("claude-sonnet-4-6")).toBe(1000000);
  });

  it("returns 1M for future dated variants via prefix match", () => {
    expect(getContextWindow("claude-opus-4-7-20260501")).toBe(1000000);
    expect(getContextWindow("claude-sonnet-4-7-20260601")).toBe(1000000);
    expect(getContextWindow("claude-opus-4-6-20260401")).toBe(1000000);
    expect(getContextWindow("claude-sonnet-4-6-20260601")).toBe(1000000);
  });

  it("returns default for unknown models", () => {
    expect(getContextWindow("unknown-model")).toBe(200000);
    expect(getContextWindow("claude-haiku-5-0")).toBe(200000);
  });
});

describe("parseSessionContext", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cctx-test-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("returns null for non-existent file", async () => {
    const result = await parseSessionContext("/nonexistent/path.jsonl");
    expect(result).toBeNull();
  });

  it("returns null for empty file", async () => {
    const filePath = join(tempDir, "empty.jsonl");
    await writeFile(filePath, "");

    const result = await parseSessionContext(filePath);
    expect(result).toBeNull();
  });

  it("returns null for file with no usage data", async () => {
    const filePath = join(tempDir, "no-usage.jsonl");
    await writeFile(filePath, '{"type":"user","message":{"role":"user","content":"hello"}}\n');

    const result = await parseSessionContext(filePath);
    expect(result).toBeNull();
  });

  it("parses valid session file with usage data", async () => {
    const filePath = join(tempDir, "test-session-abc123.jsonl");
    const sessionData = [
      '{"type":"user","message":{"role":"user","content":"hello"},"timestamp":"2026-01-17T10:00:00Z"}',
      '{"type":"assistant","message":{"role":"assistant","model":"claude-opus-4-5-20251101","usage":{"input_tokens":10,"output_tokens":50,"cache_read_input_tokens":5000,"cache_creation_input_tokens":1000}},"timestamp":"2026-01-17T10:00:01Z"}',
    ].join("\n");
    await writeFile(filePath, sessionData);

    const result = await parseSessionContext(filePath);

    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe("test-session-abc123");
    expect(result!.model).toBe("claude-opus-4-5-20251101");
    expect(result!.contextTokens).toBe(6010); // 10 + 5000 + 1000
    expect(result!.contextWindow).toBe(200000);
    expect(result!.utilization).toBeCloseTo(0.03005, 4);
    expect(result!.utilizationPercent).toBe("3.0%");
    expect(result!.usage.inputTokens).toBe(10);
    expect(result!.usage.outputTokens).toBe(50);
    expect(result!.usage.cacheReadInputTokens).toBe(5000);
    expect(result!.usage.cacheCreationInputTokens).toBe(1000);
  });

  it("uses the last message with usage data", async () => {
    const filePath = join(tempDir, "multi-message.jsonl");
    const sessionData = [
      '{"type":"assistant","message":{"model":"claude-opus-4-5-20251101","usage":{"input_tokens":10,"output_tokens":10,"cache_read_input_tokens":1000,"cache_creation_input_tokens":500}}}',
      '{"type":"assistant","message":{"model":"claude-opus-4-5-20251101","usage":{"input_tokens":20,"output_tokens":20,"cache_read_input_tokens":2000,"cache_creation_input_tokens":800}}}',
    ].join("\n");
    await writeFile(filePath, sessionData);

    const result = await parseSessionContext(filePath);

    expect(result!.contextTokens).toBe(2820); // Uses last: 20 + 2000 + 800
    expect(result!.usage.inputTokens).toBe(20);
  });
});

describe("getRemainingContext", () => {
  it("calculates remaining tokens correctly", () => {
    const info = {
      sessionId: "test",
      path: "/test",
      contextTokens: 50000,
      contextWindow: 200000,
      utilization: 0.25,
      utilizationPercent: "25.0%",
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 40000,
        cacheCreationInputTokens: 9900,
      },
      model: "claude-opus-4-5-20251101",
      lastActivity: "",
    };

    const remaining = getRemainingContext(info);

    expect(remaining.tokens).toBe(150000);
    expect(remaining.percent).toBe("75.0%");
  });

  it("handles full context", () => {
    const info = {
      sessionId: "test",
      path: "/test",
      contextTokens: 200000,
      contextWindow: 200000,
      utilization: 1.0,
      utilizationPercent: "100.0%",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 200000,
        cacheCreationInputTokens: 0,
      },
      model: "claude-opus-4-5-20251101",
      lastActivity: "",
    };

    const remaining = getRemainingContext(info);

    expect(remaining.tokens).toBe(0);
    expect(remaining.percent).toBe("0.0%");
  });
});
