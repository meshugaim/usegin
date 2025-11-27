---
name: closed-loop-web-development
description: This skill enables autonomous web development with visual feedback. Triggered by phrases like "fix the UI", "adjust the styling", "add a new feature", or "iterate on this". Uses Chrome DevTools MCP to verify changes in a closed feedback loop.
---

# Closed Loop Web Development

Iterate on UI fixes and features by making code changes and visually verifying them using Chrome DevTools MCP.

**Prerequisites:** Run the `browser-testing-setup` skill first to ensure environment is ready.

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
4. Navigate to Mailpit (`http://127.0.0.1:54324`)
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

## Tips

| Tip | Why |
|-----|-----|
| Prefer `take_snapshot` over `take_screenshot` | More token-efficient |
| Reload after code changes | Hot reload may not catch all changes |
| Check console for errors | `mcp__chrome-devtools__list_console_messages` |
| Multiple iterations are normal | UI work is inherently iterative |
