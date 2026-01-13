import { describe, expect, it } from "bun:test";
import { CLONES_DIR, buildClonePath } from "../shared";

describe("shared", () => {
  describe("CLONES_DIR", () => {
    it("is set to .clones", () => {
      expect(CLONES_DIR).toBe(".clones");
    });
  });

  describe("buildClonePath", () => {
    it("builds path with default clones dir", () => {
      const path = buildClonePath("ENG-123");
      expect(path).toBe(".clones/ENG-123");
    });

    it("builds path with custom clones dir", () => {
      const path = buildClonePath("ENG-123", "custom-dir");
      expect(path).toBe("custom-dir/ENG-123");
    });

    it("handles names with special characters", () => {
      const path = buildClonePath("feature-add-auth");
      expect(path).toBe(".clones/feature-add-auth");
    });

    it("handles numeric names", () => {
      const path = buildClonePath("12345");
      expect(path).toBe(".clones/12345");
    });
  });
});
