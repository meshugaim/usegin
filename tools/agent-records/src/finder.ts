import { Glob } from "bun";
import { join } from "node:path";
import type { Config } from "./config.ts";
import {
	filterWarmups,
	filterByContentPatterns,
	filterSubAgents,
} from "./filters.ts";

export interface ConversationResult {
	conversationPath: string;
	summaryPath: string | null;
	lineCount: number;
}

export interface FindOptions {
	date?: string; // YYYY-MM-DD
	from?: string; // YYYY-MM-DD
	to?: string; // YYYY-MM-DD
	username?: string;
	ignoreContentPatterns?: string[];
	includeSubAgents?: boolean;
}

/**
 * Find conversations based on criteria
 */
export async function findConversations(
	config: Config,
	options: FindOptions = {},
): Promise<ConversationResult[]> {
	const { date, from, to, username } = options;

	let pattern: string;

	if (date) {
		// Specific date: {username}/{YYYY-MM}/{YYYY-MM-DD}/*.txt
		const [year, month] = date.split("-");
		const yearMonth = `${year}-${month}`;
		const usernamePattern = username || "*";
		pattern = `${usernamePattern}/${yearMonth}/${date}/*.txt`;
	} else if (from || to) {
		// Date range: need to search broader and filter
		const usernamePattern = username || "*";
		pattern = `${usernamePattern}/*/*/*.txt`;
	} else if (username) {
		// Just username filter
		pattern = `${username}/*/*/*.txt`;
	} else {
		// All conversations
		pattern = "*/*/*/*.txt";
	}

	// Find all conversation files (not summary files)
	const glob = new Glob(pattern);
	const files: string[] = [];

	for await (const file of glob.scan({
		cwd: config.recordsDir,
		absolute: true,
		onlyFiles: true,
	})) {
		// Exclude summary files
		if (!file.endsWith(".summary.md")) {
			files.push(file);
		}
	}

	// Filter by date range if specified
	let filteredFiles = files;
	if (from || to) {
		filteredFiles = files.filter((file) => {
			const match = file.match(/\/(\d{4}-\d{2}-\d{2})\//);
			if (!match) return false;

			const fileDate = match[1];
			if (from && fileDate < from) return false;
			if (to && fileDate > to) return false;
			return true;
		});
	}

	// Filter out sub-agent conversations (unless includeSubAgents is true)
	let afterSubAgentFilter = filteredFiles;
	if (!options.includeSubAgents) {
		afterSubAgentFilter = filterSubAgents(filteredFiles);
	}

	// Filter out warmup conversations
	const nonWarmupFiles = await filterWarmups(afterSubAgentFilter);

	// Filter out conversations matching ignore patterns
	const finalFiles = await filterByContentPatterns(
		nonWarmupFiles,
		options.ignoreContentPatterns || [],
	);

	// Build results with summary paths and line counts
	const results: ConversationResult[] = [];

	for (const conversationPath of finalFiles) {
		// Check if summary exists
		const summaryPath = getSummaryPath(conversationPath);
		const summaryExists = await Bun.file(summaryPath).exists();

		// Count lines in the conversation file
		const lineCount = await countLines(conversationPath);

		results.push({
			conversationPath,
			summaryPath: summaryExists ? summaryPath : null,
			lineCount,
		});
	}

	// Sort by path (which includes timestamp in filename)
	results.sort((a, b) => a.conversationPath.localeCompare(b.conversationPath));

	return results;
}

/**
 * Get the summary path for a conversation file
 */
function getSummaryPath(conversationPath: string): string {
	// Replace .txt with .summary.md
	return conversationPath.replace(/\.txt$/, ".summary.md");
}

/**
 * Count lines in a file
 */
async function countLines(filePath: string): Promise<number> {
	try {
		const file = Bun.file(filePath);
		const content = await file.text();
		// Count newlines, adding 1 if file doesn't end with newline and has content
		const lines = content.split("\n");
		return lines.length;
	} catch (error) {
		// If file can't be read, return 0
		return 0;
	}
}

export interface OverviewStats {
	username: string;
	date: string;
	totalConversations: number;
	withSummaries: number;
	totalLines: number;
	avgLines: number;
}

/**
 * Get overview statistics grouped by username and date
 */
export async function getOverview(
	config: Config,
	options: FindOptions = {},
): Promise<OverviewStats[]> {
	// Get all conversations based on filters
	const conversations = await findConversations(config, options);

	// Group by username and date
	const groups = new Map<string, OverviewStats>();

	for (const conv of conversations) {
		// Extract username and date from path
		// Path format: /path/to/{username}/{YYYY-MM}/{YYYY-MM-DD}/{filename}.txt
		const match = conv.conversationPath.match(
			/\/([^/]+)\/(\d{4}-\d{2})\/(\d{4}-\d{2}-\d{2})\//,
		);
		if (!match) continue;

		const username = match[1] as string;
		const date = match[3] as string;
		const key = `${username}:${date}`;

		const existing = groups.get(key);
		if (existing) {
			existing.totalConversations++;
			existing.totalLines += conv.lineCount;
			existing.avgLines = Math.round(existing.totalLines / existing.totalConversations);
			if (conv.summaryPath) {
				existing.withSummaries++;
			}
		} else {
			groups.set(key, {
				username,
				date,
				totalConversations: 1,
				withSummaries: conv.summaryPath ? 1 : 0,
				totalLines: conv.lineCount,
				avgLines: conv.lineCount,
			});
		}
	}

	// Convert to array and sort by date (newest first), then username
	const stats = Array.from(groups.values());
	stats.sort((a, b) => {
		const dateCompare = b.date.localeCompare(a.date);
		if (dateCompare !== 0) return dateCompare;
		return a.username.localeCompare(b.username);
	});

	return stats;
}
