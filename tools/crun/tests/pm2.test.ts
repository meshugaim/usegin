import { describe, expect, it } from "bun:test";
import {
  buildPm2Name,
  parsePm2Name,
  mapPm2Status,
  generateSessionId,
} from "../src/pm2";

describe("pm2 utilities", () => {
  describe("generateSessionId", () => {
    it("generates a valid UUID", async () => {
      const id = await generateSessionId();
      // UUID format: 8-4-4-4-12
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("generates unique IDs", async () => {
      const id1 = await generateSessionId();
      const id2 = await generateSessionId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("buildPm2Name", () => {
    it("builds name from session ID only", () => {
      const name = buildPm2Name("abc123");
      expect(name).toBe("crun-abc123");
    });

    it("builds name from session ID and issue ID", () => {
      const name = buildPm2Name("abc123", "ENG-456");
      expect(name).toBe("crun-abc123-ENG-456");
    });

    it("handles empty issue ID", () => {
      const name = buildPm2Name("abc123", "");
      // Empty string is falsy, so should be same as no issue
      expect(name).toBe("crun-abc123");
    });
  });

  describe("parsePm2Name", () => {
    it("returns null for non-crun names", () => {
      expect(parsePm2Name("other-process")).toBeNull();
      expect(parsePm2Name("pm2-web")).toBeNull();
    });

    it("parses simple session ID", () => {
      const result = parsePm2Name("crun-abc123");
      expect(result).toEqual({ sessionId: "abc123" });
    });

    it("parses UUID session ID", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = parsePm2Name(`crun-${uuid}`);
      expect(result).toEqual({ sessionId: uuid });
    });

    it("parses UUID session ID with issue ID", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = parsePm2Name(`crun-${uuid}-ENG-123`);
      expect(result).toEqual({ sessionId: uuid, issueId: "ENG-123" });
    });

    it("parses various issue ID formats", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(parsePm2Name(`crun-${uuid}-ABC-1`)).toEqual({
        sessionId: uuid,
        issueId: "ABC-1",
      });
      expect(parsePm2Name(`crun-${uuid}-PROJ-99999`)).toEqual({
        sessionId: uuid,
        issueId: "PROJ-99999",
      });
    });
  });

  describe("mapPm2Status", () => {
    it("maps online to running", () => {
      expect(mapPm2Status("online")).toBe("running");
    });

    it("maps stopped with exit code 0 to done", () => {
      expect(mapPm2Status("stopped", 0)).toBe("done");
    });

    it("maps stopped with non-zero exit code to errored", () => {
      expect(mapPm2Status("stopped", 1)).toBe("errored");
    });

    it("maps errored to errored", () => {
      expect(mapPm2Status("errored")).toBe("errored");
    });

    it("maps stopping to running", () => {
      expect(mapPm2Status("stopping")).toBe("running");
    });

    it("maps unknown status to stopped", () => {
      expect(mapPm2Status("unknown")).toBe("stopped");
    });
  });
});
