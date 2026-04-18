/**
 * Types for `session code-history`.
 *
 * Designed to grow: later slices will add `session`, `linear`, and
 * extractor fields. Keep this file the single source of truth for the
 * decorated-commit shape that feeds both the plain and JSON renderers.
 */

/**
 * A single commit decorated with the fields we can derive from `git log`.
 *
 * Slice 1 (ENG-5040) only populates the four raw git fields. Later slices
 * extend this with:
 *   - session?: { id, intent?, trigger?, outcome?, sinceTimestampCmd }
 *   - linear?:  { id, title, status }
 */
export interface DecoratedCommit {
  /** Full commit SHA (40 hex chars). Short SHA is derived at format time. */
  sha: string;
  /** ISO date of the commit — `YYYY-MM-DD`, from `git log --format=%cs`. */
  date: string;
  /** Commit subject line. */
  subject: string;
  /**
   * Full commit body. Trailer stripping happens in the format layer.
   *
   * Empty body is represented as `""` (empty string) — NOT `null`, NOT
   * `undefined`, NOT omitted. The JSON mode (slice 6) MUST emit `body`
   * as `""` in the empty case so consumers can rely on the key being
   * present and string-typed. Resolves an ambiguity surfaced in the
   * ENG-5040 Red review.
   */
  body: string;
}
