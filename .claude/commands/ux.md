---
description: Build UX enhancements under newUX toggle using figma-design-oria branch and Figma
---

# UX Development Mode

You are now in UX development mode. Build enhanced UX under the `newUX` toggle.

## Context Loaded

!`cat .claude/skills/ux/SKILL.md`

## Page Mapping (Figma reference)

!`cat tools/figma/page-mapping.json`

## MCP Tools

Use `mcp__figma-personal__*` tools to fetch Figma designs. If not enabled, the user will be prompted to approve.

**File key:** `A0DV8pRwHWgs9EF07sVYxG`

## Quick Reference

```bash
# View branch changes
git diff --stat main..origin/figma-design-oria

# View specific file from branch
git show origin/figma-design-oria:nextjs-app/path/to/file.tsx

# Fetch Figma frame (use node_ids from page-mapping.json)
# mcp__figma-personal__get_figma_data with file_key and node_id
```

## Ready

What UX enhancement should we build?
