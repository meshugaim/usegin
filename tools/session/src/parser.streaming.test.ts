import { test, expect, describe } from "bun:test";

describe("StreamingParser", () => {
  test("parses single complete line", () => {
    const { StreamingParser } = require("./parser");
    const parser = new StreamingParser();

    const line = JSON.stringify({
      type: "user",
      uuid: "u1",
      session_id: "s1",
      message: { role: "user", content: "Hello" },
    });

    const output = parser.feed(line + "\n");

    expect(output).toHaveLength(1);
    expect(output[0]).toContain("USER:");
    expect(output[0]).toContain("Hello");
  });

  test("buffers incomplete lines", () => {
    const { StreamingParser } = require("./parser");
    const parser = new StreamingParser();

    const line = JSON.stringify({
      type: "user",
      uuid: "u1",
      session_id: "s1",
      message: { role: "user", content: "Hello" },
    });

    // Feed partial line
    const output1 = parser.feed(line.slice(0, 20));
    expect(output1).toHaveLength(0);

    // Feed rest of line + newline
    const output2 = parser.feed(line.slice(20) + "\n");
    expect(output2).toHaveLength(1);
    expect(output2[0]).toContain("Hello");
  });

  test("parses multiple lines in one chunk", () => {
    const { StreamingParser } = require("./parser");
    const parser = new StreamingParser();

    const line1 = JSON.stringify({
      type: "user",
      uuid: "u1",
      session_id: "s1",
      message: { role: "user", content: "First" },
    });
    const line2 = JSON.stringify({
      type: "assistant",
      uuid: "a1",
      session_id: "s1",
      message: { role: "assistant", model: "claude", content: "Second" },
    });

    const output = parser.feed(line1 + "\n" + line2 + "\n");

    expect(output).toHaveLength(2);
    expect(output[0]).toContain("First");
    expect(output[1]).toContain("Second");
  });

  test("end() flushes remaining buffer", () => {
    const { StreamingParser } = require("./parser");
    const parser = new StreamingParser();

    const line = JSON.stringify({
      type: "user",
      uuid: "u1",
      session_id: "s1",
      message: { role: "user", content: "Final" },
    });

    // Feed without trailing newline
    parser.feed(line);
    const output = parser.end();

    expect(output).toHaveLength(1);
    expect(output[0]).toContain("Final");
  });

  test("skips system entries", () => {
    const { StreamingParser } = require("./parser");
    const parser = new StreamingParser();

    const systemLine = JSON.stringify({
      type: "system",
      subtype: "init",
      uuid: "sys1",
      session_id: "s1",
      cwd: "/test",
      tools: ["Read"],
      model: "claude",
    });
    const userLine = JSON.stringify({
      type: "user",
      uuid: "u1",
      session_id: "s1",
      message: { role: "user", content: "Hello" },
    });

    const output = parser.feed(systemLine + "\n" + userLine + "\n");

    expect(output).toHaveLength(1);
    expect(output[0]).toContain("Hello");
  });
});
