---
name: code-history usage guide
handle: code-history-usage
type: how-to
context: How to answer "why does this line of code exist?" with `session code-history`
---

# `session code-history` Usage Guide

Reach for this command when you need to understand **why** a line of code exists — not what it does. `git blame` tells you *who* last touched a line; `session code-history` tells you *why that commit existed and what decision drove it*. It locates the most recent commit that touched a `<file>:<line>`, then decorates it with the authoring Claude session's intent/trigger/outcome and any referenced Linear issue. Output is terse and streamable — machine-first, human-readable.

## Quick Reference

| Goal | Command |
|------|---------|
| Why does this line exist? | `session code-history src/foo.ts:42` |
| Programmatic consumption | `session code-history src/foo.ts:42 --json` |
| Pipe into `jq` | `session code-history src/foo.ts:42 --json \| jq .` |
| Just the subject line | `session code-history src/foo.ts:42 --json \| jq -r .subject` |
| Follow to the authoring session (copy-paste) | use the `(→ session … --since-timestamp …)` hint from plain output |
| Follow to the authoring session (scripted) | `x=$(session code-history src/foo.ts:42 --json \| jq -r '.session.id // empty'); [ -n "$x" ] && session resume "$x"` |
| Follow to the Linear issue | `plan show $(session code-history src/foo.ts:42 --json \| jq -r .linear.id)` |
| Open Linear in browser | `url=$(session code-history src/foo.ts:42 --json \| jq -r '.linear.url // empty'); [ -n "$url" ] && xdg-open "$url"` |
| Command-specific help | `session code-history --help` |

## Basic Invocation

```bash
session code-history <file>:<line>
```

`<file>` is a path (relative or absolute); `<line>` is a 1-based integer. Renames are followed automatically — if the line's history crosses a rename, the pre-rename commit still surfaces.

### Plain-mode output (the default)

```
4fff467f  2026-04-18  chore(pre-push): instrument per-stage timings + logger
    session:  533a2546-8d19-4d43-9f32-0896102367bc  (→ session 533a2546 --since-timestamp 2026-04-18T08:13Z)
      intent:   please look at issue 5032
      trigger:  let's measure yes
      outcome:  Done. Committed as 4fff467fb (not pushed — yours to push when ready). What you get now: every pre-push run appends a JSONL rec…
    linear:   ENG-5033  chore(pre-push): instrument per-stage timings + logger  [Done]
    body:     Every run appends a JSONL record to .git/pre-push-timings.jsonl (shared across worktrees, never tracked) with the wall time plus per-s…
```

The block is a stack of layers. Each layer is independent — missing layers are **omitted cleanly**, no placeholders, no blank lines.

## What each output block means

### Header — always present
```
<short-sha>  <YYYY-MM-DD>  <subject>
```
8-char SHA, ISO commit date, commit subject. Two spaces separate each field.

### `session:` block — present when the commit body carries a `Claude-Session: <uuid>` trailer
```
    session:  <full-uuid>  (→ session <shortId> --since-timestamp <t-30m>)
      intent:   <first real user ask in the session>
      trigger:  <user ask immediately before the commit>
      outcome:  <assistant's first text reply after the commit>
```
The `(→ …)` hint is a copy-pastable command that opens the authoring session starting 30 minutes before the commit — the right window to see the decision in context.

Each of `intent` / `trigger` / `outcome` is independently omitted when the extractor can't find a match (e.g. a session that didn't author the commit won't have a trigger/outcome, but intent may still render). Values are collapsed to single-line and truncated to 200 chars with `…`.

### `linear:` line — present when the commit body mentions `ENG-\d+` and `plan show` succeeds
```
    linear:   <id>  <title>  [<status>]
```
The title is truncated to 200 chars in plain mode. First `ENG-` match wins — no multi-issue handling.

### `body:` line — present when the stripped commit body has non-trailer content
```
    body:     <first 2 non-blank body lines, joined with spaces, capped at ~160 chars>
```
Trailers (`Co-Authored-By:`, `Claude-Session:`, `Part of:`, `Closes:`, etc.) are stripped first so the preview shows real prose, not boilerplate.

## `--json` mode

Single object on stdout, single line, no trailing newline inside the JSON. Field order: `sha, date, subject, body, session?, linear?`. Absent layers (`session`, `linear`) are **omitted**; an empty post-trailer-strip body is emitted as `null`. The `shortId` key on `session` is the discriminator for JSON consumers: present → session fully resolved; absent → AC-13 graceful-degradation branch (`{id, sinceTimestampCmd}` only).

```bash
session code-history src/foo.ts:42 --json
```

Pretty-printed (the raw output is a single line — pipe through `jq .` to reformat):

```json
{
  "sha": "4fff467fb48a632519c742358505e9a0a739d525",
  "date": "2026-04-18",
  "subject": "chore(pre-push): instrument per-stage timings + logger",
  "body": "Every run appends a JSONL record to .git/pre-push-timings.jsonl (shared across worktrees, never tracked) with the wall time plus per-stage breakdown of `pre-commit`, `test`, and `lint` phases. The JSONL is append-only, one record per push, and the writer fsyncs before exit so a killed push still leaves a valid record. Rotation is handled lazily on read — no background daemon.\n\nPart of: ENG-5033",
  "session": {
    "id": "533a2546-8d19-4d43-9f32-0896102367bc",
    "shortId": "533a2546",
    "intent": "please look at issue 5032",
    "trigger": "let's measure yes",
    "outcome": "Done. Committed as 4fff467fb (not pushed — yours to push when ready). What you get now: every pre-push run appends a JSONL rec…",
    "sinceTimestampCmd": "session 533a2546 --since-timestamp 2026-04-18T08:13Z"
  },
  "linear": {
    "id": "ENG-5033",
    "title": "chore(pre-push): instrument per-stage timings + logger",
    "status": "Done",
    "url": "https://linear.app/askeffi/issue/ENG-5033/chorepre-push-instrument-per-stage-timings-logger"
  }
}
```

JSON mode emits the **raw** title and body — no render-time truncation. Note that `session.intent` / `trigger` / `outcome` ARE truncated (200 chars with `…`) — but at the extractor boundary (AC 15), so the cap applies identically in both modes; the values in `--json` are byte-for-byte the same strings plain mode sees. The full `body` string above is over 400 characters; contrast with the 160-char plain-mode preview.

### `jq` recipes

```bash
# Just the subject
session code-history src/foo.ts:42 --json | jq -r .subject

# The authoring session id (absent → jq emits "null")
session code-history src/foo.ts:42 --json | jq -r '.session.id // empty'

# The Linear id + status, tab-separated
session code-history src/foo.ts:42 --json | jq -r '[.linear.id, .linear.status] | @tsv'

# Open the Linear issue in a browser (Linux)
url=$(session code-history src/foo.ts:42 --json | jq -r '.linear.url // empty')
[ -n "$url" ] && xdg-open "$url"

# Chain into `plan show` for the full issue detail
id=$(session code-history src/foo.ts:42 --json | jq -r '.linear.id // empty')
[ -n "$id" ] && plan show "$id"

# Chain into `session resume` to reopen the authoring session
sid=$(session code-history src/foo.ts:42 --json | jq -r '.session.id // empty')
[ -n "$sid" ] && session resume "$sid"
```

## The underlying contract

Three invariants worth internalizing — they make the output predictable and chainable:

1. **Missing layer → no line** (AC 9). No `session:` trailer in the commit? The whole session block is omitted. No `ENG-` reference? The `linear:` line is omitted. Empty body after trailer-stripping? The `body:` line is omitted. Never a blank line, never a placeholder like `session: none`.

2. **Graceful degradation on session fetch failure** (AC 13). If the commit body has a `Claude-Session:` trailer but the session JSONL isn't resolvable (locally or in `~/agent-records/`), the `session:` line still renders with the full UUID and the `(→ session … --since-timestamp …)` hint — just without the `intent` / `trigger` / `outcome` extractors. You still get the pointer to the authoring session; you just don't get the pre-extracted context. In `--json` mode the degraded object is `{id, sinceTimestampCmd}` only — the absence of the `shortId` key is the discriminator.

3. **Linear fetch failure → warn + omit** (AC 18). If `plan show <id> --json` times out, exits nonzero, returns malformed JSON, or isn't on PATH, the `linear:` line is omitted and a single line goes to stderr:

   ```
   Warning: plan show ENG-5033 failed; linear context skipped
   ```

   When `plan`'s stderr carries an actionable hint (`rate limited`, `not authenticated`), it's folded into the warning:

   ```
   Warning: plan show ENG-5033 failed (rate limited); linear context skipped
   ```

   stdout stays clean — JSON consumers never see warning leakage.

### "No committed history"

When the file exists but the line has never been committed (untracked file, staged-only change, line beyond the committed range), the two modes diverge — plain mode treats it as a soft-miss and exits 0, while `--json` mode treats it as an error so pipeline consumers never see an ambiguous zero-exit + empty-stdout:

| Mode | Exit | stderr | stdout |
|---|---|---|---|
| plain | 0 | `No committed history for <file>:<line>` | empty |
| `--json` | 1 | `Error: No committed history for <file>:<line>` | empty |

This is distinct from a genuine error (missing file, line out of range, git failure), which is prefixed with `Error:` and exits non-zero in both modes.

## Reserved flags (not yet)

These are reserved in the parser and currently error out. Follow-up work is tracked in ENG-5048:

- `-n <N>` — walk N most recent commits
- `--all` — walk every commit that touched the line
- `-L N,M` — line-range history
- `--func <name>` — function-by-name history

If you need any of these today: fall back to `git log -L N,N:file` and cross-reference the SHAs with `session code-history` per line.

## When to reach for it vs `git blame`

| You want… | Use |
|------|---------|
| Who last touched this line | `git blame <file> -L N,+1` |
| Why does this line exist | `session code-history <file>:N` |
| What session authored this commit | `session code-history <file>:N` (read `session:` line) |
| The Linear issue for this commit | `session code-history <file>:N` (read `linear:` line) |
| The full diff of the authoring commit | `git show $(session code-history <file>:N --json \| jq -r .sha)` |

## See also

- Full spec: `plan show ENG-5039` — complete acceptance criteria, algorithm, and deferred work
- `session docs show companion-usage` — the other how-to doc in this directory
- `session --help` — top-level CLI overview
