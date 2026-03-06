#!/usr/bin/env bun

import { $ } from "bun";

interface StatusLineInput {
  session_id: string;
  version: string;
  model: {
    display_name: string;
  };
  context_window?: {
    used_percentage: number;
  };
}

const input: StatusLineInput = await Bun.stdin.json();

// ANSI color codes
const BOLD_BLACK_ON_YELLOW = "\x1b[1;30;48;2;255;255;0m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

// Git status
async function gitStatus(): Promise<string> {
  try {
    const raw = await $`git status --porcelain`.text();
    const lines = raw.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return "";

    let staged = 0;
    let modified = 0;
    let untracked = 0;

    for (const line of lines) {
      const x = line[0]; // index (staged)
      const y = line[1]; // worktree

      if (x === "?") {
        untracked++;
      } else {
        if (x !== " " && x !== "?") staged++;
        if (y !== " " && y !== "?") modified++;
      }
    }

    const parts: string[] = [];
    if (staged > 0) parts.push(`${GREEN}+${staged}${RESET}`);
    if (modified > 0) parts.push(`${YELLOW}~${modified}${RESET}`);
    if (untracked > 0) parts.push(`${DIM}?${untracked}${RESET}`);

    return parts.join("");
  } catch {
    return "";
  }
}

const git = await gitStatus();

const parts: string[] = [];

parts.push(`v${input.version}`);

if (input.context_window?.used_percentage != null) {
  parts.push(`${input.context_window.used_percentage}%`);
}

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const modelName = input.model.display_name.toLowerCase();
const modelEmoji = modelName.includes("opus")
  ? pick(["🧠", "🔬", "🧬", "🧪", "👨‍🔬", "👩‍🔬", "🤓", "💡"])
  : modelName.includes("sonnet")
    ? pick(["👷", "🔨", "⚒️", "🏗️", "💪", "🛠️"])
    : modelName.includes("haiku")
      ? pick(["😵‍💫", "🫠", "😅", "🤔", "😬", "🥴"])
      : "🤖";

// Effort level from patched CLI input (see node_modules patch + scripts/patch-claude-statusline.sh)
// h88() can return a string ("low"|"medium"|"high"|"max") or a number (0-255)
const rawEffort = (input as any).effort?.level;
function resolveEffort(val: unknown): { label: string; color: string } | null {
  if (typeof val === "string") {
    const map: Record<string, { label: string; color: string }> = {
      max: { label: "high", color: GREEN },
      high: { label: "high", color: GREEN },
      medium: { label: "med", color: YELLOW },
      low: { label: "low", color: RED },
    };
    return map[val] ?? null;
  }
  if (typeof val === "number") {
    if (val >= 200) return { label: "high", color: GREEN };
    if (val >= 100) return { label: "med", color: YELLOW };
    return { label: "low", color: RED };
  }
  return null;
}
const effortResolved = resolveEffort(rawEffort);
const effortDisplay = effortResolved
  ? ` ${effortResolved.color}${effortResolved.label}${RESET}`
  : ` ${DIM}effort:--${RESET}`;

if (modelName.includes("opus")) {
  parts.push(`${modelEmoji} ${GREEN}${input.model.display_name}${RESET}${effortDisplay}`);
} else {
  parts.push(`${modelEmoji} ${BOLD_BLACK_ON_YELLOW}${input.model.display_name}${RESET}${effortDisplay}`);
}

if (git) parts.push(git);

parts.push(`${input.session_id.slice(0, 8)}`);

console.log(parts.join(" | "));
