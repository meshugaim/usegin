/**
 * Actor tracking — embeds actor identity into Linear issues.
 *
 * Every plan CLI invocation has an actor:
 * - Claude sessions: "claude:abc12345" (short session ID from CLAUDE_SESSION_ID)
 * - Humans: "gh:username" (GitHub login from git config)
 *
 * On create: description gets a metadata footer with the creating actor + date
 * On update: description gets the contributing actor + date added to the footer
 * On comment: comment body gets the actor appended as an HTML comment
 *
 * Deduplication: same actor on the same day only appears once.
 */

import { execSync } from "child_process";

const ACTOR_BLOCK_START = "<!-- actors:";
const ACTOR_BLOCK_END = "-->";

// Cache the resolved actor for the lifetime of the process
let cachedActor: string | null = null;

/**
 * Resolve the current actor identity.
 * Claude sessions: "claude:<short-session-id>"
 * Humans: "gh:<github-login>"
 */
export function getActor(): string {
  if (cachedActor) return cachedActor;

  const sessionId = process.env.CLAUDE_SESSION_ID;
  if (sessionId) {
    cachedActor = `claude:${sessionId.slice(0, 8)}`;
    return cachedActor;
  }

  // Fall back to git config user (GitHub login from noreply email, or user.name)
  try {
    const email = execSync("git config user.email", { encoding: "utf-8" }).trim();
    // Parse "username@users.noreply.github.com" or "123456+username@users.noreply.github.com"
    const ghMatch = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/);
    if (ghMatch) {
      cachedActor = `gh:${ghMatch[1]}`;
      return cachedActor;
    }
  } catch {
    // git not available or no config
  }

  try {
    const name = execSync("git config user.name", { encoding: "utf-8" }).trim();
    if (name) {
      cachedActor = `gh:${name}`;
      return cachedActor;
    }
  } catch {
    // git not available
  }

  cachedActor = "unknown";
  return cachedActor;
}

/**
 * Reset cached actor (for testing).
 */
export function resetActorCache(): void {
  cachedActor = null;
}

/**
 * Get today's date as YYYY-MM-DD.
 */
export function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ActorEntry {
  actor: string; // e.g. "claude:abc12345" or "gh:oria-ai"
  date: string;  // YYYY-MM-DD
}

interface ActorBlock {
  created: ActorEntry | null;
  contributed: ActorEntry[];
}

/**
 * Parse the actors metadata block from a description.
 * Returns the parsed block and the description with the block removed.
 */
export function parseActorBlock(description: string): {
  block: ActorBlock;
  descriptionWithoutBlock: string;
} {
  const block: ActorBlock = { created: null, contributed: [] };

  const startIdx = description.indexOf(ACTOR_BLOCK_START);
  if (startIdx === -1) {
    return { block, descriptionWithoutBlock: description };
  }

  const endIdx = description.indexOf(ACTOR_BLOCK_END, startIdx + ACTOR_BLOCK_START.length);
  if (endIdx === -1) {
    return { block, descriptionWithoutBlock: description };
  }

  const blockText = description.slice(startIdx + ACTOR_BLOCK_START.length, endIdx);

  // Parse "created: actor (DATE)"
  const createdMatch = blockText.match(/created:\s*([\w:.@+-]+)\s*\((\d{4}-\d{2}-\d{2})\)/);
  if (createdMatch) {
    block.created = { actor: createdMatch[1], date: createdMatch[2] };
  }

  // Parse "contributed: actor (DATE), actor (DATE), ..."
  const contributedMatch = blockText.match(/contributed:\s*(.+)/);
  if (contributedMatch) {
    const entries = contributedMatch[1].split(",").map((s) => s.trim());
    for (const entry of entries) {
      const match = entry.match(/([\w:.@+-]+)\s*\((\d{4}-\d{2}-\d{2})\)/);
      if (match) {
        block.contributed.push({ actor: match[1], date: match[2] });
      }
    }
  }

  // Remove the block from the description (and any trailing whitespace)
  const before = description.slice(0, startIdx).trimEnd();
  const after = description.slice(endIdx + ACTOR_BLOCK_END.length).trimStart();
  const descriptionWithoutBlock = after ? `${before}\n\n${after}` : before;

  return { block, descriptionWithoutBlock };
}

/**
 * Serialize an actor block back to its HTML comment format.
 */
function serializeActorBlock(block: ActorBlock): string {
  const lines: string[] = [];

  if (block.created) {
    lines.push(`created: ${block.created.actor} (${block.created.date})`);
  }

  if (block.contributed.length > 0) {
    const entries = block.contributed.map((e) => `${e.actor} (${e.date})`).join(", ");
    lines.push(`contributed: ${entries}`);
  }

  if (lines.length === 0) return "";

  return `${ACTOR_BLOCK_START}\n${lines.join("\n")}\n${ACTOR_BLOCK_END}`;
}

/**
 * Add the current actor to the description metadata footer.
 * Always returns an updated description (actor is always resolved).
 */
export function addActorToDescription(
  description: string | undefined,
  role: "created" | "contributed"
): string {
  const actor = getActor();
  const desc = description ?? "";
  const { block, descriptionWithoutBlock } = parseActorBlock(desc);
  const date = getToday();

  if (role === "created") {
    block.created = { actor, date };
  } else {
    // Dedup on actor+date
    const exists = block.contributed.some((e) => e.actor === actor && e.date === date);
    if (!exists) {
      block.contributed.push({ actor, date });
    }
  }

  const footer = serializeActorBlock(block);
  if (!footer) return desc;

  return descriptionWithoutBlock
    ? `${descriptionWithoutBlock}\n\n${footer}`
    : footer;
}

/**
 * Add actor identity to a comment body as an HTML comment.
 */
export function addActorToComment(body: string): string {
  const actor = getActor();
  return `${body}\n<!-- actor: ${actor} -->`;
}
