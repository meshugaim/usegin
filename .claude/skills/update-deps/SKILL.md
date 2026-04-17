---
name: update-deps
description: Update dependencies across the entire monorepo. Triggered by "update deps", "upgrade dependencies", "refresh deps", "dependency update", or "let's update deps".
---

# Update Dependencies

Update all dependencies across the monorepo. Every package manager, every sub-package, every lockfile.

## Before Starting

1. **Discover the current shape.** Scan the repo for all `package.json`, `pyproject.toml`, lockfiles, and any other dependency manifests. The repo is a monorepo — there are sub-packages, tools, apps, and test suites scattered across it. Find all of them. Don't just check the obvious apps — check `tools/`, `tests/`, and `experiments/` too. Every `pyproject.toml` and `package.json` is a separate upgrade target.

2. **Check dependabot PRs early.** Run `gh pr list --label dependencies` during discovery. Dependabot PRs reveal pinned versions and version range constraints that `bun update`/`uv lock --upgrade` can't fix. Incorporate them into the plan rather than discovering them halfway through.

3. **Flag pinned versions — and understand *why*.** `bun update` only bumps within version ranges. Exact pins without `^` or `~` (e.g., `"react": "19.2.4"`, `claude-agent-sdk==0.1.56`) need manual edits, so they'd otherwise be silently skipped.

   Don't just list the pins — figure out *why* each one is pinned. Some pins are intentional (lockstep ecosystems like `react`/`react-dom`, or Storybook packages, where sibling versions must match exactly) and need coordinated bumps. Others are incidental (dependabot's default write behavior) and bump like anything else. The reason determines the bump strategy, so call it out in the plan.

4. **Build a plan.** Group what you found into logical stages (e.g., by app, by package manager, by risk level). Patches and in-range bumps first, majors later.

5. **Present the plan to the user.** Show the stages, what each covers, and the order. Wait for approval before executing.

## How to Work

- **Small steps.** One logical change at a time. Commit and push after each. Don't batch unrelated updates.
- **In-range first, then majors.** Patches are safe to batch per area. Major bumps get their own commit — research breaking changes before upgrading.
- **Verify after every change.** Typecheck, lint, automated tests — whatever the area supports. If you find pre-existing test failures or typecheck errors along the way, fix them — leave the codebase cleaner than you found it.
- **Major changes need test runs, not just "it installs."** A package can install fine and still break behavior silently (e.g., chardet 7 regresses Latin-1 encoding detection). Always run the full test suite after major bumps.
- **Use worktrees** to avoid interfering with other agents' work.
- **Track in Linear** via `plan` — parent issue for the overall effort, sub-issues per stage.

### Python-specific

- **`uv lock --upgrade` updates the lockfile but doesn't install.** Always follow with `uv sync`. Otherwise `uv pip list --outdated` still shows old versions and you think nothing changed.
- **Understand upstream constraints before reporting skips.** `uv pip list --outdated` shows ALL installed packages including transitive deps. Many are blocked by upstream constraints. Use `uv tree --package X --invert` to see why a package can't upgrade — say "blocked by pyiceberg requiring cachetools<7" not just "skipped."
- **Each Python tool is independent.** Tools with their own `pyproject.toml` + `uv.lock` (e.g., `tools/fathom/`, `tools/gmail/`) have separate dependency trees. Upgrade each one individually.

### JS-specific

- **Clean stale generated files.** Next.js `.next/types/` can have stale references to deleted routes. Clean before typechecking: `rm -rf .next/types .next/dev/types`.
- **Check version overrides.** Some packages have `"overrides"` in package.json that can go stale after updates. Align them with the actual dependency versions.

### Dependabot PRs

- **Close dependabot PRs when superseded.** After applying changes manually on main, close the corresponding dependabot PRs with a comment explaining what was done. Otherwise they clutter the PR list.

## What "Done" Looks Like

- Every dependency manifest audited — nothing silently skipped.
- `bun outdated` clean across all JS areas.
- `uv pip list --outdated` clean for Python areas (or remaining items explained with specific upstream constraints).
- No uncommitted lockfile drift.
- Dependabot PRs closed or addressed.
- Pre-existing issues found along the way are fixed (broken tests, stale configs, redundant overrides).
- Linear issue closed.
