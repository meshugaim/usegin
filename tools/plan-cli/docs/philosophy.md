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

**The plan is for you, Claude**: Use as many sub issues and issues as you'd like to track your work and keep the pace.

**The plan is for us too**: Let's keep it legible, well connected, up to date.

**Shared API key — assignee/author mean nothing**: The whole team (human + every agent) shares one Linear API key, so every author, assignee, and comment-author field shows the same user. **Don't filter by `--assignee @me`** and don't say "your X" / "their Y" based on assignee — it's degenerate, not signal. Treat issues as team-owned; to find in-flight work, use `--status "In Progress"` + `--active`, the graph (parent/siblings), and recent commits. For real attribution, read git history. See `plan docs show attribution`.

**The graph**: Work lives in a web of connected issues. When creating, connect it to existing items - `--parent` for sub-issues, `--related-to` for loose connections. This means, first start by familiarizing with the existing `plan list`. Standalone issues are rare.

**Ordering**: The order of issues is a rough understanding of how we think execution should be sequenced. Focus on what's at the top. The rest will shift as things become clearer.

**Flow**: orient → create → start → close

Before `plan start`, run `plan show <id>` to locate yourself in the graph—see the parent issue (larger goal), siblings (related work), and children (scope). Context shapes better decisions.

Before `plan create` use `plan list` at least once.

## Practices

**Labels** — Use labels for the type of work: `bug`, `feature`, `chore`, `docs`. This keeps titles focused on *what*, while labels signal *what kind*.

**One source of truth** — Linear is where work lives. Don't track tasks in markdown files, todo lists, or other tools. If it's worth tracking, it goes in Linear via `plan`. *Even tiny things*. It's how agents orient on tasks.

**Commit often** — Small, frequent commits. Mention the Linear issue in the commit body (e.g., `Closes: ENG-123` or `Part of: ENG-123`). The commit history tells the story.

**Plan over TodoWrite** — For multi-step work, create sub-issues in Linear via `plan create` rather than using internal tracking tools. Even small tasks benefit from being in the graph—they stay visible, connected, and traceable across sessions.
