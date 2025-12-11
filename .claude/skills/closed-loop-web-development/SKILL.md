---
name: closed-loop-web-development
description: This skill enables autonomous web development with visual feedback. Triggered by phrases like "fix the UI", "adjust the styling", "add a new feature", or "iterate on this". Uses Playwright MCP to verify changes in a closed feedback loop.
---

# Closed Loop Web Development

Iterate on UI fixes and features by making code changes and visually verifying them using Playwright MCP.

**Prerequisites:** !IMPORTANT! Run the `browser-testing-setup` skill first to ensure environment is ready, and more info about local/prod supabase and users.

## When to Use

- Fixing UI bugs or styling issues
- Adding new UI features or components
- Adjusting layouts, colors, spacing
- User asks to test changes in the browser
- Need to verify UI changes visually

## The Loop

```
┌─────────────────────────────────────────┐
│  1. Take snapshot (understand current)  │
│              ↓                          │
│  2. Edit code                           │
│              ↓                          │
│  3. Reload page                         │
│              ↓                          │
│  4. Take snapshot (verify change)       │
│              ↓                          │
│  5. Repeat or done                      │
└─────────────────────────────────────────┘
```

## Workflow

Use `mcp__playwright__*` tools for all browser interactions:

1. **Navigate** to target page with `browser_navigate`
2. **Take snapshot** with `browser_snapshot` to understand current state
3. **Edit code** to make changes
4. **Reload** and take another snapshot to verify
5. **Iterate** until UI matches expectations

## Authentication

Sessions persist across Claude Code restarts, so you usually won't need to sign in.

If redirected to sign-in (first time or after clearing profile):

1. Take snapshot → find email input
2. Type email (e.g., `owner@test.local`) with `browser_type`
3. Click submit with `browser_click`
4. Navigate to Mailpit (`http://127.0.0.1:54324`)
5. Find and click magic link
6. Navigate to magic link URL

To switch users, clear the profile: `rm -rf .ignored/playwright-storage/profile`

## Tips

| Tip | Why |
|-----|-----|
| Prefer `browser_snapshot` over `browser_take_screenshot` | More token-efficient |
| Reload after code changes | Hot reload may not catch all changes |
| Check console for errors | `browser_console_messages` |
| Multiple iterations are normal | UI work is inherently iterative |
