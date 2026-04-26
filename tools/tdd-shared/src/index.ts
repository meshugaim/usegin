/**
 * tdd-shared — shared library for TDD-discipline skills.
 *
 * Consumed by:
 *   - tools/worker-reviewer-experiment/hooks/validate-submission.ts
 *   - .claude/skills/tdd-execute/hooks/gate-edit-by-phase.ts (planned)
 *
 * Add new exports here as the surface grows; keep modules small and
 * single-responsibility (state, events, test-globs, frontmatter).
 */

export * from "./state";
export * from "./events";
export * from "./test-globs";
export * from "./frontmatter";
