/**
 * dx docs — inline documentation for dx usage and config format.
 *
 * Exports pure functions for building and formatting docs content,
 * plus a Commander command builder.
 *
 * Part of: ENG-3443
 */

import { Command } from "commander";
import { dxShouldOutputJson } from "../output";

/** A single documentation section. */
export interface DocsSection {
  id: string;
  title: string;
  content: string;
}

/**
 * Build the full set of documentation sections.
 *
 * Returns sections for: adding-features, config-format, identity.
 */
export function buildDocsContent(): DocsSection[] {
  return [
    {
      id: "adding-features",
      title: "Adding Features",
      content: `To add a new feature toggle:

1. Register the feature in \`.dx/config.json\` under the \`features\` key:
   \`\`\`json
   "my-feature": {
     "description": "What this feature does",
     "mechanism": "How it is gated (e.g. hook, SDK check)",
     "default": true
   }
   \`\`\`

2. Gate the feature in code using the SDK:
   \`\`\`typescript
   import dx from "../../dx/sdk";
   if (dx.isEnabled("my-feature")) { /* ... */ }
   \`\`\`

3. Or gate in bash:
   \`\`\`bash
   if dx resolve my-feature --exit-code; then echo "on"; fi
   \`\`\``,
    },
    {
      id: "config-format",
      title: "Config Format",
      content: `The dx config lives in \`.dx/config.json\` with two top-level keys:

**features** — registered feature toggles:
  Each feature has \`description\`, \`mechanism\`, and \`default\` (boolean).

**users** — per-person overrides:
  Each user entry has \`aliases\` (array of strings for identity matching)
  and \`overrides\` (map of feature name to boolean).

Local overrides live in \`.dx/config.local.json\` (gitignored) with a single
\`overrides\` key. Local overrides take highest priority in the three-layer merge:
  default -> user-override -> local-override`,
    },
    {
      id: "identity",
      title: "Identity",
      content: `dx resolves the current user from environment signals in this order:

1. \`$DX_USER\` — explicit override (highest priority)
2. \`$GITHUB_USER\` — GitHub username
3. \`$USER\` — OS username
4. \`whoami\` — system command output
5. \`git config user.name\` — git user name
6. \`git config user.email\` — email prefix (before @)

Each signal is matched against user keys and aliases in config.json
(case-insensitive). Use \`dx identify\` to see which signals are active
and \`dx whoami\` to see the resolved identity.`,
    },
  ];
}

/**
 * Format documentation sections for display.
 *
 * If topic is provided and matches a section id, returns only that section.
 * If no topic or unknown topic, returns all sections (graceful fallback).
 */
export function formatDocs(
  sections: DocsSection[],
  topic?: string,
): string {
  const filtered = filterSections(sections, topic);

  const lines: string[] = [];
  for (const section of filtered) {
    lines.push(`# ${section.title}`);
    lines.push("");
    lines.push(section.content);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * Format documentation sections as JSON.
 *
 * Returns a JSON string of the sections (optionally filtered by topic).
 */
export function formatDocsJson(
  sections: DocsSection[],
  topic?: string,
): string {
  const filtered = filterSections(sections, topic);
  return JSON.stringify(filtered, null, 2);
}

/**
 * Filter sections by topic id. Returns all sections if topic is
 * not provided or doesn't match any section (graceful fallback).
 */
function filterSections(sections: DocsSection[], topic?: string): DocsSection[] {
  if (!topic) {
    return sections;
  }

  const matched = sections.filter((s) => s.id === topic);
  return matched.length > 0 ? matched : sections;
}

/**
 * Build the `dx docs` Commander command.
 *
 * Optional `[topic]` argument to show a specific section.
 */
export function buildDocsCommand(): Command {
  const cmd = new Command("docs")
    .description("Show dx documentation")
    .argument("[topic]", "Show a specific documentation topic")
    .option("--json", "Output as JSON");

  cmd.action((topic: string | undefined, opts: { json?: boolean }) => {
    const useJson = dxShouldOutputJson(opts);
    const sections = buildDocsContent();

    if (useJson) {
      process.stdout.write(formatDocsJson(sections, topic) + "\n");
    } else {
      process.stderr.write(formatDocs(sections, topic) + "\n");
    }
  });

  return cmd;
}
