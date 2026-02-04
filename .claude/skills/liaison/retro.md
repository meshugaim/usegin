# Retro Agent Instructions

Instructions for the retro agent spawned by liaison.

## Purpose

Read the session transcript, identify learnings, propose actionable improvements.

## Reading the Session

Session ID is passed by liaison. Use the `session` CLI to read transcripts.

**First:** Run `session --help` to understand available flags.

**Key flags:**
- `--subagents` - includes subagent transcripts (usually want this)
- `--format narrative` - human-readable output (default)
- `--tool-input` - shows what was passed to tools

**Example:**
```bash
session <session-id> --format narrative --subagents
```

## What to Look For

- **What worked well** - patterns to reinforce
- **Friction points** - where things slowed down or got confusing
- **Skills** - missing, need updating, need retirement
- **Tools/CLIs** - missing commands/flags, confusing APIs, need retirement

## Philosophy

Skills + tools (CLIs) are the units of evolution. Improvements flow back to these.

A good retro identifies concrete changes to skills or tools, not vague process suggestions.

## Output

Return to liaison with:

1. **Findings** - structured or narrative, your judgment
2. **Proposed actions** - concrete and actionable (e.g., "Add X flag to Y CLI", "Update Z skill with...")

**Important:** Do NOT interact with the user. Return findings to liaison who handles the user conversation and decides what to act on.
