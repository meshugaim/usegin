# Test Isolation Investigation Handoff

**Date:** 2026-01-06
**Commit:** 4d36b55

## Problem

Running `bun test` in nextjs-app showed **148 test failures**, but individual test files passed when run in isolation. This indicated test pollution when running tests in parallel.

## Root Causes Identified

### 1. Fetch Mock Pollution
**Problem:** Tests that mock `globalThis.fetch` were saving `originalFetch` at module load time. When tests run in parallel, another test might have already mocked fetch before the module loaded, causing the "original" to actually be a mock.

**Solution:** Save original fetch in `tests/setup.ts` (preload file) as `globalThis.__originalFetch` before any tests run. Test files reference this instead of saving at module load time.

**Files Fixed:**
- `tests/setup.ts` - Added `__originalFetch` save
- `tests/unit/components/chat-interface.driver.tsx`
- `tests/unit/components/chat-interface-export.test.tsx`
- `tests/unit/components/chat-interface-proxy.test.tsx`
- `tests/unit/api/workspaces-invite.test.ts`
- `tests/unit/api/chat-stream-proxy.test.ts`

### 2. Missing Sentry Mock Functions
**Problem:** Several test files mocked `@sentry/nextjs` but didn't include `getActiveSpan()`, which is called by `lib/api-client.ts`. When these mocks bled into other tests, they caused "Sentry.getActiveSpan is not a function" errors.

**Solution:** Added `getActiveSpan: () => null` to all Sentry mocks.

**Files Fixed:**
- `tests/unit/components/chat-interface-sentry.test.tsx`
- `tests/unit/components/chat-interface-toast.test.tsx`
- `tests/unit/components/error-boundary.test.tsx`
- `tests/unit/components/session-expired.test.tsx`

### 3. Missing Navigation Mock Functions
**Problem:** Some tests mocked `next/navigation` without `useSearchParams`, but components like `project-file-manager.tsx` use it. This caused "Export named 'useSearchParams' not found" errors.

**Solution:** Added `useSearchParams: () => ({ get: () => null })` to all navigation mocks.

**Files Fixed:**
- `tests/unit/components/chat-page-content-keyboard.test.tsx`
- `tests/unit/components/chat-page-content-export-loop.test.tsx`
- `tests/unit/components/session-expired.test.tsx`

### 4. DOM Cleanup Issues
**Problem:** Tests using the chat driver called `chat.cleanup()` at the end, but if a test failed or timed out, cleanup wasn't called. Also, some test files didn't have cleanup in `afterEach`.

**Solution:** Added explicit `cleanup()` from `@testing-library/react` in `afterEach` hooks.

**Files Fixed:**
- `tests/unit/components/chat-interface-degradation.test.tsx`
- `tests/unit/components/chat-interface-streaming.test.tsx`
- `tests/unit/components/chat-interface-sentry.test.tsx`

### 5. Unnecessary Mock Pollution
**Problem:** `chat-page-content-keyboard.test.tsx` mocked `ExportDropdown` with a different `data-testid`, which polluted `chat-export-dropdown.test.tsx` that tested the real component.

**Solution:** Removed the unnecessary mock since the keyboard tests don't actually need it.

## Results

- **Before:** 148 failures, 251 pass
- **After:** 49 failures, 391 pass
- **Fixed:** ~99 tests

## Remaining Issues (49 failures)

The remaining failures still appear to be test isolation issues. They pass when run in small groups but fail in the full suite. This is a known limitation of bun's test runner with module mocking.

### Patterns Observed
- First test in each failing group times out (~1000ms)
- Subsequent tests fail fast with "Found multiple elements" errors
- Tests that mock the same modules (Sentry, Supabase, navigation) conflict

### Potential Future Fixes
1. Run problematic test files with separate preload files
2. Use `bunfig.toml` to configure test isolation
3. Consider Jest or Vitest which have better mock isolation
4. Add mock.restore() calls (bun doesn't fully support this yet)

## Key Files to Know

| File | Purpose |
|------|---------|
| `tests/setup.ts` | Test preload, sets up happy-dom and saves original fetch |
| `tests/unit/components/chat-interface.driver.tsx` | Shared test driver, handles fetch mocking and cleanup |
| `tests/unit/components/chat-interface.mocks.ts` | Shared mocks for Sentry, notifications, Supabase |

## Commands

```bash
# Run all tests
cd nextjs-app && bun test

# Run specific test file in isolation (usually passes)
bun test tests/unit/components/chat-interface-streaming.test.tsx

# Run multiple specific files together to test isolation
bun test tests/unit/components/chat-interface-*.test.tsx
```
