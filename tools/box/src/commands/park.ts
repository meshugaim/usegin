import { Command } from "commander";
import { resolveConfig, snapshotSelector } from "../lib/config";
import {
  buildSnapshotArgs, checkPrereqs, getServer, listServers, resolveTargetName, runHcloud,
} from "../lib/hcloud";

export function parkCommand(): Command {
  return new Command("park")
    .description("Snapshot a box but KEEP it running (freeze a checkpoint, stay on the same box)")
    .argument("[box]", "box name or id (default: the configured box)")
    .action((boxArg: string | undefined) => {
      const prereq = checkPrereqs();
      if (!prereq.ok) {
        console.error(`Error: ${prereq.error}`);
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

      if (!getServer(name)) {
        const upHint = `box up ${name === cfg.name ? "" : name}`.trimEnd();
        console.log(`No server '${name}' to park. \`${upHint}\` brings it up first.`);
        return;
      }

      console.error(`Parking '${name}' — snapshotting its current state (the box keeps running) ...`);
      const snap = runHcloud(
        buildSnapshotArgs({
          name,
          description: `${name} ${new Date().toISOString().replace(/\.\d+Z$/, "Z")}`,
          label: snapshotSelector(name),
        }),
        { inherit: true },
      );
      if (snap.code !== 0) {
        console.error(`Error: snapshot failed (exit ${snap.code}). The box is untouched and still running.`);
        process.exit(snap.code);
      }

      console.log("");
      console.log(`Parked. '${name}' is STILL RUNNING (and billing) — you're on the same box, now with a fresh checkpoint.`);
      console.log(`  park = freeze-and-keep (a checkpoint you can roll back to).`);
      console.log(`  down = snapshot + DELETE (the cost-stop teardown). Use \`box down ${name === cfg.name ? "" : name}\` to stop billing.`.trimEnd());
    });
}
