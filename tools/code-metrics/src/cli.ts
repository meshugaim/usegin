#!/usr/bin/env bun
// Code metrics analyzer - analyze churn, complexity, stability, and more

import { Command } from "commander";
import { getAllFileCommits, getFileInfo } from "./git.js";
import { calculateMetric, type MetricType } from "./metrics.js";
import { formatOutput, getMetricInfo, type FormatOptions } from "./format.js";
import { $ } from "bun";

const program = new Command();

function isLockFile(file: string): boolean {
  return (
    file.endsWith("bun.lock") ||
    file.endsWith("uv.lock") ||
    file.endsWith("package-lock.json") ||
    file.endsWith("yarn.lock") ||
    file.endsWith("pnpm-lock.yaml")
  );
}

async function analyzeMetric(
  metricType: MetricType,
  options: {
    limit: number;
    excludeLocks: boolean;
    minChanges: number;
    format: "table" | "csv" | "json";
    details: boolean;
  }
) {
  // Check if we're in a git repo
  const isRepo = await $`git rev-parse --git-dir`.quiet().nothrow();
  if (isRepo.exitCode !== 0) {
    console.error("Error: Not in a git repository");
    process.exit(1);
  }

  if (options.format === "table") {
    console.log("Analyzing repository...");
  }

  // Get all file commits
  const fileCommits = await getAllFileCommits();

  // Filter by min changes and exclude locks
  const filteredCommits = new Map();
  for (const [file, commits] of fileCommits) {
    if (commits.length < options.minChanges) continue;
    if (options.excludeLocks && isLockFile(file)) continue;
    filteredCommits.set(file, commits);
  }

  // Get file info (line counts)
  const files = Array.from(filteredCommits.keys());
  const fileInfoMap = await getFileInfo(files);

  // Filter out non-existent files or empty files
  for (const [file, info] of fileInfoMap) {
    if (!info.exists || info.lines === 0) {
      filteredCommits.delete(file);
      fileInfoMap.delete(file);
    }
  }

  // Calculate metrics
  const results = calculateMetric(metricType, filteredCommits, fileInfoMap);

  // Sort by value descending
  results.sort((a, b) => b.value - a.value);

  // Format and output
  const formatOptions: FormatOptions = {
    format: options.format,
    limit: options.limit,
    showDetails: options.details,
  };

  const output = formatOutput(results, metricType, formatOptions);
  console.log(output);
}

program
  .name("code-metrics")
  .description("Analyze codebase metrics: churn, complexity, stability, and more")
  .version("1.0.0");

// Churn command
program
  .command("churn")
  .description("Code churn (L×C): file length × change frequency")
  .option("-l, --limit <n>", "Show top N files", "30")
  .option("--exclude-locks", "Exclude lock files")
  .option("-m, --min-changes <n>", "Only show files with at least N changes", "5")
  .option("-f, --format <type>", "Output format: table, csv, json", "table")
  .option("-d, --details", "Show detailed columns", false)
  .action((options) => {
    analyzeMetric("churn", {
      limit: parseInt(options.limit),
      excludeLocks: options.excludeLocks,
      minChanges: parseInt(options.minChanges),
      format: options.format,
      details: options.details,
    });
  });

// Recency-weighted churn command
program
  .command("recency")
  .description("Recency-weighted churn: recent changes count more than old changes")
  .option("-l, --limit <n>", "Show top N files", "30")
  .option("--exclude-locks", "Exclude lock files")
  .option("-m, --min-changes <n>", "Only show files with at least N changes", "5")
  .option("-f, --format <type>", "Output format: table, csv, json", "table")
  .option("-d, --details", "Show detailed columns", false)
  .action((options) => {
    analyzeMetric("recency-weighted-churn", {
      limit: parseInt(options.limit),
      excludeLocks: options.excludeLocks,
      minChanges: parseInt(options.minChanges),
      format: options.format,
      details: options.details,
    });
  });

// Bug density command
program
  .command("bugs")
  .description("Bug density: percentage of commits that are bug fixes")
  .option("-l, --limit <n>", "Show top N files", "30")
  .option("--exclude-locks", "Exclude lock files")
  .option("-m, --min-changes <n>", "Only show files with at least N changes", "5")
  .option("-f, --format <type>", "Output format: table, csv, json", "table")
  .option("-d, --details", "Show detailed columns", false)
  .action((options) => {
    analyzeMetric("bug-density", {
      limit: parseInt(options.limit),
      excludeLocks: options.excludeLocks,
      minChanges: parseInt(options.minChanges),
      format: options.format,
      details: options.details,
    });
  });

// Author diversity command
program
  .command("authors")
  .description("Author diversity: number of unique authors per file")
  .option("-l, --limit <n>", "Show top N files", "30")
  .option("--exclude-locks", "Exclude lock files")
  .option("-m, --min-changes <n>", "Only show files with at least N changes", "5")
  .option("-f, --format <type>", "Output format: table, csv, json", "table")
  .option("-d, --details", "Show detailed columns", false)
  .action((options) => {
    analyzeMetric("author-diversity", {
      limit: parseInt(options.limit),
      excludeLocks: options.excludeLocks,
      minChanges: parseInt(options.minChanges),
      format: options.format,
      details: options.details,
    });
  });

// Stability command
program
  .command("stability")
  .description("Stability score: days since last change")
  .option("-l, --limit <n>", "Show top N files", "30")
  .option("--exclude-locks", "Exclude lock files")
  .option("-m, --min-changes <n>", "Only show files with at least N changes", "5")
  .option("-f, --format <type>", "Output format: table, csv, json", "table")
  .option("-d, --details", "Show detailed columns", false)
  .action((options) => {
    analyzeMetric("stability", {
      limit: parseInt(options.limit),
      excludeLocks: options.excludeLocks,
      minChanges: parseInt(options.minChanges),
      format: options.format,
      details: options.details,
    });
  });

// List metrics command
program
  .command("list")
  .description("List all available metrics")
  .action(() => {
    console.log("\nAvailable Metrics:\n");

    const metrics: MetricType[] = [
      "churn",
      "recency-weighted-churn",
      "bug-density",
      "author-diversity",
      "stability",
    ];

    for (const metric of metrics) {
      const info = getMetricInfo(metric);
      console.log(`  ${info.name}`);
      console.log(`  ${info.description}\n`);
    }

    console.log("Run any metric with: code-metrics <metric-name>");
    console.log("Example: code-metrics churn --exclude-locks --limit 50\n");
  });

// Default action - show help
program.action(() => {
  program.help();
});

program.parse();
