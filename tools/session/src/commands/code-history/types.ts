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
 *     (ENG-5043 — landed)
 *   - linear?:  { id, title, status }
 *     (ENG-5044 — landed)
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
  /**
   * Linear issue context decoration (slice 5 / ENG-5044).
   *
   * Populated by `runCodeHistory` when the commit body mentions an
   * `ENG-\d+` reference AND `plan show <id> --json` succeeds. Absent
   * otherwise (no ENG ref, subprocess failure, malformed JSON, timeout).
   *
   * All three fields are REQUIRED when `linear` is present — partial
   * responses from `plan show` are treated as malformed and result in
   * `linear` being omitted (plus an AC-18 stderr warning from the
   * decorator naming the issue id).
   *
   * Shape matches what `tools/plan-cli/src/lib/output/detail.ts`
   * `formatShowJson` emits at the top level:
   *   - `id`     — the Linear identifier (e.g. `ENG-5039`). Populated
   *     from `identifier` in the JSON (renamed here to `id` for
   *     consistency with `session.id`).
   *   - `title`  — issue title, RAW (no truncation at the fetch
   *     boundary — ENG-5044 S-6 revision). Truncation is applied at
   *     render time by `formatLinearLine` for plain mode; slice 6's
   *     JSON mode emits the raw string verbatim. Mirrors `body`'s
   *     raw-in-JSON pattern so the two user-visible long-text fields
   *     follow one rule.
   *   - `status` — issue state display name (e.g. "In Progress").
   */
  linear?: {
    id: string;
    title: string;
    status: string;
  };
}
