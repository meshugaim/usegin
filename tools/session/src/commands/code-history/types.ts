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
  /**
   * Full ISO-8601 committer timestamp from `git log --format=%cI`
   * (e.g. `2026-04-18T08:43:00+00:00`). Slice 4 (ENG-5043) needs
   * minute-precision timestamps for the `--since-timestamp <t-30m>`
   * hint rendered on the session line; `%cs` alone (date-only) isn't
   * enough. Kept alongside `date` rather than replacing it because
   * the header line still wants `YYYY-MM-DD` verbatim from `%cs`.
   */
  committedAt: string;
  /** Commit subject line. */
  subject: string;
  /**
   * Full commit body. Trailer stripping happens in the format layer.
   *
   * Empty body is represented as `""` (empty string) — NOT `null`, NOT
   * `undefined`, NOT omitted. The JSON mode (slice 6) MUST emit `body`
   * as `""` in the empty case so consumers can rely on the key being
   * present and string-typed.
   */
  body: string;
  /**
   * Session context decoration (slice 4 / ENG-5043).
   *
   * Populated by `runCodeHistory` when the commit body contains a
   * `Claude-Session: <uuid>` trailer AND the session JSONL is
   * resolvable (locally or via auto-fetch). Absent otherwise.
   *
   * Shape matches the spec's "Concrete example":
   *   - `id` — full UUID of the authoring Claude session
   *   - `intent` / `trigger` / `outcome` — already-truncated extractor
   *     output (see ENG-5042). Each is `undefined` when the corresponding
   *     extractor returned `null` (missing-layer → omitted line invariant).
   *   - `sinceTimestampCmd` — a chained `session <shortId> --since-timestamp <t-30m>`
   *     command the user can copy-paste to pull the same session at the
   *     right start. Always populated when `session` is present, even on
   *     fetch failure (AC 13 graceful degradation).
   */
  session?: {
    id: string;
    intent?: string;
    trigger?: string;
    outcome?: string;
    sinceTimestampCmd: string;
  };
}
