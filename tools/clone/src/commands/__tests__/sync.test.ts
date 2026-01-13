import { describe, expect, it } from "bun:test";
import {
  runSync,
  type SyncResult,
  type SyncDeps,
} from "../sync";

describe("sync command", () => {
  describe("SyncResult interface", () => {
    it("has required fields for success", () => {
      const result: SyncResult = {
        name: "ENG-123",
        success: true,
      };

      expect(result.name).toBe("ENG-123");
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("has error field for failure", () => {
      const result: SyncResult = {
        name: "ENG-123",
        success: false,
        error: "Merge conflict",
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Merge conflict");
    });
  });

  describe("runSync", () => {
    function createMockDeps(overrides: Partial<SyncDeps> = {}): SyncDeps {
      return {
        listCloneDirectories: async () => [],
        syncClone: async () => {},
        output: () => {},
        ...overrides,
      };
    }

    it("outputs 'No clones found' when no clones exist", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => [],
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runSync({}, deps);

      expect(outputMessage).toBe("No clones found");
    });

    it("syncs all clones when no name provided", async () => {
      const syncedClones: string[] = [];
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123", "ENG-456"],
        syncClone: async (name) => {
          syncedClones.push(name);
        },
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runSync({}, deps);

      expect(syncedClones).toContain("ENG-123");
      expect(syncedClones).toContain("ENG-456");
      expect(outputMessage).toContain("ENG-123");
      expect(outputMessage).toContain("ENG-456");
    });

    it("syncs specific clone when name provided", async () => {
      const syncedClones: string[] = [];
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123", "ENG-456"],
        syncClone: async (name) => {
          syncedClones.push(name);
        },
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runSync({ name: "ENG-123" }, deps);

      expect(syncedClones).toEqual(["ENG-123"]);
      expect(outputMessage).toContain("ENG-123");
      expect(outputMessage).not.toContain("ENG-456");
    });

    it("outputs error when specified clone not found", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123"],
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runSync({ name: "nonexistent" }, deps);

      expect(outputMessage).toContain("Clone 'nonexistent' not found");
    });

    it("shows success message for each synced clone", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123"],
        syncClone: async () => {},
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runSync({}, deps);

      expect(outputMessage).toContain("ENG-123");
      expect(outputMessage).toContain("synced");
    });

    it("handles sync errors gracefully", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123"],
        syncClone: async () => {
          throw new Error("Merge conflict");
        },
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runSync({}, deps);

      expect(outputMessage).toContain("ENG-123");
      expect(outputMessage).toContain("failed");
      expect(outputMessage).toContain("Merge conflict");
    });

    it("outputs JSON format when json option is true", async () => {
      let outputMessage = "";
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123", "ENG-456"],
        syncClone: async (name) => {
          if (name === "ENG-456") {
            throw new Error("Failed to sync");
          }
        },
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runSync({ json: true }, deps);

      const parsed = JSON.parse(outputMessage);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe("ENG-123");
      expect(parsed[0].success).toBe(true);
      expect(parsed[1].name).toBe("ENG-456");
      expect(parsed[1].success).toBe(false);
      expect(parsed[1].error).toBe("Failed to sync");
    });

    it("continues syncing other clones when one fails", async () => {
      const syncedClones: string[] = [];
      const deps = createMockDeps({
        listCloneDirectories: async () => ["ENG-123", "ENG-456", "ENG-789"],
        syncClone: async (name) => {
          if (name === "ENG-456") {
            throw new Error("Merge conflict");
          }
          syncedClones.push(name);
        },
        output: () => {},
      });

      await runSync({}, deps);

      expect(syncedClones).toContain("ENG-123");
      expect(syncedClones).toContain("ENG-789");
      expect(syncedClones).not.toContain("ENG-456");
    });
  });
});
