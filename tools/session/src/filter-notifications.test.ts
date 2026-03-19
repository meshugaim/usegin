/**
 * Tests for filterNotifications — removes task-notification turns from session output.
 *
 * Task notifications are user turns containing <task-notification> XML tags,
 * delivered when background agents complete. Filtering them out lets companion
 * agents get clean session transcripts via --exclude-notifications.
 */

import { describe, it, expect } from "bun:test";
import { filterNotifications, isNotificationTurn } from "./filter-notifications";
import { userTurn, assistantTurn } from "./testing";

describe("isNotificationTurn", () => {
  it("returns true for a turn with <task-notification> tag", () => {
    const turn = userTurn("u1", `<task-notification>
<task-id>a13b130c18d1d4940</task-id>
<status>completed</status>
<summary>Agent "companion" completed</summary>
<result>All done</result>
</task-notification>`);
    expect(isNotificationTurn(turn)).toBe(true);
  });

  it("returns false for a normal user turn", () => {
    const turn = userTurn("u1", "Please fix the bug in main.ts");
    expect(isNotificationTurn(turn)).toBe(false);
  });

  it("returns false for a normal assistant turn", () => {
    const turn = assistantTurn("a1", "I'll look into that.");
    expect(isNotificationTurn(turn)).toBe(false);
  });

  it("returns false for a turn that mentions 'task notification' without the XML tag", () => {
    const turn = userTurn("u1", "I checked the task notification and it looks fine");
    expect(isNotificationTurn(turn)).toBe(false);
  });

  it("returns false for a turn with empty text", () => {
    const turn = userTurn("u1", "");
    expect(isNotificationTurn(turn)).toBe(false);
  });
});

describe("filterNotifications", () => {
  it("removes turns with <task-notification> in text", () => {
    const turns = [
      userTurn("u1", "Hello"),
      assistantTurn("a1", "Hi!"),
      userTurn("u2", `<task-notification>
<task-id>abc123</task-id>
<status>completed</status>
<summary>Agent done</summary>
<result>Result here</result>
</task-notification>`),
      assistantTurn("a2", "Got it"),
    ];

    const filtered = filterNotifications(turns);
    expect(filtered).toHaveLength(3);
    expect(filtered.map(t => t.uuid)).toEqual(["u1", "a1", "a2"]);
  });

  it("keeps normal user/assistant turns", () => {
    const turns = [
      userTurn("u1", "Hello"),
      assistantTurn("a1", "Hi!"),
      userTurn("u2", "How are you?"),
      assistantTurn("a2", "I'm fine"),
    ];

    const filtered = filterNotifications(turns);
    expect(filtered).toHaveLength(4);
  });

  it("keeps turns with partial matches (e.g., 'I checked the task notification')", () => {
    const turns = [
      userTurn("u1", "I checked the task notification and it looks fine"),
      assistantTurn("a1", "Good to hear"),
    ];

    const filtered = filterNotifications(turns);
    expect(filtered).toHaveLength(2);
  });

  it("handles empty turn array", () => {
    const filtered = filterNotifications([]);
    expect(filtered).toHaveLength(0);
  });

  it("handles turns with no text", () => {
    const turns = [
      userTurn("u1", ""),
      assistantTurn("a1", ""),
    ];

    const filtered = filterNotifications(turns);
    expect(filtered).toHaveLength(2);
  });

  it("removes multiple notification turns", () => {
    const turns = [
      userTurn("u1", "Start"),
      userTurn("u2", `<task-notification><task-id>t1</task-id><status>completed</status></task-notification>`),
      assistantTurn("a1", "Acknowledged"),
      userTurn("u3", `<task-notification><task-id>t2</task-id><status>completed</status></task-notification>`),
      userTurn("u4", "Continue"),
    ];

    const filtered = filterNotifications(turns);
    expect(filtered).toHaveLength(3);
    expect(filtered.map(t => t.uuid)).toEqual(["u1", "a1", "u4"]);
  });
});
