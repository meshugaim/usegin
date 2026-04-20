/**
 * JSON renderer for `session code-history --json` (slice 6 — ENG-5055).
 *
 * Pure function — takes a `DecoratedCommit` and returns the JSON string
 * emitted on stdout. No I/O, no side effects. Stderr-side concerns
 * (the AC-18 warning, the AC-19 "no committed history" path) are
 * handled by `runCodeHistory` / `decorateCommitWithLinear` exactly as
 * in plain mode — the JSON path only diverges at the render step.
 *
 * Spec pins (ENG-5055 description + code-history.json.test.ts):
 *
 *   - Field order: `sha, date, subject, body, session?, linear?`. Pinned
 *     by test 2 via `Object.keys(obj)`. JSON.stringify preserves object
 *     insertion order in V8/JSC, so we build the object in that exact
 *     sequence.
 *   - `body: string | null` — always present. When the stripped body is
 *     empty (no non-trailer content, or subject-only commit), emit
 *     `null`. Otherwise emit the RAW post-trailer-strip body: no
 *     truncation, no ellipsis (AC 17 "body is the lone exception to the
 *     omit-when-absent rule").
 *   - `session` / `linear` are OMITTED (not null) when absent — AC 17's
 *     default rule.
 *   - Raw `linear.title` + raw `body` — truncation lives in plain-mode
 *     render only (G3 dividend from ENG-5044 S-6; see `linear.ts` and
 *     `format.ts` docstrings).
 *   - `session.intent` / `trigger` / `outcome` come through already
 *     collapsed + capped at `CONTEXT_MAX_LEN`. Same strings plain mode
 *     sees — AC 15 pins the cap at the extractor boundary, not at
 *     render.
 *
 * JSON shape (happy path, all layers resolved):
 *
 * ```json
 * {
 *   "sha": "<40-char>",
 *   "date": "YYYY-MM-DD",
 *   "subject": "...",
 *   "body": "...",
 *   "session": {
 *     "id": "<uuid>",
 *     "shortId": "<8 chars>",
 *     "intent": "...",
 *     "trigger": "...",
 *     "outcome": "...",
 *     "sinceTimestampCmd": "session <shortId> --since-timestamp <t-30m>"
 *   },
 *   "linear": {
 *     "id": "ENG-XXXX",
 *     "title": "...",
 *     "status": "...",
 *     "url": "https://linear.app/..."
 *   }
 * }
 * ```
 *
 * Degraded paths (pinned by tests):
 *
 *   - No `Claude-Session:` trailer in body → `session` omitted (I2).
 *   - Session fetch fails (SessionNotFoundError) → `session = { id,
 *     sinceTimestampCmd }` only, no shortId / extractors (test 4).
 *   - No ENG ref in body → `linear` omitted (I3).
 *   - `plan show` fails → `linear` omitted, AC-18 warning on stderr
 *     (test 13). Stdout stays pure JSON — nothing leaks.
 */

import { stripTrailers } from "./trailers";
import type { DecoratedCommit } from "./types";

/**
 * Serialize a `DecoratedCommit` to the AC 17-pinned JSON string for
 * stdout. Emits exactly one JSON object, no trailing newline (the
 * caller adds one via `console.log`).
 *
 * Returns a string (not an object) because:
 *   1. The field-order pin (test 2) requires us to control the
 *      serialization — returning an object and letting the caller
 *      `JSON.stringify` it exposes the same insertion-order guarantee,
 *      but centralizing the `JSON.stringify` call here keeps the spec
 *      invariant (one object, no nesting, no trailing garbage) inside
 *      this module.
 *   2. The caller's job is just `console.log(renderJson(commit))` —
 *      no post-processing, no intermediate shape munging.
 */
export function renderJson(commit: DecoratedCommit): string {
  // Build the top-level object in the pinned order (`sha, date,
  // subject, body, session?, linear?`). Conditional keys use the
  // assignment-after-base-literal pattern: start with an object literal
  // containing the four always-present keys in their pinned order, then
  // assign `session` / `linear` with `if (x !== undefined) out.key = …`.
  // Preserves the obvious order at the literal (a reader sees the pinned
  // quartet at a glance) and keeps the conditional writes plainly
  // `if`-guarded rather than hidden inside `...(cond ? {k:v} : {})`
  // spread noise. `body` is always present with an explicit
  // `string | null` value (AC 17 exception); absent layers are OMITTED
  // (AC 17 default rule).
  const strippedBody = stripTrailers(commit.body);
  const body: string | null =
    strippedBody.length === 0 ? null : strippedBody;

  const session = commit.session;
  const linear = commit.linear;

  const out: Record<string, unknown> = {
    sha: commit.sha,
    date: commit.date,
    subject: commit.subject,
    body,
  };
  if (session !== undefined) {
    out.session = buildSession(session);
  }
  if (linear !== undefined) {
    out.linear = buildLinear(linear);
  }
  return JSON.stringify(out);
}

/**
 * Build the `session` sub-object in the order test 3 implicitly
 * expects: `id, shortId?, intent?, trigger?, outcome?, sinceTimestampCmd`.
 * The test list doesn't pin session field ordering the way it pins the
 * top level, but keeping a stable insertion order means JSON consumers
 * (humans, diff tools, docs) see the same shape across invocations.
 *
 * Extractor fields (`intent`, `trigger`, `outcome`) are already
 * `truncate`d at the extractor boundary — we pass them through raw. If
 * extractors returned `null`, the decorator omitted the field on
 * `DecoratedCommit.session`, so `undefined` here means "omit in JSON"
 * (AC 17 default rule).
 */
function buildSession(
  session: NonNullable<DecoratedCommit["session"]>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { id: session.id };
  // `shortId` appears ONLY on the fully-resolved path. Its presence is
  // the signal that the session was parsed end-to-end; absence signals
  // the AC-13 graceful-degradation branch (test 4). JSON mirrors the
  // decorator's discriminator.
  if (session.shortId !== undefined) out.shortId = session.shortId;
  if (session.intent !== undefined) out.intent = session.intent;
  if (session.trigger !== undefined) out.trigger = session.trigger;
  if (session.outcome !== undefined) out.outcome = session.outcome;
  out.sinceTimestampCmd = session.sinceTimestampCmd;
  return out;
}

/**
 * Build the `linear` sub-object in order `id, title, status, url?`.
 * `title` is emitted RAW (G3 dividend — no truncation at this layer).
 * `url` is optional — `fetchLinearIssue` treats missing/non-string
 * url as a soft miss (the issue record still succeeds without it).
 */
function buildLinear(
  linear: NonNullable<DecoratedCommit["linear"]>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: linear.id,
    title: linear.title,
    status: linear.status,
  };
  if (linear.url !== undefined) out.url = linear.url;
  return out;
}
