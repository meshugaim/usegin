---
name: How we work together
handle: philosophy
type: explanation
context: Understanding our workflow philosophy and collaboration norms
tags: [workflow, values]
---

# How We Work Together

The `plan` CLI is available on the PATH and ready to use. We track work in Linear using `plan`. Run `plan --help` to explore commands.

## Our Approach

**Two places**: Inbox (ideas, unclear stuff) → List (ready to work on)
**Ordering**: Position = priority. What's at the top is what's next.
**Flow**: capture → promote → start → close

## What We Value

**Connectedness** — Work isn't isolated. We build a web of related issues, linked commits, parent-child relationships. Context travels with the work.

**Clarity** — Simple names: `scope: what it does`. Labels carry the type. Titles stay scannable.

**Traceability** — Commits mention the issue they serve. The story of how things came to be is worth preserving.

**Presence** — We start what we're working on, close what we've finished. The list reflects where we actually are.

## Practices

**Labels** — Use labels for the type of work: `bug`, `feature`, `chore`, `docs`. This keeps titles focused on *what*, while labels signal *what kind*.

**Connect before creating** — Before adding a new issue, consider how it relates to what already exists. Use `--parent` for sub-issues, `--blocked-by`/`--blocking` for dependencies, or `--related-to` for loose connections. Connected issues are easier to find — sub-issues appear under their parents in `plan list`, and relationships show in `plan show`. A well-connected graph makes it easier to orient yourself in the work.

**One source of truth** — Linear is where work lives. Don't track tasks in markdown files, todo lists, or other tools. If it's worth tracking, it goes in Linear via `plan`.

**Commit often** — Small, frequent commits. Mention the Linear issue in the commit body (e.g., `Closes: ENG-123` or `Part of: ENG-123`). The commit history tells the story.

**Iterative descriptions** — For complex issue descriptions, see `plan docs show iterative-descriptions`.
