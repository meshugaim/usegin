---
description: Read a previous Claude session by id/prefix using the `session` CLI, then synthesize the arc + user intent + how far we got + next steps. Triggered by "/read-session <id>", "read session <id>", or pasted session UUID/prefix.
---

# Read Session

Pull a previous session, understand what happened, propose what to do with it.

**Session id / prefix:** $ARGUMENTS

## Step 1 — Orient on the CLI

The `session` CLI's surface changes. Refresh first:

```bash
session --help 2>&1 | head -60
```

Skim for what's available (`--full`, `--timeline`, `--tool-input`, `search-in`, etc.).

## Step 2 — Pull the summary

Always start with the summary view — it shows turn count, subagents, commits, cost, and the rough shape of the session:

```bash
session $ARGUMENTS 2>&1 | head -200
```

Note the conversation length, subagent count, and commits so you can pick the right depth in step 3.

## Step 3 — Ask what to read

Use `AskUserQuestion` with a single question on read depth. Options should include:

| Option | When |
|---|---|
| Full transcript | Default for short/medium sessions; needed when intent isn't obvious from summary |
| Last N turns | When the session is huge and the user is picking up from the end |
| Specific search | When the user is hunting one thread (`session search-in <id> <query>`) |
| Subagent N | When a specific Wes/sub-agent is the interesting part (`session <subagent-id>`) |

Tailor option labels to the actual session's size — e.g. "Full transcript (272 turns)" so the user can see the cost of the choice.

## Step 4 — Read

Run the chosen variant:

```bash
# full
session $ARGUMENTS --full 2>&1

# last N (estimate by tail line count, then trim)
session $ARGUMENTS --full 2>&1 | tail -400

# search
session search-in $ARGUMENTS "<query>"
```

If the output is huge, prefer `head` / `tail` over reading it all — the summary already gave you the skeleton.

## Step 5 — Synthesize

Report in this shape (per the project Reporting rule — opening line, then table):

> One plain sentence naming what the session was.

| | |
|---|---|
| **User intent** | What the human was trying to do |
| **Arc** | The 3–6 beat shape of how it went |
| **How far we got** | Concrete output — commits, issues closed, decisions made, dead-ends hit |
| **Next steps** | The natural continuations (be specific — issue ids, file paths, the actual next move) |

Keep it tight. The transcript is in your context now; the user wants the click, not the recap.

## Step 6 — Offer to pick up

Close with `AskUserQuestion`:

| Option | Means |
|---|---|
| Pick up where it left off | Continue the work — start the next slice / next ticket / next decision |
| Dig into a specific beat | User names a commit, subagent, or decision they want unpacked |
| Just context, no action | Keep the session loaded as background; user will direct from here |

## Notes

- Session ids are 4+ hex chars; the CLI accepts prefixes. Don't ask for the full UUID.
- If `session $ARGUMENTS` fails with "not found", try `session fetch $ARGUMENTS` first (pulls from `~/agent-records/`), then re-run.
- For sessions with many subagents, the summary lists them — call out interesting ones in step 5 rather than reading every one.
- Don't dump raw transcripts into your reply; synthesize.
