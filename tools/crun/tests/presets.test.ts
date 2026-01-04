import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, readdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadPreset,
  loadPresets,
  listPresets,
  getDefaultPresetsDir,
  getRepoPresetsDir,
  type PresetDeps,
  type Preset,
} from "../src/presets";

const TEST_USER_PRESETS_DIR = join(tmpdir(), "crun-test-user-presets");
const TEST_REPO_PRESETS_DIR = join(tmpdir(), "crun-test-repo-presets");

// Legacy single-dir deps for backward compatibility tests
function createTestDeps(): PresetDeps {
  return {
    userPresetsDir: TEST_USER_PRESETS_DIR,
  };
}

// New dual-source deps
function createDualSourceDeps(): PresetDeps {
  return {
    userPresetsDir: TEST_USER_PRESETS_DIR,
    repoPresetsDir: TEST_REPO_PRESETS_DIR,
  };
}

beforeEach(async () => {
  await rm(TEST_USER_PRESETS_DIR, { recursive: true, force: true });
  await rm(TEST_REPO_PRESETS_DIR, { recursive: true, force: true });
  await mkdir(TEST_USER_PRESETS_DIR, { recursive: true });
  await mkdir(TEST_REPO_PRESETS_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_USER_PRESETS_DIR, { recursive: true, force: true });
  await rm(TEST_REPO_PRESETS_DIR, { recursive: true, force: true });
});

describe("loadPreset", () => {
  test("loads a single preset from user dir", async () => {
    const preset: Preset = {
      name: "tdd",
      reminder: "Write tests first, then implement",
    };
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "tdd.json"),
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
      join(TEST_USER_PRESETS_DIR, "tdd.json"),
      JSON.stringify(tddPreset)
    );
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "commit-often.json"),
      JSON.stringify(commitPreset)
    );
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "implementation.json"),
      JSON.stringify(implementationPreset)
    );

    const deps = createTestDeps();
    const loaded = await loadPreset("implementation", deps);

    expect(loaded).toEqual(implementationPreset);
  });

  test("loads preset from repo dir when provided", async () => {
    const preset: Preset = {
      name: "repo-preset",
      reminder: "From repo",
    };
    await Bun.write(
      join(TEST_REPO_PRESETS_DIR, "repo-preset.json"),
      JSON.stringify(preset)
    );

    const deps = createDualSourceDeps();
    const loaded = await loadPreset("repo-preset", deps);

    expect(loaded).toEqual(preset);
  });

  test("repo preset takes precedence over user preset with same name", async () => {
    const userPreset: Preset = {
      name: "tdd",
      reminder: "User version",
    };
    const repoPreset: Preset = {
      name: "tdd",
      reminder: "Repo version (should win)",
    };
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "tdd.json"),
      JSON.stringify(userPreset)
    );
    await Bun.write(
      join(TEST_REPO_PRESETS_DIR, "tdd.json"),
      JSON.stringify(repoPreset)
    );

    const deps = createDualSourceDeps();
    const loaded = await loadPreset("tdd", deps);

    expect(loaded).toEqual(repoPreset);
  });

  test("falls back to user preset when not in repo", async () => {
    const userPreset: Preset = {
      name: "user-only",
      reminder: "Only in user dir",
    };
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "user-only.json"),
      JSON.stringify(userPreset)
    );

    const deps = createDualSourceDeps();
    const loaded = await loadPreset("user-only", deps);

    expect(loaded).toEqual(userPreset);
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
      join(TEST_USER_PRESETS_DIR, "tdd.json"),
      JSON.stringify(tddPreset)
    );
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "commit-often.json"),
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
      join(TEST_USER_PRESETS_DIR, "tdd.json"),
      JSON.stringify(tddPreset)
    );
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "commit-often.json"),
      JSON.stringify(commitPreset)
    );
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "implementation.json"),
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
      join(TEST_USER_PRESETS_DIR, "tdd.json"),
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
      join(TEST_USER_PRESETS_DIR, "tdd.json"),
      JSON.stringify(tddPreset)
    );
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "implementation.json"),
      JSON.stringify(implementationPreset)
    );

    const deps = createTestDeps();
    // Request both tdd directly and through implementation
    const loaded = await loadPresets(["tdd", "implementation"], deps);

    // Should only have tdd once
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe("tdd");
  });

  test("loads presets from both repo and user dirs", async () => {
    const repoPreset: Preset = {
      name: "repo-only",
      reminder: "From repo",
    };
    const userPreset: Preset = {
      name: "user-only",
      reminder: "From user",
    };

    await Bun.write(
      join(TEST_REPO_PRESETS_DIR, "repo-only.json"),
      JSON.stringify(repoPreset)
    );
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "user-only.json"),
      JSON.stringify(userPreset)
    );

    const deps = createDualSourceDeps();
    const loaded = await loadPresets(["repo-only", "user-only"], deps);

    expect(loaded).toHaveLength(2);
    expect(loaded.map((p) => p.name)).toContain("repo-only");
    expect(loaded.map((p) => p.name)).toContain("user-only");
  });
});

describe("listPresets", () => {
  test("lists all available presets from user dir", async () => {
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "tdd.json"),
      JSON.stringify({ name: "tdd", reminder: "test" })
    );
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "coverage.json"),
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
      join(TEST_USER_PRESETS_DIR, "tdd.json"),
      JSON.stringify({ name: "tdd", reminder: "test" })
    );
    await Bun.write(join(TEST_USER_PRESETS_DIR, "readme.md"), "# Presets");

    const deps = createTestDeps();
    const names = await listPresets(deps);

    expect(names).toEqual(["tdd"]);
  });

  test("merges presets from both repo and user dirs", async () => {
    await Bun.write(
      join(TEST_REPO_PRESETS_DIR, "repo-preset.json"),
      JSON.stringify({ name: "repo-preset", reminder: "from repo" })
    );
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "user-preset.json"),
      JSON.stringify({ name: "user-preset", reminder: "from user" })
    );

    const deps = createDualSourceDeps();
    const names = await listPresets(deps);

    expect(names.sort()).toEqual(["repo-preset", "user-preset"]);
  });

  test("deduplicates when same preset exists in both sources", async () => {
    await Bun.write(
      join(TEST_REPO_PRESETS_DIR, "tdd.json"),
      JSON.stringify({ name: "tdd", reminder: "from repo" })
    );
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "tdd.json"),
      JSON.stringify({ name: "tdd", reminder: "from user" })
    );

    const deps = createDualSourceDeps();
    const names = await listPresets(deps);

    // Should only list "tdd" once
    expect(names).toEqual(["tdd"]);
  });

  test("handles missing repo dir gracefully", async () => {
    await rm(TEST_REPO_PRESETS_DIR, { recursive: true, force: true });
    await Bun.write(
      join(TEST_USER_PRESETS_DIR, "tdd.json"),
      JSON.stringify({ name: "tdd", reminder: "test" })
    );

    const deps = createDualSourceDeps();
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

describe("getRepoPresetsDir", () => {
  test("returns path under .claude/workflow-presets relative to cwd", () => {
    const dir = getRepoPresetsDir();
    expect(dir).toContain(".claude");
    expect(dir).toContain("workflow-presets");
    expect(dir).not.toContain("~");
  });
});
