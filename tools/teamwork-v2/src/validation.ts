import { readFile, writeFile, access } from "fs/promises";
import { join } from "path";
import {
  getWorkspacePath,
  readPlanningState as workspaceReadPlanningState,
  updatePlanningState,
  type WorkspaceDeps,
  type PlanningState,
  type ValidationResult,
} from "./workspace";
import { emitEvent, readEvents as eventsReadEvents, type PlanningEvent } from "./events";

// Re-export ValidationResult for external use
export type { ValidationResult } from "./workspace";

/**
 * Requirement from spec-requirements.json
 */
export interface Requirement {
  id: string;
  description: string;
}

/**
 * Slice from slices.json
 */
export interface Slice {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  requirements: string[]; // requirement IDs covered
  testApproach?: string;
  dependencies?: string[];
  isIndependent?: boolean;
}

/**
 * Gap - a requirement not covered by any slice
 */
export interface Gap {
  requirementId: string;
  description: string;
}

/**
 * Overlap - a requirement covered by multiple slices
 */
export interface Overlap {
  requirementId: string;
  slices: string[]; // slice titles
}

/**
 * Warning - non-critical issue like missing acceptance criteria
 */
export interface Warning {
  type: "missing_criteria" | "other";
  sliceTitle: string;
  message: string;
}

// ValidationResult is imported and re-exported from workspace.ts

/**
 * Read spec requirements from the workspace
 */
export async function readSpecRequirements(
  specId: string,
  deps: WorkspaceDeps
): Promise<Requirement[]> {
  const workspacePath = getWorkspacePath(specId, deps);
  const requirementsPath = join(workspacePath, "spec-requirements.json");

  const content = await readFile(requirementsPath, "utf-8");
  return JSON.parse(content);
}

/**
 * Read slices from the workspace
 */
export async function readSlices(
  specId: string,
  deps: WorkspaceDeps
): Promise<Slice[]> {
  const workspacePath = getWorkspacePath(specId, deps);
  const slicesPath = join(workspacePath, "slices.json");

  const content = await readFile(slicesPath, "utf-8");
  return JSON.parse(content);
}

/**
 * Find gaps - requirements not covered by any slice
 */
export function findGaps(requirements: Requirement[], slices: Slice[]): Gap[] {
  // Build a set of all covered requirement IDs
  const coveredRequirements = new Set<string>();
  for (const slice of slices) {
    for (const reqId of slice.requirements || []) {
      coveredRequirements.add(reqId);
    }
  }

  // Find requirements that are not covered
  const gaps: Gap[] = [];
  for (const req of requirements) {
    if (!coveredRequirements.has(req.id)) {
      gaps.push({
        requirementId: req.id,
        description: req.description,
      });
    }
  }

  return gaps;
}

/**
 * Find overlaps - requirements covered by multiple slices
 */
export function findOverlaps(requirements: Requirement[], slices: Slice[]): Overlap[] {
  // Build a map of requirement ID -> slice titles
  const requirementToSlices = new Map<string, string[]>();

  for (const slice of slices) {
    for (const reqId of slice.requirements || []) {
      const existingSlices = requirementToSlices.get(reqId) || [];
      existingSlices.push(slice.title);
      requirementToSlices.set(reqId, existingSlices);
    }
  }

  // Find requirements covered by more than one slice
  const overlaps: Overlap[] = [];
  requirementToSlices.forEach((sliceTitles, reqId) => {
    if (sliceTitles.length > 1) {
      overlaps.push({
        requirementId: reqId,
        slices: sliceTitles,
      });
    }
  });

  return overlaps;
}

/**
 * Find slices with missing acceptance criteria
 */
export function findMissingCriteria(slices: Slice[]): Warning[] {
  const warnings: Warning[] = [];

  for (const slice of slices) {
    if (!slice.acceptanceCriteria || slice.acceptanceCriteria.length === 0) {
      warnings.push({
        type: "missing_criteria",
        sliceTitle: slice.title,
        message: `Slice "${slice.title}" has no acceptance criteria`,
      });
    }
  }

  return warnings;
}

/**
 * Build a requirements map for looking up descriptions
 */
function buildRequirementsMap(requirements: Requirement[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const req of requirements) {
    map.set(req.id, req.description);
  }
  return map;
}

/**
 * Main validation function - validates slices against spec requirements
 */
export async function validateSliceCoverage(
  specId: string,
  deps: WorkspaceDeps
): Promise<ValidationResult> {
  const workspacePath = getWorkspacePath(specId, deps);

  // Emit validation_started event
  await emitEvent(specId, "validation_started", { specId }, deps);

  // Read requirements and slices
  const requirements = await readSpecRequirements(specId, deps);
  const slices = await readSlices(specId, deps);

  // Find gaps, overlaps, and warnings
  const gapsDetails = findGaps(requirements, slices);
  const overlapsDetails = findOverlaps(requirements, slices);
  const warningsDetails = findMissingCriteria(slices);

  // Build requirements map for descriptions
  const reqMap = buildRequirementsMap(requirements);

  // Emit gap_detected events
  for (const gap of gapsDetails) {
    await emitEvent(
      specId,
      "gap_detected",
      {
        requirementId: gap.requirementId,
        description: gap.description,
      },
      deps
    );
  }

  // Emit overlap_detected events
  for (const overlap of overlapsDetails) {
    await emitEvent(
      specId,
      "overlap_detected",
      {
        requirementId: overlap.requirementId,
        slices: overlap.slices,
      },
      deps
    );
  }

  // Convert to result format
  const gaps = gapsDetails.map((g) => g.requirementId);
  const overlaps = overlapsDetails.map(
    (o) => `${o.requirementId}: ${o.slices.join(", ")}`
  );
  const warnings = warningsDetails.map((w) => w.message);

  const result: ValidationResult = {
    gaps,
    overlaps,
    warnings,
    isValid: gaps.length === 0,
  };

  // Emit validation_completed event
  await emitEvent(
    specId,
    "validation_completed",
    {
      gapsCount: gaps.length,
      overlapsCount: overlaps.length,
      warningsCount: warnings.length,
      isValid: result.isValid,
    },
    deps
  );

  // Update state with validation result
  await updatePlanningState(specId, { validationResult: result } as Partial<PlanningState & { validationResult: ValidationResult }>, deps);

  return result;
}

/**
 * Re-export readPlanningState from workspace for convenience
 */
export async function readPlanningState(
  specId: string,
  deps: WorkspaceDeps
): Promise<PlanningState & { validationResult?: ValidationResult }> {
  return workspaceReadPlanningState(specId, deps) as Promise<
    PlanningState & { validationResult?: ValidationResult }
  >;
}

/**
 * Re-export readEvents from events for convenience
 */
export async function readEvents(
  specId: string,
  deps: WorkspaceDeps
): Promise<PlanningEvent[]> {
  return eventsReadEvents(specId, deps);
}

/**
 * Check if slices.json exists in workspace
 */
export async function slicesExist(
  specId: string,
  deps: WorkspaceDeps
): Promise<boolean> {
  const workspacePath = getWorkspacePath(specId, deps);
  const slicesPath = join(workspacePath, "slices.json");
  try {
    await access(slicesPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if spec-requirements.json exists in workspace
 */
export async function specRequirementsExist(
  specId: string,
  deps: WorkspaceDeps
): Promise<boolean> {
  const workspacePath = getWorkspacePath(specId, deps);
  const requirementsPath = join(workspacePath, "spec-requirements.json");
  try {
    await access(requirementsPath);
    return true;
  } catch {
    return false;
  }
}
