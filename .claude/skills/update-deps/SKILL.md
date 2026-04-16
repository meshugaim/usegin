---
name: update-deps
description: Update dependencies across the entire monorepo. Triggered by "update deps", "upgrade dependencies", "refresh deps", "dependency update", or "let's update deps".
---

# Update Dependencies

Update all dependencies across the monorepo. Every package manager, every sub-package, every lockfile.

## Before Starting

1. **Discover the current shape.** Scan the repo for all `package.json`, `pyproject.toml`, lockfiles, and any other dependency manifests. The repo is a monorepo — there are sub-packages, tools, apps, and test suites scattered across it. Find all of them.
2. **Build a plan.** Group what you found into logical stages (e.g., by app, by package manager, by risk level). Patches and in-range bumps first, majors later.
3. **Present the plan to the user.** Show the stages, what each covers, and the order. Wait for approval before executing.

## How to Work

- **Small steps.** One logical change at a time. Commit and push after each. Don't batch unrelated updates.
- **In-range first, then majors.** Patches are safe to batch per area. Major bumps get their own commit — research breaking changes before upgrading.
- **Verify after every change.** Typecheck, lint, automated tests — whatever the area supports.
- **Major changes need manual verification.** When a major upgrade touches UI, visual output, or user-facing behavior, don't rely on automated tests alone. Start the dev server, open a browser, and verify things look and work right. Tell the user what you checked.
- **Use worktrees** to avoid interfering with other agents' work.
- **Track in Linear** via `plan` — parent issue for the overall effort, sub-issues per stage.

## What "Done" Looks Like

- Every dependency manifest audited — nothing silently skipped.
- `outdated` checks clean across the repo (or intentional skips noted to the user with reasons).
- No uncommitted lockfile drift.
- Linear issue closed.
