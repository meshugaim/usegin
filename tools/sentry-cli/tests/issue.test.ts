import { describe, test, expect } from "bun:test";
import {
  formatIssueSummary,
  formatIssueStats,
  formatIssueJson,
  computeEventStats,
  type SentryIssue,
  type SentryEventLite,
  type EventStats,
} from "../src/lib/issue-format";

describe("computeEventStats", () => {
  const sampleEvents: SentryEventLite[] = [
    {
      eventID: "event1",
      dateCreated: "2024-01-15T10:30:00Z",
      tags: [
        { key: "url", value: "/projects/123/settings" },
        { key: "environment", value: "staging" },
        { key: "browser", value: "Chrome" },
      ],
    },
    {
      eventID: "event2",
      dateCreated: "2024-01-15T10:31:00Z",
      tags: [
        { key: "url", value: "/projects/123/settings" },
        { key: "environment", value: "staging" },
        { key: "browser", value: "Chrome" },
      ],
    },
    {
      eventID: "event3",
      dateCreated: "2024-01-15T10:32:00Z",
      tags: [
        { key: "url", value: "/toggles" },
        { key: "environment", value: "production" },
        { key: "browser", value: "Firefox" },
      ],
    },
    {
      eventID: "event4",
      dateCreated: "2024-01-15T10:33:00Z",
      tags: [
        { key: "url", value: "/projects" },
        { key: "environment", value: "production" },
        { key: "browser", value: "Safari" },
      ],
    },
  ];

  test("groups events by URL", () => {
    const stats = computeEventStats(sampleEvents);
    expect(stats.byUrl).toEqual({
      "/projects/123/settings": 2,
      "/toggles": 1,
      "/projects": 1,
    });
  });

  test("groups events by environment", () => {
    const stats = computeEventStats(sampleEvents);
    expect(stats.byEnvironment).toEqual({
      staging: 2,
      production: 2,
    });
  });

  test("groups events by browser", () => {
    const stats = computeEventStats(sampleEvents);
    expect(stats.byBrowser).toEqual({
      Chrome: 2,
      Firefox: 1,
      Safari: 1,
    });
  });

  test("returns total event count", () => {
    const stats = computeEventStats(sampleEvents);
    expect(stats.total).toBe(4);
  });

  test("handles events without tags gracefully", () => {
    const eventsWithMissingTags: SentryEventLite[] = [
      {
        eventID: "event1",
        dateCreated: "2024-01-15T10:30:00Z",
        tags: [{ key: "environment", value: "staging" }],
      },
      {
        eventID: "event2",
        dateCreated: "2024-01-15T10:31:00Z",
        // No tags array at all
      },
    ];

    const stats = computeEventStats(eventsWithMissingTags);
    expect(stats.total).toBe(2);
    expect(stats.byEnvironment).toEqual({ staging: 1 });
    expect(stats.byUrl).toEqual({});
  });

  test("handles empty events array", () => {
    const stats = computeEventStats([]);
    expect(stats.total).toBe(0);
    expect(stats.byUrl).toEqual({});
    expect(stats.byEnvironment).toEqual({});
    expect(stats.byBrowser).toEqual({});
  });
});

describe("formatIssueStats", () => {
  const stats: EventStats = {
    total: 44,
    byUrl: {
      "/projects/.../settings": 23,
      "/toggles": 17,
      "/projects": 4,
    },
    byEnvironment: {
      staging: 32,
      production: 12,
    },
    byBrowser: {
      Chrome: 30,
      Firefox: 10,
      Safari: 4,
    },
  };

  test("formats stats with URL breakdown", () => {
    const output = formatIssueStats(stats);
    expect(output).toContain("Events by URL:");
    expect(output).toContain("/projects/.../settings");
    expect(output).toContain("23");
    expect(output).toContain("/toggles");
    expect(output).toContain("17");
  });

  test("formats stats with environment breakdown", () => {
    const output = formatIssueStats(stats);
    expect(output).toContain("Events by environment:");
    expect(output).toContain("staging");
    expect(output).toContain("32");
    expect(output).toContain("production");
    expect(output).toContain("12");
  });

  test("formats stats with browser breakdown", () => {
    const output = formatIssueStats(stats);
    expect(output).toContain("Events by browser:");
    expect(output).toContain("Chrome");
    expect(output).toContain("30");
  });

  test("sorts breakdowns by count descending", () => {
    const output = formatIssueStats(stats);
    // Check that staging (32) appears before production (12)
    const stagingIndex = output.indexOf("staging");
    const productionIndex = output.indexOf("production");
    expect(stagingIndex).toBeLessThan(productionIndex);
  });

  test("shows total event count", () => {
    const output = formatIssueStats(stats);
    expect(output).toContain("Total events:");
    expect(output).toContain("44");
  });
});

describe("formatIssueSummary", () => {
  const sampleIssue: SentryIssue = {
    id: "123456",
    shortId: "NEXTJS-APP-1",
    title: "Error: Something went wrong",
    status: "unresolved",
    count: "42",
    userCount: 15,
    firstSeen: "2024-01-10T10:00:00Z",
    lastSeen: "2024-01-15T10:30:00Z",
    project: {
      slug: "nextjs-app",
      name: "Next.js App",
    },
    metadata: {
      type: "TypeError",
      value: "Cannot read property 'foo' of undefined",
    },
  };

  test("shows issue ID and title", () => {
    const output = formatIssueSummary(sampleIssue, "askeffi");
    expect(output).toContain("NEXTJS-APP-1");
    expect(output).toContain("Error: Something went wrong");
  });

  test("shows status and counts", () => {
    const output = formatIssueSummary(sampleIssue, "askeffi");
    expect(output).toContain("unresolved");
    expect(output).toContain("42"); // event count
    expect(output).toContain("15"); // user count
  });

  test("shows project info", () => {
    const output = formatIssueSummary(sampleIssue, "askeffi");
    expect(output).toContain("nextjs-app");
  });

  test("shows first and last seen dates", () => {
    const output = formatIssueSummary(sampleIssue, "askeffi");
    expect(output).toContain("First seen:");
    expect(output).toContain("Last seen:");
  });

  test("includes Sentry link", () => {
    const output = formatIssueSummary(sampleIssue, "askeffi");
    expect(output).toContain("https://sentry.io/organizations/askeffi/issues/");
    expect(output).toContain("123456");
  });
});

describe("formatIssueJson", () => {
  const sampleIssue: SentryIssue = {
    id: "123456",
    shortId: "NEXTJS-APP-1",
    title: "Error: Something went wrong",
    status: "unresolved",
    count: "42",
    userCount: 15,
    firstSeen: "2024-01-10T10:00:00Z",
    lastSeen: "2024-01-15T10:30:00Z",
    project: {
      slug: "nextjs-app",
      name: "Next.js App",
    },
    metadata: {
      type: "TypeError",
      value: "Cannot read property 'foo' of undefined",
    },
  };

  const stats: EventStats = {
    total: 44,
    byUrl: { "/projects": 44 },
    byEnvironment: { staging: 44 },
    byBrowser: { Chrome: 44 },
  };

  test("returns valid JSON", () => {
    const output = formatIssueJson(sampleIssue, stats);
    const parsed = JSON.parse(output);
    expect(parsed.issue.shortId).toBe("NEXTJS-APP-1");
    expect(parsed.stats.total).toBe(44);
  });

  test("includes issue metadata in JSON", () => {
    const output = formatIssueJson(sampleIssue, stats);
    const parsed = JSON.parse(output);
    expect(parsed.issue.status).toBe("unresolved");
    expect(parsed.issue.userCount).toBe(15);
  });

  test("includes stats breakdowns in JSON", () => {
    const output = formatIssueJson(sampleIssue, stats);
    const parsed = JSON.parse(output);
    expect(parsed.stats.byEnvironment.staging).toBe(44);
    expect(parsed.stats.byBrowser.Chrome).toBe(44);
  });
});
