---
name: manually-executing-e2e-tests
description: This skill should be used when manually executing E2E tests using Chrome DevTools MCP. Triggered by phrases like "run e2e tests", "execute feature file", "test the sign-in flow", or "run tests/e2e/*.feature". Reads Gherkin feature files and executes them step-by-step using Chrome DevTools MCP.
---

# Manually Executing E2E Tests

## Overview

Execute Gherkin feature files manually using Chrome DevTools MCP. This skill provides step-by-step instructions for running E2E tests against the local development environment.

## When to Use

Use this skill when:
- Running E2E tests defined in `tests/e2e/*.feature` files
- Testing authentication flows
- Testing role-based access control
- Verifying UI behavior across different user roles
- User asks to "run e2e tests" or "execute feature file"

## Prerequisites

Before running tests, ensure all components are running:

### 1. Local Supabase

```bash
just supabase-status
# Should show "supabase local development setup is running"

# If not running:
just supabase-start
```

### 2. Seed Data

Ensure test users exist:

```bash
# Reset database with seed data if needed
just supabase-reset
```

**Local Test Users:**
| Email                 | Role     | User ID                                |
|-----------------------|----------|----------------------------------------|
| `owner@test.local`    | Owner    | `11111111-1111-1111-1111-111111111111` |
| `internal@test.local` | Internal | `22222222-2222-2222-2222-222222222222` |
| `external@test.local` | External | `33333333-3333-3333-3333-333333333333` |

### 3. Development Servers

```bash
# Start Next.js + Python API
just dev
```

### 4. Chrome DevTools MCP

**CRITICAL: Chrome must be running BEFORE Claude Code starts for MCP tools to be available.**

```bash
# Always restart chrome:
just chrome-restart

# Verify Chrome is responding:
curl -s http://127.0.0.1:9222/json/version
```

**If MCP tools are not available** (e.g., `mcp__chrome-devtools__list_pages` fails):
1. Verify Chrome is running with `just chrome-status`
2. If Chrome is running but tools aren't available, **ask the user to restart Claude Code**
3. The MCP connection is established at Claude startup and cannot be refreshed mid-session

## Gitpod Environment

In Gitpod, use public URLs instead of localhost:

```bash
gitpod env ports list
```

Example URLs:
- App: `https://3000--<workspace-id>.gitpod.dev`
- Mailpit: `https://54324--<workspace-id>.gitpod.dev` (or `http://127.0.0.1:54324` from within the workspace)

**Important:** When using Chrome DevTools MCP in Gitpod, navigate to the Gitpod public URLs for the app (port 3000), but Mailpit can be accessed via localhost.

## Executing Tests

### Reading Feature Files

1. Read the feature file to understand the scenarios:
```bash
cat tests/e2e/auth.feature
```

2. Execute each scenario step-by-step using Chrome DevTools MCP tools.

### Common MCP Operations

#### Navigation
```
mcp__chrome-devtools__navigate_page with url and type="url"
```

#### Taking Snapshots (preferred over screenshots)
```
mcp__chrome-devtools__take_snapshot
```
Returns the accessibility tree - more token-efficient than screenshots.

#### Filling Form Fields

**Method 1: Using fill (preferred when it works)**
```
mcp__chrome-devtools__fill with uid and value
```

**Method 2: Using evaluate_script (fallback for React forms)**
If `fill` times out or doesn't trigger React state updates:
```javascript
mcp__chrome-devtools__evaluate_script with function:
() => {
  const input = document.querySelector('input');
  input.focus();
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeInputValueSetter.call(input, 'email@test.local');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'Done';
}
```

#### Clicking Elements
```
mcp__chrome-devtools__click with uid
```

#### Waiting for Text
```
mcp__chrome-devtools__wait_for with text and timeout
```

### Authentication Flow Steps

1. **Navigate to sign-in page**
   ```
   mcp__chrome-devtools__navigate_page to /sign-in
   ```

2. **Take snapshot** to get element UIDs
   ```
   mcp__chrome-devtools__take_snapshot
   ```

3. **Fill email field** using the textbox UID from snapshot
   ```
   mcp__chrome-devtools__fill with uid and value="owner@test.local"
   ```

4. **Click submit button**
   ```
   mcp__chrome-devtools__click with button UID
   ```

5. **Wait for confirmation**
   ```
   mcp__chrome-devtools__wait_for with text="Check your email"
   ```

6. **Navigate to Mailpit** at `http://127.0.0.1:54324`

7. **Take snapshot** to find the email

8. **Click on the email** to open it

9. **Take snapshot** to find the magic link URL

10. **Navigate to the magic link URL** to complete authentication

11. **Verify redirect** to dashboard/projects page

### Verifying Test Results

After each scenario, verify:
- Current URL matches expected destination
- Expected elements are visible (use `take_snapshot`)
- User email is displayed correctly
- Role-specific elements are present/absent

## Troubleshooting

### Chrome Not Responding
```bash
just chrome-restart
```

### MCP Tools Not Available
Ask user to restart Claude Code after ensuring Chrome is running.

### Form Submission Errors
If you see "One of email or phone must be set", the React form state wasn't updated. Use the `evaluate_script` method with native input value setter.

### Mailpit Not Showing Emails
1. Check Supabase is running: `just supabase-status`
2. Ensure using `@test.local` emails that exist in seed data

### Browser Shows Old State
Clear Chrome profile:
```bash
just chrome-stop
rm -rf /tmp/chrome-profile-stable
just chrome-start
```
Then restart Claude Code.

## Reporting Results

After executing tests, report:
- **Pass/Fail** for each scenario
- **What was verified** (elements found, text matched, URLs correct)
- **Any errors or unexpected behavior**
- **Screenshots only if needed** for debugging failures
