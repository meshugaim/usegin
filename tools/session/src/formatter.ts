/**
 * Barrel re-export for all formatter modules.
 *
 * Shared utilities live in format-shared.ts. Format-specific code lives in
 * dedicated modules. This file re-exports everything so existing imports
 * (e.g. `from "./formatter"`) continue to work without changes.
 *
 * Import graph (no cycles):
 *   format-narrative.ts  ─┐
 *   format-terminal.ts   ─┼─→ format-shared.ts
 *   format-markdown.ts   ─┘
 *   formatter.ts ──→ re-exports all of the above (one-way)
 */

// Shared types and utilities
export * from "./format-shared";

// Format-specific modules
export * from "./format-narrative";
export * from "./format-terminal";
export * from "./format-markdown";
