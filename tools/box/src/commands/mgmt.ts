import { Command } from "commander";
import { parsePort, resolveConfig, snapshotSelector } from "../lib/config";
import {
  buildCreateFromSnapshotArgs, buildTailnetSshArgs, checkPrereqs, cleanHostkey,
  getServer, listSnapshots, pickLatestSnapshot, resolveSize, runHcloud, runSsh,
  serverIp, tailnetReachable,
} from "../lib/hcloud";
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

  mgmt.addCommand(mgmtUpCommand());
  mgmt.addCommand(mgmtSshCommand());
  mgmt.addCommand(mgmtStatusCommand());
  mgmt.addCommand(mgmtLeaseServerCommand());
  return mgmt;
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
    .option("--size <type>", "hcloud server type for the mgmt box, overriding BOX_TYPE (e.g. cpx11)")
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
