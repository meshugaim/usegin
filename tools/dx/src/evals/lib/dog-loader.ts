/**
 * dog-loader.ts — Parse a Definition of Good (DoG) markdown file.
 *
 * Parses:
 *   - H1 slug assertion (# DoG: <slug> matches filename)
 *   - ## Goal → goalText
 *   - ## Dimensions → table rows → DogDimension[]
 *   - ## Success criteria → raw text
 *   - ## Anti-criteria → raw text
 *   - ## Calibration anchors → raw text
 *   - ## Notes for the iterating Claude → raw text
 *
 * Returns a typed DogDocument.
 */

import { readFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { dogsDir } from "./case-loader";

export type DimensionType = "bool" | "float" | "int";
export type HowMeasured = `structural` | `judge:${string}` | `hybrid`;

export interface DogDimension {
  name: string;
  type: DimensionType;
  unit: string;
  threshold: string;
  how_measured: string;
}

export interface DogDocument {
  slug: string;
  goalText: string;
  dimensions: DogDimension[];
  successCriteria: string;
  antiCriteria: string;
  calibrationAnchors: string;
  notesForIterator: string;
  /** Full raw markdown — passed verbatim to the judge prompt */
  rawMarkdown: string;
}

export class DogParseError extends Error {
  constructor(
    public readonly filePath: string,
    message: string,
  ) {
    super(`dog-loader: ${filePath}: ${message}`);
    this.name = "DogParseError";
  }
}

function parseDimensionsTable(tableBlock: string, filePath: string): DogDimension[] {
  // Filter to pipe-bounded rows only; explicitly detect the --- separator row.
  const pipeLines = tableBlock
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\|.+\|$/.test(l));

  const separatorIdx = pipeLines.findIndex((l) => /^\|[\s|:-]+\|$/.test(l));
  if (separatorIdx < 0) {
    throw new DogParseError(filePath, '"## Dimensions" table missing separator row');
  }
  // Data rows are everything after the separator
  const dataLines = pipeLines.slice(separatorIdx + 1);
  const dimensions: DogDimension[] = [];

  for (const line of dataLines) {
    // Split by | and trim each cell
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length - 1); // strip leading/trailing empty

    if (cells.length < 5) continue;
    const [name, type, unit, threshold, how_measured] = cells;
    const thresholdVal = threshold.trim();
    // Validate threshold at load time — fail fast with a clear message.
    if (!isValidThreshold(thresholdVal)) {
      throw new DogParseError(
        filePath,
        `Invalid threshold "${thresholdVal}" for dimension "${name.trim()}" — expected like ">= 0.95"`,
      );
    }
    dimensions.push({
      name: name.trim(),
      type: type.trim() as DimensionType,
      unit: unit.trim(),
      threshold: thresholdVal,
      how_measured: how_measured.trim(),
    });
  }
  return dimensions;
}

function isValidThreshold(t: string): boolean {
  if (t === "== true" || t === "== false") return true;
  return /^[><=!]+\s*[\d.]+$/.test(t);
}

function extractSection(markdown: string, heading: string): string {
  // Match ## <heading> and grab content until the next ## or end
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^## ${escaped}\\s*$`, "m");
  const match = re.exec(markdown);
  if (!match) return "";
  const start = match.index + match[0].length;
  const rest = markdown.slice(start);
  const nextH2 = /^## /m.exec(rest);
  return (nextH2 ? rest.slice(0, nextH2.index) : rest).trim();
}

export function parseDog(filePath: string): DogDocument {
  let rawMarkdown: string;
  try {
    rawMarkdown = readFileSync(filePath, "utf-8");
  } catch {
    throw new DogParseError(filePath, "file not found or unreadable");
  }

  // Assert H1 slug matches filename
  const h1Match = /^# DoG:\s*(.+)$/m.exec(rawMarkdown);
  if (!h1Match) {
    throw new DogParseError(filePath, 'missing H1 "# DoG: <slug>"');
  }
  const slug = h1Match[1].trim();
  const fileSlug = basename(filePath, ".md");
  if (slug !== fileSlug) {
    throw new DogParseError(
      filePath,
      `H1 slug "${slug}" does not match filename slug "${fileSlug}"`,
    );
  }

  const goalText = extractSection(rawMarkdown, "Goal");
  if (!goalText) {
    throw new DogParseError(filePath, 'missing "## Goal" section');
  }

  const dimensionsBlock = extractSection(rawMarkdown, "Dimensions");
  if (!dimensionsBlock) {
    throw new DogParseError(filePath, 'missing "## Dimensions" section');
  }
  const dimensions = parseDimensionsTable(dimensionsBlock, filePath);
  if (dimensions.length === 0) {
    throw new DogParseError(filePath, '"## Dimensions" table has no rows');
  }

  const successCriteria = extractSection(rawMarkdown, "Success criteria");
  const antiCriteria = extractSection(rawMarkdown, "Anti-criteria");
  const calibrationAnchors = extractSection(rawMarkdown, "Calibration anchors");
  const notesForIterator = extractSection(rawMarkdown, "Notes for the iterating Claude");

  return {
    slug,
    goalText,
    dimensions,
    successCriteria,
    antiCriteria,
    calibrationAnchors,
    notesForIterator,
    rawMarkdown,
  };
}

/**
 * Resolve a dog_ref (relative path in the case JSON) to an absolute path,
 * then parse and return the DogDocument.
 *
 * dog_ref is relative to the case *file* (stored in evalCase._file_path).
 * When only corpus is available (legacy), fall back to dogsDir resolution.
 *
 * @param dogRef       The dog_ref string from the case JSON.
 * @param corpus       Corpus name ("effi"|"gin") — used as fallback only.
 * @param caseFilePath Absolute path of the case JSON — preferred resolution base.
 */
export function loadDog(dogRef: string, corpus: string, caseFilePath?: string): DogDocument {
  let absPath: string;
  if (caseFilePath) {
    // Resolve relative to the directory that holds the case file.
    absPath = resolve(dirname(caseFilePath), dogRef);
  } else {
    // Fallback: assume dog_ref is "../dogs/<file>" style relative to cases/
    absPath = join(dogsDir(corpus), basename(dogRef));
  }
  return parseDog(absPath);
}
