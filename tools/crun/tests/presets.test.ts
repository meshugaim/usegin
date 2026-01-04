import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, readdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadPreset,
  loadPresets,
  listPresets,
  getDefaultPresetsDir,
  type PresetDeps,
  type Preset,
} from "../src/presets";

const TEST_PRESETS_DIR = join(tmpdir(), "crun-test-presets");

function createTestDeps(): PresetDeps {
  return {
    presetsDir: TEST_PRESETS_DIR,
  };
}

beforeEach(async () => {
  await rm(TEST_PRESETS_DIR, { recursive: true, force: true });
  await mkdir(TEST_PRESETS_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_PRESETS_DIR, { recursive: true, force: true });
});

describe("loadPreset", () => {
  test("loads a single preset from file", async () => {
    const preset: Preset = {
      name: "tdd",
      reminder: "Write tests first, then implement",
    };
    await Bun.write(
      join(TEST_PRESETS_DIR, "tdd.json"),
      JSON.stringify(preset, null, 2)
    );

    const deps = createTestDeps();
    const loaded = await loadPreset("tdd", deps);

    expect(loaded).toEqual(preset);
  });

  test("returns null for non-existent preset", async () => {
    const deps = createTestDeps();
    const loaded = await loadPreset("nonexistent", deps);

    expect(loaded).toBeNull();
  });

  test("handles combined preset with includes", async () => {
    const tddPreset: Preset = {
      name: "tdd",
      reminder: "Write tests first",
    };
    const commitPreset: Preset = {
      name: "commit-often",
      reminder: "Commit after each change",
    };
    const implementationPreset: Preset = {
      name: "implementation",
      includes: ["tdd", "commit-often"],
    };

    await Bun.write(
      join(TEST_PRESETS_DIR, "tdd.json"),
      JSON.stringify(tddPreset)
    );
    await Bun.write(
      join(TEST_PRESETS_DIR, "commit-often.json"),
      JSON.stringify(commitPreset)
    );
    await Bun.write(
      join(TEST_PRESETS_DIR, "implementation.json"),
      JSON.stringify(implementationPreset)
    );

    const deps = createTestDeps();
    const loaded = await loadPreset("implementation", deps);

    expect(loaded).toEqual(implementationPreset);
  });
});

describe("loadPresets", () => {
  test("loads multiple presets by name", async () => {
    const tddPreset: Preset = {
      name: "tdd",
      reminder: "Write tests first",
    };
    const commitPreset: Preset = {
      name: "commit-often",
      reminder: "Commit after each change",
    };

    await Bun.write(
      join(TEST_PRESETS_DIR, "tdd.json"),
      JSON.stringify(tddPreset)
    );
    await Bun.write(
      join(TEST_PRESETS_DIR, "commit-often.json"),
      JSON.stringify(commitPreset)
    );

    const deps = createTestDeps();
    const loaded = await loadPresets(["tdd", "commit-often"], deps);

    expect(loaded).toHaveLength(2);
    expect(loaded[0]).toEqual(tddPreset);
    expect(loaded[1]).toEqual(commitPreset);
  });

  test("expands combined presets to their includes", async () => {
    const tddPreset: Preset = {
      name: "tdd",
      reminder: "Write tests first",
    };
    const commitPreset: Preset = {
      name: "commit-often",
      reminder: "Commit after each change",
    };
    const implementationPreset: Preset = {
      name: "implementation",
      includes: ["tdd", "commit-often"],
    };

    await Bun.write(
      join(TEST_PRESETS_DIR, "tdd.json"),
      JSON.stringify(tddPreset)
    );
    await Bun.write(
      join(TEST_PRESETS_DIR, "commit-often.json"),
      JSON.stringify(commitPreset)
    );
    await Bun.write(
      join(TEST_PRESETS_DIR, "implementation.json"),
      JSON.stringify(implementationPreset)
    );

    const deps = createTestDeps();
    const loaded = await loadPresets(["implementation"], deps);

    expect(loaded).toHaveLength(2);
    expect(loaded.map((p) => p.name)).toEqual(["tdd", "commit-often"]);
  });

  test("skips missing presets and continues", async () => {
    const tddPreset: Preset = {
      name: "tdd",
      reminder: "Write tests first",
    };
    await Bun.write(
      join(TEST_PRESETS_DIR, "tdd.json"),
      JSON.stringify(tddPreset)
    );

    const deps = createTestDeps();
    const loaded = await loadPresets(["tdd", "nonexistent"], deps);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe("tdd");
  });

  test("deduplicates presets when expanded", async () => {
    const tddPreset: Preset = {
      name: "tdd",
      reminder: "Write tests first",
    };
    const implementationPreset: Preset = {
      name: "implementation",
      includes: ["tdd"],
    };

    await Bun.write(
      join(TEST_PRESETS_DIR, "tdd.json"),
      JSON.stringify(tddPreset)
    );
    await Bun.write(
      join(TEST_PRESETS_DIR, "implementation.json"),
      JSON.stringify(implementationPreset)
    );

    const deps = createTestDeps();
    // Request both tdd directly and through implementation
    const loaded = await loadPresets(["tdd", "implementation"], deps);

    // Should only have tdd once
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe("tdd");
  });
});

describe("listPresets", () => {
  test("lists all available presets", async () => {
    await Bun.write(
      join(TEST_PRESETS_DIR, "tdd.json"),
      JSON.stringify({ name: "tdd", reminder: "test" })
    );
    await Bun.write(
      join(TEST_PRESETS_DIR, "coverage.json"),
      JSON.stringify({ name: "coverage", reminder: "coverage" })
    );

    const deps = createTestDeps();
    const names = await listPresets(deps);

    expect(names.sort()).toEqual(["coverage", "tdd"]);
  });

  test("returns empty array when no presets exist", async () => {
    const deps = createTestDeps();
    const names = await listPresets(deps);

    expect(names).toEqual([]);
  });

  test("ignores non-json files", async () => {
    await Bun.write(
      join(TEST_PRESETS_DIR, "tdd.json"),
      JSON.stringify({ name: "tdd", reminder: "test" })
    );
    await Bun.write(join(TEST_PRESETS_DIR, "readme.md"), "# Presets");

    const deps = createTestDeps();
    const names = await listPresets(deps);

    expect(names).toEqual(["tdd"]);
  });
});

describe("getDefaultPresetsDir", () => {
  test("returns path under ~/.claude/workflow-presets", () => {
    const dir = getDefaultPresetsDir();
    expect(dir).toContain(".claude");
    expect(dir).toContain("workflow-presets");
  });
});
