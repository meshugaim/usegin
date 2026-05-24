import { Command } from "commander";
import { statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { resolveConfig, parsePort } from "../lib/config";
import { parseDuration, formatDuration } from "../lib/duration";
import { hasRecentActivity, buildRenewUrl } from "../lib/renew";

/**
 * `box renew` — the in-container push-lease renew daemon (slice 3 of the
 * push-lease bake). Runs INSIDE a work box's devcontainer. Each pass it asks one
 * question — is Claude actively working? — by the same signal as
 * `tools/bin/ona-keep-alive-while-claude-working`: a JSONL write under
 * `~/.claude/projects` within the buffer window. If active, it pushes a lease
 * renewal to the mgmt box's lease server (`http://<mgmt>:<port>/lease/renew?box=`);
 * if idle, it does nothing and lets the lease lapse. The mgmt reaper (`box watch`)
 * later downs the box once its lease has been quiet long enough.
 *
 * Token-free: no hcloud, no checkPrereqs — a work box never holds the hcloud
 * token. The only thing it needs to know is who it is (its tailnet name) and where
 * to push (the mgmt box + lease port).
 *
 * **Bias against false-down, end to end.** A fetch failure or a missing projects
 * dir must NOT kill the daemon — a transient mgmt blip or a momentary fs hiccup
 * would otherwise stop renewals and let `box watch` down a live box. So every pass
 * swallows its own errors (log + continue); the only fatal error is not knowing
 * the box's own name, which is a config error caught before the loop starts.
 */
export function renewCommand(): Command {
  return new Command("renew")
    .description("In-container daemon: renew this box's lease while Claude is actively working")
    .option("--box <name>", "this box's name (default: $BOX_TAILNET_NAME, the box's tailnet/MagicDNS name)")
    .option("--mgmt <name>", "mgmt box to renew against (default: config BOX_MGMT_NAME)")
    .option("--port <n>", "lease-server port on the mgmt box (default: config BOX_LEASE_PORT)")
    .option("--buffer <dur>", "activity window: a JSONL write newer than this means 'working'", "10m")
    .option("--interval <dur>", "time between renew passes", "60s")
    .option("--projects <dir>", "Claude projects dir to scan for JSONL activity", join(homedir(), ".claude", "projects"))
    .option("--once", "run a single pass and exit (cron-friendly; no daemon loop)")
    .action(async (opts: {
      box?: string; mgmt?: string; port?: string;
      buffer: string; interval: string; projects: string; once?: boolean;
    }) => {
      const cfg = resolveConfig();

      // Identity: who am I? Without a box name there is nothing to renew, and a
      // wrong/empty name would silently renew the wrong (or no) box's lease — the
      // exact false-down we guard against. So fail loud rather than guess.
      const box = (opts.box ?? process.env.BOX_TAILNET_NAME ?? "").trim();
      if (!box) {
        console.error(
          "Error: can't renew — this box's name is unknown.\n" +
          "Set $BOX_TAILNET_NAME (box work/container.sh inject it) or pass --box <name>.",
        );
        process.exit(1);
        return;
      }

      // Target: where to push. mgmt + port from config, overridable. --port goes
      // through parsePort and fails loud on garbage (config is ambient → soft;
      // a flag is explicit → loud, matching mgmt's lease-server convention).
      const mgmtName = opts.mgmt?.trim() || cfg.mgmtName;
      let port = cfg.leasePort;
      if (opts.port !== undefined) {
        const p = parsePort(opts.port);
        if (p === null) {
          console.error(`Error: invalid --port "${opts.port}" — expected a TCP port (1–65535).`);
          process.exit(1);
          return;
        }
        port = p;
      }

      // Parse durations up front so a typo fails loud before the daemon starts
      // (a "30" buffer that silently meant 30ms would never read as active).
      let bufferMs: number;
      let intervalMs: number;
      try {
        bufferMs = parseDuration(opts.buffer);
        intervalMs = parseDuration(opts.interval);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
        return;
      }

      // The base URL (sans ?box=) for the banner — don't leak the box into the
      // banner twice; it's printed on its own line.
      const targetBase = `http://${mgmtName}:${port}/lease/renew`;

      // Cap how long a single renew fetch may block. WITHOUT this, a black-holed
      // mgmt (connection accepted but never answered — e.g. a half-open socket
      // after a mgmt restart) leaves `fetch` pending forever; the daemon wedges
      // inside one pass, never sleeps, never renews again, and `box watch` reaps a
      // live box. A reject we already survive (the catch below); an infinite hang
      // we don't — the timeout converts the hang into a catchable AbortError so the
      // loop keeps breathing. Bound by the interval so a pass can't outlive its own
      // cadence, floored at 1s and capped at 15s for sane defaults at any interval.
      const fetchTimeoutMs = Math.max(1_000, Math.min(intervalMs, 15_000));

      console.error(
        `box renew — box '${box}', target ${targetBase}, buffer ${formatDuration(bufferMs)}, ` +
        `${opts.once ? "single pass" : `every ${formatDuration(intervalMs)}`}.`,
      );
      console.error(`Scanning ${opts.projects} for *.jsonl activity.`);

      // The buffer must outlast the renew interval, or the box can read 'idle'
      // between two renews while work is genuinely ongoing (a long tool call writes
      // no JSONL mid-tool — see ona-keep-alive's same caveat). Warn, don't fail:
      // a tight interval is unusual but not wrong, and the operator may know better.
      if (bufferMs < intervalMs) {
        console.error(
          `Warning: buffer (${formatDuration(bufferMs)}) < interval (${formatDuration(intervalMs)}). ` +
          "A pass may read 'idle' between renews mid-work; set buffer >= interval, and the reaper's idle window > buffer.",
        );
      }

      // One pass: collect JSONL mtimes, gate on recency, renew iff active. Never
      // throws — a missing projects dir or a fetch failure logs and returns so the
      // loop survives a transient blip (see the false-down note above).
      const runPass = async (): Promise<void> => {
        const now = new Date();
        const mtimes = collectJsonlMtimes(opts.projects);

        if (!hasRecentActivity(mtimes, now, bufferMs)) {
          console.error(`[${now.toISOString()}] idle — not renewing (no JSONL write in last ${formatDuration(bufferMs)}).`);
          return;
        }

        const url = buildRenewUrl({ mgmtName, port, box });
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(fetchTimeoutMs) });
          if (res.ok) {
            console.error(`[${now.toISOString()}] active — renewed lease for '${box}' (HTTP ${res.status}).`);
          } else {
            // A non-2xx (e.g. 400 missing-box, 5xx mgmt error) is NOT a renewal —
            // surface it loudly so a misconfigured target doesn't masquerade as a
            // silent success while the lease quietly lapses.
            console.error(`[${now.toISOString()}] active — renew got HTTP ${res.status} from mgmt; will retry next pass.`);
          }
        } catch (err) {
          // Transient: mgmt down/unreachable, DNS fail, or our own fetch timeout
          // (AbortError) firing on a black-holed connection. Log and continue — do
          // NOT crash the daemon, or one blip stops all future renewals and the box
          // gets reaped. The timeout is what keeps a hang from wedging the loop.
          const reason = err instanceof DOMException && err.name === "TimeoutError"
            ? `timed out after ${formatDuration(fetchTimeoutMs)}`
            : err instanceof Error ? err.message : String(err);
          console.error(`[${now.toISOString()}] active — renew failed (${reason}); will retry next pass.`);
        }
      };

      if (opts.once) {
        await runPass();
        return;
      }

      // Daemon loop. SIGINT/SIGTERM exit cleanly between passes (a pass itself runs
      // to completion), mirroring `box watch`.
      let running = true;
      process.on("SIGINT", () => { running = false; console.error("\nbox renew stopping."); });
      process.on("SIGTERM", () => { running = false; });
      while (running) {
        await runPass();
        if (!running) break;
        await Bun.sleep(intervalMs);
      }
    });
}

/**
 * IO: collect mtimes of every `*.jsonl` under `projectsDir`, recursively (Claude
 * JSONL live in per-project subdirs). Returns `[]` — never throws — when the dir
 * is missing or a file vanishes mid-scan, so the caller's recency gate reads it as
 * "idle" rather than crashing the daemon. Thin by design; the recency decision is
 * the pure `hasRecentActivity`.
 */
function collectJsonlMtimes(projectsDir: string): Date[] {
  const mtimes: Date[] = [];
  try {
    const glob = new Bun.Glob("**/*.jsonl");
    for (const rel of glob.scanSync({ cwd: projectsDir, onlyFiles: true })) {
      try {
        mtimes.push(statSync(join(projectsDir, rel)).mtime);
      } catch {
        // File vanished between scan and stat (a session rotated/deleted it).
        // Skip it — its absence just means it doesn't count toward activity.
      }
    }
  } catch {
    // Projects dir missing or unreadable → no activity signal. Safe direction:
    // reads as idle; we don't renew, and we don't crash.
  }
  return mtimes;
}
