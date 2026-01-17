// Output formatting utilities
import Table from "cli-table3";
import type { MetricResult, MetricType } from "./metrics.js";

export interface FormatOptions {
  format: "table" | "csv" | "json";
  limit: number;
  showDetails: boolean;
}

/**
 * Get metric display name and description
 */
export function getMetricInfo(metricType: MetricType): { name: string; description: string } {
  const info = {
    churn: {
      name: "Code Churn (L×C)",
      description: "File length × change frequency - identifies large, frequently modified files",
    },
    "recency-weighted-churn": {
      name: "Recency-Weighted Churn",
      description:
        "Length × weighted changes (recent changes count more) - identifies current hotspots",
    },
    "bug-density": {
      name: "Bug Density",
      description: "Percentage of commits that are bug fixes - identifies error-prone files",
    },
    "author-diversity": {
      name: "Author Diversity",
      description: "Number of unique authors - identifies knowledge sharing vs silos",
    },
    stability: {
      name: "Stability Score",
      description: "Days since last change - identifies stable vs actively developed code",
    },
  };

  return info[metricType];
}

/**
 * Format value based on metric type
 */
function formatValue(metricType: MetricType, value: number): string {
  if (metricType === "bug-density") {
    return `${value.toFixed(1)}%`;
  }
  if (metricType === "stability") {
    if (value === Infinity) return "Never changed";
    return `${value} days`;
  }
  if (metricType === "recency-weighted-churn") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return value.toLocaleString();
}

/**
 * Get column headers based on metric type
 */
function getColumns(metricType: MetricType, showDetails: boolean): string[] {
  const base = ["File", "Score"];

  // Always show details for churn metric
  if (metricType === "churn") {
    return [...base, "Lines", "Changes"];
  }

  if (!showDetails) return base;

  switch (metricType) {
    case "recency-weighted-churn":
      return [...base, "Lines", "Changes", "Weighted"];
    case "bug-density":
      return [...base, "Bug Fixes", "Total Changes"];
    case "author-diversity":
      return [...base, "Authors", "Total Changes"];
    case "stability":
      return [...base, "Last Changed", "Last Author"];
    default:
      return base;
  }
}

/**
 * Get row data based on metric type
 */
function getRowData(result: MetricResult, metricType: MetricType, showDetails: boolean): string[] {
  const base = [result.file, formatValue(metricType, result.value)];

  // Always show details for churn metric
  if (metricType === "churn" && result.details) {
    return [
      ...base,
      result.details.lines.toLocaleString(),
      result.details.changes.toLocaleString(),
    ];
  }

  if (!showDetails || !result.details) return base;

  switch (metricType) {
    case "recency-weighted-churn":
      return [
        ...base,
        result.details.lines.toLocaleString(),
        result.details.changes.toString(),
        result.details.weightedChanges.toFixed(1),
      ];
    case "bug-density":
      return [
        ...base,
        result.details.bugFixes.toString(),
        result.details.totalChanges.toString(),
      ];
    case "author-diversity":
      return [
        ...base,
        result.details.uniqueAuthors.toString(),
        result.details.totalChanges.toString(),
      ];
    case "stability":
      return [
        ...base,
        result.details.lastChange || "N/A",
        result.details.lastAuthor || "N/A",
      ];
    default:
      return base;
  }
}

/**
 * Format results as a table
 */
export function formatTable(
  results: MetricResult[],
  metricType: MetricType,
  options: FormatOptions
): string {
  const info = getMetricInfo(metricType);
  const columns = getColumns(metricType, options.showDetails);

  const table = new Table({
    head: columns,
    colAligns: ["left", "right", ...Array(columns.length - 2).fill("right")],
    style: {
      head: ["cyan"],
      border: ["gray"],
    },
  });

  const limited = results.slice(0, options.limit);

  for (const result of limited) {
    table.push(getRowData(result, metricType, options.showDetails));
  }

  let output = `\n${info.name}\n`;
  output += `${info.description}\n`;
  output += "=".repeat(80) + "\n";
  output += table.toString() + "\n";
  output += `\nTotal files analyzed: ${results.length}\n`;

  if (results.length > options.limit) {
    output += `Showing top ${options.limit} results (use --limit to show more)\n`;
  }

  return output;
}

/**
 * Format results as CSV
 */
export function formatCsv(
  results: MetricResult[],
  metricType: MetricType,
  options: FormatOptions
): string {
  const columns = getColumns(metricType, options.showDetails);
  let output = columns.join(",") + "\n";

  const limited = results.slice(0, options.limit);

  for (const result of limited) {
    const row = getRowData(result, metricType, options.showDetails);
    // Escape commas in file paths
    const escaped = row.map((cell) => (cell.includes(",") ? `"${cell}"` : cell));
    output += escaped.join(",") + "\n";
  }

  return output;
}

/**
 * Format results as JSON
 */
export function formatJson(
  results: MetricResult[],
  metricType: MetricType,
  options: FormatOptions
): string {
  const info = getMetricInfo(metricType);
  const limited = results.slice(0, options.limit);

  const output = {
    metric: metricType,
    name: info.name,
    description: info.description,
    totalFiles: results.length,
    results: limited,
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Format results based on options
 */
export function formatOutput(
  results: MetricResult[],
  metricType: MetricType,
  options: FormatOptions
): string {
  switch (options.format) {
    case "csv":
      return formatCsv(results, metricType, options);
    case "json":
      return formatJson(results, metricType, options);
    case "table":
    default:
      return formatTable(results, metricType, options);
  }
}
