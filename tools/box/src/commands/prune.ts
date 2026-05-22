import { Command } from "commander";
import { resolveConfig, snapshotSelector } from "../lib/config";
import {
  checkPrereqs, deleteSnapshot, listServers, listSnapshots, pickLatestSnapshot,
  resolveTargetName, selectSnapshotsToPrune,
} from "../lib/hcloud";
import { formatEur, snapshotStorageCost } from "../lib/cost";
import { isHeadless } from "../../../lib/headless";

const DEFAULT_KEEP = 3;

export function pruneCommand(): Command {
  return new Command("prune")
    .description("Delete a box's OLD snapshots, keeping the latest N (frees storage; the box is untouched)")
    .argument("[box]", "box name or id (default: the configured box)")
    .option("--keep <n>", `keep the latest <n> snapshots`, String(DEFAULT_KEEP))
    .option("-y, --yes", "skip the confirmation prompt")
    .action((boxArg: string | undefined, opts: { keep: string; yes?: boolean }) => {
      const prereq = checkPrereqs();
      if (!prereq.ok) {
        console.error(`Error: ${prereq.error}`);
        process.exit(1);
      }

      const keep = Number.parseInt(opts.keep, 10);
      if (Number.isNaN(keep) || keep < 0) {
        console.error(`Error: --keep must be a non-negative integer (got "${opts.keep}").`);
        process.exit(1);
      }

      const cfg = resolveConfig();
      const servers = listServers();
      const resolved = resolveTargetName({ selector: boxArg }, cfg.name, servers);
      if (resolved.error) {
        console.error(`Error: ${resolved.error}`);
        process.exit(1);
      }
      const name = resolved.name!;

      const snapshots = listSnapshots(snapshotSelector(name));
      const toPrune = selectSnapshotsToPrune(snapshots, keep);

      if (toPrune.length === 0) {
        console.log(`Nothing to prune — '${name}' has ${snapshots.length} snapshot${snapshots.length === 1 ? "" : "s"}, keeping the latest ${keep}.`);
        return;
      }

      const prunedSizes = snapshots.filter((s) => toPrune.includes(s.id)).map((s) => s.image_size ?? 0);
      const reclaim = snapshotStorageCost(prunedSizes);
      const latestId = pickLatestSnapshot(snapshots)?.id;
      const dropsLatest = latestId != null && toPrune.includes(latestId);

      console.error(`Pruning '${name}': deleting ${toPrune.length} old snapshot${toPrune.length === 1 ? "" : "s"} (${toPrune.join(", ")}), keeping the latest ${keep}.`);
      console.error(`  Frees ~${formatEur(reclaim)}/mo storage. The box itself is untouched.`);
      if (dropsLatest) {
        console.error(`  WARNING: --keep ${keep} removes the LATEST snapshot too — '${name}' will have nothing to \`box up\` from.`);
      }

      const confirmed = opts.yes || process.env.BOX_YES === "1";
      if (!confirmed) {
        if (isHeadless()) {
          console.error(`Refusing to prune '${name}' without --yes in a non-interactive/headless context.`);
          process.exit(1);
        }
        const ans = prompt(`Delete ${toPrune.length} snapshot${toPrune.length === 1 ? "" : "s"} of '${name}'? [y/N]`);
        if (ans !== "y" && ans !== "Y") {
          console.log("Aborted.");
          process.exit(1);
        }
      }

      let deleted = 0;
      const failed: number[] = [];
      for (const id of toPrune) {
        const res = deleteSnapshot(id);
        if (res.code === 0) {
          deleted += 1;
        } else {
          failed.push(id);
          console.error(`  Failed to delete snapshot ${id} (exit ${res.code}). ${res.stderr.trim()}`.trimEnd());
        }
      }

      if (failed.length > 0) {
        console.error(`Pruned ${deleted}/${toPrune.length}; ${failed.length} failed (${failed.join(", ")}).`);
        process.exit(1);
      }
      console.log(`Pruned ${deleted} snapshot${deleted === 1 ? "" : "s"} from '${name}' — freed ~${formatEur(reclaim)}/mo. Kept the latest ${keep}.`);
    });
}
