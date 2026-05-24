import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { parsePort, resolveConfig, snapshotSelector } from "../lib/config";
import {
  buildBreakGlassArgs, buildCreateFromSnapshotArgs, buildCreateServerArgs,
  buildTailnetSshArgs, checkPrereqs, cleanHostkey, getServer, listSnapshots,
  pickLatestSnapshot, resolveSize, runHcloud, runSsh, serverIp, tailnetReachable,
} from "../lib/hcloud";
import { isValidBoxName, wrapBashC } from "../lib/golden-base";
import {
  buildCloudInitDoneCheck, buildRunSetupCommand, buildTailscaleUpCommand,
  buildTokenInstallCommand, buildTokenScpArgs, localHcloudConfigPath,
  MGMT_DEFAULT_SIZE, MGMT_HCLOUD_CONFIG_PATH, mgmtCloudInitPath, setupMgmtScriptPath,
} from "../lib/mgmt-provision";
import { serveLease } from "../lib/lease-server";

/**
 * `box mgmt` — manage the always-on MANAGEMENT box (slice 6).
 *
 * The two-tier topology: the mgmt box is the always-on, LEAN host that holds the
 * hcloud token and runs the `box` CLI to manage the fleet. WORK boxes are
 * token-free and reach each other (and are reached) by tailnet name (slice 3),
 * so the token never leaves the mgmt box. The mgmt box is "itself a box" —
 * managed by `box mgmt` — but a distinct one: a fixed name (`BOX_MGMT_NAME`,
 * default `effi-mgmt`) and its OWN snapshot lineage (`role=<mgmtName>-devbox`).
 *
 * It is NOT the full dev devcontainer the WORK boxes run — it's a lean env (just
 * enough to run `box` + tailscale). Because it's lean, `box mgmt up` only
 * RECREATES it from its own snapshot; it does NOT fall back to the (devbox)
 * golden base. Provisioning the mgmt box from scratch + placing the token on it
 * is a separate, interactive step (not in this command surface).
 */
export function mgmtCommand(): Command {
  const mgmt = new Command("mgmt")
    .description("Manage the always-on, token-holding management box (lean; recreate/ssh/status)");

  mgmt.addCommand(mgmtProvisionCommand());
  mgmt.addCommand(mgmtUpCommand());
  mgmt.addCommand(mgmtSshCommand());
  mgmt.addCommand(mgmtStatusCommand());
  mgmt.addCommand(mgmtLeaseServerCommand());
  return mgmt;
}

/**
 * Run a command on the mgmt box over the BREAK-GLASS path (public IP via
 * `hcloud server ssh`) — used during provisioning, BEFORE the box is on the
 * tailnet. `stdin` pipes a payload to the remote command WITHOUT it landing in
 * argv (so a streamed script, or any secret, never shows in a process list/log).
 *
 * The command goes over as a SINGLE arg (`wrapBashC`) so ssh's argv-flattening
 * doesn't shred a multi-word command — same reasoning as base.ts's sshExec.
 * `inheritOut: false` captures output (for the marker poll); otherwise inherits.
 */
function breakGlassExec(
  name: string,
  remoteCmd: string,
  opts: { stdin?: string; inheritOut?: boolean } = {},
): { code: number; stdout: string } {
  const remote = wrapBashC(remoteCmd);
  const argv = ["hcloud", ...buildBreakGlassArgs({ name, command: [remote] })];
  const inheritOut = opts.inheritOut ?? true;
  const proc = Bun.spawnSync(argv, {
    stdin: opts.stdin !== undefined ? new TextEncoder().encode(opts.stdin) : "inherit",
    stdout: inheritOut ? "inherit" : "pipe",
    stderr: "inherit",
  });
  return { code: proc.exitCode ?? 1, stdout: inheritOut ? "" : (proc.stdout?.toString() ?? "") };
}

/**
 * `box mgmt provision` — stand up the always-on, lean mgmt box FROM SCRATCH.
 *
 * Orchestration (pure arg-builders in lib/mgmt-provision.ts; IO here):
 *   1. create a fresh Ubuntu server (cloud-init-mgmt.yaml installs the lean
 *      toolchain — bun/hcloud/tailscale/git, NO docker/node/devcontainer),
 *   2. wait for ssh + cloud-init-done (over break-glass public IP),
 *   3. `tailscale up --authkey=… --hostname=<mgmtName>` (key over ssh, not metadata),
 *   4. run setup-mgmt.sh (clone repo, install + enable the two push-lease units),
 *   5. place the hcloud token (scp the local cli.toml; never echo it) — `box watch`
 *      needs it to list/down servers.
 *
 * It does NOT auto-snapshot (see the closing note): snapshotting is left as an
 * explicit next step so the operator can verify the box is healthy + hardened
 * first, then snapshot it as the `effi-mgmt` lineage that `box mgmt up` revives.
 *
 * Secrets stay OUT of instance metadata: the tailscale authkey rides in via the
 * `tailscale up` ssh command (a single ssh arg), and the hcloud token rides in as
 * an scp'd FILE — neither is ever written to cloud-init user-data. Same principle
 * golden-base.ts states for the work boxes.
 */
function mgmtProvisionCommand(): Command {
  return new Command("provision")
    .description("Provision the always-on lean mgmt box from scratch (fresh Ubuntu → tailnet → push-lease units → token)")
    .option("--size <type>", "hcloud server type — the lean mgmt box doesn't need a big disk", MGMT_DEFAULT_SIZE)
    .option("--authkey <key>", "reusable Tailscale auth key (or set BOX_TS_AUTHKEY) — passed over ssh, never into metadata")
    .option("--no-place-token", "skip scp'ing the local hcloud token to the box (place it yourself later)")
    .option("--wait <seconds>", "max seconds to wait for cloud-init first-boot to finish", "240")
    .action((opts: { size: string; authkey?: string; placeToken: boolean; wait: string }) => {
      const prereq = checkPrereqs();
      if (!prereq.ok) {
        console.error(`Error: ${prereq.error}`);
        process.exit(1);
      }

      const cfg = resolveConfig();
      const name = cfg.mgmtName;
      const type = resolveSize({ sizeFlag: opts.size, configType: cfg.type });

      if (!isValidBoxName(name)) {
        console.error(`Error: mgmt box name '${name}' isn't a valid DNS label (lowercase a-z, 0-9, hyphens; <=63 chars).`);
        process.exit(1);
      }
      if (!cfg.sshKeyName) {
        console.error("Error: no ssh key configured. Set BOX_SSH_KEY (or HETZNER_SSH_KEY_NAME) to a registered hcloud ssh-key name.");
        console.error("  Register one: hcloud ssh-key create --name <name> --public-key-from-file ~/.ssh/id_ed25519.pub");
        process.exit(1);
      }

      // The tailscale authkey is a SECRET — read from a flag or env, passed over
      // ssh at `tailscale up` time, NEVER baked into instance metadata. Mint a
      // reusable, non-expiring key in the Tailscale admin console.
      const authkey = (opts.authkey ?? process.env.BOX_TS_AUTHKEY)?.trim();
      if (!authkey) {
        console.error("Error: no Tailscale auth key. Pass --authkey <key> (or set BOX_TS_AUTHKEY).");
        console.error("  Mint a reusable key: Tailscale admin → Settings → Keys. Keep it out of chat/logs.");
        process.exit(1);
      }
      if (!authkey.startsWith("tskey-")) {
        console.error("Error: --authkey doesn't look like a Tailscale auth key (expected to start with 'tskey-').");
        process.exit(1);
      }

      const existing = getServer(name);
      if (existing) {
        console.error(`Error: mgmt box '${name}' already exists at ${serverIp(existing) || "?"}.`);
        console.error("  Provision is for a FROM-SCRATCH box. Use `box mgmt ssh` / `box mgmt up`, or delete it first.");
        process.exit(1);
      }

      // 1. Create the fresh box. cloud-init-mgmt.yaml runs first-boot.
      console.error(`Creating fresh mgmt box '${name}' (${type} @ ${cfg.location}) from ${cfg.baseImage} ...`);
      const create = runHcloud(
        buildCreateServerArgs({
          name,
          type,
          image: cfg.baseImage,
          location: cfg.location,
          sshKey: cfg.sshKeyName,
          label: snapshotSelector(name),
          userDataFile: mgmtCloudInitPath(),
        }),
        { inherit: true },
      );
      if (create.code !== 0) {
        console.error(`Error: hcloud server create failed (exit ${create.code}).`);
        process.exit(create.code);
      }
      const server = getServer(name);
      const ip = serverIp(server);
      cleanHostkey(ip); // fresh instance → fresh host key

      // 2. Wait for cloud-init first-boot to finish (the marker file). We poll
      // over break-glass ssh (public IP) because the box isn't on the tailnet yet.
      const waitS = Math.max(0, Number.parseInt(opts.wait, 10) || 240);
      console.error(`Waiting up to ${waitS}s for cloud-init first-boot (bun/hcloud/tailscale install) ...`);
      const deadline = Date.now() + waitS * 1_000;
      let ready = false;
      // Give sshd a moment to come up before the first probe.
      Bun.sleepSync(15_000);
      while (Date.now() < deadline) {
        const probe = breakGlassExec(name, buildCloudInitDoneCheck(), { inheritOut: false });
        if (probe.code === 0) { ready = true; break; }
        Bun.sleepSync(10_000);
      }
      if (!ready) {
        console.error(`Error: cloud-init didn't finish within ${waitS}s. The box is up at ${ip || "?"};`);
        console.error("  inspect with `hcloud server ssh " + name + "` (check /var/log/cloud-init-output.log),");
        console.error("  then re-run provisioning steps by hand or `box mgmt provision` after deleting it.");
        process.exit(1);
      }
      console.error("cloud-init first-boot done.");

      // 3. Join the tailnet. Authkey passed as a SINGLE ssh arg (not split by
      // ssh's argv-flatten) and never logged. We log the command WITHOUT the key.
      console.error(`Joining the tailnet as '${name}' (tailscale up; authkey passed over ssh, not metadata) ...`);
      const tsCode = breakGlassExec(name, buildTailscaleUpCommand({ name, authkey })).code;
      if (tsCode !== 0) {
        console.error(`Error: tailscale up failed (exit ${tsCode}). The box is up but not on the tailnet.`);
        process.exit(tsCode);
      }

      // 4. Run setup-mgmt.sh: clone the repo + install/enable the push-lease
      // units. The script is STREAMED over ssh stdin (so a fresh box needn't have
      // it yet), with the repo URL as a positional arg. NOTE the private-repo gap
      // below — git auth on the box is the operator's responsibility.
      console.error("Running setup-mgmt.sh (clone repo + install push-lease systemd units) ...");
      const setupBody = readFileSync(setupMgmtScriptPath(), "utf8");
      const setupCode = breakGlassExec(
        name,
        buildRunSetupCommand({ repoUrl: cfg.repoUrl }),
        { stdin: setupBody },
      ).code;
      if (setupCode !== 0) {
        console.error(`Error: setup-mgmt.sh failed (exit ${setupCode}). See the output above.`);
        console.error("  Common cause: the private repo clone needs git auth on the box (gh login / a deploy key).");
        console.error("  Fix auth on the box, then re-run `box mgmt provision` (after deleting this box) or run setup-mgmt.sh by hand.");
        process.exit(setupCode);
      }

      // 5. Place the hcloud token (the mgmt box is the ONE host that holds it).
      // scp the local cli.toml as a FILE — its contents never touch argv/logs.
      if (opts.placeToken) {
        const localToken = localHcloudConfigPath(process.env.HOME);
        if (!existsSync(localToken)) {
          console.error(`Warning: local hcloud token not found at ${localToken} — skipping token placement.`);
          console.error("  Place it yourself so `box watch` can list + down servers:");
          console.error(`    scp ${localToken} dev@${name}:${MGMT_HCLOUD_CONFIG_PATH}  (chmod 600 on the box)`);
          console.error("  Or set HCLOUD_TOKEN in /home/dev/.box/box.env (loaded by box-watch.service).");
        } else {
          console.error("Placing the hcloud token (scp; the token is never echoed) ...");
          cleanHostkey(name); // now on the tailnet — scp by name
          const scp = Bun.spawnSync(["scp", ...buildTokenScpArgs({ name, localPath: localToken })], {
            stdout: "inherit", stderr: "inherit", stdin: "ignore",
          });
          if ((scp.exitCode ?? 1) !== 0) {
            console.error(`Error: scp of the token failed (exit ${scp.exitCode}). Place it by hand (see MGMT.md).`);
            process.exit(scp.exitCode ?? 1);
          }
          // Install it into place + lock to 0600 over the tailnet ssh path.
          cleanHostkey(name);
          const installCode = runSsh(
            buildTailnetSshArgs({ name, command: [wrapBashC(buildTokenInstallCommand())] }),
          ).code;
          if (installCode !== 0) {
            console.error(`Error: installing the token on the box failed (exit ${installCode}). Place it by hand (see MGMT.md).`);
            process.exit(installCode);
          }
          // Restart box-watch so it picks up the now-present token (it may have
          // crash-looped on a missing context before the token landed).
          runSsh(buildTailnetSshArgs({ name, command: [wrapBashC("sudo systemctl restart box-watch.service")] }));
        }
      } else {
        console.error("Skipping token placement (--no-place-token). `box watch` needs it — place it before relying on the reaper:");
        console.error(`  scp ~/.config/hcloud/cli.toml dev@${name}:${MGMT_HCLOUD_CONFIG_PATH}  (chmod 600 on the box)`);
      }

      // Snapshotting is a deliberate, explicit NEXT step (not auto): the operator
      // should verify the box is healthy + harden it (close public :22) BEFORE
      // snapshotting, so the `effi-mgmt` lineage that `box mgmt up` revives ships
      // hardened. Auto-snapshotting here would bake the still-:22-open box.
      console.log("");
      console.log(`Mgmt box '${name}' provisioned and on the tailnet at ${ip || "?"}.`);
      console.log("Push-lease units (box-lease-server, box-watch) installed + enabled.");
      console.log("");
      console.log("Next steps (make it revivable + hardened):");
      console.log(`  1. verify:  box mgmt ssh systemctl is-active box-lease-server box-watch`);
      console.log(`  2. harden:  box mgmt ssh -- sudo bash -s < scripts/hetzner/harden-firewall.sh  (closes public :22; tailnet-only)`);
      console.log(`  3. snapshot the lineage so \`box mgmt up\` can revive it:`);
      console.log(`       hcloud server create-image ${name} --type snapshot --label ${snapshotSelector(name)} --description "mgmt box"`);
    });
}

/**
 * `box mgmt up` — bring the mgmt box up. Mirrors `up.ts`, but spins ONLY from the
 * mgmt box's own snapshot (`role=<mgmtName>-devbox`); there is deliberately no
 * golden-base fallback — the mgmt box is a lean env, not a devbox, and
 * provisioning-from-scratch is a separate interactive step.
 */
function mgmtUpCommand(): Command {
  return new Command("up")
    .description("Recreate the mgmt box from its latest snapshot (fast; no golden-base fallback)")
    // Default to the SAME lean size `provision` used, not the work-box BOX_TYPE
    // (cpx42): the mgmt box is snapshotted as a lean cx22, so reviving it on the
    // heavy work-box default would silently make the always-on box ~6x more
    // expensive than what was provisioned. `--size` still overrides per call.
    .option("--size <type>", "hcloud server type for the mgmt box (default: the lean mgmt size)", MGMT_DEFAULT_SIZE)
    .action((opts: { size?: string }) => {
      const prereq = checkPrereqs();
      if (!prereq.ok) {
        console.error(`Error: ${prereq.error}`);
        process.exit(1);
      }

      const cfg = resolveConfig();
      const name = cfg.mgmtName;
      const type = resolveSize({ sizeFlag: opts.size, configType: cfg.type });

      if (!cfg.sshKeyName) {
        console.error("Error: no ssh key configured. Set BOX_SSH_KEY (or HETZNER_SSH_KEY_NAME) to a registered hcloud ssh-key name.");
        console.error("  Register one: hcloud ssh-key create --name <name> --public-key-from-file ~/.ssh/id_ed25519.pub");
        process.exit(1);
      }

      const existing = getServer(name);
      if (existing) {
        console.log(`mgmt box '${name}' is already up at ${serverIp(existing) || "?"}.`);
        return;
      }

      // Recreate from the mgmt box's OWN snapshot only. No golden-base fallback:
      // the mgmt box is a lean, identity-FUL env (its snapshot captured its joined
      // tailnet node), so it auto-reconnects as the same node — no first-boot
      // user-data, same reasoning as a per-box spin in `up.ts`.
      const snapshot = pickLatestSnapshot(listSnapshots(snapshotSelector(name)));
      if (!snapshot) {
        console.error(`Error: no snapshot for the mgmt box '${name}' (selector ${snapshotSelector(name)}).`);
        console.error("  The mgmt box is a lean env, not a devbox — `box mgmt up` recreates it from its own");
        console.error("  snapshot, it does NOT spin from the golden base. Provision it first (interactive:");
        console.error("  spin a lean host, place the hcloud token, snapshot it), then `box mgmt up` recreates it.");
        process.exit(1);
      }

      console.error(`Spinning mgmt box '${name}' from snapshot ${snapshot.id} (${type} @ ${cfg.location}) ...`);
      const res = runHcloud(
        buildCreateFromSnapshotArgs({
          name,
          type,
          image: snapshot.id,
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
      console.log(`Up at ${ip || "?"}. Connect:`);
      console.log("  box mgmt ssh");
    });
}

/**
 * `box mgmt ssh [command...]` — shell into the mgmt box. Mirrors `ssh.ts`:
 * tailnet-first by name (no hcloud call), hcloud break-glass by IP otherwise.
 */
function mgmtSshCommand(): Command {
  return new Command("ssh")
    .description("Shell into the mgmt box as the dev user — tailnet by name, hcloud break-glass")
    .argument("[command...]", "optional command to run instead of an interactive shell")
    .action((command: string[]) => {
      const cfg = resolveConfig();
      const name = cfg.mgmtName;

      // Tailnet first: `ssh dev@<mgmtName>` over the tailnet. No hcloud call.
      if (tailnetReachable(name)) {
        cleanHostkey(name); // host key churns across `up` — see cleanHostkey
        const res = runSsh(buildTailnetSshArgs({ name, command }));
        process.exit(res.code);
      }

      // Break-glass: not on the tailnet → hcloud server ssh by IP.
      const prereq = checkPrereqs();
      if (!prereq.ok) {
        console.error(`Error: ${prereq.error}`);
        process.exit(1);
      }
      const server = getServer(name);
      if (!server) {
        console.error(`Error: mgmt box '${name}' is down (and not on the tailnet). Run \`box mgmt up\`.`);
        process.exit(1);
      }

      cleanHostkey(serverIp(server));
      const res = runHcloud(["server", "ssh", name, "-u", "dev", ...command], { inherit: true });
      process.exit(res.code);
    });
}

/**
 * `box mgmt status` — thin: is the mgmt box up, and how many snapshots back it.
 * Deliberately minimal (no cost/tailnet-hygiene rollup; that's `box status`).
 */
function mgmtStatusCommand(): Command {
  return new Command("status")
    .description("Show whether the mgmt box is up + its snapshot count")
    .action(() => {
      const prereq = checkPrereqs();
      if (!prereq.ok) {
        console.error(`Error: ${prereq.error}`);
        process.exit(1);
      }

      const cfg = resolveConfig();
      const name = cfg.mgmtName;
      const server = getServer(name);
      const snapshots = listSnapshots(snapshotSelector(name));
      const snaps = `${snapshots.length} snap${snapshots.length === 1 ? "" : "s"}`;

      console.log(`=== mgmt box: ${name} ===`);
      if (server) {
        console.log(`  ${server.server_type?.name ?? "?"}  ${server.status}  ${serverIp(server) || "?"}  ${server.datacenter?.name ?? "?"}  ${snaps}`);
      } else {
        console.log(`  down (snapshot only)  ${snaps} — \`box mgmt up\` to revive.`);
      }
    });
}

/**
 * Resolve a `--port` flag to a valid TCP port, failing loud on garbage. Garbage
 * (non-numeric, zero, negative, trailing junk, out of the 1–65535 range) must NOT
 * fall through to a broken or surprising `Bun.serve` — the operator typed a port;
 * if it can't be one, say so and exit. The flag path exits (the operator is
 * present and an explicit bad flag deserves a hard stop); the env path in
 * `resolveConfig` fails soft to the default. Both share `parsePort` so the
 * notion of "valid port" can never drift between them — including the trap that
 * `Bun.serve({ port: 70000 })` does NOT throw but silently CLAMPS to 65535.
 */
function requirePort(raw: string): number {
  const port = parsePort(raw);
  if (port === null) {
    console.error(`Error: invalid --port '${raw}' — expected an integer in 1–65535.`);
    process.exit(1);
  }
  return port;
}

/**
 * `box mgmt lease-server` — run the always-on push-lease HTTP server on the mgmt
 * box (slice 7, push model). Work boxes that are actively working renew their
 * lease by curling this server; it records each renewal in the persisted lease
 * store, and `box watch`'s reaper reads that store to decide keep/down. Mgmt
 * never SSHes into a work box — the inside reports out. See `lease-server.ts`.
 *
 * No auth, by design: the security boundary is the network, not the request. A
 * hardened box only accepts traffic over the tailnet (`harden-firewall.sh`), so
 * only tailnet peers can reach this port — same trust model as serve-static.
 * Run it ONLY on the lean mgmt box behind the tailnet; never on a public
 * interface.
 *
 * Long-running: `Bun.serve` keeps the process alive. SIGINT/SIGTERM stop the
 * server and exit cleanly (mirrors `box watch`'s signal handling).
 */
function mgmtLeaseServerCommand(): Command {
  return new Command("lease-server")
    .description("Run the push-lease HTTP server on the mgmt box (no auth; tailnet-only)")
    .option("--port <n>", "TCP port to listen on, overriding BOX_LEASE_PORT")
    .option("--store <path>", "path to the lease store JSON, overriding BOX_LEASE_STORE")
    .action((opts: { port?: string; store?: string }) => {
      const cfg = resolveConfig();
      const port = opts.port !== undefined ? requirePort(opts.port) : cfg.leasePort;
      const storePath = opts.store ?? cfg.leaseStorePath;

      const server = serveLease({ port, storePath });

      console.error(`box mgmt lease-server — listening on :${port}, store ${storePath}`);
      console.error(
        `Work boxes renew at http://${cfg.mgmtName}:${port}/lease/renew?box=<self>`,
      );

      // Long-running: Bun.serve holds the process open. Stop cleanly on a signal
      // so the socket is released and the process exits with success — mirrors
      // `box watch`'s SIGINT/SIGTERM handling.
      const stop = (): void => {
        console.error("\nbox mgmt lease-server stopping.");
        server.stop();
        process.exit(0);
      };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
    });
}
