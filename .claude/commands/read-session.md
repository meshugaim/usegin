---
description: Read a previous Claude session by id/prefix using the `session` CLI, then synthesize the arc + user intent + how far we got + next steps. Triggered by "/read-session <id>", "read session <id>", or pasted session UUID/prefix.
---

# Read Session

Pull a previous session, understand what happened, propose what to do with it.

**Session id / prefix:** $ARGUMENTS

## Pre-loaded context

The CLI surface and session summary are pre-injected below — no need to re-run them.

### `session --help`

!`session --help 2>&1 | head -60`

### `session $ARGUMENTS` (summary)

!`session $ARGUMENTS 2>&1 | head -200`

## Step 1 — Pick read depth

Skim the summary above for turn count, subagents, commits. Then use `AskUserQuestion` to pick depth:

| Option | When |
|---|---|
| Full transcript | Default for short/medium sessions; needed when intent isn't obvious from summary |
| Last N turns | When the session is huge and the user is picking up from the end |
| Specific search | When the user is hunting one thread (`session search-in <id> <query>`) |
| Subagent N | When a specific sub-agent is the interesting part (`session <subagent-id>`) |

Tailor labels to the actual size — e.g. "Full transcript (272 turns)" — so the user sees the cost.

## Step 2 — Read

Run the chosen variant:

```bash
session $ARGUMENTS --full 2>&1                  # full
session $ARGUMENTS --full 2>&1 | tail -400      # last N
session search-in $ARGUMENTS "<query>"          # search
session <subagent-id>                            # one subagent
```

If output is huge, prefer `head` / `tail` over reading the whole thing — the summary already gave you the skeleton.

## Step 3 — Synthesize

Report in this shape (per the project Reporting rule — opening line, then table):

> One plain sentence naming what the session was.

| | |
|---|---|
| **User intent** | What the human was trying to do |
| **Arc** | The 3–6 beat shape of how it went |
| **How far we got** | Concrete output — commits, issues closed, decisions made, dead-ends hit |
| **Next steps** | The natural continuations (be specific — issue ids, file paths, the actual next move) |

Keep it tight. The transcript is in your context now; the user wants the click, not the recap.

## Step 4 — Offer to pick up

Close with `AskUserQuestion`:

| Option | Means |
|---|---|
| Pick up where it left off | Continue the work — next slice / next ticket / next decision |
| Dig into a specific beat | User names a commit, subagent, or decision to unpack |
| Just context, no action | Keep the session loaded as background; user will direct from here |

## Notes

- Session ids are 4+ hex chars; the CLI accepts prefixes. Don't ask for the full UUID.
- If the summary block above shows a "not found" error, run `session fetch $ARGUMENTS` (pulls from `~/agent-records/`) and try again.
- For sessions with many subagents, the summary lists them — call out interesting ones in step 3 rather than reading every one.
- Don't dump raw transcripts into your reply; synthesize.
