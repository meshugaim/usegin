/**
 * tdd-shared/frontmatter — parse YAML frontmatter from agent-written
 * markdown files.
 *
 * Ported verbatim from `tools/worker-reviewer-experiment/hooks/validate-submission.ts`
 * so both worker-reviewer and tdd-execute can share the parser without
 * re-importing each other.
 *
 * Contract: file content starts with a line of literally "---", then YAML,
 * then a closing "---" line. Anything else returns null. We deliberately
 * tolerate Windows line endings.
 */

import { parse as parseYaml } from "yaml";

export interface FrontmatterParse {
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Extract YAML frontmatter from a markdown-style document. Returns null
 * if there's no frontmatter, the closing fence is missing, or the YAML
 * fails to parse.
 *
 * The returned `body` is the content AFTER the closing `---` line, joined
 * by `\n` — line endings are normalised on the way back.
 */
export function extractFrontmatter(content: string): FrontmatterParse | null {
  // Normalise CRLF → LF so split("\n") works on Windows-saved files too.
  const normalised = content.replace(/\r\n/g, "\n");
  if (!normalised.startsWith("---")) {
    return null;
  }

  const lines = normalised.split("\n");
  let closingIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return null;
  }

  const frontmatterText = lines.slice(1, closingIndex).join("\n");
  const body = lines.slice(closingIndex + 1).join("\n");

  try {
    const fm = parseYaml(frontmatterText);
    if (fm === null || fm === undefined) {
      return { frontmatter: {}, body };
    }
    if (typeof fm !== "object" || Array.isArray(fm)) {
      // Frontmatter that parsed to a scalar / array is technically valid
      // YAML but not useful. Surface as null so callers fall back.
      return null;
    }
    return { frontmatter: fm as Record<string, unknown>, body };
  } catch {
    return null;
  }
}
