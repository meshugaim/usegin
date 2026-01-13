import { describe, expect, it } from "bun:test";
import {
  buildClonePath,
  cloneExists,
  getDefaultConfig,
  getDefaultDeps,
  runCreate,
  CLONES_DIR,
  createCreateCommand,
  type CreateConfig,
  type CreateDeps,
} from "../create";

describe("create command", () => {
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

      expect(typeof deps.getOriginUrl).toBe("function");
      expect(typeof deps.cloneExists).toBe("function");
      expect(typeof deps.createClone).toBe("function");
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

  describe("cloneExists", () => {
    it("returns true when clone directory exists", async () => {
      const result = await cloneExists(async () => true, ".clones/ENG-123");
      expect(result).toBe(true);
    });

    it("returns false when clone directory does not exist", async () => {
      const result = await cloneExists(async () => false, ".clones/ENG-123");
      expect(result).toBe(false);
    });
  });

  describe("createCreateCommand", () => {
    it("creates a Command instance", () => {
      const cmd = createCreateCommand();
      expect(cmd).toBeDefined();
      expect(cmd.name()).toBe("create");
    });

    it("has correct description", () => {
      const cmd = createCreateCommand();
      expect(cmd.description()).toBe("Create a new reference clone");
    });

    it("requires name argument", () => {
      const cmd = createCreateCommand();
      const args = cmd.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe("name");
      expect(args[0].required).toBe(true);
    });
  });

  describe("runCreate", () => {
    function createMockDeps(overrides: Partial<CreateDeps> = {}): CreateDeps {
      return {
        getOriginUrl: async () => "git@github.com:owner/repo.git",
        cloneExists: async () => false,
        createClone: async () => {},
        output: () => {},
        errorOutput: () => {},
        exit: ((code: number) => {
          throw new Error(`Exit called with code ${code}`);
        }) as (code: number) => never,
        ...overrides,
      };
    }

    it("creates clone successfully when it does not exist", async () => {
      let outputMessage = "";
      let createCloneCalled = false;
      let createdPath = "";
      let createdOrigin = "";

      const deps = createMockDeps({
        cloneExists: async () => false,
        createClone: async (origin, path) => {
          createCloneCalled = true;
          createdOrigin = origin;
          createdPath = path;
        },
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runCreate("ENG-999", getDefaultConfig(), deps);

      expect(createCloneCalled).toBe(true);
      expect(createdPath).toBe(".clones/ENG-999");
      expect(createdOrigin).toBe("git@github.com:owner/repo.git");
      expect(outputMessage).toContain("Created:");
      expect(outputMessage).toContain(".clones/ENG-999");
    });

    it("exits with error when clone already exists", async () => {
      let errorMessage = "";

      const deps = createMockDeps({
        cloneExists: async () => true,
        errorOutput: (msg) => {
          errorMessage = msg;
        },
      });

      await expect(
        runCreate("ENG-123", getDefaultConfig(), deps)
      ).rejects.toThrow("Exit called with code 1");
      expect(errorMessage).toContain("already exists");
    });

    it("handles createClone failure", async () => {
      let errorMessage = "";

      const deps = createMockDeps({
        cloneExists: async () => false,
        createClone: async () => {
          throw new Error("Git error");
        },
        errorOutput: (msg) => {
          errorMessage = msg;
        },
      });

      await expect(
        runCreate("ENG-999", getDefaultConfig(), deps)
      ).rejects.toThrow("Exit called with code 1");
      expect(errorMessage).toContain("Error creating clone");
    });

    it("uses custom config when provided", async () => {
      let createdPath = "";

      const customConfig: CreateConfig = {
        clonesDir: "custom-dir",
      };

      const deps = createMockDeps({
        cloneExists: async () => false,
        createClone: async (_origin, path) => {
          createdPath = path;
        },
      });

      await runCreate("test", customConfig, deps);

      expect(createdPath).toBe("custom-dir/test");
    });

    it("outputs success message with path", async () => {
      let outputMessage = "";

      const deps = createMockDeps({
        cloneExists: async () => false,
        createClone: async () => {},
        output: (msg) => {
          outputMessage = msg;
        },
      });

      await runCreate("ENG-999", getDefaultConfig(), deps);

      expect(outputMessage).toContain(".clones/ENG-999");
    });

    it("exits with error when origin URL cannot be fetched", async () => {
      let errorMessage = "";

      const deps = createMockDeps({
        getOriginUrl: async () => {
          throw new Error("Not a git repository");
        },
        errorOutput: (msg) => {
          errorMessage = msg;
        },
      });

      await expect(
        runCreate("ENG-999", getDefaultConfig(), deps)
      ).rejects.toThrow("Exit called with code 1");
      expect(errorMessage).toContain("Error");
    });
  });
});
