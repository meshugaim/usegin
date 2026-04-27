---
id: z097
title: Shared `.git/index` makes per-creator commit attribution unenforceable — needs per-session worktrees
type: zettel
authored-by: usegin
threads: [↑z094, ↑z095, ↑z096, ~reference_autosync_concurrent_collisions, ~feedback_main_wt_stay_on_main]
created: 2026-04-27
session: 6ca86823-eae7-44be-86a1-09bb142813ab
---

## Human side

Lihu, 2026-04-27: *"i wanna clean git. but everything should be gitted by it's
creator. tell me if you manage to find who wrote what and send them messages
(wake them up) to commit. just a small POC if it's possible."*

POC verdict: **attribution detection works** (file → session via JSONL
`tool_use` scan, 34/35 mapped). **"Wake them up to commit"** mechanism exists
(`claude --resume <id> -p "..."`). **But neither solves the problem**, because
the bottleneck is upstream of attribution.

## UseGin side — the click

When N concurrent Claude sessions share one git checkout, they share *one*
`.git/index`. Any session's `git add` modifies the index for everyone. Any
session's `git commit` captures whatever is in the shared index *at that
instant*, not what that session staged.

So: even with perfect knowledge of who authored each file, you cannot
*commit* per-creator from a shared index. Race-condition by design. The
attribution layer is moot if the commit layer already shuffled authorship.

This generalizes z094 (untracked-file vanishing on `reset --hard`), z095
(pre-push lint blocking on a stranger's dirt), and z096 (mode-1 cluster — my
files under sibling's message). Same root: shared index. Different surface
symptoms.

Today (2026-04-27) we hit this **at least four times** across ENG-5413,
ENG-5414, ENG-5415, ENG-5416, plus this Zisser-build session. Five known
hits before noon.

## Concrete signature this session

Session `6ca86823` authored 1 file (`dictionary.md` edit) + ~30 new files
(`zisser/`, `usegin/.../CLAUDE.md`, etc.). When committing the 1-file edit:

```
$ git add usegin/wispr-flow-corrector/dictionary.md
$ git commit -m "wispr-corrector: cell → Zisser ..."
[main 9af0288a5] wispr-corrector: cell → Zisser (agent-name context)
 7 files changed, 1254 insertions(+), 1 deletion(-)
 create mode 100644 tools/dx/src/slack/commands/inbox.ts          ← NOT mine
 create mode 100644 tools/dx/src/slack/inbox.test.ts              ← NOT mine
 create mode 100644 tools/dx/src/slack/inbox.ts                   ← NOT mine
 create mode 100644 tools/dx/src/slack/inboxCursor.test.ts        ← NOT mine
 create mode 100644 tools/dx/src/slack/inboxCursor.ts             ← NOT mine
```

The `git notes` on `9af0288a5` carries the correction post-hoc.

## Decision shape (z020) — what we should do

> **D-worktree-per-session: Build a `dx session-wt` convention where each
> autonomous Claude session opens its own git worktree as a peer to
> `/workspaces/test-mvp/`, operates entirely there, and pushes commits as-is
> to main. The main checkout becomes the human's lane, never an agent's.**
>
> Because: shared `.git/index` is the root cause of every commit-attribution
> failure we've seen today. Every other proposed mitigation (autosync
> stash-before-reset, pre-commit fail-loud-on-foreign-staging, attribution
> annotation post-hoc) is a band-aid. Worktrees give each session a
> physically-isolated index.
>
> Price: each session needs ~50–100MB of duplicated working-tree files
> (linked, but the cost is real on agents that compile/build). Setup cost:
> a `dx session-wt enter` command, a SessionStart hook to call it, a teardown
> step that rebases the session's commits onto main and removes the worktree.
>
> Risk: agents accustomed to `/workspaces/test-mvp/` paths will produce
> absolute-path artifacts that don't transplant. Mitigation: enforce
> repo-relative paths via existing CLAUDE.md conventions (already mostly
> done).
>
> Alternatives rejected:
> A. Serialize commits via lockfile — preserves shared-index root cause; just
>    queues races into deadlocks.
> B. Per-agent `.gitconfig` with `core.indexFile=...` overrides — works
>    technically, but the working tree is still shared so untracked files
>    still vanish on each other's `reset --hard`.
> C. Tell agents to commit-on-every-write — already partially adopted (z094);
>    reduces blast radius but doesn't fix the message-payload mismatch (z096).
> D. Post-hoc attribution patches via `git notes` — what we're doing right
>    now. Useful as a stopgap; not a fix.

## Trigger to revisit

When `dx session-wt` is implemented end-to-end and one autonomous-cluster
session has run end-to-end through it without a collision, supersede this
zettel with the operational-shape one.

Until then: the rule is "in a shared checkout, expect attribution drift,
verify with `git log -- <path>` not `git log --grep`, and add `git notes`
post-hoc when a commit's message and payload diverge."
