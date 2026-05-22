import { Command } from "commander";
import { resolveConfig, snapshotSelector } from "../lib/config";
import {
  checkPrereqs, getServer, listServers, listSnapshots, resolveTargetName, serverIp,
} from "../lib/hcloud";
import { shouldDefaultToJson } from "../../../lib/output-mode";

export function statusCommand(): Command {
  return new Command("status")
    .description("Show a box's server state, snapshots, and a cost reminder")
    .argument("[box]", "box name or id (default: the configured box)")
    .option("--json", "output JSON")
    .action((boxArg: string | undefined, opts: { json?: boolean }) => {
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

      const server = getServer(name);
      const snapshots = listSnapshots(snapshotSelector(name));

      const json = shouldDefaultToJson({
        envVarName: "BOX_OUTPUT",
        json: opts.json,
        env: process.env,
        isTTY: process.stdout.isTTY,
      });

      if (json) {
        console.log(JSON.stringify({
          name,
          running: server !== null,
          server: server
            ? { id: server.id, type: server.server_type?.name, status: server.status, ip: serverIp(server), datacenter: server.datacenter?.name }
            : null,
          snapshots: snapshots.map((s) => ({ id: s.id, description: s.description, image_size: s.image_size, created: s.created })),
        }, null, 2));
        return;
      }

      console.log(`=== ${name} ===`);
      if (server) {
        console.log(`  ${server.server_type?.name ?? "?"}  ${server.status}  ${serverIp(server) || "?"}  ${server.datacenter?.name ?? "?"}`);
        console.log(`  RUNNING — billing per hour. \`box down ${name}\` to snapshot + stop billing.`);
      } else {
        console.log("  (no server — cheap snapshot-only state)");
      }
      console.log("");
      console.log(`=== snapshots (${snapshotSelector(name)}) ===`);
      if (snapshots.length === 0) {
        console.log("  (none)");
      } else {
        for (const s of [...snapshots].sort((a, b) => a.created.localeCompare(b.created))) {
          const gb = s.image_size != null ? `${s.image_size.toFixed(2)}GB` : "?";
          console.log(`  ${s.id}  ${gb}  ${s.created}  ${s.description ?? ""}`.trimEnd());
        }
      }
    });
}
