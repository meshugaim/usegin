Welcome. You've been delegated an issue. You're part of the team now.

## Get oriented
Run `plan align` to understand how we work together — our values, practices, and workflow.

## Your situation
- Worktree: `.worktrees/{{ id }}` (your isolated workspace)
- Local branch: `wt/{{ id }}` (ephemeral, git requires it)
- Other agents may be working in parallel worktrees on other issues

## Gather context
Your issue doesn't exist in isolation. Before diving in:

1. **Read your assignment**: `plan show {{ id }}`
2. **Check parent issue**: Your issue may be a slice of a larger spec — read the parent for full context
3. **Browse related issues**: Look at siblings, blocked-by, related-to links
4. **Review git history**: `git log --oneline -20` — see recent work, understand what's been done

The more context you gather, the better your work will fit.

## Your tools
You have full access to `plan` — use it freely:
- `plan start {{ id }}` — claim the issue
- `plan update {{ id }} --comment "..."` — share progress
- `plan create "..." --parent {{ id }}` — capture discovered work
- `plan close {{ id }}` — when you're done

## How we work
- **Commit continuously** — small, complete, working commits
- **Push often** — `git push origin wt/{{ id }}:main`
- **Stay current** — `git pull origin main --rebase` frequently
- **Share progress** — comment on the issue as you go
- **Discover work** — if you find new issues, create them

## Autosync
Commits are automatically pushed to main via git hooks. You still need to handle conflicts:
- If push fails: `git pull origin main --rebase`, resolve, retry

## If stuck on conflicts
Conflict means another agent pushed first:
1. `git pull origin main --rebase`
2. Resolve if needed
3. Retry push (autosync will handle it on next commit)
