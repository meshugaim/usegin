import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  readProjectSettings,
  writeProjectSettings,
  getAutoCompactEnabled,
  setAutoCompactEnabled,
  getSettingsPath,
  getUserSettingsPath,
  readUserSettings,
  writeUserSettings,
} from "../src/lib/settings";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir, homedir } from "os";

describe("getSettingsPath", () => {
  it("returns .claude/settings.json path for project", () => {
    const result = getSettingsPath("/some/project");
    expect(result).toBe("/some/project/.claude/settings.json");
  });
});

describe("getUserSettingsPath", () => {
  it("returns ~/.claude/settings.json path", () => {
    const result = getUserSettingsPath();
    expect(result).toBe(join(homedir(), ".claude", "settings.json"));
  });
});

describe("readProjectSettings", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-settings-test-${Date.now()}`);
    await mkdir(join(testDir, ".claude"), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("reads existing settings.json", async () => {
    const settings = { autoCompactEnabled: true, otherKey: "value" };
    await writeFile(join(testDir, ".claude/settings.json"), JSON.stringify(settings));

    const result = await readProjectSettings(testDir);
    expect(result).toEqual(settings);
  });

  it("returns empty object when settings.json does not exist", async () => {
    const result = await readProjectSettings(testDir);
    expect(result).toEqual({});
  });

  it("returns empty object for invalid JSON", async () => {
    await writeFile(join(testDir, ".claude/settings.json"), "not valid json");
    const result = await readProjectSettings(testDir);
    expect(result).toEqual({});
  });
});

describe("writeProjectSettings", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-settings-test-${Date.now()}`);
    await mkdir(join(testDir, ".claude"), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("writes settings to file", async () => {
    const settings = { autoCompactEnabled: false, foo: "bar" };
    await writeProjectSettings(testDir, settings);

    const file = Bun.file(join(testDir, ".claude/settings.json"));
    const result = await file.json();
    expect(result).toEqual(settings);
  });

  it("creates .claude directory if it does not exist", async () => {
    const freshDir = join(tmpdir(), `ccfg-settings-test-fresh-${Date.now()}`);
    await mkdir(freshDir, { recursive: true });

    try {
      const settings = { autoCompactEnabled: true };
      await writeProjectSettings(freshDir, settings);

      const file = Bun.file(join(freshDir, ".claude/settings.json"));
      const result = await file.json();
      expect(result).toEqual(settings);
    } finally {
      await rm(freshDir, { recursive: true, force: true });
    }
  });
});

describe("getAutoCompactEnabled", () => {
  let testDir: string;
  let settingsPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-autocompact-test-${Date.now()}`);
    await mkdir(join(testDir, ".claude"), { recursive: true });
    settingsPath = join(testDir, ".claude", "settings.json");
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("returns true when autoCompactEnabled is true", async () => {
    await writeFile(settingsPath, JSON.stringify({ autoCompactEnabled: true }));

    const result = await getAutoCompactEnabled(settingsPath);
    expect(result).toBe(true);
  });

  it("returns false when autoCompactEnabled is false", async () => {
    await writeFile(settingsPath, JSON.stringify({ autoCompactEnabled: false }));

    const result = await getAutoCompactEnabled(settingsPath);
    expect(result).toBe(false);
  });

  it("returns undefined when autoCompactEnabled is not set", async () => {
    await writeFile(settingsPath, JSON.stringify({ otherSetting: "value" }));

    const result = await getAutoCompactEnabled(settingsPath);
    expect(result).toBeUndefined();
  });

  it("returns undefined when settings.json does not exist", async () => {
    const result = await getAutoCompactEnabled(settingsPath);
    expect(result).toBeUndefined();
  });
});

describe("setAutoCompactEnabled", () => {
  let testDir: string;
  let settingsPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ccfg-autocompact-test-${Date.now()}`);
    await mkdir(join(testDir, ".claude"), { recursive: true });
    settingsPath = join(testDir, ".claude", "settings.json");
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("sets autoCompactEnabled to true", async () => {
    await writeFile(settingsPath, JSON.stringify({ autoCompactEnabled: false }));

    await setAutoCompactEnabled(true, settingsPath);

    const result = await getAutoCompactEnabled(settingsPath);
    expect(result).toBe(true);
  });

  it("sets autoCompactEnabled to false", async () => {
    await writeFile(settingsPath, JSON.stringify({ autoCompactEnabled: true }));

    await setAutoCompactEnabled(false, settingsPath);

    const result = await getAutoCompactEnabled(settingsPath);
    expect(result).toBe(false);
  });

  it("preserves other settings when updating", async () => {
    const originalSettings = {
      autoCompactEnabled: false,
      hooks: { PreCompact: [] },
      enabledPlugins: { "some-plugin": true },
    };
    await writeFile(settingsPath, JSON.stringify(originalSettings));

    await setAutoCompactEnabled(true, settingsPath);

    const file = Bun.file(settingsPath);
    const result = await file.json();
    expect(result).toEqual({
      ...originalSettings,
      autoCompactEnabled: true,
    });
  });

  it("creates settings file if it does not exist", async () => {
    await setAutoCompactEnabled(true, settingsPath);

    const result = await getAutoCompactEnabled(settingsPath);
    expect(result).toBe(true);
  });
});
