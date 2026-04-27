import { Command } from "commander";
import { findById, updateThreads, zettelsDir } from "../storage";
import type { Edge, EdgeKind } from "../types";

export function buildZettelLinkCommand(): Command {
  return new Command("link")
    .description("Add a thread from one zettel to another. Default kind: cross-reference.")
    .argument("<from>", "source zettel id")
    .argument("<to>", "target id (zettel id, ENG-id, principle name…)")
    .option("--placement", "this is THE placement edge (replaces existing placement)")
    .option("--cross", "cross-reference (default)")
    .action((from: string, to: string, opts: { placement?: boolean; cross?: boolean }) => {
      const z = findById(from, zettelsDir());
      if (!z) {
        process.stderr.write(`dx zettel link: source "${from}" not found\n`);
        process.exit(1);
      }
      const kind: EdgeKind = opts.placement ? "placement" : "cross";
      // If placement, drop any existing placement (only one allowed per z021/z028 schema).
      const existing = kind === "placement" ? z.threads.filter((e) => e.kind !== "placement") : z.threads;
      // De-dupe: don't add same (to, kind) twice.
      if (existing.some((e) => e.to === to && e.kind === kind)) {
        process.stderr.write(`dx zettel link: ${z.id} already has ${kind === "placement" ? "↑" : "~"}${to}\n`);
        return;
      }
      const next: Edge[] = [...existing, { to, kind }];
      // Reorder so placements come first (display convention).
      next.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "placement" ? -1 : 1));
      updateThreads(z.path, next);
      process.stderr.write(`Linked ${z.id} ${kind === "placement" ? "↑" : "~"} ${to}\n`);
    });
}
