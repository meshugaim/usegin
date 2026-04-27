import { Command } from "commander";
import { buildZettelAddCommand } from "./commands/add";
import { buildZettelShowCommand } from "./commands/show";
import { buildZettelListCommand } from "./commands/list";
import { buildZettelLinkCommand } from "./commands/link";

/**
 * `dx zettel` — UseGin's shared 2nd brain CLI (slice 1).
 *
 * Slice 1 storage: markdown files in `usegin/zettel/zettels/`.
 * Slice 2 will lift to Supabase (per zettel z034).
 *
 * See `usegin/zettel/SLICE-1.md` for scope and usage examples.
 */
export function buildZettelCommand(): Command {
  const cmd = new Command("zettel")
    .alias("z")
    .description(
      "Capture and retrieve zettels — UseGin's shared 2nd brain. Slice 1: markdown + git.",
    );
  cmd.addCommand(buildZettelAddCommand());
  cmd.addCommand(buildZettelShowCommand());
  cmd.addCommand(buildZettelListCommand());
  cmd.addCommand(buildZettelLinkCommand());
  return cmd;
}
