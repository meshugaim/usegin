import { Command } from "commander";
import { resolveConfig, snapshotSelector } from "../lib/config";
import {
  buildSnapshotArgs, checkPrereqs, getServer, listServers, resolveTargetName, runHcloud,
} from "../lib/hcloud";
import { isHeadless } from "../../../lib/headless";

export function downCommand(): Command {
  return new Command("down")
    .description("Snapshot a box, then DELETE it (the only way to stop billing)")
    .argument("[box]", "box name or id (default: the configured box)")
    .option("-y, --yes", "skip the confirmation prompt")
    .action((boxArg: string | undefined, opts: { yes?: boolean }) => {
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
        console.log(`No server '${name}' to take down.`);
        return;
      }

      const confirmed = opts.yes || process.env.BOX_YES === "1";
      if (!confirmed) {
        if (isHeadless()) {
          console.error(`Refusing to delete '${name}' without --yes in a non-interactive/headless context.`);
          process.exit(1);
        }
        const ans = prompt(`Snapshot '${name}' and DELETE it (stops billing)? [y/N]`);
        if (ans !== "y" && ans !== "Y") {
          console.log("Aborted.");
          process.exit(1);
        }
      }

      console.error(`Snapshotting '${name}' (captures the built devcontainer image + repo) ...`);
      const snap = runHcloud(
        buildSnapshotArgs({
          name,
          description: `${name} ${new Date().toISOString().replace(/\.\d+Z$/, "Z")}`,
          label: snapshotSelector(name),
        }),
        { inherit: true },
      );
      if (snap.code !== 0) {
        console.error(`Error: snapshot failed (exit ${snap.code}); NOT deleting the server.`);
        process.exit(snap.code);
      }

      console.error("Deleting server (snapshot is kept) ...");
      const del = runHcloud(["server", "delete", name], { inherit: true });
      if (del.code !== 0) {
        console.error(`Error: server delete failed (exit ${del.code}). The snapshot was created; the server still exists and is billing.`);
        process.exit(del.code);
      }

      console.log(`Down. You now pay only snapshot storage (~cents/month). Bring it back with: box up ${name === cfg.name ? "" : name}`.trimEnd());
    });
}
