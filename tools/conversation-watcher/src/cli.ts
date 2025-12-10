#!/usr/bin/env bun

/**
 * CLI entry point for conversation-watcher
 * Run directly by PM2 for process management
 */

import { existsSync } from "node:fs";
import { watch } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Config } from "./config";
import { configSchema } from "./config";
import {
	initRepository,
	syncAllConversations,
	syncConversation,
} from "./git-sync";

// Default paths
const defaultCloneDir = join(homedir(), ".conversation-watcher", "repo");
const defaultWatchDir = join(
	homedir(),
	".config",
	"Claude Code",
	"conversations",
);

/**
 * Get git username from config (tries local, then global)
 */
async function getGitUsername(): Promise<string | null> {
	try {
		// Try local config first, then global
		const { stdout } = await Bun.$`git config user.name`.quiet();
		return stdout.toString().trim() || null;
	} catch {
		return null;
	}
}

/**
 * Parse CLI arguments
 */
function parseArgs() {
	const args = process.argv.slice(2);
	const options: Record<string, string> = {};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg?.startsWith("--")) {
			const key = arg.slice(2);
			const value = args[i + 1];
			if (value && !value.startsWith("--")) {
				options[key] = value;
				i++;
			}
		}
	}

	return options;
}

/**
 * Main entry point
 */
async function main() {
	const args = parseArgs();

	// Get username from args or git config
	const username = args.username || (await getGitUsername());

	// Check for extract mode
	if (args.mode === "extract") {
		// One-time extraction mode
		const config = configSchema.parse({
			username,
			repoUrl: args.repo,
			cloneDir: args.cloneDir || defaultCloneDir,
			watchDir: args.watchDir || defaultWatchDir,
			debounceMs: 2000,
			detached: false,
		});

		if (!existsSync(config.watchDir)) {
			console.error(`Error: Directory does not exist: ${config.watchDir}`);
			process.exit(1);
		}

		console.log("Initializing repository...");
		await initRepository(config);

		console.log("\nProcessing conversations...");
		const { Glob } = await import("bun");
		const glob = new Glob("*.jsonl");
		const files = Array.from(glob.scanSync(config.watchDir));

		if (files.length === 0) {
			console.log("No conversation files found");
			return;
		}

		console.log(`Found ${files.length} conversation file(s)\n`);

		for (const file of files) {
			const fullPath = join(config.watchDir, file);
			await syncConversation(config, fullPath);
		}

		console.log("\n✓ Extraction complete");
	} else {
		// Watch mode (default - run by PM2)
		if (!username || !args.repo) {
			console.error("Error: --repo is required");
			if (!username) {
				console.error(
					"Error: --username is required (or set git config user.name)",
				);
			}
			console.error(
				"Usage: bun run src/cli.ts --repo <url> [--username <name>] [--cloneDir <path>] [--watchDir <path>]",
			);
			process.exit(1);
		}

		const config = configSchema.parse({
			username,
			repoUrl: args.repo,
			cloneDir: args.cloneDir || defaultCloneDir,
			watchDir: args.watchDir || defaultWatchDir,
			debounceMs: parseInt(args.debounceMs || "2000", 10),
			detached: true,
		});

		// Start the watcher service
		await startWatcherService(config);
	}
}

/**
 * Wait for a directory to exist, checking periodically
 * This prevents crash loops when Claude Code hasn't created the directory yet
 */
async function waitForDirectory(
	dirPath: string,
	checkIntervalMs = 10000,
): Promise<void> {
	if (existsSync(dirPath)) {
		return; // Directory already exists
	}

	console.log(`⏳ Watch directory does not exist yet: ${dirPath}`);
	console.log("   Waiting for Claude Code to create it...");
	console.log(`   (checking every ${checkIntervalMs / 1000}s)`);
	console.log("");

	// Keep checking until directory exists
	let checkCount = 0;
	const logsPerMinute = Math.ceil(60000 / checkIntervalMs); // log every ~60 seconds

	while (!existsSync(dirPath)) {
		await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
		checkCount++;

		// Log periodic status (approximately every 60 seconds)
		if (checkCount % logsPerMinute === 0) {
			console.log(`⏳ Still waiting for directory: ${dirPath}`);
		}
	}

	console.log(`✓ Watch directory created: ${dirPath}`);
	console.log("");
}

/**
 * Start the background watcher service
 */
async function startWatcherService(config: Config): Promise<void> {
	console.log("Configuration:");
	console.log(`  Username: ${config.username}`);
	console.log(`  Repository: ${config.repoUrl}`);
	console.log(`  Clone directory: ${config.cloneDir}`);
	console.log(`  Watch directory: ${config.watchDir}`);
	console.log(`  Debounce delay: ${config.debounceMs}ms`);
	console.log("");

	// Initialize repository
	await initRepository(config);

	// Wait for watch directory to exist (graceful startup)
	await waitForDirectory(config.watchDir);

	console.log(`Watching directory: ${config.watchDir}`);
	console.log("Press Ctrl+C to stop\n");

	// Process existing files first
	await syncAllConversations(config, config.watchDir);

	// Set up signal handlers for graceful shutdown
	let isShuttingDown = false;

	const shutdown = async () => {
		if (isShuttingDown) return;
		isShuttingDown = true;
		console.log("\nReceived shutdown signal. Cleaning up...");
		process.exit(0);
	};

	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);

	// Debouncing map: filename -> timeout ID
	const pendingSyncs = new Map<string, Timer>();

	// Watch for changes
	console.log("Watcher is running...");

	try {
		const watcher = watch(config.watchDir, { recursive: false });

		for await (const event of watcher) {
			if (isShuttingDown) break;

			const filename = event.filename;
			if (!filename || !filename.endsWith(".jsonl")) continue;

			const fullPath = join(config.watchDir, filename);

			// Check if file exists (rename event can mean delete)
			if (!existsSync(fullPath)) continue;

			// Clear any pending sync for this file
			if (pendingSyncs.has(filename)) {
				clearTimeout(pendingSyncs.get(filename));
			}

			// Schedule a new sync after debounce period
			const timeoutId = setTimeout(async () => {
				pendingSyncs.delete(filename);
				await syncConversation(config, fullPath);
			}, config.debounceMs);

			pendingSyncs.set(filename, timeoutId);
		}
	} catch (error) {
		if (!isShuttingDown) {
			console.error("Watcher error:", (error as Error).message);
			process.exit(1);
		}
	}
}

// Run if executed directly
if (import.meta.main) {
	main().catch((error) => {
		console.error("Fatal error:", error.message);
		process.exit(1);
	});
}
