import { Command } from "commander";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig, snapshotSelector } from "../lib/config";
import {
  buildCreateFromSnapshotArgs, checkPrereqs, cleanHostkey, getServer,
  listSnapshots, pickLatestSnapshot, resolveSize, runHcloud, serverIp,
} from "../lib/hcloud";
import {
  buildFirstBootUserData, chooseSpinSource, goldenBaseSelector, isValidBoxName,
} from "../lib/golden-base";

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

      // A box's own latest snapshot wins; a brand-new name falls back to the
      // golden base. (Two cheap label-scoped lookups; see chooseSpinSource.)
      const perBox = pickLatestSnapshot(listSnapshots(snapshotSelector(name)));
      const golden = pickLatestSnapshot(listSnapshots(goldenBaseSelector()));
      const choice = chooseSpinSource(perBox, golden);
      if (!choice) {
        console.error(`Error: no snapshot for '${name}', and no golden base (purpose=golden-base) to spin from.`);
        console.error("  Build the base first — see `box base finalize` (slice 4).");
        process.exit(1);
      }

      // Golden-base spins are identity-less → inject first-boot user-data so the
      // box sets its hostname and joins the tailnet as its OWN node. Per-box spins
      // keep their baked identity, so we pass NO user-data (re-running `tailscale
      // up` would register a duplicate node fighting the existing one).
      let userDataFile: string | undefined;
      if (choice.identityless) {
        if (!isValidBoxName(name)) {
          console.error(`Error: '${name}' isn't a valid box name (DNS label: lowercase a-z, 0-9, hyphens; <=63 chars).`);
          process.exit(1);
        }
        userDataFile = join(tmpdir(), `box-userdata-${name}-${Date.now()}.yaml`);
        writeFileSync(userDataFile, buildFirstBootUserData(name), { mode: 0o600 });
      }

      const freshNote = choice.identityless ? " — fresh tailnet identity on first boot" : "";
      console.error(`Spinning '${name}' from ${choice.source} (image ${choice.image}, ${type} @ ${cfg.location})${freshNote} ...`);
      const res = runHcloud(
        buildCreateFromSnapshotArgs({
          name,
          type,
          image: choice.image,
          location: cfg.location,
          sshKey: cfg.sshKeyName,
          label: snapshotSelector(name),
          userDataFile,
        }),
        { inherit: true },
      );
      if (userDataFile) { try { unlinkSync(userDataFile); } catch { /* best-effort temp cleanup */ } }
      if (res.code !== 0) {
        console.error(`Error: hcloud server create failed (exit ${res.code}).`);
        process.exit(res.code);
      }

      const server = getServer(name);
      const ip = serverIp(server);
      cleanHostkey(ip); // snapshot-recreate rotates the host key
      console.log("");
      if (choice.identityless) {
        console.log(`Spinning up '${name}' from the golden base. First boot runs cloud-init`);
        console.log("(set hostname + join tailnet), so give it ~1 min before connecting:");
      } else {
        console.log(`Up at ${ip || "?"}. Connect + resume the devcontainer tmux:`);
      }
      console.log(`  box work ${name === cfg.name ? "" : name}`.trimEnd());
    });
}
