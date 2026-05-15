---
name: fleet
description: Capture a Friday-night snapshot of every Claude/Gin agent running on this machine, enriched with a one-line "where we stand" and "next step" per agent. Lifts the deterministic `dx fleet` table into a Monday-morning-rehydratable Polaroid. Triggered by "/fleet", "fleet snapshot", "what's running", "agent inventory", "Friday snapshot", "where are my sessions", or by your own judgment when the human says they're winding down for the week and has many parallel agents in flight.
---

# fleet — Friday-night agent Polaroid

## What this does

Runs `dx fleet --json` (Layer 1, deterministic), then for each row reads the tail of the session's JSONL transcript and writes a markdown file with one `##` block per agent. Each block carries three load-bearing lines — **Goal**, **Where we stand**, **Next step** — plus resume cues. One file. One read on Monday morning rehydrates everything.

## When to invoke

| Trigger | Phrase / situation |
|---|---|
| Explicit | `/fleet`, "fleet snapshot", "Friday snapshot", "agent inventory", "what's running", "where are my sessions" |
| Inferred | Human signals winding down for the week and has multiple parallel agents in flight |

**Distinct from neighbours:**

| Skill | Scope |
|---|---|
| `m-stop` | Per-session Polaroid — *this* Gin writes it for *this* session. |
| `handoff` | Single-session continuity write/continue. |
| **`fleet`** | Cross-session inventory of *all* agents on the machine, enriched. |

## Procedure

The model must run these steps mechanically. Don't ask the user any questions; if `/fleet <path>` was passed, use `<path>` as the output, otherwise compute the default.

### 1. Get the raw rows

Run from any cwd inside the monorepo:

```bash
dx fleet --json
```

If `dx` is not on PATH (rare; worktree edge case), fall back to:

```bash
bun /workspaces/test-mvp/tools/dx/src/cli.ts fleet --json
```

The JSON shape is:

```json
{
  "snapshotAt": "2026-05-15T...Z",
  "counts": { "total": N, "blocked": N, "working": N, "done": N },
  "jobs": [
    {
      "jobId": "...", "jobIdShort": "...",
      "sessionId": "...", "sessionIdShort": "...",
      "live": true|false,
      "state": "blocked"|"working"|"done"|"unknown",
      "tempo": "...", "ageSeconds": N, "ageHuman": "Xm",
      "updatedAt": "ISO",
      "needs": "string (may be empty)",
      "intent": "string (first line of original ask)",
      "cwd": "abs path"
    }
  ]
}
```

### 2. Resolve the output path

| Case | Path |
|---|---|
| User passed `/fleet <path>` | Use `<path>` verbatim (resolve to absolute if relative to cwd). |
| Default | `usegin/memento/scopes/fleet-snapshots/<iso>.md` under repo root, ISO = UTC of `snapshotAt`, with colons → dashes for FS safety (mirrors `dx fleet snapshot`). |

Example default: `usegin/memento/scopes/fleet-snapshots/2026-05-15T19-32-08Z.md`.

Ensure the parent directory exists (`mkdir -p`).

### 3. Per-row enrichment — find the transcript

For each row in `jobs[]`:

1. Glob `~/.claude/projects/*/<full sessionId>.jsonl` (use the full `sessionId`, not `sessionIdShort`).
2. If multiple matches, pick newest by mtime: `ls -t <glob> | head -1`.
3. If zero matches, mark transcript `not found` and skip the tail read for this row — still emit the block with `Where we stand:` derived from `state` + `intent` + `needs` only.

### 4. Per-row enrichment — read the tail

For rows with a transcript, read the last ~30 entries. Each line is a JSON object; you care about `type in ("user","assistant")`.

- **Latest user message:** find the last entry with `type=="user"`. Pull `.message.content` — if it's a string, use it; if it's an array of blocks, concatenate the `text` of `type=="text"` blocks. Truncate to ~200 chars for working memory.
- **Latest assistant message:** find the last entry with `type=="assistant"`. From `.message.content`, take the last `type=="text"` block's `.text`. Skip `tool_use` / `tool_result` blocks. Truncate to ~300 chars.

Cheap shell pattern (per row):

```bash
TRANSCRIPT="$1"
# last assistant text (skip tool blocks)
jq -rs '
  [ .[] | select(.type=="assistant") ] | last
  | .message.content | if type=="array"
      then ( [ .[] | select(.type=="text") | .text ] | last // "" )
      else . end
' < <(tail -n 200 "$TRANSCRIPT" | grep -v '^[[:space:]]*$')
```

(That's a starting shape — adjust as needed; bun/python/jq all fine. Whichever is shortest.)

### 5. Per-row enrichment — synthesize the three lines

For every row, produce **exactly three lines**, each ≤120 chars, plain prose:

| Line | Derive from | Shape |
|---|---|---|
| `Goal:` | `row.intent` collapsed to one sentence | What the agent was sent to do. |
| `Where we stand:` | `row.state` + latest assistant text (if quotable) + latest user message | Current state, specific. Quote ≤1 short fragment if it pinpoints. |
| `Next step:` | `row.state` + `row.needs` | See table below. |

`Next step:` decision table:

| `state` | Recipe |
|---|---|
| `blocked` (has `needs`) | Paraphrase `needs` into an action verb: "Reply with the …", "Approve …", "Decide …", "Send …". |
| `blocked` (no `needs`) | "Open this session, read the last assistant message, unblock manually." |
| `working` | "Let it finish; check back at `dx fleet` or in `~15m`." (Pick "15m" or the agent's age, whichever larger.) |
| `done` | If the transcript tail names a deliverable path, point at it; otherwise "Read the transcript or close the tab." |
| `unknown` | "Check the process is still alive (`ps -p <pid>` from `~/.claude/sessions/<pid>.json`) and re-run `/fleet`." |

For rows where `live: false` AND `state: "done"`: emit a **single line** instead of three — `Done: <intent first 80 chars> — see transcript.` Don't fabricate a result. These are decided history; brevity beats prose.

### 6. Write the file

Single file. Shape:

```markdown
# Fleet Polaroid — <snapshotAt ISO>

<counts line, copied from `counts` — e.g. "5 jobs: 2 blocked, 1 working, 2 done.">

## <jobIdShort> · <state> · <ageHuman> ago — `<intent first 60 chars>…`
- Goal: <line>
- Where we stand: <line>
- Next step: <line>
- Resume: `session <sessionIdShort>` (or `claude --resume <sessionId>`)
- cwd: `<cwd>`
- Transcript: `<absolute path or "not found">`

## <next jobIdShort> …

…

---
### How to re-render Monday
- Live fleet now: `dx fleet`
- Frozen Friday view: `cat <this file path>`
- Enriched fresh now: `/fleet` (overwrites this file)
```

Edge cases:

- **Zero jobs.** Still write the file. Header + `0 jobs.` + the "How to re-render" footer. Nothing else.
- **Empty `needs`.** It's nullable; do not error. Fall back to the no-`needs` branch in the decision table.
- **0-byte JSONL.** Treat as transcript-not-found.

### 7. Acknowledge

Echo to the user **two lines**, no more:

```
Fleet Polaroid: <absolute output path>
<counts line>
```

Don't summarize the agents. The file is the summary; that's the point.

## Behavior notes — what NOT to do

- **Don't fabricate done-row outcomes.** If the tail doesn't make the result clear, say "shipped" or "see transcript."
- **Don't paginate.** Single file. Single read.
- **Don't push, commit, or modify source.** This is a memento write only.
- **Don't expand `done` rows past one line.** They're decided history; brevity is the design.
- **Don't invoke a sub-agent.** Inline the tail reads — they're cheap.
- **Don't ask the user anything.** If `/fleet <path>` was passed, use it; otherwise default. No `AskUserQuestion`.

## Storage

| Path | Purpose |
|---|---|
| `usegin/memento/scopes/fleet-snapshots/` | Canonical home for fleet polaroids. Mirrors `m-stop`'s per-scope pattern. |
| `<iso-utc>.md` | One file per invocation, ISO-named so timestamps sort lexically. |
| `.gitkeep` | Empty file so the directory survives in git when no snapshots are committed. |

`dx fleet snapshot` writes the deterministic (un-enriched) version to the same directory. The enriched `/fleet` output overwrites or co-exists at a different ISO; no conflict by design.
