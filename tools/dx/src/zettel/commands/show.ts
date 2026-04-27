import { Command } from "commander";
import { readFileSync } from "node:fs";
import { findById, zettelsDir } from "../storage";

export function buildZettelShowCommand(): Command {
  return new Command("show")
    .description("Print a zettel by id (z003, 003, 3 — short forms accepted).")
    .argument("<id>", "zettel id")
    .option("--json", "emit parsed JSON instead of raw markdown")
    .action((id: string, opts: { json?: boolean }) => {
      const z = findById(id, zettelsDir());
      if (!z) {
        process.stderr.write(`dx zettel show: no zettel matches "${id}"\n`);
        process.exit(1);
      }
      if (opts.json) {
        process.stdout.write(JSON.stringify(z) + "\n");
      } else {
        process.stdout.write(readFileSync(z.path, "utf-8"));
      }
    });
}
