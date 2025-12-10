---
name: merging-claude-bot-branches
description: This skill should be used when the user wants to merge branches created by the @claude GitHub bot. Triggered by phrases like "merge the claude bot branch", "merge issue X", "let's merge claude's work", or "integrate the bot's changes". Handles the complete workflow of fetching, merging, testing, and fixing builds.
---

# Merge Claude Bot Branches

## Overview

This skill handles the complete workflow for merging branches created by the @claude GitHub bot, including conflict resolution, build testing, and fixes.

## When to Use

Use this skill when the user wants to merge work done by the @claude GitHub bot. Common trigger phrases include:

- "merge the claude bot branch"
- "merge issue X"
- "let's merge claude's work"
- "integrate the bot's changes"
- "merge back the work from claude[bot]"

## Workflow

### Step 1: Check Git Status and Handle Local Changes

Before starting, verify the working directory is clean:

```bash
git status
```

**If there are uncommitted changes:**
- **Untracked files only:** Can proceed (they won't interfere with merge)
- **Modified or staged files:** Ask user how to handle:
  - Option 1: Commit the changes first
  - Option 2: Stash the changes (`git stash push -m "WIP: before merging claude bot work"`)
  - Option 3: Discard the changes (if user confirms)

### Step 2: Fetch and List Available Work

Gather information about what can be merged:

```bash
# Fetch latest from remote
git fetch origin

# List all issues (to understand what work was done)
gh issue list --json number,title,state,labels --jq '.[] | select(.labels[].name == "claude") | "\(.number): \(.title) [\(.state)]"'

# List all branches (to find claude bot branches)
git branch -a | grep "claude/"
```

**Present to user:**
- Show all claude bot branches with their associated issue numbers
- Show issue titles to give context about what each branch does
- If only one branch exists, ask if they want to merge it
- If multiple branches exist, ask which ones to merge and in what order

### Step 3: Merge Each Branch (One by One)

For each branch to merge:

#### 3.1 Attempt Merge

#### 3.2 Handle Conflicts (if any)

**If conflicts are complex:** Ask user for guidance on resolution strategy.

#### 3.3 Test the Build (if relevant)

First, check which files changed:

```bash
git diff --name-only HEAD~1
```

Only run builds if relevant code changed:
- **nextjs-app/**: `cd nextjs-app && bun run build`
- **python-services/**: `cd python-services && uv run pytest`
- **tools/session-parser/**: `cd tools/session-parser && bun test`
- **tools/retro/**: `cd tools/retro && bun test`
- **Docs/config only** (CLAUDE.md, .github/, etc.): Skip build

#### 3.4 Fix Build Errors (if any)

**If fixes are complex or you're unsure:** Ask user for guidance.

#### 3.5 Push to Main

### Step 4: Cleanup

After successful merge:

1. Close the issue with a comment referencing the merge commit
2. Delete local branch: `git branch -D <branch-name>`
3. Delete remote branch: `git push origin --delete <branch-name>` or `gh api repos/<owner>/<repo>/git/refs/heads/<branch-name> -X DELETE`
4. Prune stale remote references: `git fetch --prune`

Example:
```bash
gh issue close <issue-number> --comment "Merged in <commit-hash>"
git branch -D merge-biome
git push origin --delete claude/issue-3-20251031-1612
git fetch --prune
```

### Step 5: Move to Next Branch

If there are more branches to merge:
- Repeat Step 3 for the next branch
- Continue until all requested branches are merged

## Best Practices

- **One at a time:** Merge branches one by one to isolate issues
- **Test after each merge:** Don't batch merges without testing
- **Clear communication:** Keep user informed of progress and any issues
- **Ask when uncertain:** Don't guess on conflict resolution or complex fixes
- **Commit fixes separately:** Keep merge commits and fix commits separate for clarity
- **Preserve bot's work:** Default to keeping claude bot's changes unless they clearly break something

## Common Scenarios

### Scenario 1: Single Branch, Clean Merge
1. Fetch
2. Show branch and ask confirmation
3. Merge
4. Test build
5. Push

### Scenario 2: Multiple Branches, Clean Merges
1. Fetch
2. Show all branches and ask which to merge
3. For each branch: merge → test → push → clean-up
4. Confirm all done

### Scenario 3: Merge with Conflicts
1. Fetch
2. Attempt merge
3. Conflicts detected → analyze → resolve
4. Test build
5. If build fails → fix → test again
6. Push

### Scenario 4: Merge Breaks Build
1. Fetch
2. Merge (clean)
3. Build fails
4. Analyze errors → fix
5. Test build again
6. Push with both merge and fix commits

## Error Handling

**If merge fails with conflicts:**
- Carefully analyze both sides
- Resolve in favor of working code
- Test thoroughly after resolution

**If build fails after merge:**
- Don't push until build passes
- Fix errors methodically
- Re-test after each fix
- Commit fixes with clear messages

**If you're stuck:**
- Show the user what's blocked
- Ask for guidance
- Don't force through uncertain changes

## Notes

- The branch naming pattern is typically: `claude/issue-<number>-<YYYYMMDD>-<HHMM>`
- Always use `origin/` prefix when merging remote branches
