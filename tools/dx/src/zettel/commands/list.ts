import { Command } from "commander";
import { readAll, zettelsDir } from "../storage";

export function buildZettelListCommand(): Command {
  return new Command("list")
    .alias("ls")
    .description("List all zettels.")
    .option("--json", "emit JSON array")
    .option("--by <author>", "filter by author (human, usegin, consultant)")
    .action((opts: { json?: boolean; by?: string }) => {
      let all = readAll(zettelsDir());
      if (opts.by) all = all.filter((z) => z.authoredBy === opts.by);
      if (opts.json) {
        process.stdout.write(
          JSON.stringify(
            all.map(({ body: _b, path: _p, ...rest }) => rest),
          ) + "\n",
        );
      } else {
        for (const z of all) {
          process.stdout.write(`${z.id}  [${z.authoredBy}]  ${z.title}\n`);
        }
      }
    });
}
