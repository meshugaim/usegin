import { describe, expect, it } from "bun:test";
import {
  buildClonePath,
  getDefaultConfig,
  getDefaultDeps,
  runDestroy,
  CLONES_DIR,
  createDestroyCommand,
  type DestroyConfig,
  type DestroyDeps,
} from "../destroy";

describe("destroy command", () => {
  describe("constants", () => {
    it("CLONES_DIR is .clones", () => {
      expect(CLONES_DIR).toBe(".clones");
    });
  });

  describe("getDefaultConfig", () => {
    it("returns default config with correct values", () => {
      const config = getDefaultConfig();

      expect(config.clonesDir).toBe(".clones");
    });
  });

  describe("getDefaultDeps", () => {
    it("returns object with required methods", () => {
      const deps = getDefaultDeps();

      expect(typeof deps.cloneExists).toBe("function");
      expect(typeof deps.removeClone).toBe("function");
      expect(typeof deps.output).toBe("function");
      expect(typeof deps.errorOutput).toBe("function");
      expect(typeof deps.exit).toBe("function");
    });
  });

  describe("buildClonePath", () => {
    it("builds path with default config", () => {
      const path = buildClonePath("ENG-123");
      expect(path).toBe(".clones/ENG-123");
    });

    it("builds path with custom config", () => {
      const path = buildClonePath("ENG-123", {
        clonesDir: "custom-dir",
      });
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

  describe("createDestroyCommand", () => {
    it("creates a Command instance", () => {
      const cmd = createDestroyCommand();
      expect(cmd).toBeDefined();
      expect(cmd.name()).toBe("destroy");
    });

    it("has correct description", () => {
      const cmd = createDestroyCommand();
      expect(cmd.description()).toBe("Remove a clone");
    });

    it("requires name argument", () => {
      const cmd = createDestroyCommand();
      const args = cmd.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe("name");
      expect(args[0].required).toBe(true);
    });

    it("has --force option", () => {
      const cmd = createDestroyCommand();
      const forceOption = cmd.options.find((opt) => opt.long === "--force");
      expect(forceOption).toBeDefined();
    });
  });

  describe("runDestroy", () => {
    function createMockDeps(overrides: Partial<DestroyDeps> = {}): DestroyDeps {
      return {
        cloneExists: async () => true,
        removeClone: async () => {},
        output: () => {},
        errorOutput: () => {},
        exit: ((code: number) => {
          throw new Error(`Exit called with code ${code}`);
        }) as (code: number) => never,
        ...overrides,
      };
    }

    it("destroys clone successfully when it exists", async () => {
      let outputMessage = "";
      let removeCloneCalled = false;
      let removedPath = "";

      const deps = createMockDeps({
        cloneExists: async () => true,
        removeClone: async (path) => {
          removeCloneCalled = true;
          removedPath = path;
        },
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runDestroy("ENG-123", {}, getDefaultConfig(), deps);

      expect(removeCloneCalled).toBe(true);
      expect(removedPath).toBe(".clones/ENG-123");
      expect(outputMessage).toContain("Destroyed:");
    });

    it("exits with error when clone does not exist", async () => {
      let errorMessage = "";

      const deps = createMockDeps({
        cloneExists: async () => false,
        errorOutput: (msg) => {
          errorMessage = msg;
        },
      });

      await expect(
        runDestroy("ENG-999", {}, getDefaultConfig(), deps)
      ).rejects.toThrow("Exit called with code 1");
      expect(errorMessage).toContain("does not exist");
    });

    it("handles removeClone failure without force", async () => {
      let errorMessage = "";

      const deps = createMockDeps({
        cloneExists: async () => true,
        removeClone: async () => {
          throw new Error("Directory not empty");
        },
        errorOutput: (msg) => {
          errorMessage = msg;
        },
      });

      await expect(
        runDestroy("ENG-123", {}, getDefaultConfig(), deps)
      ).rejects.toThrow("Exit called with code 1");
      expect(errorMessage).toContain("Error destroying clone");
    });

    it("uses custom config when provided", async () => {
      let removedPath = "";

      const customConfig: DestroyConfig = {
        clonesDir: "custom-dir",
      };

      const deps = createMockDeps({
        cloneExists: async () => true,
        removeClone: async (path) => {
          removedPath = path;
        },
      });

      await runDestroy("test", {}, customConfig, deps);

      expect(removedPath).toBe("custom-dir/test");
    });

    it("outputs success message after destroying", async () => {
      let outputMessage = "";

      const deps = createMockDeps({
        cloneExists: async () => true,
        removeClone: async () => {},
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runDestroy("ENG-123", {}, getDefaultConfig(), deps);

      expect(outputMessage).toContain("Destroyed:");
      expect(outputMessage).toContain(".clones/ENG-123");
    });
  });
});
