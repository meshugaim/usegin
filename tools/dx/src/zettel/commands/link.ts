import { Command } from "commander";
import { findById, normalizeId, updateThreads, zettelsDir } from "../storage";
import type { Edge, EdgeKind } from "../types";

const ZETTEL_TOKEN_RE = /^z?\d+$/;

/** Normalize the `to` token. Bare numerics get a `zNNN` form; everything else passes through. */
function normalizeTarget(to: string): string {
  return ZETTEL_TOKEN_RE.test(to.trim()) ? normalizeId(to) : to.trim();
}

/** A target is considered "external" (not a zettel id) if it doesn't match the zettel pattern. */
function isExternalTarget(to: string): boolean {
  return !ZETTEL_TOKEN_RE.test(to);
}

export function buildZettelLinkCommand(): Command {
  return new Command("link")
    .description("Add a thread from one zettel to another. Default kind: cross-reference.")
    .argument("<from>", "source zettel id")
    .argument("<to>", "target id (zettel id, ENG-id, principle name…)")
    .option("--placement", "this is THE placement edge (replaces existing placement)")
    .option("--cross", "cross-reference (default)")
    .option("--force", "skip target-existence validation (use for forward refs / open-to-empty)")
    .action(
      (
        from: string,
        toRaw: string,
        opts: { placement?: boolean; cross?: boolean; force?: boolean },
      ) => {
        const z = findById(from, zettelsDir());
        if (!z) {
          process.stderr.write(`dx zettel link: source "${from}" not found\n`);
          process.exit(1);
        }
        const to = normalizeTarget(toRaw);
        // Validate target exists when it looks like a zettel id (z059).
        // External tokens (ENG-NNNN, principle-N, SLICE-N, free strings) pass through.
        if (!opts.force && !isExternalTarget(to)) {
          const target = findById(to, zettelsDir());
          if (!target) {
            process.stderr.write(
              `dx zettel link: target "${to}" not found. Use --force to link anyway (forward ref / open-to-empty).\n`,
            );
            process.exit(1);
          }
        }
        const kind: EdgeKind = opts.placement ? "placement" : "cross";
        // If placement, drop any existing placement (only one allowed per z021/z028 schema).
        const existing =
          kind === "placement" ? z.threads.filter((e) => e.kind !== "placement") : z.threads;
        // De-dupe across BOTH kinds (z062): a target should appear at most once total —
        // ↑X and ~X simultaneously would be two edges to the same node, which is noise.
        const alreadyLinked = existing.find((e) => e.to === to);
        if (alreadyLinked) {
          const existingPrefix = alreadyLinked.kind === "placement" ? "↑" : "~";
          const wantedPrefix = kind === "placement" ? "↑" : "~";
          if (alreadyLinked.kind === kind) {
            process.stderr.write(
              `dx zettel link: ${z.id} already has ${wantedPrefix}${to}\n`,
            );
            return;
          }
          process.stderr.write(
            `dx zettel link: ${z.id} already has ${existingPrefix}${to} (different kind). Refusing to add ${wantedPrefix}${to} — drop the existing one first or use a different target.\n`,
          );
          process.exit(1);
        }
        const next: Edge[] = [...existing, { to, kind }];
        // Placements first (display convention).
        next.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "placement" ? -1 : 1));
        updateThreads(z.path, next);
        process.stderr.write(`Linked ${z.id} ${kind === "placement" ? "↑" : "~"} ${to}\n`);
      },
    );
}
