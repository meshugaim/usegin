#!/usr/bin/env bun
/**
 * Director auto-inject PreToolUse hook — shared by build-orchestrate and research.
 *
 * Fires before every Agent/TeamCreate spawn. Reads the active session's
 * skill rules (from AUTO-INJECT markers) and whiteboard Auto-Inject section,
 * then outputs both as additionalContext to re-orient the director.
 *
 * The active session file (.claude/builds/active.json) contains:
 *   { "whiteboard": "<path>", "skill": "<path>" }
 *
 * Silent (no output, exit 0) when:
 * - Tool is not Agent/TeamCreate
 * - No active session file exists (no orchestration skill active)
 * - Neither skill markers nor whiteboard Auto-Inject section found
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";

interface PostToolInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response?: Record<string, unknown>;
}

interface ActiveSession {
  whiteboard: string;
  skill?: string;
}

/**
 * Extract content between <!-- AUTO-INJECT-START --> and <!-- AUTO-INJECT-END -->
 * from the SKILL.md file.
 */
function extractSkillRules(content: string): string | null {
  const startMarker = "<!-- AUTO-INJECT-START -->";
  const endMarker = "<!-- AUTO-INJECT-END -->";

  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) return null;

  const afterStart = startIdx + startMarker.length;
  const endIdx = content.indexOf(endMarker, afterStart);
  if (endIdx === -1) return null;

  const extracted = content.slice(afterStart, endIdx).trim();
  return extracted || null;
}

/**
 * Extract the ## Auto-Inject section from the whiteboard.
 * Everything between "## Auto-Inject" and the next "## " heading.
 */
function extractAutoInjectSection(content: string): string | null {
  const headerPattern = /^## Auto-Inject.*$/m;
  const match = content.match(headerPattern);
  if (!match || match.index === undefined) return null;

  const sectionStart = match.index + match[0].length;
  const remaining = content.slice(sectionStart);

  // Find the next ## heading
  const nextHeading = remaining.search(/^## /m);
  const sectionContent =
    nextHeading === -1 ? remaining.trim() : remaining.slice(0, nextHeading).trim();

  return sectionContent || null;
}

async function main() {
  const input = await Bun.stdin.text();

  let toolInput: PostToolInput;
  try {
    toolInput = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  // Only fire for Agent or TeamCreate
  if (toolInput.tool_name !== "Agent" && toolInput.tool_name !== "TeamCreate") {
    process.exit(0);
  }

  // Find repo root to resolve paths
  const repoRoot = resolve(import.meta.dir, "../..");

  // Check for active build
  const activeBuildPath = resolve(repoRoot, ".claude/builds/active.json");
  if (!existsSync(activeBuildPath)) {
    process.exit(0);
  }

  let activeSession: ActiveSession;
  try {
    const raw = await Bun.file(activeBuildPath).text();
    activeSession = JSON.parse(raw);
  } catch {
    console.error("[auto-inject] Failed to parse .claude/builds/active.json");
    process.exit(0);
  }

  if (!activeSession.whiteboard) {
    process.exit(0);
  }

  // Read skill rules from whichever skill is active
  const skillPath = activeSession.skill
    ? resolve(repoRoot, activeSession.skill)
    : resolve(repoRoot, ".claude/skills/build-orchestrate/SKILL.md");
  let skillRules: string | null = null;
  try {
    const skillContent = await Bun.file(skillPath).text();
    skillRules = extractSkillRules(skillContent);
  } catch {
    // Skill file missing — not fatal
  }

  // Read whiteboard Auto-Inject section
  const whiteboardPath = resolve(repoRoot, activeSession.whiteboard);
  let sessionNotes: string | null = null;
  try {
    const whiteboardContent = await Bun.file(whiteboardPath).text();
    sessionNotes = extractAutoInjectSection(whiteboardContent);
  } catch {
    // Whiteboard missing — not fatal
  }

  // If neither exists, exit silently
  if (!skillRules && !sessionNotes) {
    process.exit(0);
  }

  // Build the combined context
  const parts: string[] = [];

  if (skillRules) {
    parts.push("[Director Re-orientation]");
    parts.push(skillRules);
  }

  if (sessionNotes) {
    if (parts.length > 0) parts.push("");
    parts.push("[Session Notes]");
    parts.push(sessionNotes);
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: parts.join("\n"),
    },
  };

  console.log(JSON.stringify(output));
  process.exit(0);
}

main();
