import { Command } from "commander";
import { resolveConfig, snapshotSelector } from "../lib/config";
import {
  buildCreateFromSnapshotArgs, checkPrereqs, cleanHostkey, getServer,
  listSnapshots, pickLatestSnapshot, resolveSize, runHcloud, serverIp,
} from "../lib/hcloud";

export function upCommand(): Command {
  return new Command("up")
    .description("Recreate a box from its latest snapshot (fast)")
    .argument("[name]", "box name to bring up (default: the configured box)")
    .option("--size <type>", "hcloud server type for this box, overriding BOX_TYPE (e.g. cpx31)")
    .action((nameArg: string | undefined, opts: { size?: string }) => {
      const prereq = checkPrereqs();
      if (!prereq.ok) {
        console.error(`Error: ${prereq.error}`);
        process.exit(1);
      }

      const cfg = resolveConfig();
      const name = nameArg?.trim() || cfg.name;
      const type = resolveSize({ sizeFlag: opts.size, configType: cfg.type });

      if (!cfg.sshKeyName) {
        console.error("Error: no ssh key configured. Set BOX_SSH_KEY (or HETZNER_SSH_KEY_NAME) to a registered hcloud ssh-key name.");
        console.error("  Register one: hcloud ssh-key create --name <name> --public-key-from-file ~/.ssh/id_ed25519.pub");
        process.exit(1);
      }

      const existing = getServer(name);
      if (existing) {
        console.log(`'${name}' is already up at ${serverIp(existing) || "?"}.`);
        return;
      }

      const snap = pickLatestSnapshot(listSnapshots(snapshotSelector(name)));
      if (!snap) {
        console.error(`Error: no snapshot found for '${name}'. Provision it first (first-time setup).`);
        process.exit(1);
      }

      console.error(`Recreating '${name}' from snapshot ${snap.id} (${type} @ ${cfg.location}) ...`);
      const res = runHcloud(
        buildCreateFromSnapshotArgs({
          name,
          type,
          image: snap.id,
          location: cfg.location,
          sshKey: cfg.sshKeyName,
          label: snapshotSelector(name),
        }),
        { inherit: true },
      );
      if (res.code !== 0) {
        console.error(`Error: hcloud server create failed (exit ${res.code}).`);
        process.exit(res.code);
      }

      const server = getServer(name);
      const ip = serverIp(server);
      cleanHostkey(ip); // snapshot-recreate rotates the host key
      console.log("");
      console.log(`Up at ${ip || "?"}. Connect + resume the devcontainer tmux:`);
      console.log(`  box work ${name === cfg.name ? "" : name}`.trimEnd());
    });
}
