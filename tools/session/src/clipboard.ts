/**
 * Clipboard utilities for copying text to the system clipboard.
 *
 * Detects the available clipboard tool on the current platform and
 * provides a simple copy function. Falls back gracefully when no
 * clipboard tool is available.
 */

// =============================================================================
// CLIPBOARD TOOL DETECTION
// =============================================================================

/**
 * A clipboard tool is a command + args that accepts text on stdin.
 */
export interface ClipboardTool {
  /** Display name for messages */
  name: string;
  /** Command to run */
  command: string;
  /** Arguments to pass */
  args: string[];
}

/**
 * Ordered list of clipboard tools to try, from most-preferred to least.
 * - pbcopy: macOS (always available)
 * - wl-copy: Wayland (modern Linux)
 * - xclip: X11 (common on Linux)
 * - xsel: X11 (alternative)
 */
const CLIPBOARD_TOOLS: ClipboardTool[] = [
  { name: "pbcopy", command: "pbcopy", args: [] },
  { name: "wl-copy", command: "wl-copy", args: [] },
  { name: "xclip", command: "xclip", args: ["-selection", "clipboard"] },
  { name: "xsel", command: "xsel", args: ["--clipboard", "--input"] },
];

/**
 * Check if a command is available on the system.
 */
async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["sh", "-c", "command -v " + command], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Detect the first available clipboard tool on this system.
 *
 * Returns `null` if no clipboard tool is found. Result is cached so
 * subsequent calls skip the probe.
 */
let cachedTool: ClipboardTool | null | undefined;
export async function detectClipboardTool(): Promise<ClipboardTool | null> {
  if (cachedTool !== undefined) return cachedTool;
  let result: ClipboardTool | null = null;
  for (const tool of CLIPBOARD_TOOLS) {
    if (await isCommandAvailable(tool.command)) {
      result = tool;
      break;
    }
  }
  cachedTool = result;
  return result;
}

// =============================================================================
// CLIPBOARD OPERATIONS
// =============================================================================

/**
 * Copy text to the system clipboard.
 *
 * Returns true if the text was successfully copied, false otherwise.
 */
export async function copyToClipboard(
  text: string,
  tool: ClipboardTool
): Promise<boolean> {
  try {
    const proc = Bun.spawn([tool.command, ...tool.args], {
      stdin: new Response(text),
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Return the ordered list of clipboard tools that are probed.
 * Exported for testing.
 */
export function getClipboardTools(): readonly ClipboardTool[] {
  return CLIPBOARD_TOOLS;
}
