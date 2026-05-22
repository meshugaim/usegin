#!/usr/bin/env bun

import { $ } from "bun";
import { dirname, join } from "path";
import { probeSyncHealthSync } from "../../tools/session-sync/src/health.ts";

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

// session-sync daemon health — a *live* counterpart to the SessionStart banner
// (banner-env-status.sh). Re-evaluated on every statusline render, so a daemon
// that dies or drops into needs-auth mid-session is visible immediately rather
// than only at the next session start (ENG-6158). Same ✅/⚠/❌ vocabulary and
// severity ordering (down > auth > stale > ok) as the banner. Fail-silent, like
// the tip CLI below — a probe error must never break the status line.
function syncSegment(): string {
  try {
    const h = probeSyncHealthSync();
    switch (h.state) {
      case "down":
        return `${RED}❌ sync down${RESET}`;
      case "auth":
        return `${YELLOW}⚠ sync auth${RESET}`;
      case "stale": {
        const age = h.lastUploadAgeS;
        const pretty =
          age == null
            ? ""
            : age >= 3600
              ? ` ${Math.floor(age / 3600)}h`
              : ` ${Math.floor(age / 60)}m`;
        return `${YELLOW}⚠ sync stale${pretty}${RESET}`;
      }
      default:
        return `${GREEN}✅ sync${RESET}`;
    }
  } catch {
    return "";
  }
}

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

if (modelName.includes("opus")) {
  parts.push(`${modelEmoji} ${GREEN}${input.model.display_name}${RESET}`);
} else {
  parts.push(`${modelEmoji} ${BOLD_BLACK_ON_YELLOW}${input.model.display_name}${RESET}`);
}

if (git) parts.push(git);

const sync = syncSegment();
if (sync) parts.push(sync);

parts.push(`${input.session_id.slice(0, 8)}`);

// Ambient tip from DX tip system — rendered on its own row below the main
// info line. Claude Code's status line renders each line of stdout as a
// separate row, so the tip CLI owns the full second row (emoji, title,
// context, and the `tip show <handle>` "learn more" hint).
let tipLine = "";
try {
  // Resolve repo root from this script's location: .claude/hooks/ → repo root
  const repoRoot = join(dirname(dirname(import.meta.dir)));
  const tipResult = Bun.spawnSync({
    cmd: ["bun", join(repoRoot, "tools/tips/src/cli.ts"), "statusline"],
    stdout: "pipe",
    stderr: "pipe",
    cwd: repoRoot,
  });
  tipLine = tipResult.stdout.toString().trim();
} catch {
  // Non-blocking — tip CLI failure should never break the status line
}

console.log(parts.join(" | "));
if (tipLine) console.log(tipLine);
