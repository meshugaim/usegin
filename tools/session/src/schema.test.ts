/**
 * Schema Drift Detector
 *
 * This test scans real JSONL files from ~/.claude/projects/ to detect
 * unknown entry types that aren't covered by our types.ts definitions.
 *
 * This helps us discover new entry types added to Claude Code sessions
 * so we can update our parser accordingly.
 */

import { test, expect, describe, beforeAll } from "bun:test";
import { Glob } from "bun";
import { homedir } from "os";
import { KNOWN_ENTRY_TYPES, KNOWN_FIELDS_BY_TYPE } from "./types";

/**
 * Extract all unique 'type' values from a JSONL file
 * Returns a Set of type strings found in the file
 */
export async function extractTypesFromJSONL(filePath: string): Promise<Set<string>> {
  const types = new Set<string>();

  try {
    const file = Bun.file(filePath);
    const content = await file.text();
    const lines = content.split("\n").filter((l) => l.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type && typeof entry.type === "string") {
          types.add(entry.type);
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Skip files we can't read
  }

  return types;
}

/**
 * Extract all unique fields for each entry type from a JSONL file
 * Returns a Map of type -> Set of field names
 */
export async function extractFieldsByTypeFromJSONL(
  filePath: string
): Promise<Map<string, Set<string>>> {
  const fieldsByType = new Map<string, Set<string>>();

  try {
    const file = Bun.file(filePath);
    const content = await file.text();
    const lines = content.split("\n").filter((l) => l.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type && typeof entry.type === "string") {
          if (!fieldsByType.has(entry.type)) {
            fieldsByType.set(entry.type, new Set());
          }
          const fields = fieldsByType.get(entry.type)!;
          for (const key of Object.keys(entry)) {
            fields.add(key);
          }
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Skip files we can't read
  }

  return fieldsByType;
}

/**
 * Find all JSONL files in the Claude projects directory
 */
async function findAllJSONLFiles(): Promise<string[]> {
  const claudeDir = `${homedir()}/.claude/projects`;
  const files: string[] = [];

  try {
    const glob = new Glob("**/*.jsonl");
    for await (const file of glob.scan({ cwd: claudeDir, absolute: true })) {
      files.push(file);
    }
  } catch {
    // Directory might not exist
  }

  return files;
}

describe("schema drift detector", () => {
  let jsonlFiles: string[] = [];
  let allTypesFound: Set<string> = new Set();
  let allFieldsByType: Map<string, Set<string>> = new Map();

  beforeAll(async () => {
    jsonlFiles = await findAllJSONLFiles();

    if (jsonlFiles.length === 0) {
      console.log("\n[Schema Drift] No JSONL files found in ~/.claude/projects/");
      console.log("[Schema Drift] Skipping schema drift detection - run on a machine with Claude sessions\n");
      return;
    }

    console.log(`\n[Schema Drift] Scanning ${jsonlFiles.length} JSONL files...`);

    // Collect all types and fields from all files
    for (const file of jsonlFiles) {
      const types = await extractTypesFromJSONL(file);
      for (const type of types) {
        allTypesFound.add(type);
      }

      const fieldsByType = await extractFieldsByTypeFromJSONL(file);
      for (const [type, fields] of fieldsByType) {
        if (!allFieldsByType.has(type)) {
          allFieldsByType.set(type, new Set());
        }
        const existingFields = allFieldsByType.get(type)!;
        for (const field of fields) {
          existingFields.add(field);
        }
      }
    }

    console.log(`[Schema Drift] Found ${allTypesFound.size} unique entry types\n`);
  });

  test("should report all discovered entry types", () => {
    if (jsonlFiles.length === 0) {
      console.log("  [SKIPPED] No JSONL files available");
      return;
    }

    console.log("\n=== Entry Types Found ===");
    const sortedTypes = [...allTypesFound].sort();
    for (const type of sortedTypes) {
      const isKnown = KNOWN_ENTRY_TYPES.includes(type);
      const status = isKnown ? "[OK]" : "[UNKNOWN]";
      console.log(`  ${status} ${type}`);
    }
    console.log("");

    // This test always passes - it's informational
    expect(true).toBe(true);
  });

  test("should identify unknown entry types", () => {
    if (jsonlFiles.length === 0) {
      console.log("  [SKIPPED] No JSONL files available");
      return;
    }

    const unknownTypes = [...allTypesFound].filter(
      (type) => !KNOWN_ENTRY_TYPES.includes(type)
    );

    if (unknownTypes.length > 0) {
      console.log("\n=== Unknown Entry Types ===");
      console.log("The following types were found but are not in types.ts:");
      for (const type of unknownTypes) {
        console.log(`  - "${type}"`);
      }
      console.log("\nConsider adding these to the EntryType union in types.ts");
      console.log("");
    } else {
      console.log("\n[Schema Drift] All entry types are known - no drift detected\n");
    }

    // This is informational - we don't fail the test for unknown types
    // but we do report them clearly
    expect(true).toBe(true);
  });

  test("should report unknown fields on known types", () => {
    if (jsonlFiles.length === 0) {
      console.log("  [SKIPPED] No JSONL files available");
      return;
    }

    console.log("\n=== Fields by Type ===");

    let hasUnknownFields = false;
    const sortedTypes = [...allFieldsByType.keys()].sort();

    for (const type of sortedTypes) {
      const fields = allFieldsByType.get(type)!;
      const knownFields = KNOWN_FIELDS_BY_TYPE[type] ?? [];
      const unknownFields = [...fields].filter(
        (f) => !knownFields.includes(f) && f !== "type"
      );

      if (unknownFields.length > 0) {
        hasUnknownFields = true;
        console.log(`\n  ${type}:`);
        console.log(`    Known fields: ${knownFields.join(", ") || "(none defined)"}`);
        console.log(`    Unknown fields: ${unknownFields.join(", ")}`);
      }
    }

    if (!hasUnknownFields) {
      console.log("  No unknown fields found on known types\n");
    } else {
      console.log("\n[Schema Drift] Consider updating KNOWN_FIELDS_BY_TYPE in types.ts\n");
    }

    // Informational - always passes
    expect(true).toBe(true);
  });

  test("should provide summary statistics", () => {
    if (jsonlFiles.length === 0) {
      console.log("  [SKIPPED] No JSONL files available");
      return;
    }

    const unknownTypes = [...allTypesFound].filter(
      (type) => !KNOWN_ENTRY_TYPES.includes(type)
    );

    console.log("\n=== Summary ===");
    console.log(`  Files scanned: ${jsonlFiles.length}`);
    console.log(`  Total entry types: ${allTypesFound.size}`);
    console.log(`  Known types: ${allTypesFound.size - unknownTypes.length}`);
    console.log(`  Unknown types: ${unknownTypes.length}`);
    console.log("");

    if (unknownTypes.length > 0) {
      console.log("  ACTION NEEDED: Update types.ts with the unknown types listed above");
    } else {
      console.log("  STATUS: Schema is up to date");
    }
    console.log("");

    expect(true).toBe(true);
  });
});
