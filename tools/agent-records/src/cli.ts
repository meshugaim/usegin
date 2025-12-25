#!/usr/bin/env bun

import Table from "cli-table3";
import { configSchema } from "./config.ts";
import {
	findConversations,
	getOverview,
	searchSummaries,
	runSearchFzf,
	getConversationContent,
} from "./finder.ts";
import type { FindOptions, SearchOptions } from "./finder.ts";

interface CliArgs {
	command: "find" | "overview" | "search" | "help";
	date?: string;
	from?: string;
	to?: string;
	username?: string;
	recordsDir?: string;
	ignoreContent?: string[];
	withSubagents?: boolean;
	query?: string; // For search command
	noFzf?: boolean; // Output path directly without fzf
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): CliArgs {
	const parsed: Partial<CliArgs> = {};

	// First arg is the command
	const command = args[0];
	if (
		command !== "find" &&
		command !== "overview" &&
		command !== "search" &&
		command !== "help"
	) {
		throw new Error(
			`Invalid command: ${command}. Use 'find', 'overview', 'search', or 'help'`,
		);
	}
	parsed.command = command;

	// For search command, collect non-flag args as query
	const queryParts: string[] = [];

	// Parse flags
	for (let i = 1; i < args.length; i++) {
		const arg = args[i];

		if (arg?.startsWith("--")) {
			const key = arg.slice(2);

			// Boolean flags (no value)
			if (key === "with-subagents") {
				parsed.withSubagents = true;
				continue;
			}
			if (key === "no-fzf") {
				parsed.noFzf = true;
				continue;
			}

			const value = args[i + 1];

			if (!value || value.startsWith("--")) {
				throw new Error(`Missing value for --${key}`);
			}

			switch (key) {
				case "date":
					parsed.date = value;
					i++;
					break;
				case "from":
					parsed.from = value;
					i++;
					break;
				case "to":
					parsed.to = value;
					i++;
					break;
				case "username":
					parsed.username = value;
					i++;
					break;
				case "records-dir":
					parsed.recordsDir = value;
					i++;
					break;
				case "ignore-content":
					if (!parsed.ignoreContent) {
						parsed.ignoreContent = [];
					}
					parsed.ignoreContent.push(value);
					i++;
					break;
				default:
					throw new Error(`Unknown flag: --${key}`);
			}
		} else if (command === "search" && arg) {
			// For search command, non-flag args are the query
			queryParts.push(arg);
		}
	}

	// Join query parts for search command
	if (command === "search" && queryParts.length > 0) {
		parsed.query = queryParts.join(" ");
	}

	return parsed as CliArgs;
}

/**
 * Print help information
 */
function printHelp() {
	console.log(`
Agent Records CLI - Query and consume agent conversation records

USAGE:
  agent-records <command> [options]

COMMANDS:
  find        Find conversations matching criteria
  search      Search summaries and output full conversation text
  overview    Show statistics grouped by username and date
  help        Show this help message

SEARCH COMMAND:
  agent-records search <query> [options]

  Searches through .summary.md files for matching keywords, shows results
  in an interactive fzf picker, and outputs the full conversation text.

  Options:
    --username <name>     Filter by username
    --from <YYYY-MM-DD>   Search from this date onwards
    --to <YYYY-MM-DD>     Search up to this date
    --no-fzf              Skip fzf, output first match directly

  Examples:
    # Search for sessions about GFS fixes
    agent-records search "GFS stuck files"

    # Search within a date range
    agent-records search "authentication" --from 2025-12-01

    # Search for a specific user's sessions
    agent-records search "refactor" --username lihub

    # Pipe directly to Claude for context
    agent-records search "login bug" --no-fzf | claude -p "continue this work"

FIND OPTIONS:
  --date <YYYY-MM-DD>       Find conversations on a specific date
  --from <YYYY-MM-DD>       Find conversations from this date onwards
  --to <YYYY-MM-DD>         Find conversations up to this date
  --username <name>         Filter by username (kebab-cased automatically)
  --records-dir <path>      Path to agent records directory (default: ~/agent-records)
  --ignore-content <regex>  Exclude conversations matching regex pattern (can be used multiple times)
  --with-subagents          Include sub-agent conversations (excluded by default)

OUTPUT FORMATS:
  find:         Table with columns: Path, Summary, Lines
                Summary shows "Yes" or "No" for whether a summary exists.
                Line count shows the size of the conversation file.

  overview:     Table showing username, date, total conversations, summaries, and line counts

EXAMPLES:
  # Find all conversations on a specific date
  agent-records find --date 2025-11-08

  # Find conversations in a date range
  agent-records find --from 2025-11-01 --to 2025-11-10

  # Find conversations for a specific user
  agent-records find --username nitsan-avni

  # Get overview statistics
  agent-records overview

  # Get overview for specific date range
  agent-records overview --from 2025-11-01 --to 2025-11-10

  # Use custom records directory
  agent-records find --date 2025-11-08 --records-dir /path/to/records

  # Exclude conversations with summarize commands
  agent-records find --date 2025-11-08 --ignore-content "<command-name>/summarize.*</command-name>"

  # Multiple ignore patterns
  agent-records find --ignore-content "pattern1" --ignore-content "pattern2"

BEHAVIOR:
  - Sub-agent conversations are excluded by default (use --with-subagents to include)
  - Warmup conversations are always excluded
  - Conversations matching summarize.* slash commands are excluded by default
  - Usernames are normalized to kebab-case (e.g., "Nitsan Avni" → "nitsan-avni")
  - Summary files are auto-detected (.summary.md extension)

For more information, see the README.md file.
`);
}

/**
 * Main CLI function
 */
async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		printHelp();
		process.exit(1);
	}

	try {
		const cliArgs = parseArgs(args);

		// Handle help command
		if (cliArgs.command === "help") {
			printHelp();
			return;
		}

		// Build config
		const config = configSchema.parse({
			recordsDir: cliArgs.recordsDir,
		});

		// Build find options with default ignore patterns
		const defaultIgnorePatterns = [] as string[];
		const ignorePatterns = [
			...defaultIgnorePatterns,
			...(cliArgs.ignoreContent || []),
		];

		const findOptions: FindOptions = {
			date: cliArgs.date,
			from: cliArgs.from,
			to: cliArgs.to,
			username: cliArgs.username,
			ignoreContentPatterns: ignorePatterns,
			includeSubAgents: cliArgs.withSubagents || false,
		};

		// Execute command
		if (cliArgs.command === "search") {
			// Search command
			if (!cliArgs.query) {
				console.error("Error: Search query is required");
				console.error("Usage: agent-records search <query> [options]");
				process.exit(1);
			}

			const searchOptions: SearchOptions = {
				username: cliArgs.username,
				from: cliArgs.from,
				to: cliArgs.to,
			};

			const results = await searchSummaries(config, cliArgs.query, searchOptions);

			if (results.length === 0) {
				console.error(`No sessions found matching: "${cliArgs.query}"`);
				process.exit(1);
			}

			let selectedPath: string | null;

			if (cliArgs.noFzf) {
				// No fzf mode - just use first result
				selectedPath = results[0].conversationPath;
			} else {
				// Interactive fzf selection
				selectedPath = await runSearchFzf(results);
			}

			if (!selectedPath) {
				process.exit(1);
			}

			// Output the full conversation content
			const content = await getConversationContent(selectedPath);
			if (content) {
				console.log(content);
			} else {
				console.error(`Error: Could not read conversation at ${selectedPath}`);
				process.exit(1);
			}
		} else if (cliArgs.command === "overview") {
			const stats = await getOverview(config, findOptions);

			// Create table
			const table = new Table({
				head: [
					"Username",
					"Date",
					"Conversations",
					"Summaries",
					"Missing",
					"Total Lines",
					"Avg Lines",
				],
				style: {
					head: ["cyan"],
				},
			});

			// Add rows
			for (const stat of stats) {
				const missing = stat.totalConversations - stat.withSummaries;
				table.push([
					stat.username,
					stat.date,
					stat.totalConversations.toString(),
					stat.withSummaries.toString(),
					missing.toString(),
					stat.totalLines.toString(),
					stat.avgLines.toString(),
				]);
			}

			// Calculate totals
			const totalConversations = stats.reduce(
				(sum, s) => sum + s.totalConversations,
				0,
			);
			const totalSummaries = stats.reduce((sum, s) => sum + s.withSummaries, 0);
			const totalMissing = totalConversations - totalSummaries;
			const totalLines = stats.reduce((sum, s) => sum + s.totalLines, 0);
			const avgLines =
				totalConversations > 0 ? Math.round(totalLines / totalConversations) : 0;

			// Add totals row
			table.push([
				{ content: "TOTAL", colSpan: 2, hAlign: "right" },
				totalConversations.toString(),
				totalSummaries.toString(),
				totalMissing.toString(),
				totalLines.toString(),
				avgLines.toString(),
			]);

			console.log(table.toString());
		} else if (cliArgs.command === "find") {
			// find command
			const results = await findConversations(config, findOptions);

			// Create table for results
			const table = new Table({
				head: ["Path", "Summary", "Lines"],
				style: {
					head: ["cyan"],
				},
				// No colWidths - let paths display at full length
			});

			// Add rows
			for (const result of results) {
				const hasSummary = result.summaryPath ? "Yes" : "No";
				table.push([result.conversationPath, hasSummary, result.lineCount.toString()]);
			}

			console.log(table.toString());
		}
	} catch (error) {
		if (error instanceof Error) {
			console.error(`Error: ${error.message}`);
		} else {
			console.error("An unknown error occurred");
		}
		process.exit(1);
	}
}

// Run the CLI
main();
