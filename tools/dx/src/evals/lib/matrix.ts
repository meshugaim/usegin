/**
 * matrix.ts — Parse --matrix flags and produce the Cartesian cell list.
 *
 * Supported axes at v0: model, prompt.
 * Other axes emit a clear error naming the boundary.
 */

export const SUPPORTED_AXES = ["model", "prompt"] as const;
export type SupportedAxis = (typeof SUPPORTED_AXES)[number];

export interface MatrixAxisSpec {
  axis: string;
  values: string[];
}

export interface CellSpec {
  model: string;
  prompt: string;
  /** e.g. { model: "opus", prompt: "v1" } */
  axisLabels: Record<string, string>;
}

/**
 * Parse raw --matrix flag values ("model=opus,sonnet", "prompt=v1,v2", …).
 * Throws a descriptive error for unsupported axes.
 */
export function parseMatrixFlags(rawList: string[]): MatrixAxisSpec[] {
  const axes: MatrixAxisSpec[] = [];
  for (const raw of rawList) {
    const eqIdx = raw.indexOf("=");
    if (eqIdx === -1) {
      throw new Error(
        `--matrix: expected "axis=value1,value2" format, got: "${raw}"`,
      );
    }
    const axis = raw.slice(0, eqIdx).trim();
    const valStr = raw.slice(eqIdx + 1).trim();
    if (!axis || !valStr) {
      throw new Error(`--matrix: axis name and values must be non-empty, got: "${raw}"`);
    }
    if (!(SUPPORTED_AXES as readonly string[]).includes(axis)) {
      throw new Error(
        `--matrix: axis "${axis}" is not supported at v0. ` +
          `Supported axes: ${SUPPORTED_AXES.join(", ")}. ` +
          `Temperature, judge-model, and other axes are planned for v1.`,
      );
    }
    const values = valStr.split(",").map((v) => v.trim()).filter((v) => v.length > 0);
    if (values.length === 0) {
      throw new Error(`--matrix: no values after splitting "${valStr}" for axis "${axis}"`);
    }
    axes.push({ axis, values });
  }
  return axes;
}

/**
 * Produce the Cartesian product of all axes.
 * Fills in defaults for axes not mentioned:
 *   model  → ["claude-sonnet-4-6"]
 *   prompt → ["baseline"]
 */
export function cartesian(
  axes: MatrixAxisSpec[],
  defaults: { model: string; prompt: string },
): CellSpec[] {
  const modelValues = axes.find((a) => a.axis === "model")?.values ?? [defaults.model];
  const promptValues = axes.find((a) => a.axis === "prompt")?.values ?? [defaults.prompt];

  const cells: CellSpec[] = [];
  for (const model of modelValues) {
    for (const prompt of promptValues) {
      cells.push({
        model,
        prompt,
        axisLabels: { model, prompt },
      });
    }
  }
  return cells;
}

/**
 * Derive a filesystem-safe slug for a cell.
 * Keeps axis values to 12 chars each; adds a short hash suffix when truncated.
 *
 * Format: model_<model>__prompt_<prompt>
 * Double-underscore separates axes; single-underscore separates key+value.
 * Omits the prompt segment entirely when prompt is "(embedded)" (gin corpus,
 * no prompt axis in the matrix).
 *
 * Note: the djb2-style hash is deterministic but not collision-proof at v0;
 * revisit if cell count grows past ~100.
 */
export function cellSlug(cell: CellSpec): string {
  const truncate = (s: string): string => {
    if (s.length <= 12) return s;
    // simple djb2-style hash for suffix
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return s.slice(0, 10) + h.toString(36).slice(0, 4);
  };
  const modelPart = truncate(cell.model.replace(/[^a-z0-9-]/gi, "-").toLowerCase());
  if (cell.prompt === "(embedded)") {
    // Gin corpus with no prompt axis: slug is just the model segment
    return `model_${modelPart}`;
  }
  const promptPart = truncate(cell.prompt.replace(/[^a-z0-9-]/gi, "-").toLowerCase());
  return `model_${modelPart}__prompt_${promptPart}`;
}
