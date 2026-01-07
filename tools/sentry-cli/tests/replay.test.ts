import { describe, test, expect } from "bun:test";
import {
  parseRrwebEvents,
  formatReplayTimeline,
  formatReplayJson,
  type RrwebEvent,
  type ParsedReplayEvent,
  RrwebEventType,
  RrwebIncrementalSource,
} from "../src/lib/replay-format";

// Sample rrweb events for testing
const sampleEvents: RrwebEvent[] = [
  // Meta event
  {
    type: RrwebEventType.Meta,
    timestamp: 1704067200000,
    data: {
      href: "https://example.com/dashboard",
      width: 1920,
      height: 1080,
    },
  },
  // Full snapshot
  {
    type: RrwebEventType.FullSnapshot,
    timestamp: 1704067200100,
    data: {
      node: { type: 0, childNodes: [] },
    },
  },
  // Mouse click
  {
    type: RrwebEventType.IncrementalSnapshot,
    timestamp: 1704067201000,
    data: {
      source: RrwebIncrementalSource.MouseInteraction,
      type: 2, // Click
      x: 500,
      y: 300,
    },
  },
  // DOM Mutation
  {
    type: RrwebEventType.IncrementalSnapshot,
    timestamp: 1704067202000,
    data: {
      source: RrwebIncrementalSource.Mutation,
      texts: [],
      attributes: [],
      removes: [],
      adds: [
        {
          parentId: 1,
          nextId: null,
          node: {
            type: 2,
            tagName: "div",
            attributes: { class: "error-message" },
          },
        },
      ],
    },
  },
  // Input event
  {
    type: RrwebEventType.IncrementalSnapshot,
    timestamp: 1704067203000,
    data: {
      source: RrwebIncrementalSource.Input,
      id: 42,
      text: "user@example.com",
    },
  },
  // Scroll event
  {
    type: RrwebEventType.IncrementalSnapshot,
    timestamp: 1704067204000,
    data: {
      source: RrwebIncrementalSource.Scroll,
      id: 1,
      x: 0,
      y: 500,
    },
  },
  // Custom event (error)
  {
    type: RrwebEventType.Custom,
    timestamp: 1704067205000,
    data: {
      tag: "error",
      payload: {
        message: "TypeError: Cannot read property 'foo' of undefined",
      },
    },
  },
];

describe("parseRrwebEvents", () => {
  test("parses all event types", () => {
    const parsed = parseRrwebEvents(sampleEvents);
    expect(parsed.length).toBeGreaterThan(0);
  });

  test("extracts meta event info", () => {
    const parsed = parseRrwebEvents(sampleEvents);
    const metaEvent = parsed.find((e) => e.type === "meta");
    expect(metaEvent).toBeDefined();
    expect(metaEvent?.details).toContain("https://example.com/dashboard");
  });

  test("extracts mouse click events", () => {
    const parsed = parseRrwebEvents(sampleEvents);
    const clickEvent = parsed.find((e) => e.type === "click");
    expect(clickEvent).toBeDefined();
    expect(clickEvent?.details).toContain("500");
    expect(clickEvent?.details).toContain("300");
  });

  test("extracts mutation events", () => {
    const parsed = parseRrwebEvents(sampleEvents);
    const mutationEvent = parsed.find((e) => e.type === "mutation");
    expect(mutationEvent).toBeDefined();
    expect(mutationEvent?.details).toContain("div");
  });

  test("extracts input events", () => {
    const parsed = parseRrwebEvents(sampleEvents);
    const inputEvent = parsed.find((e) => e.type === "input");
    expect(inputEvent).toBeDefined();
    // Should mask sensitive input
    expect(inputEvent?.details).not.toContain("user@example.com");
    expect(inputEvent?.details).toContain("[input]");
  });

  test("extracts scroll events", () => {
    const parsed = parseRrwebEvents(sampleEvents);
    const scrollEvent = parsed.find((e) => e.type === "scroll");
    expect(scrollEvent).toBeDefined();
    expect(scrollEvent?.details).toContain("500");
  });

  test("extracts error events", () => {
    const parsed = parseRrwebEvents(sampleEvents);
    const errorEvent = parsed.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.details).toContain("TypeError");
  });

  test("preserves timestamps", () => {
    const parsed = parseRrwebEvents(sampleEvents);
    for (const event of parsed) {
      expect(event.timestamp).toBeGreaterThan(0);
    }
  });
});

describe("parseRrwebEvents with type filter", () => {
  test("filters to mutation events only", () => {
    const parsed = parseRrwebEvents(sampleEvents, { type: "mutation" });
    expect(parsed.length).toBe(1);
    expect(parsed[0].type).toBe("mutation");
  });

  test("filters to click events only", () => {
    const parsed = parseRrwebEvents(sampleEvents, { type: "click" });
    expect(parsed.length).toBe(1);
    expect(parsed[0].type).toBe("click");
  });

  test("filters to error events only", () => {
    const parsed = parseRrwebEvents(sampleEvents, { type: "error" });
    expect(parsed.length).toBe(1);
    expect(parsed[0].type).toBe("error");
  });

  test("returns empty for non-matching filter", () => {
    const parsed = parseRrwebEvents(sampleEvents, { type: "viewport" });
    expect(parsed.length).toBe(0);
  });
});

describe("formatReplayTimeline", () => {
  test("formats events as timeline", () => {
    const parsed = parseRrwebEvents(sampleEvents);
    const output = formatReplayTimeline(parsed);

    expect(output).toContain("Timeline");
    // Should have relative timestamps
    expect(output).toMatch(/\+\d+/); // Like +0ms, +1000ms
  });

  test("includes event types in output", () => {
    const parsed = parseRrwebEvents(sampleEvents);
    const output = formatReplayTimeline(parsed);

    expect(output).toContain("click");
    expect(output).toContain("mutation");
    expect(output).toContain("error");
  });

  test("handles empty events list", () => {
    const output = formatReplayTimeline([]);
    expect(output).toContain("No events");
  });
});

describe("formatReplayJson", () => {
  test("returns valid JSON", () => {
    const parsed = parseRrwebEvents(sampleEvents);
    const output = formatReplayJson(parsed);
    const json = JSON.parse(output);

    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBe(parsed.length);
  });

  test("includes all event properties", () => {
    const parsed = parseRrwebEvents(sampleEvents);
    const output = formatReplayJson(parsed);
    const json = JSON.parse(output);

    for (const event of json) {
      expect(event).toHaveProperty("type");
      expect(event).toHaveProperty("timestamp");
      expect(event).toHaveProperty("details");
    }
  });
});

describe("timestamp normalization", () => {
  test("normalizes seconds timestamps to milliseconds", () => {
    // Timestamp in seconds (before Jan 1, 2000 in ms)
    const events: RrwebEvent[] = [
      {
        type: RrwebEventType.Meta,
        timestamp: 1704067200, // seconds
        data: { href: "https://example.com" },
      },
    ];
    const parsed = parseRrwebEvents(events);
    expect(parsed[0].timestamp).toBe(1704067200000); // converted to ms
  });

  test("preserves milliseconds timestamps", () => {
    const events: RrwebEvent[] = [
      {
        type: RrwebEventType.Meta,
        timestamp: 1704067200000, // already ms
        data: { href: "https://example.com" },
      },
    ];
    const parsed = parseRrwebEvents(events);
    expect(parsed[0].timestamp).toBe(1704067200000);
  });
});

// Hydration error specific tests
describe("parseRrwebEvents hydration filter", () => {
  const hydrationEvents: RrwebEvent[] = [
    // Regular mutation
    {
      type: RrwebEventType.IncrementalSnapshot,
      timestamp: 1704067201000,
      data: {
        source: RrwebIncrementalSource.Mutation,
        texts: [],
        attributes: [],
        removes: [],
        adds: [
          {
            parentId: 1,
            nextId: null,
            node: { type: 2, tagName: "div", attributes: {} },
          },
        ],
      },
    },
    // Hydration-related mutation (server/client mismatch pattern)
    {
      type: RrwebEventType.IncrementalSnapshot,
      timestamp: 1704067202000,
      data: {
        source: RrwebIncrementalSource.Mutation,
        texts: [{ id: 5, value: "client-rendered" }],
        attributes: [
          { id: 3, attributes: { "data-reactroot": "" } },
        ],
        removes: [],
        adds: [],
      },
    },
    // Custom hydration error event
    {
      type: RrwebEventType.Custom,
      timestamp: 1704067203000,
      data: {
        tag: "error",
        payload: {
          message: "Hydration failed because the initial UI does not match",
        },
      },
    },
  ];

  test("filters to hydration-related events", () => {
    const parsed = parseRrwebEvents(hydrationEvents, { type: "hydration" });
    // Should include the custom error with hydration message
    expect(parsed.some((e) => e.details.includes("Hydration"))).toBe(true);
  });

  test("includes data-reactroot attribute changes", () => {
    const parsed = parseRrwebEvents(hydrationEvents, { type: "hydration" });
    // Should include mutation with data-reactroot attribute
    expect(parsed.some((e) => e.details.includes("data-reactroot"))).toBe(true);
  });

  test("excludes unrelated mutations from hydration filter", () => {
    const parsed = parseRrwebEvents(hydrationEvents, { type: "hydration" });
    // Should NOT include the regular div mutation (first event)
    expect(parsed.every((e) => !e.details.includes("+1 nodes (div)"))).toBe(true);
  });
});
