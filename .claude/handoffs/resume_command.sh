#!/bin/bash
# Run this to continue the session
claude --dangerously-skip-permissions --append-system-prompt 'Handoff file: /workspaces/test-mvp/.claude/handoffs/handoff_20260106_172008.md' 'Context was running low. Session handed off automatically.

Previous session transcript: /workspaces/test-mvp/.claude/handoffs/handoff_20260106_172008.md

The previous session was working on: ENG-902
Run `plan show ENG-902` for full context.

IMPORTANT: First, read the handoff file and output a SHORT paragraph (3-4 sentences) confirming:
- What issue/task you understand was being worked on
- What specific work was in progress
- What you will do next

Then continue the task.'
