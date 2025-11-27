---
name: running-gherkin-tests
description: This skill executes Gherkin feature files using Chrome DevTools MCP. Triggered by phrases like "run e2e tests", "execute feature file", "test the sign-in flow", or "run tests/e2e/*.feature".
---

# Running Gherkin Tests

Execute Gherkin feature files step-by-step using Chrome DevTools MCP.

**Prerequisites:** Run the `browser-testing-setup` skill first to ensure environment is ready.

## Feature Files

Feature files live in `tests/e2e/*.feature`. Read them first:

```bash
cat tests/e2e/auth.feature
```

## Execution Workflow

1. **Read the feature file** - understand Given/When/Then steps
2. **Execute each step** using Chrome DevTools MCP
3. **Verify assertions** after each Then step
4. **Report results** per scenario

## Common MCP Operations

| Operation | Tool | Notes |
|-----------|------|-------|
| Navigate | `mcp__chrome-devtools__navigate_page` | Use `type="url"` |
| Snapshot | `mcp__chrome-devtools__take_snapshot` | Preferred over screenshot (token efficient) |
| Fill input | `mcp__chrome-devtools__fill` | Use uid from snapshot |
| Click | `mcp__chrome-devtools__click` | Use uid from snapshot |
| Wait for text | `mcp__chrome-devtools__wait_for` | Set appropriate timeout |

## Authentication Flow

For magic link sign-in:

1. Navigate to `/sign-in`
2. Take snapshot → find email input uid
3. Fill email (e.g., `owner@test.local`)
4. Click submit button
5. Wait for "Check your email" confirmation
6. Navigate to Mailpit (`http://127.0.0.1:54324`)
7. Take snapshot → click email → take snapshot → find magic link
8. Navigate to magic link URL
9. Verify redirect to dashboard

### React Form Workaround

If `fill` times out or doesn't trigger React state, use `evaluate_script`:

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
// Pass the input element via args: [{ uid: "<input-uid>" }]
```

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
→ navigate_page to /sign-in

When I enter "owner@test.local" in the email field
→ take_snapshot, fill with uid

And I click the "Send magic link" button
→ click with button uid

Then I should see "Check your email..."
→ wait_for text or take_snapshot and verify

When I open the magic link from Mailpit
→ navigate to Mailpit, click email, extract link, navigate to it

Then I should be redirected to the dashboard
→ verify URL contains /projects or /dashboard
```
