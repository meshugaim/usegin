---
name: closed-loop-web-development
description: This skill enables autonomous web development with visual feedback. Triggered by phrases like "fix the UI", "adjust the styling", "add a new feature", or "iterate on this". Uses Chrome DevTools MCP to verify changes in a closed feedback loop.
---

# Closed Loop Web Development

Iterate on UI fixes and features by making code changes and visually verifying them using Chrome DevTools MCP.

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

### 1. Navigate to Target Page

```
mcp__chrome-devtools__navigate_page with url and type="url"
```

### 2. Take Initial Snapshot

```
mcp__chrome-devtools__take_snapshot
```

Understand current state before making changes.

### 3. Edit Code

Make changes to the relevant component/file.

### 4. Reload and Verify

```
mcp__chrome-devtools__navigate_page with type="reload"
mcp__chrome-devtools__take_snapshot
```

Check if the change had the intended effect.

### 5. Iterate

Repeat until the UI matches expectations.

## Authentication

If redirected to sign-in:

1. Take snapshot → find email input
2. Fill email (e.g., `owner@test.local`)
3. Click submit
4. Navigate to (or curl) Mailpit (`http://127.0.0.1:54324`)
5. Find and click magic link
6. Navigate to magic link URL

### React Form Workaround

If `fill` doesn't trigger React state:

```javascript
mcp__chrome-devtools__evaluate_script with function:
(el) => {
  el.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, 'owner@test.local');
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return 'Done';
}
// Pass element via args: [{ uid: "<input-uid>" }]
```

## Multi-Agent Browser Sharing

When multiple agents may be working in the same browser simultaneously, each agent should use its own dedicated tab to avoid conflicts.

### Setup Your Own Tab

1. **List existing pages** to see what's open:
   ```
   mcp__chrome-devtools__list_pages
   ```

2. **Create a new tab** for your work:
   ```
   mcp__chrome-devtools__new_page with url="<your-target-url>"
   ```

3. **Select your tab** by index before any operation:
   ```
   mcp__chrome-devtools__select_page with pageIdx=<your-tab-index>
   ```

### Best Practices

- Always create a **new tab** at the start of your session instead of reusing existing ones
- **Remember your tab index** and re-select it if you suspect another agent may have changed the active page
- Before taking snapshots or interacting, verify you're on the correct page with `list_pages`
- When done, you can close your tab with `mcp__chrome-devtools__close_page` (optional, but keeps things tidy)

## Tips

| Tip | Why |
|-----|-----|
| Prefer `take_snapshot` over `take_screenshot` | More token-efficient |
| Reload after code changes | Hot reload may not catch all changes |
| Check console for errors | `mcp__chrome-devtools__list_console_messages` |
| Multiple iterations are normal | UI work is inherently iterative |
| Use your own tab in multi-agent setups | Prevents conflicts with other agents |
