import { Command } from "commander";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { parseFrontmatter, loadDocsFromDir, formatDocsList } from "./docs";
import { dim } from "../lib/colors";

function getDocsDir(internal = false): string {
  const base = join(dirname(import.meta.dir), "..", "docs");
  return internal ? join(base, "internal") : base;
}

function getPhilosophyContent(): string {
  const docsDir = getDocsDir();
  const content = readFileSync(join(docsDir, "philosophy.md"), "utf-8");
  const { body } = parseFrontmatter(content);
  return body;
}

function getDocsOverview(): string {
  const userDocs = loadDocsFromDir(getDocsDir(false));
  const internalDocs = loadDocsFromDir(getDocsDir(true));
  const allDocs = [...userDocs, ...internalDocs];

  if (allDocs.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push("## Available Docs\n");
  lines.push(formatDocsList(allDocs));
  lines.push("");
  lines.push(dim("Use: plan docs show <handle|number>"));

  return lines.join("\n");
}

function getCompactCli(): string {
  return [
    "## CLI Quick Reference",
    "",
    "Run `plan --help` for full command reference. Common patterns:",
    "",
    "```",
    'plan create "scope: title" --parent <id> --label feature',
    "plan show <id> --tree",
    "plan start <id>",
    "plan close <id>",
    "plan update <id> --comment \"text\"",
    "```",
    "",
    "## Searching & Navigating",
    "",
    "Use built-in search and filters — never pipe `plan` output through grep.",
    "",
    "```",
    'plan search "auth middleware"              # Text search across all issues',
    "plan list --label bug                      # Filter by label",
    'plan list --status "In Progress"           # Filter by status',
    "plan list --assignee @me                   # My issues",
    "plan list --depth 0 --limit 10             # Top-level only, capped",
    "```",
    "",
    "Run `plan list --help` for all options.",
  ].join("\n");
}

function getCompactDocs(): string {
  return [
    "## Docs",
    "",
    "Run `plan docs` to browse embedded documentation (iterative descriptions, workflow philosophy, and more).",
  ].join("\n");
}

export function createAlignCommand(): Command {
  const cmd = new Command("align")
    .description("Output collaboration norms and workflow philosophy")
    .option("--compact", "Shorter output for injection into agent context")
    .action((options, command) => {
      console.log(getPhilosophyContent());

      if (options.compact) {
        console.log("");
        console.log(getCompactCli());
        console.log("");
        console.log(getCompactDocs());
      } else {
        console.log("\n---\n");
        command.parent?.outputHelp();

        const docsOverview = getDocsOverview();
        if (docsOverview) {
          console.log("\n---\n");
          console.log(docsOverview);
        }
      }
    });

  return cmd;
}
