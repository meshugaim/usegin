---
name: running-gherkin-tests
description: This skill executes Gherkin feature files using Playwright MCP. Triggered by phrases like "run e2e tests", "execute feature file", "test the sign-in flow", or "run tests/e2e/*.feature".
---

# Running Gherkin Tests

Execute Gherkin feature files step-by-step using Playwright MCP.

**Prerequisites:** Run the `browser-testing-setup` skill first to ensure environment is ready.

## Feature Files

Feature files live in `tests/e2e/*.feature`. Read them first:

```bash
cat tests/e2e/auth.feature
```

## Execution Workflow

1. **Read the feature file** - understand Given/When/Then steps
2. **Execute each step** using Playwright MCP (`mcp__playwright__*` tools)
3. **Verify assertions** after each Then step
4. **Report results** per scenario

## Common Operations

Use Playwright MCP tools for browser automation:

- `browser_navigate` - Navigate to URLs
- `browser_snapshot` - Get page state (preferred over screenshot)
- `browser_type` - Type into inputs
- `browser_click` - Click elements
- `browser_wait_for` - Wait for text/conditions

## Authentication Flow

For magic link sign-in:

1. Navigate to `/sign-in`
2. Take snapshot → find email input
3. Type email (e.g., `owner@test.local`)
4. Click submit button
5. Wait for "Check your email" confirmation
6. Navigate to Mailpit (`http://127.0.0.1:54324`)
7. Take snapshot → click email → find magic link
8. Navigate to magic link URL
9. Verify redirect to dashboard

## Reporting Results

After executing tests, report:

| Item | Description |
|------|-------------|
| Pass/Fail | Per scenario |
| What was verified | Elements found, text matched, URLs correct |
| Errors | Any unexpected behavior |
| Screenshots | Only if needed for debugging failures |

## Example Execution

For `auth.feature` scenario "Sign in with magic link as owner":

```gherkin
Given I am on the sign-in page
→ browser_navigate to /sign-in

When I enter "owner@test.local" in the email field
→ browser_snapshot, browser_type with ref

And I click the "Send magic link" button
→ browser_click with button ref

Then I should see "Check your email..."
→ browser_wait_for text or browser_snapshot and verify

When I open the magic link from Mailpit
→ navigate to Mailpit, click email, extract link, navigate to it

Then I should be redirected to the dashboard
→ verify URL contains /projects or /dashboard
```
