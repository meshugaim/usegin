---
name: writing-e2e-tests
description: Write Playwright e2e tests using driver pattern. Triggered by "write e2e test", "add e2e test for", "e2e test for X", or "test this page".
---

# Writing E2E Tests

Write maintainable Playwright e2e tests using the driver pattern.

**Reference implementation:** Project Settings page demonstrates all patterns:
- Driver: `tests/e2e/drivers/project-settings.driver.ts`
- E2E tests: `tests/e2e/tests/project-settings.spec.ts`
- Unit tests: `nextjs-app/tests/unit/components/project-file-manager.test.tsx`
- Component: `nextjs-app/components/project-file-manager.tsx` (data-testid usage)

## Workflow

### 1. Explore with Playwright MCP First

Before writing test scripts, manually test the flow using Playwright MCP.

**See:** `browser-testing-setup` skill for environment setup, `closed-loop-web-development` skill for the MCP workflow.

This helps you:
- Understand the actual DOM structure
- Find the right selectors
- Discover edge cases
- Validate the test scenario before coding

### 2. Write Driver and Tests

Use the driver pattern from the start:

1. Create driver file with selectors and actions
2. Write tests using driver methods
3. Add `data-testid` to components as needed

### 3. Iterate with e2e CLI

Keep services running for fast iteration:

```bash
e2e up                           # Start services once
e2e run -- my-test.spec.ts       # Run tests (fast, services already up)
e2e down                         # Clean up when done
```

## When to Use E2E vs Unit Tests

| Use E2E for | Use Unit for |
|-------------|--------------|
| Browser APIs (`confirm()`, `window.open()`) | Component logic |
| Multi-page navigation | State management |
| Auth redirects | Error handling |
| Full user journeys | Input validation |
| Real API integration | Mocked API responses |

**Rule of thumb:** If you can test it by mocking, use unit tests. E2E is for browser-only behavior.

## File Structure

```
tests/e2e/
├── tests/
│   └── <page>.spec.ts       # Test specs
├── drivers/
│   └── <page>.driver.ts     # Page driver (selectors + actions)
└── fixtures/
    └── index.ts             # Auth, logging fixtures
```

## Driver Pattern

### 1. Create Driver

```typescript
// drivers/example.driver.ts
import { expect, type Page } from "@playwright/test";

const DEFAULT_TIMEOUT = 10000;

export function createExampleDriver(page: Page) {
  const selectors = {
    // Group by section
    submitButton: () => page.getByTestId("submit-btn"),
    emailInput: () => page.getByTestId("email-input"),
    successMessage: () => page.getByTestId("success-message"),
  };

  return {
    // Navigation
    goto: async () => {
      await page.goto("/example");
      await expect(selectors.submitButton()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    },

    // Actions
    fillEmail: async (email: string) => {
      await selectors.emailInput().fill(email);
    },

    submit: async () => {
      await selectors.submitButton().click();
    },

    // Assertions
    expectSuccess: async () => {
      await expect(selectors.successMessage()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    },

    // Dialog handling
    confirmAndDelete: async () => {
      page.once("dialog", (dialog) => dialog.accept());
      await selectors.deleteButton().click();
    },

    // Popup handling
    openInNewTab: async () => {
      const [popup] = await Promise.all([
        page.waitForEvent("popup"),
        selectors.externalLink().click(),
      ]);
      return popup;
    },

    // Raw access
    page,
    selectors,
  };
}
```

### 2. Write Tests

```typescript
// tests/example.spec.ts
import { test, expect, TEST_IDS } from "../fixtures";
import { createExampleDriver } from "../drivers/example.driver";

test.describe("Example Page", () => {
  test("user can submit form", async ({ authAsOwner: page }) => {
    const driver = createExampleDriver(page);

    await driver.goto();
    await driver.fillEmail("test@example.com");
    await driver.submit();
    await driver.expectSuccess();
  });
});
```

## Adding data-testid

Add to components for stable selectors:

```tsx
// In component
<Button data-testid="submit-btn">Submit</Button>
<input data-testid="email-input" />
<div data-testid="success-message">{message}</div>

// Dynamic IDs for lists
<Button data-testid={`delete-file-${file.id}`}>Delete</Button>
```

## Common Patterns

### Auth Fixtures

```typescript
test("owner can access", async ({ authAsOwner: page }) => { ... });
test("internal user sees limited view", async ({ authAsInternal: page }) => { ... });
test("redirects unauthenticated", async ({ page }) => { ... });
```

### Dialog Handling

```typescript
// Accept confirm dialog
page.once("dialog", (dialog) => dialog.accept());
await driver.clickDelete();

// Dismiss (cancel)
page.once("dialog", (dialog) => dialog.dismiss());
await driver.clickDelete();
```

### File Upload

```typescript
await page.getByTestId("file-input").setInputFiles({
  name: "test.txt",
  mimeType: "text/plain",
  buffer: Buffer.from("content"),
});
```

### Wait for Navigation

```typescript
await expect(page).toHaveURL(/\/success/);
```

## Avoiding Flakiness

E2E tests can be flaky due to timing issues. Here are common causes and solutions:

### 1. Database State Verification

When verifying async operations (API calls, background jobs), use polling instead of fixed waits:

```typescript
// BAD: Fixed wait - arbitrary and slow
await page.waitForTimeout(2000);
const row = await db.query("SELECT * FROM items WHERE ...");

// GOOD: Poll until condition is met or timeout
async function pollUntil<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  timeout: number = 15000
): Promise<T> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const result = await fn();
    if (condition(result)) return result;
    await new Promise(r => setTimeout(r, 500));
  }
  return fn(); // Return last result for error message
}

const row = await pollUntil(
  () => db.query("SELECT * FROM items WHERE ..."),
  (result) => result !== null,
  15000
);
```

### 2. Test Data Isolation

Tests can pollute each other's state. Clean up BEFORE and AFTER:

```typescript
// In driver
cleanupBefore: async (projectId: string) => {
  await deleteTestData(projectId);

  // Poll to VERIFY deletion completed (don't trust timing)
  const maxWait = 5000;
  const pollInterval = 200;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const remaining = await queryTestData(projectId);
    if (remaining.length === 0) {
      await new Promise(r => setTimeout(r, 100)); // Small buffer
      return;
    }
    await new Promise(r => setTimeout(r, pollInterval));
  }
  console.warn("Cleanup verification timed out");
},

cleanup: async () => {
  await deleteTestData(projectId);
  await new Promise(r => setTimeout(r, 200));
},

// In test
try {
  await driver.cleanupBefore(projectId); // Ensure clean slate
  // ... test logic ...
} finally {
  await driver.cleanup(); // Clean up after
}
```

### 3. UI State Waits

Wait for specific UI elements, not arbitrary timeouts:

```typescript
// BAD: Arbitrary wait
await page.waitForTimeout(1000);

// GOOD: Wait for specific element that indicates completion
await expect(page.getByTestId("success-message")).toBeVisible();
await expect(page.getByTestId("loading-spinner")).not.toBeVisible();
```

### 4. CI-Specific Timeouts

CI environments are slower. Use longer timeouts:

```typescript
// Local might work with 10s, CI needs 15-20s
const DEFAULT_TIMEOUT = 15000;
```

### 5. Multi-Turn Conversation Tests

React state updates may not be committed immediately. Add delays between messages:

```typescript
// BAD: Second message may send before React commits session_id
await chat.sendMessage("First message");
await chat.expectAssistantResponse();
await chat.sendMessage("Second message"); // session_id may still be null!

// GOOD: Wait for React to commit the session_id state update
await chat.sendMessage("First message");
await chat.expectAssistantResponse();
await new Promise(r => setTimeout(r, 500)); // Let React commit state
await chat.sendMessage("Second message"); // session_id is set
```

### 6. Multi-User Tests

When testing with multiple users, avoid concurrent API requests:

```typescript
// BAD: Second user starts while first user's persistence is still running
await ownerChat.sendMessage("Hello");
await ownerChat.expectAssistantResponse();
await internalChat.sendMessage("Hi"); // May cause API contention

// GOOD: Add delay between users to let async operations complete
await ownerChat.sendMessage("Hello");
await ownerChat.expectAssistantResponse();
await new Promise(r => setTimeout(r, 1000)); // Let persistence complete
await internalChat.sendMessage("Hi");
```

### 7. Reference Implementation

See `tests/e2e/drivers/conversation.driver.ts` for a complete example of:
- Polling with `pollUntil()`
- `cleanupBefore()` and `cleanup()` methods
- Timeout handling for async database operations
- Multi-user test patterns with proper delays

## Checklist

### Before Writing

- [ ] Explore the flow manually with Playwright MCP
- [ ] Add `data-testid` to interactive elements in component
- [ ] Start services with `e2e up`

### While Writing

- [ ] Create driver file in `tests/e2e/drivers/`
- [ ] Use fixtures for auth (`authAsOwner`, `authAsInternal`, etc.)
- [ ] Handle dialogs with `page.once("dialog", ...)`
- [ ] Clean up test data BEFORE and AFTER tests (see Avoiding Flakiness)
- [ ] Use polling for async state verification, not fixed waits
- [ ] Use 15s+ timeouts for database operations in CI
- [ ] Run with `e2e run -- <file>` for fast iteration

### After Writing

- [ ] Run full suite with `e2e run` to verify
- [ ] Clean up with `e2e down`

## Running Tests

Use the `e2e` CLI. Run `e2e --help` or `e2e docs` for documentation.
