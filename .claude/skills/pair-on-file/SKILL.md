---
name: pair-on-file
description: Pair with the user on a single file (spec, design doc, plan) where each save triggers a Monitor notification and you reply by editing the file in place rather than chat. Use when the user wants to iterate on a doc together, when they say "monitor my edits", "reply by editing", "let's collaborate on this file", "I'll add inline comments", or "I'll save and you respond". Don't use for code work spanning many files (use interactive-dev) or when normal chat back-and-forth is fine.
---

# Pair on file

A pattern for collaborating on a single file across many turns without the user typing `.` to trigger each response. A file-watcher Monitor fires one notification per save; you read the changes and respond by editing the file in place.

## When to use

- The user is iterating on a doc/spec/design and wants a tight loop.
- They asked for it: "monitor my edits", "reply by editing", "let's pair on this", "I'll add inline comments".
- The work is one file (or a tight set) and the back-and-forth is mostly text.

Don't use when work spans many files, edits are in code (use `interactive-dev` or `code-review`), or normal chat is fine.

## Setup

1. Check `inotifywait` is on PATH; if not, `sudo apt-get install -y inotify-tools`.
2. Arm a persistent Monitor against the file's **directory** (not the file directly — atomic-save renames would orphan a direct watch), filtered to the filename:

   ```
   inotifywait -m -q --format '%e %f' -e close_write -e moved_to <dir> 2>/dev/null | grep --line-buffered '<filename>'
   ```

   With `persistent: true`, `timeout_ms: 3600000`, and a description that names the file (it appears in every notification).

3. Tell the user the monitor is armed and the task id to TaskStop when done.

## Reply convention

Each save is one turn. Default to replying **by editing the file**, not chat:

- Inline answers next to the user's question — a short `>` blockquote, a small revision, an annotation.
- Leave a marker the user can grep (`> _ack_`, `> _changed §X.Y_`) so they don't have to read the whole file to find your reply.
- Chat reply is then minimal: one sentence noting what you changed, or "standing by" on a no-op save.

Fall back to chat only for meta-questions (process, scope, "should I…?") that don't belong in the artifact.

## Watch out for

- **No-op saves.** Read the file and diff against your last view; if nothing material changed, acknowledge briefly and stand by.
- **Truncated system-reminder diffs.** The reminder may be cut off; Read the file directly when the relevant part is past the cut.
- **Cleanup.** When the topic shifts or the work is done, TaskStop the monitor. A forgotten persistent watcher burning context across an unrelated topic is the failure mode.
- **Handoff.** If ending the session with the watch still armed, name the task id in the handoff so the next agent decides whether to keep it.
