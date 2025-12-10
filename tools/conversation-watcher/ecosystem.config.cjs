/**
 * PM2 Ecosystem configuration for conversation-watcher
 *
 * Username detection (priority order):
 *   1. WATCHER_USERNAME environment variable
 *   2. git config user.name (local or global)
 *   3. None (CLI will show error and require --username flag)
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 stop conversation-watcher
 *   pm2 restart conversation-watcher
 *   pm2 logs conversation-watcher
 *   pm2 monit
 *
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 */

const { homedir } = require("node:os");
const { join } = require("node:path");
const { execSync } = require("node:child_process");

// Get git username from config (tries local, then global) if not provided via env
function getGitUsername() {
	try {
		// Use cwd option to ensure we check git config from the project directory
		return execSync("git config user.name", {
			encoding: "utf8",
			cwd: __dirname,
		}).trim();
	} catch {
		return null;
	}
}

// Determine username: env var > git config > none (CLI will error)
const detectedUsername = process.env.WATCHER_USERNAME || getGitUsername();

module.exports = {
	apps: [
		{
			name: "conversation-watcher",
			script: "bun",
			args: [
				"run",
				"src/cli.ts",
				...(detectedUsername ? ["--username", detectedUsername] : []),
				"--repo",
				process.env.WATCHER_REPO || "https://github.com/AskEffi/agent-records",
				"--cloneDir",
				process.env.WATCHER_CLONE_DIR || join(homedir(), "agent-records"),
				"--watchDir",
				process.env.WATCHER_WATCH_DIR ||
					join(homedir(), ".claude", "projects", "-workspaces-test-mvp"),
			],
			interpreter: "none",
			cwd: __dirname,
			instances: 1,
			autorestart: true,
			restart_delay: 5000, // wait 5s before first restart
			exp_backoff_restart_delay: 100, // exponential backoff: 5s → 10s → 15s (max)
			cron_restart: "*/2 * * * *", // restart every 2 minutes to catch missed file changes
			watch: false,
			max_memory_restart: "500M",
			env: {
				NODE_ENV: "production",
			},
			error_file: "~/.local/log/conversation-watcher-error.log",
			out_file: "~/.local/log/conversation-watcher-out.log",
			log_date_format: "YYYY-MM-DD HH:mm:ss Z",
			merge_logs: true,
		},
	],
};
