/**
 * Git operations for syncing conversations to repository
 */

import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { $ } from "bun";
import { discoverSubagentFiles } from "../../lib/jsonl-discovery.ts";
import type { Config } from "./config";
import { extractConversation, formatConversation } from "./extractor";

export { discoverSubagentFiles };

/**
 * Options for syncConversation
 */
export interface SyncOptions {
	/** Include .jsonl.gz archive alongside text extract (default: false) */
	includeArchive?: boolean;
}

/**
 * Convert a string to kebab-case
 */
export function toKebabCase(str: string): string {
	return str
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Remove a stale .git/index.lock if it exists and no other git process is running.
 * This happens when the watcher (or a git op it spawned) is killed mid-operation.
 */
function removeStaleGitLock(repoDir: string): void {
	const lockPath = join(repoDir, ".git", "index.lock");
	if (!existsSync(lockPath)) return;

	console.warn(`Found stale git lock at ${lockPath}, removing...`);
	try {
		unlinkSync(lockPath);
		console.log("Removed stale git lock file.");
	} catch (error) {
		console.error(
			"Warning: Could not remove stale git lock:",
			(error as Error).message,
		);
	}
}

/**
 * Initialize the git repository (clone if needed, pull if exists)
 */
export async function initRepository(config: Config): Promise<void> {
	if (existsSync(config.cloneDir)) {
		console.log(`Repository already exists at ${config.cloneDir}`);
		removeStaleGitLock(config.cloneDir);

		// Pull latest changes
		try {
			console.log("Pulling latest changes...");
			await $`git pull`.cwd(config.cloneDir);
		} catch (error) {
			console.error(
				"Warning: Could not pull latest changes:",
				(error as Error).message,
			);
		}
	} else {
		console.log(`Cloning repository to ${config.cloneDir}...`);
		try {
			// Create parent directory if needed
			const parentDir = join(config.cloneDir, "..");
			if (!existsSync(parentDir)) {
				mkdirSync(parentDir, { recursive: true });
			}

			await $`git clone ${config.repoUrl} ${config.cloneDir}`;
			console.log("Repository cloned successfully");
		} catch (error) {
			console.error("Error cloning repository:", (error as Error).message);
			throw error;
		}
	}
}

/**
 * Get the conversation ID from a jsonl filename
 */
export function getConversationId(filename: string): string {
	return basename(filename, ".jsonl");
}

/**
 * Find an existing conversation file across all date folders
 * Supports both old format (conversation-{id}.txt) and new format (HHMM-conversation-{id}.txt)
 */
export async function findExistingConversation(
	config: Config,
	conversationId: string,
): Promise<string | null> {
	const userDir = join(config.cloneDir, toKebabCase(config.username));

	if (!existsSync(userDir)) {
		return null;
	}

	try {
		const { Glob } = await import("bun");
		// Match both old and new formats
		const glob = new Glob(`**/*conversation-${conversationId}.txt`);
		const files = Array.from(glob.scanSync(userDir));

		if (files.length > 0 && files[0]) {
			return join(userDir, files[0]);
		}
	} catch (error) {
		console.error(
			"Error searching for existing conversation:",
			(error as Error).message,
		);
	}

	return null;
}

/**
 * Find an existing archive (.jsonl.gz) for a conversation across all date folders.
 * Mirrors findExistingConversation but looks for the compressed JSONL archive.
 */
export async function findExistingArchive(
	config: Config,
	conversationId: string,
): Promise<string | null> {
	const userDir = join(config.cloneDir, toKebabCase(config.username));

	if (!existsSync(userDir)) {
		return null;
	}

	try {
		const { Glob } = await import("bun");
		const glob = new Glob(`**/*conversation-${conversationId}.jsonl.gz`);
		const files = Array.from(glob.scanSync(userDir));

		if (files.length > 0 && files[0]) {
			return join(userDir, files[0]);
		}
	} catch (error) {
		console.error(
			"Error searching for existing archive:",
			(error as Error).message,
		);
	}

	return null;
}

/**
 * Get the output path for a conversation file
 * If the conversation already exists in a different date folder, returns that path
 * Otherwise creates a new path based on current date with HHMMSS prefix from first message
 */
export async function getOutputPath(
	config: Config,
	conversationId: string,
	firstMessageTimestamp?: string,
): Promise<string> {
	// Check if conversation already exists
	const existingPath = await findExistingConversation(config, conversationId);
	if (existingPath) {
		console.log(`Found existing conversation at: ${existingPath}`);
		return existingPath;
	}

	// Create new path based on current date
	const now = new Date();
	const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
	const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

	const dir = join(
		config.cloneDir,
		toKebabCase(config.username),
		yearMonth,
		date,
	);
	mkdirSync(dir, { recursive: true });

	// Generate HHMMSS prefix from first message timestamp if available
	let timePrefix = "";
	if (firstMessageTimestamp) {
		try {
			const timestamp = new Date(firstMessageTimestamp);
			const hours = String(timestamp.getHours()).padStart(2, "0");
			const minutes = String(timestamp.getMinutes()).padStart(2, "0");
			const seconds = String(timestamp.getSeconds()).padStart(2, "0");
			timePrefix = `${hours}${minutes}${seconds}-`;
		} catch (error) {
			console.warn("Could not parse timestamp, using no prefix:", error);
		}
	}

	return join(dir, `${timePrefix}conversation-${conversationId}.txt`);
}

/**
 * Ensure .gitattributes exists in the clone directory with binary treatment for .jsonl.gz files.
 * Idempotent: only writes the file if it doesn't already exist.
 */
export async function ensureGitAttributes(cloneDir: string): Promise<void> {
	const gitattributesPath = join(cloneDir, ".gitattributes");
	if (!existsSync(gitattributesPath)) {
		await Bun.write(gitattributesPath, "*.jsonl.gz binary\n");
		console.log("Created .gitattributes with binary rule for *.jsonl.gz");
	}
}

/**
 * Compress a file with gzip and write it to the destination path.
 * Returns true on success, false on failure (logs the error).
 */
async function compressAndWrite(
	sourcePath: string,
	destPath: string,
): Promise<boolean> {
	try {
		const buffer = new Uint8Array(await Bun.file(sourcePath).arrayBuffer());
		const compressed = Bun.gzipSync(buffer);
		await Bun.write(destPath, compressed);
		return true;
	} catch (error) {
		console.error(
			`Warning: Failed to compress ${sourcePath}:`,
			(error as Error).message,
		);
		return false;
	}
}

/**
 * Archive the main session JSONL and any subagent JSONL files.
 *
 * Returns an array of relative paths (relative to cloneDir) of all newly written
 * archive files, suitable for passing to `git add`.
 */
async function archiveSessionJsonl(
	config: Config,
	jsonlPath: string,
	outputPath: string,
): Promise<string[]> {
	const archivedRelativePaths: string[] = [];

	// 1. Archive the main session JSONL
	const archivePath = outputPath.replace(/\.txt$/, ".jsonl.gz");
	const mainSuccess = await compressAndWrite(jsonlPath, archivePath);
	if (mainSuccess) {
		const relativePath = archivePath.replace(`${config.cloneDir}/`, "");
		archivedRelativePaths.push(relativePath);
		console.log(`Archived session JSONL to: ${archivePath}`);
	}

	// 2. Discover and archive subagent files
	const subagentFiles = await discoverSubagentFiles(jsonlPath);
	if (subagentFiles.length > 0) {
		// Subagents go into a directory named after the text file (minus .txt)
		const subagentsDir = join(outputPath.replace(/\.txt$/, ""), "subagents");
		mkdirSync(subagentsDir, { recursive: true });

		for (const subagentPath of subagentFiles) {
			const subagentFilename = basename(subagentPath, ".jsonl");
			const subagentArchivePath = join(
				subagentsDir,
				`${subagentFilename}.jsonl.gz`,
			);
			const subSuccess = await compressAndWrite(
				subagentPath,
				subagentArchivePath,
			);
			if (subSuccess) {
				const relativePath = subagentArchivePath.replace(
					`${config.cloneDir}/`,
					"",
				);
				archivedRelativePaths.push(relativePath);
				console.log(`Archived subagent JSONL to: ${subagentArchivePath}`);
			}
		}
	}

	return archivedRelativePaths;
}

/**
 * Extract and sync a conversation file to git repository
 */
export async function syncConversation(
	config: Config,
	jsonlPath: string,
	options: SyncOptions = {},
): Promise<void> {
	const conversationId = getConversationId(jsonlPath);
	console.log(`\nProcessing conversation: ${conversationId}`);
	removeStaleGitLock(config.cloneDir);

	try {
		// Extract conversation
		console.log("Extracting conversation...");
		const { messages, messagesByUuid } = await extractConversation(jsonlPath);

		// Skip if no messages
		if (messages.length === 0) {
			console.log(`⊘ Skipping ${conversationId}: No extractable messages`);
			return;
		}

		const formatted = formatConversation(messages, messagesByUuid);

		// Skip if formatted content is empty
		if (!formatted || formatted.trim().length === 0) {
			console.log(`⊘ Skipping ${conversationId}: Empty content`);
			return;
		}

		// Get first message timestamp for filename
		const firstMessageTimestamp =
			messages.length > 0 ? messages[0]?.timestamp : undefined;

		// Write to output file
		const outputPath = await getOutputPath(
			config,
			conversationId,
			firstMessageTimestamp,
		);
		console.log(`Writing to: ${outputPath}`);
		await Bun.write(outputPath, formatted);

		// Archive the full JSONL (gzip-compressed) alongside the text extract.
		// Only when includeArchive is true (throttled separately from text extraction).
		// Errors here are non-fatal: text extraction is the primary artifact.
		let archivedPaths: string[] = [];
		if (options.includeArchive) {
			try {
				await ensureGitAttributes(config.cloneDir);
				archivedPaths = await archiveSessionJsonl(
					config,
					jsonlPath,
					outputPath,
				);
			} catch (error) {
				console.error(
					"Warning: JSONL archival failed, continuing with text only:",
					(error as Error).message,
				);
			}
		}

		// Git add: stage the text file, .gitattributes, and all archive files
		const textRelativePath = outputPath.replace(`${config.cloneDir}/`, "");
		const allPaths = [textRelativePath, ...archivedPaths];

		// Always stage .gitattributes if it exists (idempotent)
		if (existsSync(join(config.cloneDir, ".gitattributes"))) {
			allPaths.push(".gitattributes");
		}

		for (const filePath of allPaths) {
			await $`git add ${filePath}`.cwd(config.cloneDir);
		}

		// Check if there are changes to commit
		const status = await $`git status --porcelain`.cwd(config.cloneDir).text();
		if (!status.trim()) {
			console.log(`⊘ Skipping ${conversationId}: No changes to commit`);
			return;
		}

		// Commit and push
		console.log("Committing changes...");
		const now = new Date().toISOString().split("T")[0];
		const commitMsg = `Update conversation ${conversationId} for ${config.username} (${now})`;
		await $`git commit -m ${commitMsg}`.cwd(config.cloneDir).quiet();

		// Pull with rebase before pushing to avoid conflicts
		console.log("Pulling latest changes with rebase...");
		try {
			await $`git pull --rebase`.cwd(config.cloneDir);
		} catch (error) {
			console.error(
				"Warning: Could not pull with rebase:",
				(error as Error).message,
			);
			console.error("Attempting to abort rebase and continue...");
			await $`git rebase --abort`.cwd(config.cloneDir).nothrow();
			throw error;
		}

		console.log("Pushing to remote...");
		await $`git push`.cwd(config.cloneDir);

		console.log(`✓ Synced conversation ${conversationId}`);
	} catch (error) {
		console.error(
			`Error syncing conversation ${conversationId}:`,
			(error as Error).message,
		);
	}
}

/**
 * Process all existing .jsonl files in a directory
 */
export async function syncAllConversations(
	config: Config,
	watchDir: string,
	options: SyncOptions = {},
): Promise<void> {
	console.log("Processing existing conversations...");

	try {
		const { Glob } = await import("bun");
		const glob = new Glob("*.jsonl");
		const files = Array.from(glob.scanSync(watchDir));

		for (const file of files) {
			const fullPath = join(watchDir, file);
			await syncConversation(config, fullPath, options);
		}
	} catch (error) {
		console.error(
			"Error processing existing conversations:",
			(error as Error).message,
		);
	}
}
