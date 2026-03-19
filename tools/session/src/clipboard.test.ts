/**
 * Tests for clipboard detection and copy utilities.
 */

import { describe, it, expect } from "bun:test";
import { getClipboardTools, type ClipboardTool } from "./clipboard";

describe("getClipboardTools", () => {
  it("returns an ordered list of clipboard tools", () => {
    const tools = getClipboardTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("lists pbcopy first (macOS preferred)", () => {
    const tools = getClipboardTools();
    expect(tools[0].name).toBe("pbcopy");
    expect(tools[0].command).toBe("pbcopy");
    expect(tools[0].args).toEqual([]);
  });

  it("includes wl-copy for Wayland", () => {
    const tools = getClipboardTools();
    const wlCopy = tools.find((t) => t.name === "wl-copy");
    expect(wlCopy).toBeDefined();
    expect(wlCopy!.command).toBe("wl-copy");
    expect(wlCopy!.args).toEqual([]);
  });

  it("includes xclip with -selection clipboard", () => {
    const tools = getClipboardTools();
    const xclip = tools.find((t) => t.name === "xclip");
    expect(xclip).toBeDefined();
    expect(xclip!.command).toBe("xclip");
    expect(xclip!.args).toEqual(["-selection", "clipboard"]);
  });

  it("includes xsel with --clipboard --input", () => {
    const tools = getClipboardTools();
    const xsel = tools.find((t) => t.name === "xsel");
    expect(xsel).toBeDefined();
    expect(xsel!.command).toBe("xsel");
    expect(xsel!.args).toEqual(["--clipboard", "--input"]);
  });

  it("prefers pbcopy > wl-copy > xclip > xsel", () => {
    const tools = getClipboardTools();
    const names = tools.map((t) => t.name);
    expect(names).toEqual(["pbcopy", "wl-copy", "xclip", "xsel"]);
  });
});

describe("detectClipboardTool", () => {
  it("returns a ClipboardTool or null", async () => {
    const { detectClipboardTool } = await import("./clipboard");
    const result = await detectClipboardTool();
    // In CI/dev environments, we might or might not have a clipboard tool
    expect(result === null || typeof result?.command === "string").toBe(true);
  });
});
