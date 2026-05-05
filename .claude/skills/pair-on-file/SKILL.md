---
name: pair-on-file
description: Pair with the user on a single file (spec, design doc, plan) where each save triggers a Monitor notification and you reply by editing the file in place rather than chat. Use when the user wants to iterate on a doc together, when they say "monitor my edits", "reply by editing", "let's collaborate on this file", "I'll add inline comments", or "I'll save and you respond".
---

# Pair on file

A pattern for collaborating on a single file across many turns without each response needing to be manually triggered. A file-watcher Monitor fires one notification per save; you read the changes and respond by editing the file in place.

## When to use

- The user is iterating on a doc/spec/design and wants a tight loop.
- They asked for it: "monitor my edits", "reply by editing", "let's pair on this", "I'll add inline comments".
- The work is one file (or a tight set) and the back-and-forth is mostly text.

Don't use when work spans many files, edits are in code (use `interactive-dev` or `code-review`), or normal chat is fine.

## Setup

1. `inotifywait` is preinstalled in the devcontainer (`inotify-tools`). On a host that's missing it, `sudo apt-get install -y inotify-tools`.
2. Arm a persistent Monitor against the file's **directory** (not the file directly — atomic-save renames would orphan a direct watch), filtered to the filename:

   ```
   inotifywait -m -q --format '%e %f' -e close_write -e moved_to <dir> 2>/dev/null | grep --line-buffered '<filename>'
   ```

   With `persistent: true`, `timeout_ms: 3600000`, and a description that names the file (it appears in every notification).

3. Tell the user the monitor is armed and the task id to TaskStop when done.

## Reply convention

Each save is one turn. **Most asks are about editing the file itself — so the right move is just to do the edit. If the user's comment is fully addressed by your change, remove the comment too.** Don't accumulate ack-markers when the comment was the ask.

Use blockquotes / inline annotations only when:
- the answer is partial or deferred (you need to flag what's still open),
- the user asked a question that doesn't translate to a file edit,
- you want to surface a tradeoff before making the change.

Chat reply is minimal: one sentence noting what you changed, or "standing by" on a no-op save. Fall back to chat only for meta-questions (process, scope, "should I…?") that don't belong in the artifact.

## Composes with `plan checkout` / `plan push`

The skill works on any file path, including the temp file `plan checkout <ID>` writes for a Linear issue description (`/tmp/linear/<ID>/description.md`). Workflow:

1. `plan checkout ENG-XXXX` — pulls the description to disk.
2. Arm pair-on-file on `/tmp/linear/ENG-XXXX/description.md`.
3. Edit-save-edit with Claude responding inline.
4. `plan push ENG-XXXX` when the description is right.

Same pattern for any file the team uses as a substrate for an iterative loop — design docs, specs, drafts, notes.
