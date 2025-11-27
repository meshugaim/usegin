---
name: creating-retro-proposals
description: Create proposal branches from retro analysis. Used by CI after analyzing a session. Triggered by "create proposals", "turn this into proposals", or after completing session analysis in CI.
---

# Creating Retro Proposals

Turn analysis insights into concrete proposal branches that can be reviewed and merged.

## Context

This skill is typically used in CI after analyzing a session. The workflow:
1. Session pushed to `retro/sessions/<date>-<short-id>` branch
2. CI parses session and runs analysis
3. Analysis identifies friction points and proposed improvements
4. **This skill:** Create proposal branches with actual changes

## Prerequisites

You need:
- Session ID (from the session branch name, e.g., `0ce86053` from `retro/sessions/2024-01-15-0ce86053`)
- One or more proposals from your analysis with: title, type, confidence, description

## Proposal Types

| Type | What to change |
|------|----------------|
| `skill-refinement` | Edit existing `.claude/skills/<name>/SKILL.md` |
| `new-skill` | Create new `.claude/skills/<name>/SKILL.md` |
| `skill-deprecation` | Delete or mark skill as deprecated |
| `claude-md` | Edit `CLAUDE.md` |
| `tooling` | Create/edit scripts in `retro/`, `session-parser/`, etc. |

## Workflow

### Step 1: Extract Session ID

Get the short session ID from the session branch:
```bash
# If analyzing branch retro/sessions/2024-11-27-0ce86053
SESSION_ID="0ce86053"
```

In CI, this comes from the `$SESSION_BRANCH` environment variable or workflow input.

### Step 2: For Each Proposal

For each proposal identified in your analysis:

#### 2a. Create Branch

```bash
# Ensure on main first
git checkout main
git pull origin main

# Create proposal branch
# Format: retro/proposals/<session-id>-<slug>
git checkout -b retro/proposals/${SESSION_ID}-<proposal-slug>
```

Slug should be kebab-case, descriptive, e.g.:
- `refine-writing-specs`
- `new-debugging-skill`
- `update-claude-md-patterns`

#### 2b. Make Actual Changes

Make the actual file changes based on proposal type:

**Skill refinement:**
```bash
# Edit the existing skill file
# .claude/skills/<skill-name>/SKILL.md
```

**New skill:**
```bash
mkdir -p .claude/skills/<skill-name>
# Write SKILL.md with frontmatter and content
```

**CLAUDE.md update:**
```bash
# Edit CLAUDE.md directly
```

#### 2c. Create Meta File

```bash
mkdir -p retro/proposals/<proposal-slug>
```

Write `retro/proposals/<proposal-slug>/meta.md`:

```markdown
# <Proposal Title>

**Type:** <skill-refinement|new-skill|skill-deprecation|claude-md|tooling>
**Confidence:** <high|medium|low>
**Source Session:** <full-session-id or session-branch>

## Summary

<1-2 sentences: what this proposal changes and why>

## Changes

- <file1>: <what changed>
- <file2>: <what changed>

## Context

<Brief explanation of the friction point or gap that led to this proposal>
```

#### 2d. Commit and Push

```bash
git add .
git commit -m "retro: <proposal-slug>

<Brief description of the change>

Source: retro/sessions/<date>-<session-id>"

git push -u origin retro/proposals/${SESSION_ID}-<proposal-slug>
```

### Step 3: Return to Main

After creating all proposals:
```bash
git checkout main
```

## Example

Analysis identified: "The implementing-specs skill should mention using subagents for parallel work"

```bash
SESSION_ID="0ce86053"

# Create branch
git checkout main && git pull
git checkout -b retro/proposals/0ce86053-refine-implementing-specs

# Edit the skill
# ... edit .claude/skills/implementing-specs/SKILL.md ...

# Create meta
mkdir -p retro/proposals/refine-implementing-specs
cat > retro/proposals/refine-implementing-specs/meta.md << 'EOF'
# Refine Implementing Specs Skill

**Type:** skill-refinement
**Confidence:** medium
**Source Session:** retro/sessions/2024-11-27-0ce86053

## Summary

Add guidance about using subagents for parallel work to the implementing-specs skill.

## Changes

- `.claude/skills/implementing-specs/SKILL.md`: Added section on subagent usage

## Context

Session showed repeated sequential operations that could have been parallelized with subagents.
EOF

# Commit and push
git add .
git commit -m "retro: refine-implementing-specs

Add subagent parallelization guidance

Source: retro/sessions/2024-11-27-0ce86053"

git push -u origin retro/proposals/0ce86053-refine-implementing-specs
git checkout main
```

## CI Environment Notes

When running in CI (GitHub Actions):
- Use `git config` for commits if needed:
  ```bash
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  ```
- Ensure `contents: write` permission in workflow
- The `GITHUB_TOKEN` allows pushing to the same repo

## Decision: When to Create Proposals

Not every insight needs a proposal branch. Create proposals when:
- **High confidence:** Clear improvement, create it
- **Medium confidence:** Create if the change is concrete and testable
- **Low confidence:** Usually skip, or note in analysis output for human review

Skip creating proposals for:
- Vague observations without concrete fixes
- Changes that need more investigation
- Patterns seen only once (wait for repetition)
