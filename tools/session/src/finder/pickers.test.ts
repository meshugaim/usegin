/**
 * Tests for session picker functionality (tmux, vsc, output files)
 */

import { describe, test, expect, mock } from "bun:test";
import type { SessionInfo } from "../finder";

describe("buildVscCommand", () => {
  test("builds vsc terminal create command with --shellCmd", async () => {
    const { buildVscCommand } = await import("../finder");

    const cmd = buildVscCommand("/tmp/output.json");

    expect(cmd).toContain("vsc");
    expect(cmd).toContain("terminal");
    expect(cmd).toContain("create");
    expect(cmd).toContain("--shellCmd");
    expect(cmd).toContain("--output-file");
    expect(cmd).toContain("/tmp/output.json");
  });

  test("includes --all-projects when specified", async () => {
    const { buildVscCommand } = await import("../finder");

    const cmd = buildVscCommand("/tmp/output.json", { allProjects: true });

    expect(cmd).toContain("--all-projects");
  });

  test("includes --since when specified", async () => {
    const { buildVscCommand } = await import("../finder");

    const cmd = buildVscCommand("/tmp/output.json", { since: "2d" });

    expect(cmd).toContain("--since");
    expect(cmd).toContain("2d");
  });

  test("includes terminal name", async () => {
    const { buildVscCommand } = await import("../finder");

    const cmd = buildVscCommand("/tmp/output.json");

    expect(cmd).toContain("--name");
    expect(cmd).toContain("Session Picker");
  });
});

describe("buildTmuxPopupCommand", () => {
  test("builds tmux popup command with default options", async () => {
    const { buildTmuxPopupCommand } = await import("../finder");

    const cmd = buildTmuxPopupCommand("/tmp/output.json");

    expect(cmd).toContain("tmux");
    expect(cmd).toContain("popup");
    expect(cmd).toContain("-E"); // close on exit
    expect(cmd).toContain("--output-file");
    expect(cmd).toContain("/tmp/output.json");
  });

  test("includes width and height options", async () => {
    const { buildTmuxPopupCommand } = await import("../finder");

    const cmd = buildTmuxPopupCommand("/tmp/output.json", { width: "90%", height: "85%" });

    expect(cmd).toContain("-w");
    expect(cmd).toContain("90%");
    expect(cmd).toContain("-h");
    expect(cmd).toContain("85%");
  });

  test("includes --all-projects when specified", async () => {
    const { buildTmuxPopupCommand } = await import("../finder");

    const cmd = buildTmuxPopupCommand("/tmp/output.json", { allProjects: true });

    expect(cmd).toContain("--all-projects");
  });

  test("includes --since when specified", async () => {
    const { buildTmuxPopupCommand } = await import("../finder");

    const cmd = buildTmuxPopupCommand("/tmp/output.json", { since: "1d" });

    expect(cmd).toContain("--since");
    expect(cmd).toContain("1d");
  });
});

describe("isTmuxAvailable", () => {
  test("returns boolean indicating tmux availability", async () => {
    const { isTmuxAvailable } = await import("../finder");

    const result = await isTmuxAvailable();

    expect(typeof result).toBe("boolean");
  });
});

describe("generateOutputFilePath", () => {
  test("generates unique temp file path", async () => {
    const { generateOutputFilePath } = await import("../finder");

    const path1 = generateOutputFilePath();
    const path2 = generateOutputFilePath();

    expect(path1).toMatch(/^\/tmp\/claude-session-ref-.*\.json$/);
    expect(path2).toMatch(/^\/tmp\/claude-session-ref-.*\.json$/);
    expect(path1).not.toBe(path2);
  });
});

describe("pollForFile", () => {
  test("returns file contents when file exists", async () => {
    const { pollForFile } = await import("../finder");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    const tempFile = path.join(os.tmpdir(), `poll-test-${Date.now()}.json`);
    const testData = { test: "data" };

    try {
      // Write file immediately
      await fs.writeFile(tempFile, JSON.stringify(testData));

      const result = await pollForFile(tempFile, { intervalMs: 50, timeoutMs: 500 });

      expect(result).toEqual(testData);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  });

  test("returns null on timeout when file does not exist", async () => {
    const { pollForFile } = await import("../finder");

    const result = await pollForFile("/tmp/nonexistent-file-12345.json", {
      intervalMs: 50,
      timeoutMs: 150,
    });

    expect(result).toBeNull();
  });

  test("waits for file to appear", async () => {
    const { pollForFile } = await import("../finder");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    const tempFile = path.join(os.tmpdir(), `poll-delay-test-${Date.now()}.json`);
    const testData = { delayed: true };

    try {
      // Write file after a delay
      setTimeout(async () => {
        await fs.writeFile(tempFile, JSON.stringify(testData));
      }, 100);

      const result = await pollForFile(tempFile, { intervalMs: 50, timeoutMs: 500 });

      expect(result).toEqual(testData);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  });
});

describe("openSessionPicker", () => {
  test("throws error when method=tmux but not in tmux", async () => {
    const { openSessionPicker } = await import("../finder");

    // Save original TMUX env
    const originalTmux = process.env.TMUX;

    try {
      // Remove TMUX to simulate not being in tmux
      delete process.env.TMUX;

      // Force tmux method
      await expect(openSessionPicker({ method: "tmux" })).rejects.toThrow("tmux not available");
    } finally {
      // Restore original TMUX env
      if (originalTmux) {
        process.env.TMUX = originalTmux;
      }
    }
  });

  test("throws helpful error when no method available", async () => {
    // Mock both availability checks to return false
    const originalFinder = await import("../finder");

    mock.module("../finder", () => ({
      ...originalFinder,
      isVscBridgeAvailable: mock(async () => false),
      isTmuxAvailable: mock(async () => false),
    }));

    const { openSessionPicker } = await import("../finder");
    const originalTmux = process.env.TMUX;

    try {
      delete process.env.TMUX;

      await expect(openSessionPicker({ method: "auto" })).rejects.toThrow(
        /No session picker method available/
      );
    } finally {
      if (originalTmux) {
        process.env.TMUX = originalTmux;
      }
      mock.restore();
    }
  });
});

describe("isVscBridgeAvailable", () => {
  test("returns false when port file does not exist", async () => {
    const { isVscBridgeAvailable } = await import("../finder");

    // Use a path that definitely doesn't exist
    const result = await isVscBridgeAvailable("/nonexistent/path/.vsc-bridge.port");

    expect(result).toBe(false);
  });

  test("returns boolean based on port file and server availability", async () => {
    const { isVscBridgeAvailable } = await import("../finder");

    // Default path - may or may not exist depending on environment
    const result = await isVscBridgeAvailable();

    expect(typeof result).toBe("boolean");
  });
});

describe("detectPickerMethod", () => {
  test("returns tmux when TMUX env var is set", async () => {
    const { detectPickerMethod } = await import("../finder");

    const originalTmux = process.env.TMUX;

    try {
      process.env.TMUX = "/tmp/tmux-1000/default,12345,0";

      const result = await detectPickerMethod();

      expect(result).toBe("tmux");
    } finally {
      if (originalTmux) {
        process.env.TMUX = originalTmux;
      } else {
        delete process.env.TMUX;
      }
    }
  });

  test("returns null when neither tmux nor vsc available", async () => {
    const { detectPickerMethod } = await import("../finder");

    const originalTmux = process.env.TMUX;

    try {
      delete process.env.TMUX;

      // Pass a nonexistent port file path to ensure vsc check fails
      const result = await detectPickerMethod("/nonexistent/.vsc-bridge.port");

      expect(result).toBeNull();
    } finally {
      if (originalTmux) {
        process.env.TMUX = originalTmux;
      }
    }
  });
});

describe("parsePickArgs with --method", () => {
  test("parses --method flag", async () => {
    const { parsePickArgs } = await import("../cli-args");

    const args = parsePickArgs(["--method", "vsc"]);
    expect(args.method).toBe("vsc");
  });

  test("defaults method to auto", async () => {
    const { parsePickArgs } = await import("../cli-args");

    const args = parsePickArgs([]);
    expect(args.method).toBe("auto");
  });

  test("accepts tmux, vsc, auto as valid methods", async () => {
    const { parsePickArgs } = await import("../cli-args");

    expect(parsePickArgs(["--method", "tmux"]).method).toBe("tmux");
    expect(parsePickArgs(["--method", "vsc"]).method).toBe("vsc");
    expect(parsePickArgs(["--method", "auto"]).method).toBe("auto");
  });
});

describe("writeOutputFile", () => {
  test("writes session info to JSON file", async () => {
    const { writeOutputFile } = await import("../finder");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    const session: SessionInfo = {
      path: "/home/user/.claude/projects/-workspaces-foo/abc123-def456.jsonl",
      id: "abc123-def456",
      mtime: new Date("2024-11-29T14:32:00Z"),
      project: "-workspaces-foo",
    };

    const tempFile = path.join(os.tmpdir(), `test-output-${Date.now()}.json`);

    try {
      await writeOutputFile(session, tempFile);

      const content = await fs.readFile(tempFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.path).toBe(session.path);
      expect(parsed.id).toBe(session.id);
      expect(parsed.date).toBe("2024-11-29T14:32:00.000Z");
      expect(parsed.project).toBe(session.project);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  });

  test("writes summary when available", async () => {
    const { writeOutputFile } = await import("../finder");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    const session: SessionInfo = {
      path: "/path/to/session.jsonl",
      id: "session-id",
      mtime: new Date(),
      project: "project",
    };

    const tempFile = path.join(os.tmpdir(), `test-output-summary-${Date.now()}.json`);

    try {
      await writeOutputFile(session, tempFile, "My session summary");

      const content = await fs.readFile(tempFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.summary).toBe("My session summary");
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  });

  test("writes null summary when not provided", async () => {
    const { writeOutputFile } = await import("../finder");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    const session: SessionInfo = {
      path: "/path/to/session.jsonl",
      id: "session-id",
      mtime: new Date(),
      project: "project",
    };

    const tempFile = path.join(os.tmpdir(), `test-output-null-${Date.now()}.json`);

    try {
      await writeOutputFile(session, tempFile);

      const content = await fs.readFile(tempFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.summary).toBeNull();
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  });
});
