#!/usr/bin/env bun
/**
 * UserPromptSubmit hook — when Lihu's prompt mentions "skill", check whether
 * recently-touched skills under `.claude/skills/` have a corresponding lab
 * under `.claude/skill-lab/<skill-name>/lab.md`. If any are missing, emit a
 * <system-reminder> nudging UseGin to consider creating one (manually or via
 * the rnd skill).
 *
 * Motivated by zettel z077. Additive only — never blocks, never modifies state.
 *
 * Heuristic for "recently touched": skill directories under `.claude/skills/`
 * with a directory mtime within the last 60 minutes. Cheap (one readdir + stat
 * per entry, ~100 entries, sub-10ms typical). Captures skills the agent or
 * human has been editing in roughly the current session window without
 * requiring session-state plumbing. False-positive cost is low (an
 * informational nudge); false-negative cost is the same thing it is today
 * (nothing fires).
 *
 * Defensive: if `.claude/skill-lab/` is missing, exit silently rather than
 * crash. Same for any unexpected I/O failure — UserPromptSubmit fires every
 * turn and must never block flow.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

type HookInput = {
  prompt?: string;
  session_id?: string;
  hook_event_name?: string;
};

const RECENT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SKILL_WORD = /\bskill(?:s)?\b/i;

async function readStdinJson<T>(): Promise<T | null> {
  if (process.stdin.isTTY) return null;
  let buf = "";
  for await (const chunk of process.stdin) buf += chunk;
  if (!buf.trim()) return null;
  try {
    return JSON.parse(buf) as T;
  } catch {
    return null;
  }
}

function passThrough(): void {
  process.stdout.write(JSON.stringify({ continue: true }) + "\n");
}

function recentlyTouchedSkills(skillsDir: string, now: number): string[] {
  let entries: string[];
  try {
    entries = readdirSync(skillsDir);
  } catch {
    return [];
  }

  const recent: string[] = [];
  for (const entry of entries) {
    const full = resolve(skillsDir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    if (now - st.mtimeMs <= RECENT_WINDOW_MS) {
      recent.push(entry);
    }
  }
  return recent;
}

async function main() {
  const payload = await readStdinJson<HookInput>();
  const prompt = payload?.prompt ?? "";

  if (!prompt || !SKILL_WORD.test(prompt)) {
    passThrough();
    return;
  }

  const repoRoot = resolve(import.meta.dir, "../..");
  const skillsDir = resolve(repoRoot, ".claude/skills");
  const labDir = resolve(repoRoot, ".claude/skill-lab");

  // Defensive: if either directory is missing, do nothing.
  if (!existsSync(skillsDir) || !existsSync(labDir)) {
    passThrough();
    return;
  }

  const recent = recentlyTouchedSkills(skillsDir, Date.now());
  if (recent.length === 0) {
    passThrough();
    return;
  }

  // A skill has a lab if `.claude/skill-lab/<skill-name>/lab.md` exists
  // (the established convention — see liaison/, cell/, research/ etc.).
  const missing = recent.filter(
    (name) => !existsSync(resolve(labDir, name, "lab.md")),
  );

  if (missing.length === 0) {
    passThrough();
    return;
  }

  const lines = [
    "<system-reminder>",
    "Recently-touched skills without a corresponding lab in `.claude/skill-lab/<name>/lab.md`:",
    "",
    ...missing.map((name) => `  - ${name}`),
    "",
    "Consider running the rnd skill or writing the lab manually so the skill has a place to accumulate retros and what-we-learned. (Per zettel z077.)",
    "</system-reminder>",
  ];

  process.stdout.write(
    JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: lines.join("\n"),
      },
    }) + "\n",
  );
}

main().catch(() => {
  // Never block the user's turn on a telemetry hook.
  passThrough();
});
