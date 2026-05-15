/**
 * PM2 Ecosystem configuration for session-sync.
 *
 * The daemon watches `~/.claude/projects/*` and uploads idle JSONL
 * sessions to Supabase via `/api/v1/dev-sessions/*`. One per developer
 * environment (local-devcontainer, codespaces, gitpod, ona).
 *
 * Usage:
 *   bun pm2 start tools/session-sync/ecosystem.config.cjs
 *   bun pm2 stop session-sync
 *   bun pm2 restart session-sync
 *   bun pm2 logs session-sync
 *   bun pm2 status
 *
 * autorestart: true with guardrails — `min_uptime` + `max_restarts` +
 * `restart_delay` bound the auth-expiry loop. When `src/cli.ts` exits cleanly
 * because auth/profile loading failed (no `effi auth login` yet, or the token
 * expired), pm2 waits `restart_delay` (5s) and retries; after `max_restarts`
 * unstable starts (each running <`min_uptime`/60s), pm2 marks the process
 * `errored` and stops. The banner-env-status hook picks up `errored` and
 * prints the recovery hint. Trade-off vs the earlier `autorestart: false`:
 * we now survive process death from any cause (SIGKILL, OOM, segfault,
 * env-pause-induced teardown) without manual restart. Recovery flow on auth
 * expiry is unchanged: `effi auth login`, then `bun pm2 restart session-sync`.
 *
 * Environment variables consumed by `src/cli.ts` (see README):
 *   SESSION_SYNC_PROJECTS_DIR, SESSION_SYNC_STATE_DIR, SESSION_SYNC_IDLE_MS,
 *   SESSION_SYNC_SAFETY_MS, SESSION_SYNC_PREFLIGHT_MS, SESSION_SYNC_PROFILE,
 *   EFFI_CONFIG_DIR.
 *
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 */

const { join } = require("node:path");

module.exports = {
	apps: [
		{
			name: "session-sync",
			script: "bun",
			args: ["run", "src/cli.ts"],
			interpreter: "none",
			cwd: __dirname,
			instances: 1,
			autorestart: true,
			min_uptime: 60000,
			max_restarts: 5,
			restart_delay: 5000,
			watch: false,
			max_memory_restart: "256M",
			env: {
				NODE_ENV: "production",
			},
			error_file: join(
				process.env.HOME || "/root",
				".local/state/session-sync/pm2-error.log",
			),
			out_file: join(
				process.env.HOME || "/root",
				".local/state/session-sync/pm2-out.log",
			),
			log_date_format: "YYYY-MM-DD HH:mm:ss Z",
			merge_logs: true,
		},
	],
};
