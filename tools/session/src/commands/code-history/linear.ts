/**
 * Linear integration for `session code-history` (slice 5 — ENG-5044).
 *
 * This module owns the three steps that turn a commit body into a
 * `DecoratedCommit.linear` record:
 *
 *   1. {@link extractLinearRef}  — scan the RAW body (including trailers)
 *      for the first `ENG-\d+` occurrence. The first-match rule is
 *      spec-explicit (ENG-5039 Algorithm step 5b) — no multi-issue
 *      handling in v1.
 *   2. {@link fetchLinearIssue}  — spawn `plan show <id> --json`,
 *      parse `{ identifier, title, status }` from the JSON, and
 *      return the RAW record (no title truncation — that's a
 *      render-time concern, see step 3 and `types.ts`). Returns
 *      `null` on ANY failure: nonzero exit, timeout (5s via
 *      `AbortSignal.timeout`), missing `plan` CLI, unparseable JSON,
 *      or partial response (any of the three required fields absent,
 *      non-string, or empty-string).
 *   3. {@link formatLinearLine}  — render the one-line output for the
 *      plain-mode block at 4-space indent. Returns `null` when the
 *      commit has no `linear` field populated (AC 9 missing-layer
 *      invariant).
 *
 * The module does NOT use `stripTrailers` — we scan the FULL body
 * because the ENG ref frequently lives in a `Part of: ENG-XXXX` or
 * `Closes: ENG-XXXX` trailer (forward-pointer context from prior
 * slices).
 *
 * Failure → null contract (G4): every failure path in
 * `fetchLinearIssue` collapses to `null`. The decorator
 * (`decorateCommitWithLinear`, in `linear-decorate.ts`) is responsible
 * for translating null into (a) omitting the `linear` key and (b)
 * emitting the AC-18 stderr warning naming the issue id. Splitting
 * these concerns keeps `fetchLinearIssue` pure (no side effects, no
 * stderr) and lets tests assert on the warning separately.
 */

import { truncateString } from "./context";
import type { DecoratedCommit } from "./types";

/**
 * Spec-pinned regex for extracting an ENG reference from a commit body.
 * `ENG-` followed by one or more digits. First match wins.
 *
 * Non-global — we only want the first match and want the capture to
 * behave as a single-match result. If a future slice needs all matches,
 * switch callers to `matchAll` and an `/ENG-\d+/g` form.
 */
export const LINEAR_REF_RE = /ENG-\d+/;

/**
 * Subprocess timeout for `plan show` (G1). 5 seconds tolerates
 * startup + heavy JSON while keeping `code-history` snappy when the
 * `plan` CLI or the Linear backend hiccups.
 *
 * Exported for tests that want to simulate / assert against the
 * timeout shape without hardcoding the literal twice.
 */
export const LINEAR_FETCH_TIMEOUT_MS = 5000;

/**
 * Extract the first `ENG-\d+` reference from a commit body.
 *
 * Returns `null` when the body contains no ENG reference, the first
 * match (verbatim) otherwise.
 *
 * Scans the RAW body — trailers are NOT stripped first. A `Part of:`
 * or `Closes:` trailer is a valid source of the ENG ref (and often
 * the only source), so `stripTrailers` would defeat the extractor for
 * the majority of commits in this codebase.
 *
 * First-match-only (G2 — spec-explicit): a body that mentions
 * `ENG-100` then `ENG-200` returns `ENG-100`. No ambiguity, no
 * multi-issue rendering in v1.
 */
export function extractLinearRef(body: string): string | null {
  return LINEAR_REF_RE.exec(body)?.[0] ?? null;
}

/**
 * Shape returned by `plan show <id> --json` that this module cares
 * about. Other fields (description, url, labels, etc.) are present in
 * the response but ignored here.
 *
 * `id` is the `identifier` field from the JSON (renamed to match the
 * `DecoratedCommit.linear.id` shape — the extractor owns the
 * naming symmetry between the two layers).
 */
export interface LinearIssue {
  id: string;
  title: string;
  status: string;
}

/**
 * Max characters of `plan`'s stderr we fold into the AC-18 warning
 * when propagating (see `fetchLinearIssue` / `formatLinearWarning`).
 *
 * Short enough to keep the warning a single grep-friendly line; long
 * enough to carry typical `plan` errors like `"rate limited"`,
 * `"not authenticated"`, `"issue ENG-XXXX not found"`. If `plan` ever
 * starts emitting longer structured errors, either bump this or move
 * the detail to a separate log line — don't let the warning grow
 * past one tty-line.
 */
export const LINEAR_FETCH_DETAIL_MAX_LEN = 120;

/**
 * Failure outcome of {@link fetchLinearIssue}. All failure modes
 * (timeout, nonzero exit, missing `plan` CLI, malformed JSON,
 * partial / empty-string response) collapse to one shape.
 *
 * `detail` carries the first non-empty line of `plan`'s stderr
 * (capped at `LINEAR_FETCH_DETAIL_MAX_LEN`) when the subprocess ran
 * and wrote to stderr — so users see `"rate limited"` or
 * `"not authenticated"` in the AC-18 warning rather than just a
 * generic "plan show ENG-X failed". Absent when stderr was empty
 * or the subprocess never started (ENOENT, timeout pre-exec).
 *
 * Shape chosen over a bare `null` return so the decorator can
 * propagate the detail into `formatLinearWarning(id, detail)` without
 * introducing a side channel.
 */
export interface FetchLinearIssueFailure {
  ok: false;
  detail?: string;
}

/**
 * Compose a `FetchLinearIssueFailure` from raw stderr text. Takes the
 * first non-empty line (so a leading blank line or a trailing newline
 * doesn't produce an empty `detail`) and caps it at
 * `LINEAR_FETCH_DETAIL_MAX_LEN` with a trailing `…`.
 *
 * Returns `{ ok: false }` (no detail) when stderr was absent or
 * contained only whitespace — callers shouldn't surface `"   "` as a
 * failure hint.
 *
 * Module-private because the shape is part of `fetchLinearIssue`'s
 * internal failure-folding logic; the decorator sees only the
 * resulting `FetchLinearIssueFailure` shape.
 */
function fetchFailure(stderrText: string | undefined): FetchLinearIssueFailure {
  if (stderrText === undefined) return { ok: false };
  // First non-empty line — trimStart before the empty check so a
  // leading `\n` doesn't win the split race.
  const firstLine = stderrText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (firstLine === undefined || firstLine.length === 0) {
    return { ok: false };
  }
  const detail =
    firstLine.length <= LINEAR_FETCH_DETAIL_MAX_LEN
      ? firstLine
      : firstLine.slice(0, LINEAR_FETCH_DETAIL_MAX_LEN - 1) + "…";
  return { ok: false, detail };
}

/**
 * Drain `proc.stderr` to a string with a short read deadline.
 *
 * The deadline (`LINEAR_STDERR_READ_TIMEOUT_MS`, 250ms) exists because
 * on `AbortSignal.timeout` paths `proc.exited` can resolve with a
 * SIGTERM exit code while a grandchild (the fake test's `sleep`, or
 * a future real wrapper's child) still holds the stderr pipe fd
 * open — a naive `new Response(proc.stderr).text()` would then wait
 * for the grandchild to exit, stalling past the whole subprocess
 * timeout window.
 *
 * On a well-behaved nonzero exit the stderr bytes are already in
 * Bun's buffer and resolve instantly; the 250ms ceiling kicks in
 * only when we'd otherwise hang. On timeout the caller gets
 * `undefined` (no detail) rather than a blocked promise.
 *
 * Module-private helper — named separately so `fetchLinearIssue`'s
 * error-folding reads linearly instead of nesting a timeout race
 * inside each failure branch.
 */
const LINEAR_STDERR_READ_TIMEOUT_MS = 250;

async function readStderr(
  proc: ReturnType<typeof Bun.spawn>,
): Promise<string | undefined> {
  const stream = proc.stderr;
  if (!stream) return "";
  // Explicit reader + manual drain so we can `cancel()` on timeout.
  // A bare `new Response(stream).text()` keeps the underlying reader
  // pending when the stream's other end is held open by a grandchild
  // process (test fake's `sleep`), which keeps Bun's event loop
  // alive past the subprocess's `unref()` and stalls the whole
  // command. Cancelling the reader releases the loop.
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    reader.cancel().catch(() => {
      // `cancel` can reject on an already-errored stream; ignore.
    });
  }, LINEAR_STDERR_READ_TIMEOUT_MS);
  // `timer.unref()` so a pending timer doesn't hold the event loop
  // past its natural exit when stderr finishes first.
  (timer as unknown as { unref?: () => void }).unref?.();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } catch {
    // Read errored (e.g. the cancel above surfaced on the in-flight
    // `.read()`). Fall through to the done-or-timedOut check below.
  } finally {
    clearTimeout(timer);
    // Release the reader lock. Safe even if the stream is cancelled.
    try {
      reader.releaseLock();
    } catch {
      // Lock may already be released after cancel; ignore.
    }
  }
  if (timedOut) return undefined;
  // Concatenate and decode.
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(buf);
}

/**
 * Fetch a Linear issue by spawning `plan show <id> --json` and
 * parsing the response. Returns a {@link LinearIssue} on success, a
 * {@link FetchLinearIssueFailure} on any failure (AC-18 + G4):
 *
 *   - `plan` CLI missing on PATH (ENOENT)
 *   - nonzero exit (unknown issue, Linear API error, auth failure)
 *   - timeout after {@link LINEAR_FETCH_TIMEOUT_MS} ms
 *   - malformed or non-JSON stdout
 *   - partial response — any of `identifier` / `title` / `status`
 *     absent, not a string, or empty-string (treated as malformed
 *     per G4).
 *
 * The caller (`decorateCommitWithLinear`) translates failure → omit
 * `commit.linear` + emit stderr warning (threading `detail` through
 * when present). This function is pure async with no side effects of
 * its own so it's subprocess-testable in isolation.
 *
 * The returned `title` is the RAW upstream string (no truncation).
 * Truncation is applied at render time by `formatLinearLine` — keeping
 * the raw title on `DecoratedCommit.linear.title` lets slice 6's JSON
 * mode emit the full title while the plain renderer stays capped at
 * `CONTEXT_MAX_LEN`. Mirrors `DecoratedCommit.body`'s raw-in-JSON
 * pattern (ENG-5044 S-6 revision of the original "truncate-at-fetch"
 * design).
 */
export async function fetchLinearIssue(
  id: string,
): Promise<LinearIssue | FetchLinearIssueFailure> {
  // One outer try/catch: spec AC 18 collapses every failure mode to a
  // single `{ ok: false }` shape (decorator owns the warning).
  // Classifying here (timeout vs ENOENT vs JSON.parse) would force
  // the decorator to carry a tagged-union back — instead the
  // decorator sees "we tried to fetch and got nothing", keeping the
  // warning template identical across all failure modes (AC 18 pins
  // ONE wording, naming the id).
  //
  // What we DO carry back on failure is `detail` — the first
  // non-empty line of `plan`'s stderr, truncated to
  // `LINEAR_FETCH_DETAIL_MAX_LEN`. That turns a bare
  // "plan show ENG-X failed" into "plan show ENG-X failed: rate
  // limited" (or "not authenticated") when `plan` emits an
  // actionable error — one line of signal, no classification, no
  // tagged union.
  //
  // Covers:
  //   - Bun.spawn sync throw (ENOENT when `plan` is not on PATH —
  //     no stderr since the subprocess never started; `detail`
  //     stays undefined)
  //   - AbortError raised via `AbortSignal.timeout(LINEAR_FETCH_TIMEOUT_MS)`
  //     (may or may not have partial stderr depending on timing)
  //   - Nonzero exit (we branch on `exitCode !== 0` → read stderr
  //     → fail with detail)
  //   - Malformed stdout (JSON.parse throws, caught below — stderr
  //     often carries a `plan`-side parse hint)
  //   - Partial or empty-string response (type-narrow each required
  //     field; absent / non-string / "" → fail with stderr detail
  //     if available)
  let proc: ReturnType<typeof Bun.spawn> | undefined;
  try {
    proc = Bun.spawn(["plan", "show", id, "--json"], {
      stdout: "pipe",
      stderr: "pipe",
      signal: AbortSignal.timeout(LINEAR_FETCH_TIMEOUT_MS),
    });
    const exitCode = await proc.exited;
    // Reading stderr is deferred until we know the subprocess exited
    // normally (i.e. we got here past `await proc.exited`). On
    // AbortError / timeout, Bun's stderr pipe can stay open due to
    // a grandchild holding the fd (see `unref` comment in `finally`),
    // so a blocking stderr read would stall the whole command —
    // negating the point of the timeout. By the time we branch on
    // `exitCode`, the exit is already visible and the stderr bytes
    // the subprocess wrote are safely drainable.
    if (exitCode !== 0) {
      return fetchFailure(await readStderr(proc));
    }
    const stdout = await new Response(proc.stdout).text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout) as unknown;
    } catch {
      // Malformed stdout — subprocess exited 0 but didn't produce
      // valid JSON. Read stderr safely here (the subprocess has
      // already exited, no grandchild-hang risk) and propagate the
      // detail. `plan`'s stderr often carries a useful hint in this
      // case ("plan: unknown command", "internal error").
      return fetchFailure(await readStderr(proc));
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { identifier?: unknown }).identifier !== "string" ||
      typeof (parsed as { title?: unknown }).title !== "string" ||
      typeof (parsed as { status?: unknown }).status !== "string"
    ) {
      return fetchFailure(await readStderr(proc));
    }
    const record = parsed as {
      identifier: string;
      title: string;
      status: string;
    };
    // Empty-string guard (partial-response → failure per G4). A
    // `plan show` response with `{identifier: "", title: "x", status:
    // "y"}` would otherwise render `    linear:   <empty>  x  [y]`
    // with column misalignment and no user-visible signal that
    // something went wrong. Treat empty as absent — the decorator's
    // AC-18 warning then names the id (and propagates any stderr
    // hint) so the user knows which fetch produced the bad shape.
    if (
      record.identifier.length === 0 ||
      record.title.length === 0 ||
      record.status.length === 0
    ) {
      return fetchFailure(await readStderr(proc));
    }
    // G3 (revised per ENG-5044 S-6): title is returned RAW here —
    // truncation happens at the format layer (`formatLinearLine`).
    // Rationale: `DecoratedCommit.linear.title` feeds both the plain
    // renderer (which wants the 200-char capped form) and slice 6's
    // JSON mode (which wants the raw upstream title, mirroring
    // `DecoratedCommit.body`'s raw-in-JSON pattern). Keeping the raw
    // string on the decorated-commit record lets each renderer apply
    // its own truncation policy without the fetch boundary lossy-
    // baking the cap into shared state.
    return {
      id: record.identifier,
      title: record.title,
      status: record.status,
    };
  } catch {
    // ENOENT (sync Bun.spawn throw), AbortError (timeout), or
    // JSON.parse. Detail-less failure — we don't try to read stderr
    // here because on AbortError / timeout the stderr pipe can stay
    // open due to a grandchild holding the fd, and a blocking read
    // would stall past the timeout window. ENOENT has no subprocess
    // at all. JSON.parse throws hit after we've handed the user a
    // nonzero exit OR valid stdout — the common "subprocess ran but
    // its output was garbage" mode is handled by the type-narrow
    // guards above (which DO read stderr), so the catch here sees
    // only the genuinely unrecoverable throws.
    return { ok: false };
  } finally {
    // Today's `plan` is a direct Bun process — no grandchild — so the
    // event-loop refcount for this subprocess drops naturally once
    // `await proc.exited` resolves. `unref` is test-fixture insurance
    // + future-proofing against a wrapper-shim rewrite.
    //
    // The integration tests' fake `plan` is a shell script that spawns
    // `sleep 10`; the grandchild `sleep` inherits the stdout/stderr
    // pipe fds and keeps them open until it exits naturally. Bun's
    // event loop stays alive waiting on those read ends, which would
    // hang the whole `code-history` process past the timeout window.
    // `unref` drops the event-loop refcount for the subprocess so the
    // parent can exit cleanly even though the fds are still held
    // downstream. If a future `plan`-wrapper-shim rewrite reintroduces
    // a real grandchild in production, the same insurance applies
    // there — the one-line call costs nothing.
    //
    // Safe to call unconditionally: `Subprocess.unref()` has been on
    // Bun since 1.0, and unref-after-exit is a no-op (not an error),
    // so no try/catch belt-and-suspenders needed.
    proc?.unref();
  }
}

/**
 * Render the plain-mode `linear:` line at 4-space top-level indent.
 *
 * Returns `null` when `linear` is `undefined` (AC 9 missing-layer
 * invariant — caller omits the line entirely, no placeholder, no
 * blank).
 *
 * Format (pinned by `linear.test.ts`):
 *
 *   `    linear:   <id>  <title>  [<status>]`
 *
 * Layout rules (mirror `formatSessionBlock` so slices 4/5/6 share one
 * column-alignment contract):
 *   - 4-space top-level indent.
 *   - `linear:` label (7 chars incl colon) padded to the same width as
 *     `session:` (8 chars incl colon) + 2 trailing spaces = value
 *     starts at column 14. `linear:` + 3 trailing spaces keeps the
 *     value column aligned with `session:`'s value column.
 *   - Fields separated by 2 spaces.
 *   - Status wrapped in square brackets — the bracket pair is the
 *     visual cue that this is metadata, not prose (matches the
 *     spec's "Concrete example").
 */
export function formatLinearLine(
  linear: DecoratedCommit["linear"],
): string | null {
  if (linear === undefined) return null;
  // Truncate title at RENDER time (ENG-5044 S-6). The raw title lives
  // on `DecoratedCommit.linear.title` so slice 6's JSON mode can emit
  // the full string — mirroring `DecoratedCommit.body`'s raw-in-JSON
  // pattern. Plain mode caps at `CONTEXT_MAX_LEN` (200) to keep the
  // block scannable, matching the session-context extractors' budget.
  const title = truncateString(linear.title);
  // 4-space indent + `linear:` (7 chars) + 3 spaces → value column 14,
  // matching `session:` / `body:`. Fields separated by 2 spaces, status
  // wrapped in brackets. Layout pinned by `linear.test.ts`.
  return `    linear:   ${linear.id}  ${title}  [${linear.status}]`;
}
