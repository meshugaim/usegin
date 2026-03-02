---
name: running-gherkin-tests
description: This skill executes Gherkin feature files using playwright-cli. Triggered by phrases like "run e2e tests", "execute feature file", "test the sign-in flow", or "run tests/e2e/*.feature".
---

# Running Gherkin Tests

Execute Gherkin feature files step-by-step using `playwright-cli`.

**Prerequisites:** Environment running (`just supabase-start && just agent-dev`) and auth state generated (`bun scripts/pw-auth.ts`).

## Feature Files

Feature files live in `tests/e2e/*.feature` and `tests/exploratory/topics/`. Read them first.

## Execution Workflow

1. **Read the feature file** — understand Given/When/Then steps
2. **Open browser and authenticate:**
   ```bash
   bunx playwright-cli open
   bunx playwright-cli state-load local-auth.json
   ```
3. **Execute each step** using `playwright-cli` commands
4. **Verify assertions** after each Then step via `snapshot`
5. **Report results** per scenario

## Common Operations

| Gherkin step | playwright-cli command |
|---|---|
| Navigate to URL | `bunx playwright-cli goto http://localhost:63000/path` |
| See page state | `bunx playwright-cli snapshot` |
| Type into input | `bunx playwright-cli fill <ref> "text"` |
| Click element | `bunx playwright-cli click <ref>` |
| Verify text exists | `bunx playwright-cli snapshot` then check output |
| Take screenshot | `bunx playwright-cli screenshot --filename /tmp/step.png` |

## Example Execution

For `auth.feature` scenario "Sign in with OTP as owner":

```gherkin
Given I am on the sign-in page
→ bunx playwright-cli goto http://localhost:63000/sign-in

When I enter "owner@test.local" in the email field
→ bunx playwright-cli snapshot  # find the textbox ref
→ bunx playwright-cli fill <ref> "owner@test.local"

And I click the "Send code" button
→ bunx playwright-cli click <ref>

Then I should see "Check your email..."
→ bunx playwright-cli snapshot  # verify text in output

When I enter the OTP code from Mailpit
→ curl Mailpit API to get OTP code (see manual-testing-by-agent skill)
→ bunx playwright-cli fill <ref> "<otp-code>"
→ bunx playwright-cli click <verify-button-ref>

Then I should be redirected to the dashboard
→ bunx playwright-cli snapshot  # verify URL and content
```

## Reporting Results

| Item | Description |
|------|-------------|
| Pass/Fail | Per scenario |
| What was verified | Elements found, text matched, URLs correct |
| Errors | Any unexpected behavior |
| Screenshots | Only if needed for debugging failures |
