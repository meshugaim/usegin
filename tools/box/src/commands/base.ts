import { Command } from "commander";
import { readFileSync } from "node:fs";
import { buildTailnetSshArgs, checkPrereqs, getServer, runHcloud, tailnetReachable } from "../lib/hcloud";
import {
  GOLDEN_BASE_AUTHKEY_PATH, buildGoldenSnapshotArgs, planGoldenFinalize, type FinalizeStep,
} from "../lib/golden-base";

/**
 * Run a command on the box over SSH — tailnet-first (by name), hcloud
 * break-glass otherwise. `stdin` pipes a payload to the remote command WITHOUT
 * it landing in argv (so a secret never shows up in a process list or log).
 */
function sshExec(name: string, remoteCmd: string, stdin?: string): number {
  const argv = tailnetReachable(name)
    ? ["ssh", ...buildTailnetSshArgs({ name, command: ["bash", "-lc", remoteCmd] })]
    : ["hcloud", "server", "ssh", name, "-u", "dev", "bash", "-lc", remoteCmd];
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
    .action((box: string, opts: { authkeyFile?: string; dryRun?: boolean; yes?: boolean }) => {
      const name = box.trim();
      const steps = planGoldenFinalize(name);

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

      run("bake-key", `sudo mkdir -p ${dirname(GOLDEN_BASE_AUTHKEY_PATH)} && sudo install -m 600 /dev/stdin ${GOLDEN_BASE_AUTHKEY_PATH}`, `${key}\n`);
      run("harden", "sudo bash -s", readFileSync(hardenScriptPath(), "utf8"));
      run("logout", "sudo tailscale logout");

      console.error("\n→ Snapshot the golden base (via hcloud API; box is now unreachable, which is fine) ...");
      const snap = runHcloud(
        buildGoldenSnapshotArgs({
          name,
          description: `slice4 golden base (identity-less) ${new Date().toISOString().replace(/\.\d+Z$/, "Z")}`,
        }),
        { inherit: true },
      );
      if (snap.code !== 0) {
        console.error(`Error: snapshot failed (exit ${snap.code}). The box is logged out + hardened but NOT snapshotted.`);
        process.exit(snap.code);
      }

      console.log("");
      console.log(`Golden base created from '${name}' (label purpose=golden-base, logged OUT of the tailnet).`);
      console.log("A box spun from it self-joins the tailnet on first boot under its own name.");
      console.log(`This build box is now unreachable (identity scrubbed) — \`box down ${name}\` / hcloud to delete it.`);
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

export function baseCommand(): Command {
  return new Command("base")
    .description("Layer-0 golden base — the identity-less image new boxes spin from")
    .addCommand(finalizeCommand());
}
