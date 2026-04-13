---
name: How to reason about issue attribution
handle: attribution
type: explanation
context: When you need to know who created, owns, or is working on an issue
tags: [workflow, attribution]
---

# Issue Attribution

**TL;DR**: Every Linear field — author, assignee, comment author — looks like one person because the whole team shares one API key. For real attribution, read git history.

## Why everything looks like one user

We use a single Linear API key for the whole workspace: the human, you (Claude), and any other agents spawned in this repo. Linear only sees the key's user, so:

- **Author** on every issue is that user
- **Assignee** set by `plan start` (which runs "assign to me") is that user
- **Comment author** on every comment is that user
- `plan list --assignee @me` returns everything the team has ever touched, not "the human's personal todos"

These fields aren't lying — they're just degenerate. Don't build inferences on them.

## Ownership is team-level; focus is not

Treat issues as **team-owned**. There's no single "mine" vs "theirs" — the human, you, and other agents are all working the same backlog, and any issue may have passed through several hands.

That said, people focus on specific things. The human may be deep in one area while you're working on another, and those threads aren't interchangeable just because they share an assignee. When you pick up work, use the graph — not the assignee field — to understand where it fits:

- **Parent** — what larger goal is this serving?
- **Siblings** — what related work is already in flight or recently closed?
- **Status** — is this in active rotation (`In Progress`) or free for pickup?
- **Labels** — what kind of work is it (`bug`, `feature`, `chore`, `docs`)?
- **Recent activity** — `plan list --active` surfaces what's been moving lately.

These signals tell you more about the real state of work than anything in the author/assignee fields.

## When you need real attribution, read git

Sometimes you genuinely need to know who wrote a piece of code, who made a past decision, or who closed an issue a certain way. The authoritative source is **git history**, not Linear:

```bash
git log --all --grep "ENG-123"     # Commits referencing the issue
git log -- path/to/file            # History for a file
git blame path/to/file             # Line-level authorship
```

Commits are signed by real git users, not the shared API key. The `Co-Authored-By:` trailer on agent commits distinguishes human work from agent work.

**Rule of thumb**: if Linear's assignee says one thing and git history says another, trust git history.

## What to do instead of `--assignee @me`

`plan list --assignee @me` is not "what's mine" — it's "everything the team has touched". More useful queries:

```bash
plan list                              # Top of the backlog, priority-ordered
plan list --status "In Progress"       # What's actively being worked on
plan list --label bug                  # Filter by kind of work
plan list --active                     # Sorted by recent activity
plan show <id> --tree                  # Graph context for a specific issue
```

## See also

- `plan docs show philosophy` — how we work together
- `plan docs show iterative-descriptions` — editing issue descriptions
