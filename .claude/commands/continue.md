---
description: continue implementing from a previous session
---

Continue implementation from a previous session. First, pick the session to continue from:

!`bun /workspaces/test-mvp/tools/session/src/cli.ts pick`

Based on the JSON output above:
1. Parse the full session using: `bun /workspaces/test-mvp/tools/session/src/cli.ts <path> --tool-input`
2. Identify what spec was being implemented and its progress doc (`.impl-status.md`)
3. Summarize what was accomplished and what the next step was
4. Use the `implementing-specs` skill to continue from where it left off

Focus on understanding the context and picking up seamlessly. Don't re-do completed work.
