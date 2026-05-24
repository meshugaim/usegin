import { Command } from "commander";
import { resolveConfig } from "../lib/config";
import { checkPrereqs, listServers } from "../lib/hcloud";
import { readActivity } from "../lib/activity";
import { snapshotAndDeleteServer } from "../lib/down";
import { parseDuration, formatDuration } from "../lib/duration";
import {
  planWatch, formatWatchReport, boxesToDown, type WatchEntry,
} from "../lib/watch";
import type { LeasePolicy } from "../lib/lease";

/**
 * `box watch` — the cost-safety daemon (slice 7). Each pass: list running boxes,
 * read each one's activity over the tailnet, and apply the lease/hard-cap rules
 * (`decideLeaseAction`) — renewing the lease for active boxes and `box down`ing
 * the idle/expired ones. It is the backstop that makes "boxes don't bill forever"
 * true even when someone forgets to `box down`.
 *
 * Designed to run on the always-on mgmt box (it holds the token); the mgmt box is
 * ALWAYS excluded so the watcher can't down itself. Bias is hard against
 * false-down: a box whose activity can't be read is never idle-downed (only the
 * hard cap can touch it), and `--dry-run` lets you watch the decisions without
 * acting.
 */
export function watchCommand(): Command {
  return new Command("watch")
    .description("Cost-safety daemon: down idle boxes after an idle window + a hard-cap TTL")
    .option("--idle <dur>", "down a box after this much inactivity", "30m")
    .option("--ttl <dur>", "hard cap: down a box after this much uptime regardless of activity (default: none)")
    .option("--interval <dur>", "time between watch passes", "60s")
    .option("--once", "run a single pass and exit (cron-friendly; no daemon loop)")
    .option("--dry-run", "report decisions but never actually down a box")
    .option("--exclude <names>", "comma-separated box names to never auto-down (the mgmt box is always excluded)")
    .action(async (opts: {
      idle: string; ttl?: string; interval: string;
      once?: boolean; dryRun?: boolean; exclude?: string;
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

      // Startup banner — make it obvious what this run will (and won't) do.
      const ttlNote = policy.hardCapMs != null ? formatDuration(policy.hardCapMs) : "none (idle-only)";
      console.error(
        `box watch — idle ${formatDuration(policy.idleMs)}, hard-cap ${ttlNote}, ` +
        `${opts.once ? "single pass" : `every ${formatDuration(intervalMs)}`}` +
        `${opts.dryRun ? ", DRY-RUN (no downs)" : ""}.`,
      );
      console.error(`Excluded (never auto-downed): ${exclude.join(", ")}`);
      if (policy.hardCapMs == null) {
        console.error("Note: no --ttl, so a box with unreadable activity will never be downed. Set --ttl for a backstop.");
      }

      const runPass = (): void => {
        const now = new Date();
        const servers = listServers().filter((s) => s.status === "running");

        const entries: WatchEntry[] = servers.map((s) => {
          const upSince = s.created ?? now.toISOString();
          // Skip the SSH probe for excluded boxes — planWatch force-keeps them
          // anyway, so probing the mgmt box every pass would be wasted work.
          if (exclude.includes(s.name)) {
            return { name: s.name, upSince, lastActivity: null, detail: "excluded — not probed" };
          }
          const activity = readActivity(s.name, now);
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
