/**
 * Terminal color utilities using ANSI escape codes.
 * No dependencies - works with any modern terminal.
 */

// Check if colors should be disabled
const NO_COLOR = process.env.NO_COLOR !== undefined || process.env.FORCE_COLOR === "0";
const FORCE_COLOR = process.env.FORCE_COLOR === "1" || process.env.FORCE_COLOR === "true";

// Detect if stdout supports colors
function supportsColor(): boolean {
  if (NO_COLOR) return false;
  if (FORCE_COLOR) return true;
  // Check if running in a TTY
  return process.stdout.isTTY ?? false;
}

const enabled = supportsColor();

// ANSI escape codes
const codes = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright foreground colors
  brightBlack: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",
};

type ColorFn = (text: string) => string;

function makeColor(code: string): ColorFn {
  return (text: string) => (enabled ? `${code}${text}${codes.reset}` : text);
}

function makeComposite(...colorCodes: string[]): ColorFn {
  const combined = colorCodes.join("");
  return (text: string) => (enabled ? `${combined}${text}${codes.reset}` : text);
}

// Export color functions
export const bold = makeColor(codes.bold);
export const dim = makeColor(codes.dim);
export const italic = makeColor(codes.italic);
export const underline = makeColor(codes.underline);

export const black = makeColor(codes.black);
export const red = makeColor(codes.red);
export const green = makeColor(codes.green);
export const yellow = makeColor(codes.yellow);
export const blue = makeColor(codes.blue);
export const magenta = makeColor(codes.magenta);
export const cyan = makeColor(codes.cyan);
export const white = makeColor(codes.white);

export const brightBlack = makeColor(codes.brightBlack);
export const brightRed = makeColor(codes.brightRed);
export const brightGreen = makeColor(codes.brightGreen);
export const brightYellow = makeColor(codes.brightYellow);
export const brightBlue = makeColor(codes.brightBlue);
export const brightMagenta = makeColor(codes.brightMagenta);
export const brightCyan = makeColor(codes.brightCyan);
export const brightWhite = makeColor(codes.brightWhite);

// Common combinations
export const boldRed = makeComposite(codes.bold, codes.red);
export const boldGreen = makeComposite(codes.bold, codes.green);
export const boldYellow = makeComposite(codes.bold, codes.yellow);
export const boldBlue = makeComposite(codes.bold, codes.blue);
export const boldCyan = makeComposite(codes.bold, codes.cyan);
export const boldMagenta = makeComposite(codes.bold, codes.magenta);
export const boldWhite = makeComposite(codes.bold, codes.white);

// Semantic colors for the plan-cli
export const colors = {
  // Issue identifiers (e.g., ENG-123)
  identifier: cyan,

  // Issue titles
  title: bold,

  // Status colors
  status: {
    backlog: dim,
    todo: white,
    inProgress: yellow,
    inReview: magenta,
    done: green,
    canceled: brightBlack,
  },

  // Labels
  label: magenta,

  // URLs
  url: blue,

  // Headers
  header: dim,

  // Errors and warnings
  error: red,
  warning: yellow,
  success: green,

  // Hints and tips
  hint: dim,

  // Position numbers
  position: dim,

  // Tree structure (indent/prefix)
  tree: dim,

  // Field names in show output
  fieldName: dim,

  // Assignee
  assignee: cyan,
};

/**
 * Format a status with appropriate color
 */
export function colorizeStatus(status: string): string {
  const normalized = status.toLowerCase().replace(/\s+/g, "");
  switch (normalized) {
    case "backlog":
      return colors.status.backlog(status);
    case "todo":
      return colors.status.todo(status);
    case "inprogress":
      return colors.status.inProgress(status);
    case "inreview":
      return colors.status.inReview(status);
    case "done":
      return colors.status.done(status);
    case "canceled":
    case "cancelled":
      return colors.status.canceled(status);
    default:
      return status;
  }
}

/**
 * Strip ANSI codes from a string (useful for width calculations)
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Get the visible length of a string (excluding ANSI codes)
 */
export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

/**
 * Pad a string to a given width, accounting for ANSI codes
 */
export function padEnd(str: string, width: number): string {
  const visible = visibleLength(str);
  if (visible >= width) return str;
  return str + " ".repeat(width - visible);
}

/**
 * Pad a string to the left to a given width, accounting for ANSI codes
 */
export function padStart(str: string, width: number): string {
  const visible = visibleLength(str);
  if (visible >= width) return str;
  return " ".repeat(width - visible) + str;
}
