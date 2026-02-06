---
name: session-retro
description: Analyze Claude Code sessions and create GitHub issues for suggested improvements. Triggered by "retro on session", "analyze this session", or "session retro".
---

# Session Retro

Analyze a Claude Code session to identify friction points and create GitHub issues for suggested improvements.

**Skills are the unit of evolution.** Improvements should flow back to skills - refining existing ones or seeding new ones. This creates a flywheel: sessions surface friction → skills get better → future sessions improve.

## Workflow

### Step 1: Parse the Session

```bash
session <session.jsonl> --tool-input --subagents
```

### Step 2: Identify Issues

Look for:

**Friction Points:**
- Multiple similar tool calls (searching/guessing)
- Failed approaches that had to be retried
- Long outputs that weren't used
- Subagents spawned but abandoned
- Rewinds (marked `[REWIND]` in parser output) - conversation branched

**Skill Gaps:**
- Domain patterns Claude didn't know
- Missing guidance that would have helped

### Step 2b: Attribute to Skills

If an improvement relates to work done as part of an active skill, target the improvement at that skill.

- Skill was active + friction occurred → update that skill
- No skill active + repeatable pattern → consider proposing a seed skill
- Truly project-wide → target CLAUDE.md

**Placeholder skills** are lightweight seeds for patterns not yet mature:
```markdown
---
name: <pattern-name>
description: <normal description>. Triggered by "<trigger>".
---

# <Pattern Name>

**Status:** Placeholder - needs more observations

## Pattern Observed
<what happened>

## Potential Guidance
<rough ideas, to be refined>
```

### Step 3: Create GitHub Issues

For each concrete improvement, create a GitHub issue:

```bash
gh issue create \
  --title "retro: <short description>" \
  --label "retro" \
  --body "$(cat <<'EOF'
## Summary

<1-2 sentences: what to change and why>

## Context

<Brief explanation of the friction point or gap observed in the session>

## Suggested Changes

- <file or area to change>
- <what to change>

## Skill Attribution

- **Target:** `<skill-name>` | `CLAUDE.md` | `new placeholder skill: <name>`

## Source

Session: `<session-branch or session-id>`
EOF
)"
```

### Step 4: Output Summary

After creating issues, output a summary:

```markdown
## Summary
[1-2 sentences: what happened in the session, did it succeed]

## Friction Points
- [point 1]
- [point 2]

## Issues Created
- #123 - <title>
- #124 - <title>

## Observations (not actionable yet)
- [things noticed but not concrete enough for an issue]
```

## Session File Location

Sessions live in `~/.claude/projects/<project-hash>/`:
- Main session: `<uuid>.jsonl`
- Subagents: `agent-*.jsonl`

Use `--list-files` to find related files:
```bash
session <session.jsonl> --list-files
```

## When to Create Issues

Create issues when:
- There's a concrete, actionable improvement
- The change is specific enough to implement

Skip creating issues for:
- Vague observations without concrete fixes
- Patterns seen only once (note them, wait for repetition)
- Changes that need more investigation first

## Known Issues (don't re-create)

- Unnecessary warmup exploration in skill subagents (#13)
