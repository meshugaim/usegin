---
name: closed-loop-web-development
description: This skill should be used for autonomous web development with visual feedback. Triggered by phrases like "fix the UI", "adjust the styling", "add a new feature", or "iterate on this". Uses Chrome DevTools MCP to verify changes in a closed feedback loop.
---

# Closed Loop Web Development

## Overview

Iterate on UI fixes and features by making code changes and visually verifying them using Chrome DevTools MCP. This enables a tight feedback loop for UI development.

## When to Use

Use this skill when:
- Fixing UI bugs or styling issues
- Adding new UI features or components
- Adjusting layouts, colors, spacing, or other visual elements
- User asks to test changes in the browser
- Need to verify UI changes visually

## Prerequisites

- Chrome running with remote debugging (via `just chrome-start` or pm2)
- Dev server running: start it with `just dev`
- App accessible at http://localhost:3000
- Chrome DevTools MCP tools available (tools starting with `mcp__chrome-devtools__`)

## Workflow

### Step 1: Verify Chrome DevTools MCP is Available

**IMPORTANT**: Before proceeding, verify you have access to Chrome DevTools MCP tools.

Try calling `mcp__chrome-devtools__list_pages`. If this fails with "No such tool available":

1. **Verify Chrome is running**:
   ```bash
   just chrome-status
   # Should show "online" status

   # Also verify the debug port is responding:
   curl -s http://127.0.0.1:9222/json/version
   ```

2. **If Chrome is running but MCP tools aren't available**:
   - STOP and ask the user to **restart Claude Code** so the MCP server connection is re-established
   - The Chrome DevTools MCP needs to be loaded at Claude startup
   - Say: "Chrome is running but I don't have access to the Chrome DevTools MCP tools. Please restart Claude Code to reload the MCP connection, then try again."

3. **If Chrome is not running**:
   ```bash
   just chrome-start
   ```
   Then ask the user to restart Claude Code.

### Step 2: Ensure Dev Server is Running

```bash
# Check if dev server is running
lsof -ti:3000,8000

# If not running, start it
just dev
```

### Step 3: Connect to Chrome and Navigate to App

```bash
# List pages to confirm connection
mcp__chrome-devtools__list_pages

# Navigate to the app
mcp__chrome-devtools__navigate_page --type url --url http://localhost:3000
```

### Step 4: Sign In (if needed)

If redirected to sign-in page:

1. Fill in email (use `nitsan@askeffi.ai` or user-specified email):
```bash
mcp__chrome-devtools__fill --uid <email-input-uid> --value "nitsan@askeffi.ai"
```

2. Click send magic link button

3. Get magic link from user or check server logs for the verification URL

4. Navigate to the magic link URL to complete authentication

### Step 5: Navigate to Relevant Page

Navigate to the page you need to work on (e.g., `/dashboard`, `/settings`, etc.)

### Step 6: Iterate

