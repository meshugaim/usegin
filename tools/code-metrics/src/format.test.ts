import { describe, expect, test } from "bun:test";
import { formatTable, formatCsv, getMetricInfo } from "./format.js";
import type { MetricResult } from "./metrics.js";

describe("format", () => {
  const mockChurnResults: MetricResult[] = [
    {
      file: "src/file1.ts",
      value: 10000,
      details: {
        lines: 100,
        changes: 100,
      },
    },
    {
      file: "src/file2.ts",
      value: 5000,
      details: {
        lines: 50,
        changes: 100,
      },
    },
  ];

  describe("churn metric", () => {
    test("table format always shows Lines and Changes columns", () => {
      const output = formatTable(mockChurnResults, "churn", {
        format: "table",
        limit: 10,
        showDetails: false, // Even with showDetails=false, should show L and C
      });

      // Should contain column headers
      expect(output).toContain("File");
      expect(output).toContain("Score");
      expect(output).toContain("Lines");
      expect(output).toContain("Changes");

      // Should contain data
      expect(output).toContain("100"); // lines
      expect(output).toContain("50"); // lines from second file
    });

    test("csv format always shows Lines and Changes columns", () => {
      const output = formatCsv(mockChurnResults, "churn", {
        format: "csv",
        limit: 10,
        showDetails: false, // Even with showDetails=false, should show L and C
      });

      // Check headers
      const lines = output.split("\n");
      expect(lines[0]).toContain("File");
      expect(lines[0]).toContain("Score");
      expect(lines[0]).toContain("Lines");
      expect(lines[0]).toContain("Changes");

      // Check data rows
      expect(lines[1]).toContain("100"); // lines
      expect(lines[1]).toContain("100"); // changes
    });

    test("showDetails flag still works for other metrics", () => {
      const bugDensityResults: MetricResult[] = [
        {
          file: "src/buggy.ts",
          value: 50.0,
          details: {
            bugFixes: 10,
            totalChanges: 20,
            percentage: 50.0,
          },
        },
      ];

      // Without details - should only show File and Score
      const outputWithoutDetails = formatTable(bugDensityResults, "bug-density", {
        format: "table",
        limit: 10,
        showDetails: false,
      });

      expect(outputWithoutDetails).toContain("File");
      expect(outputWithoutDetails).toContain("Score");
      expect(outputWithoutDetails).not.toContain("Bug Fixes");

      // With details - should show all columns
      const outputWithDetails = formatTable(bugDensityResults, "bug-density", {
        format: "table",
        limit: 10,
        showDetails: true,
      });

      expect(outputWithDetails).toContain("File");
      expect(outputWithDetails).toContain("Score");
      expect(outputWithDetails).toContain("Bug Fixes");
    });
  });
});
