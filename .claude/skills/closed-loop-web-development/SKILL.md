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
- Dev server running (`just dev`)
- App accessible at http://localhost:3000

## Workflow

### Step 1: Ensure Chrome and Dev Server are Running

```bash
# Check if Chrome is running
bun pm2 status chrome-devtools

# If not running, start it
just chrome-start

# Check if dev server is running
lsof -ti:3000,8000
```

### Step 2: Connect to Chrome and Navigate to App

```bash
# List pages to confirm connection
mcp__chrome-devtools__list_pages

# Navigate to the app
mcp__chrome-devtools__navigate_page --type url --url http://localhost:3000
```

### Step 3: Sign In (if needed)

If redirected to sign-in page:

1. Fill in email (use `nitsan@askeffi.ai` or user-specified email):
```bash
mcp__chrome-devtools__fill --uid <email-input-uid> --value "nitsan@askeffi.ai"
```

2. Click send magic link button

3. Get magic link from user or check server logs for the verification URL

4. Navigate to the magic link URL to complete authentication

### Step 4: Navigate to Relevant Page

Navigate to the page you need to work on (e.g., `/dashboard`, `/settings`, etc.)

### Step 5: Take Initial Screenshot/Snapshot

Capture current state before making changes:

```bash
# Take snapshot for text-based inspection
mcp__chrome-devtools__take_snapshot

# Take screenshot for visual inspection
mcp__chrome-devtools__take_screenshot
```

### Step 6: Make Code Changes

Edit the relevant files to fix the issue or add the feature.

### Step 7: Wait for Hot Reload

```bash
sleep 2-3  # Wait for Next.js hot reload
```

### Step 8: Verify Changes Visually

```bash
# Take new screenshot to see changes
mcp__chrome-devtools__take_screenshot

# Or inspect specific elements
mcp__chrome-devtools__evaluate_script --function "() => { /* inspect DOM/styles */ }"
```

### Step 9: Iterate as Needed

Repeat steps 6-8 until the UI is correct.

### Step 10: Test Interactions (if applicable)

If the change involves interactive elements:
- Click buttons using `mcp__chrome-devtools__click`
- Fill forms using `mcp__chrome-devtools__fill`
- Test hover states, animations, etc.

## Tips

- **Visual verification is key** - Always take screenshots to confirm changes look correct
- **Hot reload timing** - Wait 2-3 seconds after file changes for hot reload to complete
- **Use snapshots for structure** - Use text snapshots to inspect DOM/accessibility tree
- **Use screenshots for visuals** - Use screenshots to verify colors, spacing, layouts
- **Test interactions** - Don't just check static appearance, test clicking, hovering, etc.
- **Check responsive** - Resize the page if needed using `mcp__chrome-devtools__resize_page`

## Example: Fixing Inline Code Styling

```bash
# 1. Ensure Chrome is running
bun pm2 status chrome-devtools

# 2. Navigate to app
mcp__chrome-devtools__navigate_page --type url --url http://localhost:3000

# 3. Sign in (get magic link from user)
mcp__chrome-devtools__navigate_page --type url --url "<magic-link-url>"

# 4. Take screenshot of issue
mcp__chrome-devtools__take_screenshot

# 5. Inspect the problematic elements
mcp__chrome-devtools__evaluate_script --function "() => {
  return Array.from(document.querySelectorAll('code')).map(el => ({
    text: el.textContent,
    display: getComputedStyle(el).display,
    className: el.className
  }))
}"

# 6. Edit the component file
# (make changes to fix the styling)

# 7. Wait for hot reload
sleep 3

# 8. Verify the fix
mcp__chrome-devtools__take_screenshot

# 9. Inspect again to confirm
mcp__chrome-devtools__evaluate_script --function "() => {
  return Array.from(document.querySelectorAll('code')).map(el => ({
    display: getComputedStyle(el).display
  }))
}"
```

## Common Issues

**Chrome not connecting:**
- Ensure Chrome is running: `just chrome-start`
- Check if port 9222 is accessible

**Page not loading:**
- Verify dev server is running: `lsof -ti:3000`
- Check for build errors in terminal

**Hot reload not working:**
- Wait longer (sometimes takes 5+ seconds)
- Check for TypeScript/build errors
- Try navigating to a different page and back

**Magic link expired:**
- Request a new magic link from the sign-in page
- Magic links typically expire after 10-15 minutes
