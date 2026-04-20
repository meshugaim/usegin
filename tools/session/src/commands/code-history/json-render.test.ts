/**
 * Pure-module unit tests for `renderJson` (slice 6 — ENG-5055).
 *
 * `renderJson` takes a `DecoratedCommit` and returns the JSON string
 * emitted on stdout. No I/O — a plain function of its input. These
 * tests call it DIRECTLY with hand-built decorated commits so they pin
 * the render contract without the subprocess / git / session-JSONL /
 * fake-`plan`-bin fixture chain used by the integration tests in
 * `../code-history.json.test.ts`.
 *
 * Keeping both layers:
 *   - The integration tests in `../code-history.json.test.ts` pin the
 *     end-to-end pipeline (AC 18 stderr path, AC 19 no-history JSON
 *     path, flag recognition) which this file can't exercise.
 *   - These unit tests pin the render shape (field ordering, body
 *     nullify, session/linear omit-when-absent, raw pass-through,
 *     shortId discriminator, trailer stripping in body) without paying
 *     the ~1-2s per subprocess round-trip cost.
 *
 * Spec pins:
 *   - AC 17 (field ordering + omit-when-absent + body `string | null`)
 *   - AC 13 discriminator: `session.shortId` present on resolved,
 *     absent on degraded.
 *   - Raw `title` / `body` pass-through (G3 dividend from ENG-5044 S-6
 *     — no render-time truncation in JSON mode).
 *   - Trailer stripping in body: `\n\nClaude-Session: <uuid>` at end
 *     strips from JSON `body` just like plain mode.
 */

import { describe, test, expect } from "bun:test";

import { renderJson } from "./json-render";
import type { CodeHistoryJson } from "./json-render";
import type { DecoratedCommit } from "./types";

// =============================================================================
// Fixture helpers — local (these tests only need a hand-built commit)
// =============================================================================

/**
 * Build a `DecoratedCommit` with sensible defaults. Tests override the
 * fields they care about. Keeps each test short on "noise" — the SHA /
 * date / subject / committedAt aren't the subject of most pins, they
 * just have to be present.
 */
function makeCommit(overrides: Partial<DecoratedCommit> = {}): DecoratedCommit {
  return {
    sha: "4fff467fb48a632519c742358505e9a0a739d525",
    date: "2026-04-18",
    committedAt: "2026-04-18T08:43:00+00:00",
    subject: "feat: wire the JSON renderer",
    body: "",
    ...overrides,
  };
}

/**
 * Parse `renderJson`'s output once and hand back the object. All the
 * tests below assert on the parsed shape — keep the `JSON.parse` call
 * in one place so a future serialization change (e.g. a pretty-print
 * flag) only needs to rehome this helper.
 */
function parse(commit: DecoratedCommit): Record<string, unknown> {
  return JSON.parse(renderJson(commit)) as Record<string, unknown>;
}

// =============================================================================
// Field ordering (AC 17 — pinned quartet + optional layers)
// =============================================================================

describe("renderJson field ordering (ENG-5055 AC 17)", () => {
  test("full-layer commit → pinned order `sha, date, subject, body, session, linear`", () => {
    const commit = makeCommit({
      body: "Body prose.",
      session: {
        id: "11111111-2222-3333-4444-555555555555",
        shortId: "11111111",
        intent: "Wire JSON mode.",
        trigger: "Start coding.",
        outcome: "Shipped.",
        sinceTimestampCmd:
          "session 11111111 --since-timestamp 2026-04-18T08:13:00+00:00",
      },
      linear: {
        id: "ENG-5055",
        title: "JSON mode",
        status: "In Progress",
      },
    });
    // Insertion order survives JSON round-trip (V8/JSC preserve for
    // string keys). Top-level pins the exact sequence AC 17 requires.
    expect(Object.keys(parse(commit))).toEqual([
      "sha",
      "date",
      "subject",
      "body",
      "session",
      "linear",
    ]);
  });

  test("session-only (no linear) → omit linear, keep pinned order", () => {
    const commit = makeCommit({
      session: {
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        shortId: "aaaaaaaa",
        sinceTimestampCmd: "session aaaaaaaa --since-timestamp 2026-04-18T08:13:00+00:00",
      },
    });
    expect(Object.keys(parse(commit))).toEqual([
      "sha",
      "date",
      "subject",
      "body",
      "session",
    ]);
  });

  test("linear-only (no session) → omit session, keep pinned order", () => {
    const commit = makeCommit({
      body: "Body.",
      linear: {
        id: "ENG-5055",
        title: "t",
        status: "Todo",
      },
    });
    expect(Object.keys(parse(commit))).toEqual([
      "sha",
      "date",
      "subject",
      "body",
      "linear",
    ]);
  });

  test("no layers → pinned quartet only (sha, date, subject, body)", () => {
    expect(Object.keys(parse(makeCommit({ body: "Body." })))).toEqual([
      "sha",
      "date",
      "subject",
      "body",
    ]);
  });
});

// =============================================================================
// body: string | null — AC 17 exception to the omit-when-absent rule
// =============================================================================

describe("renderJson body null vs string (ENG-5055 AC 17)", () => {
  test("empty body → body: null (subject-only commit)", () => {
    const obj = parse(makeCommit({ body: "" }));
    expect(obj.body).toBeNull();
    // Key IS present — body is the lone exception to omit-when-absent.
    expect("body" in obj).toBe(true);
  });

  test("body with content → body: verbatim string (no truncation)", () => {
    const body = "Body prose, one line.";
    const obj = parse(makeCommit({ body }));
    expect(obj.body).toBe(body);
  });

  test("body that is ONLY trailers → body: null after strip", () => {
    // `Claude-Session:` alone (no preamble). `stripTrailers` collapses
    // a body that is ONLY trailer-shaped lines to `""`; the renderer
    // then nullifies it. Pinned by the trailer-strip + body-null
    // composition.
    const body = "Claude-Session: 11111111-2222-3333-4444-555555555555";
    expect(parse(makeCommit({ body })).body).toBeNull();
  });

  test("body with trailers at end → trailers stripped from JSON body", () => {
    // DoD pin: a body like `"Real prose.\n\nClaude-Session: <uuid>"`
    // emits `body: "Real prose."` — JSON mode applies the same
    // trailer-strip that plain mode's body-preview does. Without the
    // strip the JSON body would leak the trailer, which a consumer
    // (`jq .body | head`) would then re-surface. Pinned here rather
    // than at the subprocess layer so a render-side regression fires
    // without needing a full git fixture.
    const body = [
      "Real body prose.",
      "",
      "Claude-Session: 11111111-2222-3333-4444-555555555555",
    ].join("\n");
    expect(parse(makeCommit({ body })).body).toBe("Real body prose.");
  });

  test("long body is NOT truncated in JSON mode (raw-in-JSON)", () => {
    // Plain mode's body preview caps at 160 chars; JSON mode must emit
    // the full bytes so downstream consumers get the raw text. Mirror
    // of `linear.title`'s raw-in-JSON pattern.
    const body = "x".repeat(500);
    const obj = parse(makeCommit({ body }));
    expect(obj.body).toBe(body);
  });
});

// =============================================================================
// session omit + shortId discriminator (AC 17 default rule, AC 13 split)
// =============================================================================

describe("renderJson session (ENG-5055 AC 17 / AC 13)", () => {
  test("session absent → session key OMITTED (not null)", () => {
    const obj = parse(makeCommit());
    expect("session" in obj).toBe(false);
  });

  test("session resolved (fully parsed) → shortId present on session", () => {
    // AC 13 discriminator: shortId appears ONLY on the resolved path.
    // Positive case — session-decorate populates shortId when the
    // session JSONL was parsed end-to-end.
    const commit = makeCommit({
      session: {
        id: "11111111-2222-3333-4444-555555555555",
        shortId: "11111111",
        intent: "Do the thing.",
        sinceTimestampCmd:
          "session 11111111 --since-timestamp 2026-04-18T08:13:00+00:00",
      },
    });
    const session = parse(commit).session as Record<string, unknown>;
    expect(session.shortId).toBe("11111111");
    expect(session.intent).toBe("Do the thing.");
  });

  test("session degraded (AC-13 graceful) → shortId ABSENT", () => {
    // Negative case — session-decorate's SessionNotFoundError branch
    // returns `{id, sinceTimestampCmd}` only. JSON mirrors the
    // decorator's discriminator: no shortId → consumer knows the
    // session pointer was there but unresolvable.
    const commit = makeCommit({
      session: {
        id: "22222222-3333-4444-5555-666666666666",
        sinceTimestampCmd:
          "session 22222222 --since-timestamp 2026-04-18T08:13:00+00:00",
      },
    });
    const session = parse(commit).session as Record<string, unknown>;
    expect("shortId" in session).toBe(false);
    expect(session.id).toBe("22222222-3333-4444-5555-666666666666");
    expect(session.sinceTimestampCmd).toContain("session 22222222");
    // Extractors also absent on the degraded path.
    expect("intent" in session).toBe(false);
    expect("trigger" in session).toBe(false);
    expect("outcome" in session).toBe(false);
  });
});

// =============================================================================
// linear omit + url soft-miss at the render layer
// =============================================================================

describe("renderJson linear (ENG-5055 AC 17)", () => {
  test("linear absent → linear key OMITTED (not null)", () => {
    expect("linear" in parse(makeCommit())).toBe(false);
  });

  test("linear present without url → url key omitted from JSON", () => {
    const obj = parse(
      makeCommit({
        linear: { id: "ENG-5055", title: "t", status: "In Progress" },
      }),
    );
    const linear = obj.linear as Record<string, unknown>;
    expect(linear.id).toBe("ENG-5055");
    expect(linear.title).toBe("t");
    expect(linear.status).toBe("In Progress");
    expect("url" in linear).toBe(false);
  });

  test("linear with url → url key populated", () => {
    const obj = parse(
      makeCommit({
        linear: {
          id: "ENG-5055",
          title: "t",
          status: "In Progress",
          url: "https://linear.app/askeffi/issue/ENG-5055/foo",
        },
      }),
    );
    const linear = obj.linear as Record<string, unknown>;
    expect(linear.url).toBe("https://linear.app/askeffi/issue/ENG-5055/foo");
  });

  test("long linear.title is NOT truncated in JSON (raw-in-JSON, G3 dividend)", () => {
    // ENG-5044 S-6 revision: `DecoratedCommit.linear.title` carries
    // the raw upstream string; plain mode truncates at render, JSON
    // mode emits verbatim. Pin here so a future refactor that bakes
    // truncation back into the fetch boundary (or the renderer)
    // fires at the unit level.
    const longTitle = "x".repeat(500);
    const obj = parse(
      makeCommit({
        linear: { id: "ENG-5055", title: longTitle, status: "Todo" },
      }),
    );
    const linear = obj.linear as Record<string, unknown>;
    expect(linear.title).toBe(longTitle);
  });
});

// =============================================================================
// Type shape sanity — CodeHistoryJson export
// =============================================================================

describe("CodeHistoryJson export (ENG-5055)", () => {
  test("renderJson output conforms to CodeHistoryJson shape (full layer)", () => {
    // Compile-time pin: `as CodeHistoryJson` forces the exported type
    // to stay in sync with the renderer's actual output. If a future
    // slice adds a key without updating `CodeHistoryJson`, this cast
    // breaks the build.
    const commit = makeCommit({
      body: "Body.",
      session: {
        id: "11111111-2222-3333-4444-555555555555",
        shortId: "11111111",
        sinceTimestampCmd:
          "session 11111111 --since-timestamp 2026-04-18T08:13:00+00:00",
      },
      linear: {
        id: "ENG-5055",
        title: "t",
        status: "Todo",
        url: "https://linear.app/askeffi/issue/ENG-5055/foo",
      },
    });
    const parsed: CodeHistoryJson = JSON.parse(renderJson(commit));
    expect(parsed.sha).toBe(commit.sha);
    expect(parsed.body).toBe("Body.");
    expect(parsed.session?.shortId).toBe("11111111");
    expect(parsed.linear?.url).toBe(
      "https://linear.app/askeffi/issue/ENG-5055/foo",
    );
  });
});
