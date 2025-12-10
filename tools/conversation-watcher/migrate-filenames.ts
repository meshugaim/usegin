#!/usr/bin/env bun
/**
 * Migration script to add HHMMSS prefix to existing conversation files
 * based on the first message timestamp from the original JSONL files
 */

import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { $ } from "bun";

interface FileToRename {
	oldPath: string;
	newPath: string;
	conversationId: string;
	timestamp: string;
}

/**
 * Extract HHMMSS from a timestamp string
 */
function getTimePrefix(timestamp: string): string {
	try {
		const date = new Date(timestamp);
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		const seconds = String(date.getSeconds()).padStart(2, "0");
		return `${hours}${minutes}${seconds}`;
	} catch (error) {
		console.error("Could not parse timestamp:", timestamp, error);
		return "";
	}
}

/**
 * Find all conversation files in a directory recursively
 */
async function findConversationFiles(dir: string): Promise<string[]> {
	const files: string[] = [];

	try {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			if (entry.isDirectory()) {
				const subFiles = await findConversationFiles(fullPath);
				files.push(...subFiles);
			} else if (entry.isFile() && entry.name.match(/^conversation-.*\.txt$/)) {
				// Match old format without time prefix
				files.push(fullPath);
			}
		}
	} catch (error) {
		console.error(`Error reading directory ${dir}:`, error);
	}

	return files;
}

/**
 * Extract conversation ID from filename
 */
function extractConversationId(filename: string): string {
	const match = filename.match(/conversation-(.+)\.txt$/);
	return match ? match[1] : "";
}

/**
 * Get the first commit timestamp for a conversation file using git log
 */
async function getFirstCommitTimestamp(filePath: string, repoDir: string): Promise<string | null> {
	try {
		// Get the timestamp of the first commit for this file
		// Use --follow to track renames, --reverse to get oldest first
		const result = await $`git log --follow --format=%aI --reverse ${filePath}`.cwd(repoDir).text();
		const timestamps = result.trim().split("\n").filter(t => t);

		if (timestamps.length > 0 && timestamps[0]) {
			return timestamps[0];
		}

		return null;
	} catch (error) {
		// Silently return null - errors are expected for new files
		return null;
	}
}

/**
 * Main migration function
 */
async function migrate(repoDir: string, dryRun = false) {
	console.log("=== Migration: Add HHMMSS prefix to conversation files ===\n");
	console.log(`Repository: ${repoDir}`);
	console.log(`Dry run: ${dryRun}\n`);

	// Find all conversation files
	console.log("Finding conversation files...");
	const files = await findConversationFiles(repoDir);
	console.log(`Found ${files.length} conversation files\n`);

	const filesToRename: FileToRename[] = [];
	let skipped = 0;
	let processed = 0;

	// Process each file
	for (const file of files) {
		const filename = basename(file);
		processed++;

		if (processed % 50 === 0) {
			console.log(`Progress: ${processed}/${files.length}...`);
		}

		// Skip if already has time prefix (6 digits followed by hyphen)
		if (filename.match(/^\d{6}-conversation-/)) {
			skipped++;
			continue;
		}

		const conversationId = extractConversationId(filename);
		if (!conversationId) {
			console.log(`⊘ Could not extract ID from: ${filename}`);
			continue;
		}

		// Get first commit timestamp from git log
		const relativePath = file.replace(`${repoDir}/`, "");
		const firstTimestamp = await getFirstCommitTimestamp(relativePath, repoDir);

		if (!firstTimestamp) {
			console.log(`⊘ No git timestamp for: ${conversationId}`);
			continue;
		}

		const timePrefix = getTimePrefix(firstTimestamp);
		if (!timePrefix) {
			console.log(`⊘ Could not parse timestamp for: ${conversationId}`);
			continue;
		}

		// Generate new filename
		const dir = file.substring(0, file.lastIndexOf("/"));
		const newFilename = `${timePrefix}-${filename}`;
		const newPath = join(dir, newFilename);

		filesToRename.push({
			oldPath: file,
			newPath,
			conversationId,
			timestamp: firstTimestamp,
		});

		// Show first 5 examples
		if (filesToRename.length <= 5) {
			console.log(`  ${filename} -> ${newFilename}`);
		}

		if (filesToRename.length % 50 === 0) {
			console.log(`✓ Queued ${filesToRename.length} files for renaming...`);
		}
	}

	console.log(`\n=== Summary ===`);
	console.log(`Files to rename: ${filesToRename.length}`);
	console.log(`Skipped (already prefixed): ${skipped}`);
	console.log(`Total processed: ${files.length}\n`);

	if (filesToRename.length === 0) {
		console.log("No files to rename. Migration complete!");
		return;
	}

	if (dryRun) {
		console.log("DRY RUN - No files were actually renamed.");
		return;
	}

	// Perform the actual renaming using git mv
	console.log("Renaming files with git mv...\n");
	let renamed = 0;
	let failed = 0;

	for (const { oldPath, newPath } of filesToRename) {
		try {
			const relativeOld = oldPath.replace(`${repoDir}/`, "");
			const relativeNew = newPath.replace(`${repoDir}/`, "");
			await $`git mv ${relativeOld} ${relativeNew}`.cwd(repoDir);
			renamed++;
		} catch (error) {
			console.error(`✗ Failed to rename ${oldPath}:`, error);
			failed++;
		}
	}

	console.log(`\n=== Results ===`);
	console.log(`Successfully renamed: ${renamed}`);
	console.log(`Failed: ${failed}`);
	console.log("\nMigration complete!");
}

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const repoDir = args.find(arg => arg.startsWith("--repo="))?.split("=")[1] ||
	join(process.env.HOME || "~", "agent-records");

if (args.includes("--help")) {
	console.log(`
Usage: bun migrate-filenames.ts [options]

Options:
  --repo=<path>     Path to repository (default: ~/agent-records)
  --dry-run         Show what would be renamed without actually renaming
  --help            Show this help message

Example:
  bun migrate-filenames.ts --repo=/home/vscode/agent-records --dry-run
	`);
	process.exit(0);
}

migrate(repoDir, dryRun).catch(error => {
	console.error("Fatal error:", error);
	process.exit(1);
});
