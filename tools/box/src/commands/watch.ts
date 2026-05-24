import { Command } from "commander";
import { resolveConfig } from "../lib/config";
import { checkPrereqs, listServers } from "../lib/hcloud";
import { readLeaseStore } from "../lib/lease-store";
import { snapshotAndDeleteServer } from "../lib/down";
import { parseDuration, formatDuration } from "../lib/duration";
import {
  planWatch, formatWatchReport, boxesToDown, leaseWatchActivity, type WatchEntry,
} from "../lib/watch";
import type { LeasePolicy } from "../lib/lease";

/**
 * `box watch` — the cost-safety daemon (slice 7, push-lease model). Each pass:
 * list running boxes, read each one's last lease renewal from the persisted lease
 * store, and apply the lease/hard-cap rules (`decideLeaseAction`) — keeping boxes
 * with a live lease and `box down`ing the idle/expired ones. It is the backstop
 * that makes "boxes don't bill forever" true even when someone forgets to `box
 * down`.
 *
 * **Push, not pull.** The watcher no longer SSH-probes each box. Instead every
 * working box pushes "I'm alive" to the mgmt box (`box renew` → `box mgmt
 * lease-server`), which records the renewal in the lease store; this reaper reads
 * that store (`cfg.leaseStorePath`, or `--store`) to decide keep/down. So mgmt
 * never reaches INTO a work box — the inside reports out, and a work box needs no
 * token. The reaper is a READER of the store; the lease-server is its single
 * writer.
 *
 * Designed to run on the always-on mgmt box (it holds the token); the mgmt box is
 * ALWAYS excluded so the watcher can't down itself. Bias is hard against
 * false-down: a box with no (or only a stale, pre-boot) lease is never
 * idle-downed (only the hard cap can touch it), and `--dry-run` lets you watch
 * the decisions without acting.
 */
export function watchCommand(): Command {
  return new Command("watch")
    .description("Cost-safety daemon: down idle boxes (reads the push-lease store) after an idle window + a hard-cap TTL")
    .option("--idle <dur>", "down a box after this much inactivity", "30m")
    .option("--ttl <dur>", "hard cap: down a box after this much uptime regardless of activity (default: none)")
    .option("--interval <dur>", "time between watch passes", "60s")
    .option("--once", "run a single pass and exit (cron-friendly; no daemon loop)")
    .option("--dry-run", "report decisions but never actually down a box")
    .option("--exclude <names>", "comma-separated box names to never auto-down (the mgmt box is always excluded)")
    .option("--store <path>", "path to the lease store JSON, overriding BOX_LEASE_STORE (point at the same file as lease-server)")
    .action(async (opts: {
      idle: string; ttl?: string; interval: string;
      once?: boolean; dryRun?: boolean; exclude?: string; store?: string;
    }) => {
      const prereq = checkPrereqs();
      if (!prereq.ok) {
        console.error(`Error: ${prereq.error}`);
        process.exit(1);
      }

      // Parse durations up front so a typo fails loud before the daemon starts.
      let policy: LeasePolicy;
      let intervalMs: number;
      try {
        policy = {
          idleMs: parseDuration(opts.idle),
          hardCapMs: opts.ttl ? parseDuration(opts.ttl) : null,
        };
        intervalMs = parseDuration(opts.interval);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
        return;
      }

      const cfg = resolveConfig();
      // The mgmt box is the watcher's home — excluding it is non-negotiable, so it
      // is baked in regardless of --exclude (which adds further opt-outs).
      const userExcludes = (opts.exclude ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const exclude = [...new Set([cfg.mgmtName, ...userExcludes])];
      // Reader of the push-lease store written by `box mgmt lease-server`. --store
      // overrides config so the reaper and server can be pointed at the same file.
      const storePath = opts.store ?? cfg.leaseStorePath;

      // Startup banner — make it obvious what this run will (and won't) do.
      const ttlNote = policy.hardCapMs != null ? formatDuration(policy.hardCapMs) : "none (idle-only)";
      console.error(
        `box watch — idle ${formatDuration(policy.idleMs)}, hard-cap ${ttlNote}, ` +
        `${opts.once ? "single pass" : `every ${formatDuration(intervalMs)}`}` +
        `${opts.dryRun ? ", DRY-RUN (no downs)" : ""}.`,
      );
      console.error(`Reading lease store ${storePath} (written by 'box mgmt lease-server'; work boxes keep alive via 'box renew').`);
      console.error(`Excluded (never auto-downed): ${exclude.join(", ")}`);
      if (policy.hardCapMs == null) {
        console.error("Note: no --ttl, so a box with no (or only a stale) lease will never be downed. Set --ttl for a backstop.");
      }

      const runPass = (): void => {
        const now = new Date();
        const servers = listServers().filter((s) => s.status === "running");
        // Read the store ONCE per pass. box watch is a READER only — the
        // lease-server is the store's single writer; the reaper must never write.
        const store = readLeaseStore(storePath);

        const entries: WatchEntry[] = servers.map((s) => {
          const upSince = s.created ?? now.toISOString();
          // Skip the lease lookup for excluded boxes — planWatch force-keeps them
          // anyway, so reading the mgmt box's lease every pass would be wasted work.
          if (exclude.includes(s.name)) {
            return { name: s.name, upSince, lastActivity: null, detail: "excluded — not checked" };
          }
          const activity = leaseWatchActivity(store, s.name, upSince);
          return { name: s.name, upSince, lastActivity: activity.lastActivity, detail: activity.detail };
        });

        const decisions = planWatch(entries, policy, now, { exclude });
        console.error(`\n[${now.toISOString()}] watch pass — ${servers.length} running:`);
        console.error(formatWatchReport(decisions));

        for (const name of boxesToDown(decisions)) {
          if (opts.dryRun) {
            console.error(`  [dry-run] would down '${name}'.`);
            continue;
          }
          const res = snapshotAndDeleteServer(name);
          console.error(res.ok ? `  Downed '${name}'.` : `  FAILED to down '${name}': ${res.error}`);
        }
      };

      if (opts.once) {
        runPass();
        return;
      }

      // Daemon loop. Ctrl-C exits between passes; a pass itself runs to completion
      // so we never leave a box half-torn-down.
      let running = true;
      process.on("SIGINT", () => { running = false; console.error("\nbox watch stopping."); });
      process.on("SIGTERM", () => { running = false; });
      while (running) {
        runPass();
        if (!running) break;
        await Bun.sleep(intervalMs);
      }
    });
}
