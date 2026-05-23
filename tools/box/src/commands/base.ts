import { Command } from "commander";
import { readFileSync } from "node:fs";
import {
  buildBreakGlassArgs, buildTailnetSshArgs, checkPrereqs, getServer, runHcloud, tailnetReachable,
} from "../lib/hcloud";
import {
  BOX_REPO_DIR, FINALIZE_SCRUB_WAIT_S, GOLDEN_BASE_AUTHKEY_PATH, buildFinalizeLogoutCommand,
  buildGoldenSnapshotArgs, buildRebuildContainerCommand, planGoldenFinalize, wrapBashC,
  type FinalizeStep,
} from "../lib/golden-base";

/**
 * Run a command on the box over SSH — tailnet-first (by name), hcloud
 * break-glass otherwise. `stdin` pipes a payload to the remote command WITHOUT
 * it landing in argv (so a secret never shows up in a process list or log).
 *
 * The command goes over as a SINGLE arg (`wrapBashC`) so ssh's argv-flattening
 * doesn't shred a multi-word command — see wrapBashC.
 */
function sshExec(name: string, remoteCmd: string, stdin?: string): number {
  const remote = wrapBashC(remoteCmd);
  const argv = tailnetReachable(name)
    ? ["ssh", ...buildTailnetSshArgs({ name, command: [remote] })]
    : ["hcloud", ...buildBreakGlassArgs({ name, command: [remote] })];
  const proc = Bun.spawnSync(argv, {
    stdin: stdin !== undefined ? new TextEncoder().encode(stdin) : "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return proc.exitCode ?? 1;
}

function printPlan(name: string, steps: FinalizeStep[]): void {
  console.log(`Finalize '${name}' → identity-less golden base:`);
  steps.forEach((s, i) => {
    const flag = s.irreversible ? "  ⚠ irreversible" : "";
    console.log(`  ${i + 1}. [${s.kind}] ${s.title}${flag}`);
    console.log(`       ${s.detail}`);
  });
}

function finalizeCommand(): Command {
  return new Command("finalize")
    .description("Turn a working, logged-in build box into the identity-less golden base (logout + harden + snapshot)")
    .argument("<box>", "the build box to finalize (e.g. slice3-tailscale) — required, no default")
    .option("--authkey-file <path>", "file holding the reusable, non-expiring Tailscale auth key (or set BOX_TS_AUTHKEY_FILE)")
    .option("--dry-run", "print the plan without executing anything")
    .option("--yes", "skip the irreversible-step confirmation (logout makes the box unreachable)")
    .option("--skip-harden", "leave public :22 OPEN (NOT hardened) — bake a reachable base to prove the flow; re-finalize without this for production")
    .action((box: string, opts: { authkeyFile?: string; dryRun?: boolean; yes?: boolean; skipHarden?: boolean }) => {
      const name = box.trim();
      const steps = planGoldenFinalize(name, { skipHarden: opts.skipHarden });

      if (opts.dryRun) {
        printPlan(name, steps);
        console.log("\n(dry run — nothing executed)");
        return;
      }

      const prereq = checkPrereqs();
      if (!prereq.ok) {
        console.error(`Error: ${prereq.error}`);
        process.exit(1);
      }
      if (!getServer(name)) {
        console.error(`Error: no running box '${name}' to finalize. \`box status\` lists boxes.`);
        process.exit(1);
      }

      // The reusable key is baked onto the box (not into instance metadata), so a
      // box spun from the base can self-join the tailnet on first boot. Mint it in
      // the Tailscale admin console (reusable + non-expiring + non-ephemeral) and
      // save it to a file — never paste it where it lands in a transcript/log.
      const keyFile = opts.authkeyFile ?? process.env.BOX_TS_AUTHKEY_FILE;
      if (!keyFile) {
        console.error("Error: no auth key. Pass --authkey-file <path> (or set BOX_TS_AUTHKEY_FILE).");
        console.error("  Mint a reusable, non-expiring, non-ephemeral key: Tailscale admin → Settings → Keys.");
        console.error("  Save it to a file (keep it out of chat/logs), then re-run with --authkey-file.");
        process.exit(1);
      }
      let key: string;
      try {
        key = readFileSync(keyFile, "utf8").trim();
      } catch {
        console.error(`Error: could not read auth key file '${keyFile}'.`);
        process.exit(1);
      }
      if (!key.startsWith("tskey-")) {
        console.error(`Error: '${keyFile}' doesn't look like a Tailscale auth key (expected to start with 'tskey-').`);
        process.exit(1);
      }

      if (!opts.yes && process.env.BOX_YES !== "1") {
        console.error("Refusing to finalize without confirmation: step 3 (tailscale logout) makes this box");
        console.error("unreachable. The snapshot preserves its state; re-run with --yes once you're ready.");
        process.exit(1);
      }

      const run = (id: FinalizeStep["id"], remoteCmd: string, stdin?: string) => {
        const step = steps.find((s) => s.id === id)!;
        console.error(`\n→ ${step.title} ...`);
        const code = sshExec(name, remoteCmd, stdin);
        if (code !== 0) {
          console.error(`Error: step '${id}' failed (exit ${code}). Stopping — the box is untouched past this point.`);
          process.exit(code);
        }
      };

      // tee + chmod, NOT `install -m 600 /dev/stdin`: under sudo the latter fails
      // to read the piped key (verified on a throwaway — it errored with a sudo
      // usage message and wrote nothing). tee reads stdin reliably as root.
      run("bake-key", `sudo mkdir -p ${dirname(GOLDEN_BASE_AUTHKEY_PATH)} && sudo tee ${GOLDEN_BASE_AUTHKEY_PATH} >/dev/null && sudo chmod 600 ${GOLDEN_BASE_AUTHKEY_PATH} && sudo test -s ${GOLDEN_BASE_AUTHKEY_PATH}`, `${key}\n`);
      // Firewall step: harden (close :22) for production, or actively re-open :22
      // for the reachable "prove-first" base (a box from a hardened base inherits
      // :22 closed, so skipping isn't enough — we must allow it back).
      if (opts.skipHarden) {
        run("open-ssh", "sudo ufw allow OpenSSH");
      } else {
        run("harden", "sudo bash -s", readFileSync(hardenScriptPath(), "utf8"));
      }

      // Logout + wiping tailscaled state drops the tailnet, which kills our own
      // SSH session — running it synchronously ALWAYS returns a broken-pipe
      // failure even though it worked (this bit us live). So the command SCHEDULES
      // itself a few seconds out via systemd-run: the ssh call returns 0 first,
      // then the scrub fires after we've disconnected. The state wipe (not just
      // `tailscale logout`) is load-bearing — see buildFinalizeLogoutCommand.
      const logoutStep = steps.find((s) => s.id === "logout")!;
      console.error(`\n→ ${logoutStep.title} (scheduled; it severs our own connection) ...`);
      const lc = sshExec(name, buildFinalizeLogoutCommand());
      if (lc !== 0) {
        console.error(`Error: scheduling logout failed (exit ${lc}). Stopping — box untouched past harden.`);
        process.exit(lc);
      }
      console.error(`  waiting ~${FINALIZE_SCRUB_WAIT_S}s for the scrub (logout + state wipe) to finish before snapshotting ...`);
      Bun.sleepSync(FINALIZE_SCRUB_WAIT_S * 1_000);
      if (tailnetReachable(name)) {
        console.error(`Warning: '${name}' still resolves on the tailnet after logout — the snapshot may not be`);
        console.error("identity-less. Verify with slice 5 (spin two boxes; they must get distinct nodes).");
      }

      const stamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
      const description = opts.skipHarden
        ? `slice4 golden base (identity-less, :22 OPEN — UNHARDENED) ${stamp}`
        : `slice4 golden base (identity-less) ${stamp}`;
      console.error("\n→ Snapshot the golden base (via hcloud API) ...");
      const snap = runHcloud(buildGoldenSnapshotArgs({ name, description }), { inherit: true });
      if (snap.code !== 0) {
        const fw = opts.skipHarden ? ":22 left open" : "hardened";
        console.error(`Error: snapshot failed (exit ${snap.code}). The box is logged out + ${fw} but NOT snapshotted.`);
        process.exit(snap.code);
      }

      console.log("");
      console.log(`Golden base created from '${name}' (label purpose=golden-base, logged OUT of the tailnet).`);
      console.log("A box spun from it self-joins the tailnet on first boot under its own name.");
      if (opts.skipHarden) {
        console.log("⚠ This base is NOT hardened — public :22 is OPEN on it and on every box spun from it.");
        console.log(`  Prove the spin→join→work flow, then re-finalize WITHOUT --skip-harden for production.`);
        console.log(`  This build box stays reachable by public IP — \`box down ${name}\` / hcloud to delete it.`);
      } else {
        console.log(`This build box is now unreachable (identity scrubbed) — \`box down ${name}\` / hcloud to delete it.`);
      }
    });
}

/** Directory of a path (avoids a node:path import for one use). */
function dirname(p: string): string {
  return p.slice(0, p.lastIndexOf("/")) || "/";
}

/** Absolute path to the canonical firewall-hardening script in this repo. */
function hardenScriptPath(): string {
  return new URL("../../../../scripts/hetzner/harden-firewall.sh", import.meta.url).pathname;
}

function rebuildContainerCommand(): Command {
  return new Command("rebuild-container")
    .description("Recreate the build box's devcontainer from the CURRENT devcontainer.json (pulls repo first) — picks up create-time changes (appPort, mounts) a running container can't. Wipes in-container creds → re-login, then `box base finalize`.")
    .argument("<box>", "the build box to rebuild the devcontainer on")
    .option("--repo-dir <path>", "repo checkout path on the box", BOX_REPO_DIR)
    .option("--no-pull", "skip `git pull --ff-only` (use the box's current checkout as-is)")
    .action((box: string, opts: { repoDir: string; pull: boolean }) => {
      const name = box.trim();

      // SSH is tailnet-first (no token needed). Only the break-glass path needs
      // the hcloud token + a running server, so guard those only when off-tailnet.
      if (!tailnetReachable(name)) {
        const prereq = checkPrereqs();
        if (!prereq.ok) {
          console.error(`Error: '${name}' is not on the tailnet and ${prereq.error}`);
          process.exit(1);
        }
        if (!getServer(name)) {
          console.error(`Error: no running box '${name}' to rebuild. \`box status\` lists boxes.`);
          process.exit(1);
        }
      }

      console.error(`→ Recreating the devcontainer on '${name}' from its current devcontainer.json ...`);
      console.error("  (this DELETES the container — in-container creds will be wiped.)");
      const code = sshExec(name, buildRebuildContainerCommand({ repoDir: opts.repoDir, pull: opts.pull }));
      if (code !== 0) {
        console.error(`Error: rebuild failed (exit ${code}). The box's container may be in a partial state — re-run, or rebuild by hand with \`cont rebuild\`.`);
        process.exit(code);
      }

      console.log("");
      console.log(`Container on '${name}' recreated from the current devcontainer.json (appPort / mounts now live).`);
      console.log("In-container creds were wiped. Next:");
      console.log(`  1. re-login inside the container: gh auth login · claude setup-token · doppler login`);
      console.log(`  2. \`box base finalize ${name}\` to snapshot the fresh, logged-in container as the golden base.`);
    });
}

export function baseCommand(): Command {
  return new Command("base")
    .description("Layer-0 golden base — the identity-less image new boxes spin from")
    .addCommand(rebuildContainerCommand())
    .addCommand(finalizeCommand());
}
