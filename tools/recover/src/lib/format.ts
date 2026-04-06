/**
 * Render a list of stuck items or reset results as a monospace-aligned
 * table. Not a general-purpose table library — just enough to make the
 * CLI output scannable.
 */

import { bold, cyan, dim, green, red, yellow } from "./colors";
import type { ResetResult, StuckItem } from "./api";

function padRight(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function computeWidths(
  headers: readonly string[],
  rows: readonly string[][]
): number[] {
  return headers.map((h, i) => {
    let max = h.length;
    for (const row of rows) {
      const cell = row[i] ?? "";
      if (cell.length > max) max = cell.length;
    }
    return max;
  });
}

function renderTable(headers: readonly string[], rows: readonly string[][]): string {
  const widths = computeWidths(headers, rows);
  const line = (cells: readonly string[]): string =>
    cells.map((c, i) => padRight(c, widths[i]!)).join("  ");
  const divider = widths.map((w) => "─".repeat(w)).join("  ");
  return [
    bold(line(headers)),
    dim(divider),
    ...rows.map((r) => line(r)),
  ].join("\n");
}

/** Color a status string by category. */
function colorStatus(status: string | null): string {
  if (!status) return dim("-");
  switch (status) {
    case "pending":
    case "processing":
    case "synced":
      return green(status);
    case "deleted":
    case "retry_exhausted":
    case "upload_failed":
      return red(status);
    case "excluded":
      return yellow(status);
    default:
      return status;
  }
}

export function formatStuckItems(items: readonly StuckItem[]): string {
  if (items.length === 0) {
    return dim("(no stuck items)");
  }

  const headers = [
    "type",
    "id",
    "status",
    "excluded",
    "failures",
    "error",
  ] as const;
  const rows = items.map((item) => [
    cyan(item.entity_type),
    item.entity_id,
    colorStatus(item.gfs_sync_status),
    item.is_excluded ? yellow("true") : "false",
    item.failure_count.toString(),
    item.error_message ?? "",
  ]);

  return renderTable(headers, rows);
}

export function formatResetResults(results: readonly ResetResult[]): string {
  if (results.length === 0) {
    return dim("(no items processed)");
  }

  const headers = [
    "type",
    "id",
    "action",
    "status",
    "excluded",
    "failures",
  ] as const;

  const rows = results.map((r) => {
    const statusCell =
      r.old_status === r.new_status
        ? colorStatus(r.old_status)
        : `${colorStatus(r.old_status)} ${dim("→")} ${colorStatus(r.new_status)}`;
    const excludedCell =
      r.old_is_excluded === r.new_is_excluded
        ? String(r.old_is_excluded ?? "-")
        : `${r.old_is_excluded ?? "-"} ${dim("→")} ${r.new_is_excluded ?? "-"}`;
    const failuresCell =
      r.old_failure_count === r.new_failure_count
        ? String(r.old_failure_count ?? "-")
        : `${r.old_failure_count ?? "-"} ${dim("→")} ${r.new_failure_count ?? "-"}`;
    const actionCell =
      r.action === "reset"
        ? green("reset")
        : r.action === "already_clean"
          ? dim("already_clean")
          : yellow("not_found");

    return [
      cyan(r.entity_type),
      r.entity_id,
      actionCell,
      statusCell,
      excludedCell,
      failuresCell,
    ];
  });

  return renderTable(headers, rows);
}
