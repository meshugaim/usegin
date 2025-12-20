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

**The graph**: Work lives in a web of connected issues. When creating, connect it to existing items - `--parent` for sub-issues, `--related-to` for loose connections. This means, first start by familiarizing with the existing `plan list`. Standalone issues are rare.

**Ordering**: The order of issues is a rough understanding of how we think execution should be sequenced. Focus on what's at the top. The rest will shift as things become clearer.

**Flow**: create → start → close

## What We Value

**Connectedness** — We build a web of related issues, linked commits, parent-child relationships. Context travels with the work.

**Clarity** — Simple names: `scope: what it does`. Labels carry the type. Titles stay scannable.

**Traceability** — Commits mention the issue they serve. The story of how things came to be is worth preserving.

**Presence** — We start what we're working on, close what we've finished. The list reflects where we actually are.

## Practices

**Labels** — Use labels for the type of work: `bug`, `feature`, `chore`, `docs`. This keeps titles focused on *what*, while labels signal *what kind*.

**One source of truth** — Linear is where work lives. Don't track tasks in markdown files, todo lists, or other tools. If it's worth tracking, it goes in Linear via `plan`.

**Commit often** — Small, frequent commits. Mention the Linear issue in the commit body (e.g., `Closes: ENG-123` or `Part of: ENG-123`). The commit history tells the story.

**Iterative descriptions** — For complex issue descriptions, see `plan docs show iterative-descriptions`.
