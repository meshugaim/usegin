import { Command } from "commander";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { parseFrontmatter } from "./docs";

function getPhilosophyContent(): string {
  const docsDir = join(dirname(import.meta.dir), "..", "docs");
  const content = readFileSync(join(docsDir, "philosophy.md"), "utf-8");
  const { body } = parseFrontmatter(content);
  return body;
}

export function createAlignCommand(): Command {
  const cmd = new Command("align")
    .description("Output collaboration norms and workflow philosophy")
    .action((_options, command) => {
      console.log(getPhilosophyContent());
      console.log("\n---\n");
      command.parent?.outputHelp();
    });

  return cmd;
}
