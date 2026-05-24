import { Command } from "commander";
import { resolveConfig } from "../lib/config";
import {
  checkPrereqs, getServer, listServers, resolveTargetName,
} from "../lib/hcloud";
import { snapshotAndDeleteServer } from "../lib/down";
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

      const res = snapshotAndDeleteServer(name);
      if (!res.ok) {
        console.error(`Error: ${res.error}`);
        process.exit(res.code ?? 1);
      }

      console.log(`Down. You now pay only snapshot storage (~cents/month). Bring it back with: box up ${name === cfg.name ? "" : name}`.trimEnd());
    });
}
