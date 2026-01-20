import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { $ } from "bun";

/**
 * Tests for Slice Coverage Validation (ENG-1273).
 *
 * Features:
 * 1. `teamwork-v2 validate <spec-id>` checks slices against spec requirements
 * 2. Gap detection - identifies spec requirements without slice coverage
 * 3. Overlap detection - identifies requirements covered by multiple slices
 * 4. Missing acceptance criteria detection
 * 5. Integration with `impl --all` (runs validate first, aborts on critical issues)
 *
 * All tests are expected to FAIL - the implementation does not exist yet.
 */

const TEST_WORKSPACES_DIR = join(tmpdir(), "teamwork-v2-test-validation");
const CLI_PATH = join(import.meta.dir, "../src/cli.ts");

interface WorkspaceDeps {
  workspacesDir: string;
}

// Slice definition with requirements mapping
interface Slice {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  requirements: string[]; // REQ-X references
  testApproach?: string;
  dependencies?: string[];
  isIndependent?: boolean;
}

// Spec requirement definition
interface SpecRequirement {
  id: string;
  description: string;
}

// Validation result structure
interface ValidationResult {
  gaps: string[]; // Requirement IDs not covered by any slice
  overlaps: string[]; // Requirements covered by multiple slices (formatted as "REQ-X: slice1, slice2")
  warnings: string[]; // General warnings (e.g., missing acceptance criteria)
  isValid: boolean; // True if no gaps (critical issues)
}

// Planning state with validation result
interface PlanningState {
  type: "plan";
  specId: string;
  phase: string;
  revisionCount: number;
  validationResult?: ValidationResult;
  createdAt: string;
  updatedAt: string;
}

beforeEach(async () => {
  await rm(TEST_WORKSPACES_DIR, { recursive: true, force: true });
  await mkdir(TEST_WORKSPACES_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_WORKSPACES_DIR, { recursive: true, force: true });
});

function createTestDeps(): WorkspaceDeps {
  return {
    workspacesDir: TEST_WORKSPACES_DIR,
  };
}

// Helper to create a planning workspace with slices and requirements
async function createPlanningWorkspaceWithSlices(
  specId: string,
  slices: Slice[],
  requirements: SpecRequirement[]
): Promise<string> {
  const workspacePath = join(TEST_WORKSPACES_DIR, specId);
  await mkdir(workspacePath, { recursive: true });
  await mkdir(join(workspacePath, "sessions"), { recursive: true });

  const now = new Date().toISOString();
  const state: PlanningState = {
    type: "plan",
    specId,
    phase: "approved",
    revisionCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await writeFile(
    join(workspacePath, "state.json"),
    JSON.stringify(state, null, 2)
  );
  await writeFile(join(workspacePath, "events.jsonl"), "");
  await writeFile(
    join(workspacePath, "slices.json"),
    JSON.stringify(slices, null, 2)
  );
  await writeFile(
    join(workspacePath, "spec-requirements.json"),
    JSON.stringify(requirements, null, 2)
  );

  return workspacePath;
}

// ============================================================================
// validate command Tests
// ============================================================================

describe("teamwork-v2 validate command", () => {
  describe("basic functionality", () => {
    test("validates slices against spec requirements", async () => {
      await createPlanningWorkspaceWithSlices(
        "ENG-100",
        [
          {
            title: "Auth",
            description: "Authentication",
            acceptanceCriteria: ["Login works"],
            requirements: ["REQ-1"],
          },
        ],
        [{ id: "REQ-1", description: "Users can login" }]
      );

      const result =
        await $`bun ${CLI_PATH} validate ENG-100 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toContain("Validation");
    });

    test("requires planning workspace to exist", async () => {
      const result =
        await $`bun ${CLI_PATH} validate ENG-FAKE --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("not found");
    });

    test("requires slices.json to exist", async () => {
      const workspacePath = join(TEST_WORKSPACES_DIR, "ENG-101");
      await mkdir(workspacePath, { recursive: true });
      await writeFile(
        join(workspacePath, "state.json"),
        JSON.stringify({ type: "plan", specId: "ENG-101", phase: "setup" })
      );

      const result =
        await $`bun ${CLI_PATH} validate ENG-101 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("slices.json");
    });

    test("requires spec-requirements.json to exist", async () => {
      const workspacePath = join(TEST_WORKSPACES_DIR, "ENG-102");
      await mkdir(workspacePath, { recursive: true });
      await writeFile(
        join(workspacePath, "state.json"),
        JSON.stringify({ type: "plan", specId: "ENG-102", phase: "setup" })
      );
      await writeFile(
        join(workspacePath, "slices.json"),
        JSON.stringify([{ title: "Test", requirements: ["REQ-1"] }])
      );

      const result =
        await $`bun ${CLI_PATH} validate ENG-102 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain("spec-requirements.json");
    });

    test("shows validation results summary", async () => {
      await createPlanningWorkspaceWithSlices(
        "ENG-103",
        [
          {
            title: "Auth",
            description: "Authentication",
            acceptanceCriteria: ["Login works"],
            requirements: ["REQ-1"],
          },
        ],
        [
          { id: "REQ-1", description: "Users can login" },
          { id: "REQ-2", description: "Users can logout" },
        ]
      );

      const result =
        await $`bun ${CLI_PATH} validate ENG-103 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.stdout.toString()).toContain("Gaps");
      expect(result.stdout.toString()).toContain("REQ-2");
    });

    test("supports --json output format", async () => {
      await createPlanningWorkspaceWithSlices(
        "ENG-104",
        [
          {
            title: "Auth",
            description: "Authentication",
            acceptanceCriteria: ["Login works"],
            requirements: ["REQ-1"],
          },
        ],
        [{ id: "REQ-1", description: "Users can login" }]
      );

      const result =
        await $`bun ${CLI_PATH} validate ENG-104 --workspaces-dir ${TEST_WORKSPACES_DIR} --json`.text();

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("gaps");
      expect(parsed).toHaveProperty("overlaps");
      expect(parsed).toHaveProperty("warnings");
      expect(parsed).toHaveProperty("isValid");
    });

    test("exits with non-zero code when gaps exist", async () => {
      await createPlanningWorkspaceWithSlices(
        "ENG-105",
        [
          {
            title: "Auth",
            description: "Authentication",
            acceptanceCriteria: ["Login works"],
            requirements: ["REQ-1"],
          },
        ],
        [
          { id: "REQ-1", description: "Users can login" },
          { id: "REQ-2", description: "Users can logout" },
        ]
      );

      const result =
        await $`bun ${CLI_PATH} validate ENG-105 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).not.toBe(0);
    });

    test("exits with zero code when fully covered", async () => {
      await createPlanningWorkspaceWithSlices(
        "ENG-106",
        [
          {
            title: "Auth",
            description: "Authentication",
            acceptanceCriteria: ["Login works", "Logout works"],
            requirements: ["REQ-1", "REQ-2"],
          },
        ],
        [
          { id: "REQ-1", description: "Users can login" },
          { id: "REQ-2", description: "Users can logout" },
        ]
      );

      const result =
        await $`bun ${CLI_PATH} validate ENG-106 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

      expect(result.exitCode).toBe(0);
    });
  });
});

// ============================================================================
// Gap Detection Tests
// ============================================================================

describe("Gap Detection", () => {
  test("identifies requirements not covered by any slice", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-200",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
      ],
      [
        { id: "REQ-1", description: "Users can login" },
        { id: "REQ-2", description: "Users can logout" },
        { id: "REQ-3", description: "Users can reset password" },
      ]
    );

    const result = await validateSliceCoverage("ENG-200", deps);

    expect(result.gaps).toContain("REQ-2");
    expect(result.gaps).toContain("REQ-3");
    expect(result.gaps).not.toContain("REQ-1");
  });

  test("marks gaps as critical issues", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-201",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
      ],
      [
        { id: "REQ-1", description: "Users can login" },
        { id: "REQ-2", description: "Users can logout" },
      ]
    );

    const result = await validateSliceCoverage("ENG-201", deps);

    expect(result.isValid).toBe(false);
  });

  test("shows which requirements are not covered", async () => {
    await createPlanningWorkspaceWithSlices(
      "ENG-202",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
      ],
      [
        { id: "REQ-1", description: "Users can login" },
        { id: "REQ-2", description: "Users can logout" },
      ]
    );

    const result =
      await $`bun ${CLI_PATH} validate ENG-202 --workspaces-dir ${TEST_WORKSPACES_DIR}`.nothrow();

    expect(result.stdout.toString()).toContain("REQ-2");
    expect(result.stdout.toString()).toContain("Users can logout");
  });

  test("reports no gaps when all requirements are covered", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-203",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works", "Logout works"],
          requirements: ["REQ-1", "REQ-2"],
        },
      ],
      [
        { id: "REQ-1", description: "Users can login" },
        { id: "REQ-2", description: "Users can logout" },
      ]
    );

    const result = await validateSliceCoverage("ENG-203", deps);

    expect(result.gaps).toHaveLength(0);
    expect(result.isValid).toBe(true);
  });

  test("handles empty requirements list", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-204",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
      ],
      []
    );

    const result = await validateSliceCoverage("ENG-204", deps);

    expect(result.gaps).toHaveLength(0);
    expect(result.isValid).toBe(true);
  });

  test("handles empty slices list", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices("ENG-205", [], [
      { id: "REQ-1", description: "Users can login" },
    ]);

    const result = await validateSliceCoverage("ENG-205", deps);

    expect(result.gaps).toContain("REQ-1");
    expect(result.isValid).toBe(false);
  });
});

// ============================================================================
// Overlap Detection Tests
// ============================================================================

describe("Overlap Detection", () => {
  test("identifies requirements covered by multiple slices", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-300",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
        {
          title: "Security",
          description: "Security features",
          acceptanceCriteria: ["Auth secure"],
          requirements: ["REQ-1", "REQ-2"],
        },
      ],
      [
        { id: "REQ-1", description: "Users can login" },
        { id: "REQ-2", description: "Security audit" },
      ]
    );

    const result = await validateSliceCoverage("ENG-300", deps);

    expect(result.overlaps.length).toBeGreaterThan(0);
    expect(result.overlaps.some((o) => o.includes("REQ-1"))).toBe(true);
  });

  test("marks overlaps as warnings not critical issues", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-301",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
        {
          title: "Security",
          description: "Security features",
          acceptanceCriteria: ["Auth secure"],
          requirements: ["REQ-1"],
        },
      ],
      [{ id: "REQ-1", description: "Users can login" }]
    );

    const result = await validateSliceCoverage("ENG-301", deps);

    // Overlaps don't make validation fail (isValid should be true if no gaps)
    expect(result.isValid).toBe(true);
    expect(result.overlaps.length).toBeGreaterThan(0);
  });

  test("shows which slices overlap on which requirements", async () => {
    await createPlanningWorkspaceWithSlices(
      "ENG-302",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
        {
          title: "Security",
          description: "Security features",
          acceptanceCriteria: ["Auth secure"],
          requirements: ["REQ-1"],
        },
      ],
      [{ id: "REQ-1", description: "Users can login" }]
    );

    const result =
      await $`bun ${CLI_PATH} validate ENG-302 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("REQ-1");
    expect(result).toContain("Auth");
    expect(result).toContain("Security");
  });

  test("reports no overlaps when each requirement covered once", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-303",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
        {
          title: "Profile",
          description: "Profile features",
          acceptanceCriteria: ["Profile works"],
          requirements: ["REQ-2"],
        },
      ],
      [
        { id: "REQ-1", description: "Users can login" },
        { id: "REQ-2", description: "Users can view profile" },
      ]
    );

    const result = await validateSliceCoverage("ENG-303", deps);

    expect(result.overlaps).toHaveLength(0);
  });

  test("detects multiple overlapping requirements", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-304",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Works"],
          requirements: ["REQ-1", "REQ-2"],
        },
        {
          title: "Security",
          description: "Security",
          acceptanceCriteria: ["Works"],
          requirements: ["REQ-1", "REQ-2"],
        },
      ],
      [
        { id: "REQ-1", description: "Login" },
        { id: "REQ-2", description: "Logout" },
      ]
    );

    const result = await validateSliceCoverage("ENG-304", deps);

    expect(result.overlaps.length).toBe(2);
  });
});

// ============================================================================
// Missing Acceptance Criteria Tests
// ============================================================================

describe("Missing Acceptance Criteria", () => {
  test("checks that each slice has acceptance criteria", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-400",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: [], // Empty acceptance criteria
          requirements: ["REQ-1"],
        },
      ],
      [{ id: "REQ-1", description: "Users can login" }]
    );

    const result = await validateSliceCoverage("ENG-400", deps);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("Auth"))).toBe(true);
    expect(
      result.warnings.some((w) => w.toLowerCase().includes("acceptance"))
    ).toBe(true);
  });

  test("missing criteria are warnings not critical", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-401",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: [],
          requirements: ["REQ-1"],
        },
      ],
      [{ id: "REQ-1", description: "Users can login" }]
    );

    const result = await validateSliceCoverage("ENG-401", deps);

    // Missing acceptance criteria should not make validation fail
    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("no warning when slice has acceptance criteria", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-402",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login form renders", "Login validates email"],
          requirements: ["REQ-1"],
        },
      ],
      [{ id: "REQ-1", description: "Users can login" }]
    );

    const result = await validateSliceCoverage("ENG-402", deps);

    expect(
      result.warnings.filter(
        (w) => w.includes("Auth") && w.toLowerCase().includes("acceptance")
      )
    ).toHaveLength(0);
  });

  test("shows warning in CLI output", async () => {
    await createPlanningWorkspaceWithSlices(
      "ENG-403",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: [],
          requirements: ["REQ-1"],
        },
      ],
      [{ id: "REQ-1", description: "Users can login" }]
    );

    const result =
      await $`bun ${CLI_PATH} validate ENG-403 --workspaces-dir ${TEST_WORKSPACES_DIR}`.text();

    expect(result).toContain("Warning");
    expect(result).toContain("Auth");
  });

  test("detects multiple slices with missing criteria", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-404",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: [],
          requirements: ["REQ-1"],
        },
        {
          title: "Profile",
          description: "Profile",
          acceptanceCriteria: [],
          requirements: ["REQ-2"],
        },
      ],
      [
        { id: "REQ-1", description: "Login" },
        { id: "REQ-2", description: "Profile" },
      ]
    );

    const result = await validateSliceCoverage("ENG-404", deps);

    expect(result.warnings.filter((w) => w.toLowerCase().includes("acceptance"))).toHaveLength(2);
  });
});

// ============================================================================
// Integration with impl --all Tests
// ============================================================================

describe("Integration with impl --all", () => {
  test("impl --all runs validate first", async () => {
    await createPlanningWorkspaceWithSlices(
      "ENG-500",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
      ],
      [{ id: "REQ-1", description: "Users can login" }]
    );

    const result =
      await $`bun ${CLI_PATH} impl --all ENG-500 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

    expect(result).toContain("Validating");
  });

  test("impl --all aborts if critical issues (gaps)", async () => {
    await createPlanningWorkspaceWithSlices(
      "ENG-501",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
      ],
      [
        { id: "REQ-1", description: "Login" },
        { id: "REQ-2", description: "Logout" }, // Gap - not covered
      ]
    );

    const result =
      await $`bun ${CLI_PATH} impl --all ENG-501 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain("validation failed");
  });

  test("impl --all continues if only warnings (overlaps)", async () => {
    await createPlanningWorkspaceWithSlices(
      "ENG-502",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
        {
          title: "Security",
          description: "Security",
          acceptanceCriteria: ["Secure"],
          requirements: ["REQ-1"], // Overlap - same requirement
        },
      ],
      [{ id: "REQ-1", description: "Login" }]
    );

    const result =
      await $`bun ${CLI_PATH} impl --all ENG-502 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.nothrow();

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("overlap");
  });

  test("impl --all --skip-validation bypasses validation", async () => {
    await createPlanningWorkspaceWithSlices(
      "ENG-503",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
      ],
      [
        { id: "REQ-1", description: "Login" },
        { id: "REQ-2", description: "Logout" }, // Gap - would normally fail
      ]
    );

    const result =
      await $`bun ${CLI_PATH} impl --all ENG-503 --workspaces-dir ${TEST_WORKSPACES_DIR} --skip-validation --dry-run`.nothrow();

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).not.toContain("Validating");
  });

  test("impl --all shows validation results before implementation", async () => {
    await createPlanningWorkspaceWithSlices(
      "ENG-504",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
      ],
      [{ id: "REQ-1", description: "Users can login" }]
    );

    const result =
      await $`bun ${CLI_PATH} impl --all ENG-504 --workspaces-dir ${TEST_WORKSPACES_DIR} --dry-run`.text();

    const validationIndex = result.indexOf("Validation");
    const implIndex = result.indexOf("Implementation");

    expect(validationIndex).toBeLessThan(implIndex);
  });
});

// ============================================================================
// State Extension Tests
// ============================================================================

describe("State Extensions", () => {
  test("stores validationResult in state after validate", async () => {
    const { validateSliceCoverage, readPlanningState } = await import(
      "../src/validation"
    );

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-600",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
      ],
      [
        { id: "REQ-1", description: "Login" },
        { id: "REQ-2", description: "Logout" },
      ]
    );

    await validateSliceCoverage("ENG-600", deps);

    const state = await readPlanningState("ENG-600", deps);

    expect(state.validationResult).toBeDefined();
    expect(state.validationResult?.gaps).toContain("REQ-2");
    expect(state.validationResult?.isValid).toBe(false);
  });

  test("validationResult has gaps array", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-601",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Login works"],
          requirements: ["REQ-1"],
        },
      ],
      [
        { id: "REQ-1", description: "Login" },
        { id: "REQ-2", description: "Logout" },
      ]
    );

    const result = await validateSliceCoverage("ENG-601", deps);

    expect(Array.isArray(result.gaps)).toBe(true);
    expect(result.gaps).toContain("REQ-2");
  });

  test("validationResult has overlaps array", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-602",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Works"],
          requirements: ["REQ-1"],
        },
        {
          title: "Security",
          description: "Security",
          acceptanceCriteria: ["Works"],
          requirements: ["REQ-1"],
        },
      ],
      [{ id: "REQ-1", description: "Login" }]
    );

    const result = await validateSliceCoverage("ENG-602", deps);

    expect(Array.isArray(result.overlaps)).toBe(true);
  });

  test("validationResult has warnings array", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-603",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: [],
          requirements: ["REQ-1"],
        },
      ],
      [{ id: "REQ-1", description: "Login" }]
    );

    const result = await validateSliceCoverage("ENG-603", deps);

    expect(Array.isArray(result.warnings)).toBe(true);
  });

  test("validationResult has isValid boolean", async () => {
    const { validateSliceCoverage } = await import("../src/validation");

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-604",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Works"],
          requirements: ["REQ-1"],
        },
      ],
      [{ id: "REQ-1", description: "Login" }]
    );

    const result = await validateSliceCoverage("ENG-604", deps);

    expect(typeof result.isValid).toBe("boolean");
    expect(result.isValid).toBe(true);
  });
});

// ============================================================================
// Event Emission Tests
// ============================================================================

describe("Validation Events", () => {
  test("emits validation_started event", async () => {
    const { validateSliceCoverage, readEvents } = await import(
      "../src/validation"
    );

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-700",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Works"],
          requirements: ["REQ-1"],
        },
      ],
      [{ id: "REQ-1", description: "Login" }]
    );

    await validateSliceCoverage("ENG-700", deps);

    const events = await readEvents("ENG-700", deps);
    const startEvent = events.find(
      (e: { event: string }) => e.event === "validation_started"
    );

    expect(startEvent).toBeDefined();
  });

  test("emits validation_completed event with results", async () => {
    const { validateSliceCoverage, readEvents } = await import(
      "../src/validation"
    );

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-701",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Works"],
          requirements: ["REQ-1"],
        },
      ],
      [
        { id: "REQ-1", description: "Login" },
        { id: "REQ-2", description: "Logout" },
      ]
    );

    await validateSliceCoverage("ENG-701", deps);

    const events = await readEvents("ENG-701", deps);
    const completedEvent = events.find(
      (e: { event: string }) => e.event === "validation_completed"
    );

    expect(completedEvent).toBeDefined();
    expect(completedEvent?.data.gapsCount).toBe(1);
    expect(completedEvent?.data.overlapsCount).toBe(0);
    expect(completedEvent?.data.isValid).toBe(false);
  });

  test("emits gap_detected event for each gap", async () => {
    const { validateSliceCoverage, readEvents } = await import(
      "../src/validation"
    );

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-702",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Works"],
          requirements: ["REQ-1"],
        },
      ],
      [
        { id: "REQ-1", description: "Login" },
        { id: "REQ-2", description: "Logout" },
        { id: "REQ-3", description: "Reset password" },
      ]
    );

    await validateSliceCoverage("ENG-702", deps);

    const events = await readEvents("ENG-702", deps);
    const gapEvents = events.filter(
      (e: { event: string }) => e.event === "gap_detected"
    );

    expect(gapEvents.length).toBe(2);
    expect(gapEvents.some((e: { data: { requirementId: string } }) => e.data.requirementId === "REQ-2")).toBe(true);
    expect(gapEvents.some((e: { data: { requirementId: string } }) => e.data.requirementId === "REQ-3")).toBe(true);
  });

  test("emits overlap_detected event for each overlap", async () => {
    const { validateSliceCoverage, readEvents } = await import(
      "../src/validation"
    );

    const deps = createTestDeps();
    await createPlanningWorkspaceWithSlices(
      "ENG-703",
      [
        {
          title: "Auth",
          description: "Authentication",
          acceptanceCriteria: ["Works"],
          requirements: ["REQ-1"],
        },
        {
          title: "Security",
          description: "Security",
          acceptanceCriteria: ["Works"],
          requirements: ["REQ-1"],
        },
      ],
      [{ id: "REQ-1", description: "Login" }]
    );

    await validateSliceCoverage("ENG-703", deps);

    const events = await readEvents("ENG-703", deps);
    const overlapEvents = events.filter(
      (e: { event: string }) => e.event === "overlap_detected"
    );

    expect(overlapEvents.length).toBe(1);
    expect(overlapEvents[0].data.requirementId).toBe("REQ-1");
    expect(overlapEvents[0].data.slices).toContain("Auth");
    expect(overlapEvents[0].data.slices).toContain("Security");
  });
});
