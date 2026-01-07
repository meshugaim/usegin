import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { formatEvent, formatEventJson, type SentryEvent } from "../src/lib/format";

describe("formatEvent", () => {
  const sampleEvent: SentryEvent = {
    eventID: "abc123def456",
    title: "Error: Something went wrong",
    message: "Something went wrong",
    dateCreated: "2024-01-15T10:30:00Z",
    entries: [
      {
        type: "exception",
        data: {
          values: [
            {
              type: "TypeError",
              value: "Cannot read property 'foo' of undefined",
              stacktrace: {
                frames: [
                  {
                    filename: "app.js",
                    function: "handleClick",
                    lineno: 42,
                    colno: 15,
                    absPath: "/src/app.js",
                    context: [
                      [40, "function handleClick() {"],
                      [41, "  const data = getData();"],
                      [42, "  console.log(data.foo);"],
                      [43, "}"],
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
      {
        type: "breadcrumbs",
        data: {
          values: [
            {
              timestamp: "2024-01-15T10:29:55Z",
              category: "navigation",
              message: "/home -> /dashboard",
              level: "info",
            },
            {
              timestamp: "2024-01-15T10:29:58Z",
              category: "ui.click",
              message: "button#submit",
              level: "info",
            },
          ],
        },
      },
    ],
    contexts: {
      browser: { name: "Chrome", version: "120" },
      device: { family: "Desktop" },
      replay: { replay_id: "896e230a12345678" },
    },
    tags: [
      { key: "environment", value: "production" },
      { key: "release", value: "1.0.0" },
    ],
  };

  test("formats event title and metadata", () => {
    const output = formatEvent(sampleEvent);
    expect(output).toContain("abc123def456");
    expect(output).toContain("Error: Something went wrong");
    // Date format varies by locale, just check the year
    expect(output).toContain("2024");
  });

  test("formats stacktrace", () => {
    const output = formatEvent(sampleEvent);
    expect(output).toContain("TypeError");
    expect(output).toContain("Cannot read property 'foo' of undefined");
    expect(output).toContain("handleClick");
    expect(output).toContain("app.js");
    expect(output).toContain(":42");
  });

  test("formats breadcrumbs", () => {
    const output = formatEvent(sampleEvent);
    expect(output).toContain("Breadcrumbs");
    expect(output).toContain("navigation");
    expect(output).toContain("/home -> /dashboard");
    expect(output).toContain("ui.click");
    expect(output).toContain("button#submit");
  });

  test("formats contexts", () => {
    const output = formatEvent(sampleEvent);
    expect(output).toContain("browser");
    expect(output).toContain("Chrome");
    expect(output).toContain("device");
    expect(output).toContain("Desktop");
  });

  test("formats tags", () => {
    const output = formatEvent(sampleEvent);
    expect(output).toContain("environment");
    expect(output).toContain("production");
    expect(output).toContain("release");
    expect(output).toContain("1.0.0");
  });

  test("shows replay link if present", () => {
    const output = formatEvent(sampleEvent, "askeffi");
    expect(output).toContain("Replay");
    expect(output).toContain("896e230a12345678");
  });
});

describe("formatEventJson", () => {
  test("returns valid JSON", () => {
    const event: SentryEvent = {
      eventID: "abc123",
      title: "Test Error",
      dateCreated: "2024-01-15T10:30:00Z",
      entries: [],
      contexts: {},
      tags: [],
    };

    const output = formatEventJson(event);
    const parsed = JSON.parse(output);
    expect(parsed.eventID).toBe("abc123");
  });
});
