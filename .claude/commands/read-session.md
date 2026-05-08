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

## Step 1 — Default first pass: topic + endpoint

Don't ask the user how deep to read. Default to "topic + endpoint" — what was this about, and where did it stop. For most sessions this is enough; offer deeper only after synthesizing.

Run:

```bash
session $ARGUMENTS --full 2>&1 | head -80     # pins user intent + opening
session $ARGUMENTS --full 2>&1 | tail -300    # shows where it stopped + what's in flight
```

If the summary lists many commits, the tail usually includes the commit log block — no extra call needed. If output is enormous and the tail is still mid-conversation, extend to `tail -600` rather than reading the middle.

**When to skip the default and ask first** (rare):
- The session is tiny (<30 turns) — just read full
- The user explicitly said what they want ("find where we decided X", "show me the Ron review for ENG-NNNN")
- The summary already shows the session ended mid-task with no resolution — tail alone won't help

## Step 2 — Synthesize

Report in this shape (per the project Reporting rule — opening line, then table):

> One plain sentence naming what the session was.

| | |
|---|---|
| **Topic** | What the work was about — domain, not process |
| **Arc** | The 3–6 beat shape of how it went |
| **How far we got** | Concrete output — commits, issues closed, decisions made, dead-ends hit |
| **Where it stopped** | Last meaningful state — done / mid-flight / blocked / abandoned. Quote the closing line if the run self-terminated |

Keep it tight. The user wants the click, not the recap.

## Step 3 — Offer deeper only if relevant

Close with `AskUserQuestion`. Tailor options to what's actually in the session — don't offer "dig into a beat" if there were no notable beats.

| Option | When to offer |
|---|---|
| Pick up where it left off | Session ended mid-task with a clear next move |
| Dig into a specific beat | Multiple subagents, blockers, or decisions worth unpacking |
| Read the full transcript | First pass left intent ambiguous |
| Just context, no action | Always offer as the no-op fallback |

If the session is cleanly done and there's nothing to continue, a single line "nothing in flight — anything you want me to do with this?" is fine without `AskUserQuestion`.

## Other read modes (use when first-pass synthesis exposes the need)

```bash
session $ARGUMENTS --full 2>&1                  # full transcript
session search-in $ARGUMENTS "<query>"          # one thread
session <subagent-id>                            # one subagent
```

## Notes

- Session ids are 4+ hex chars; the CLI accepts prefixes. Don't ask for the full UUID.
- If the summary block above shows a "not found" error, run `session fetch $ARGUMENTS` (pulls from `~/agent-records/`) and try again.
- For sessions with many subagents, the summary lists them — call out interesting ones in step 2 rather than reading every one.
- Don't dump raw transcripts into your reply; synthesize.
