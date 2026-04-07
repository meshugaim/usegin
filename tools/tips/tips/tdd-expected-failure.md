---
title: Keep CI green mid-implementation with expected failures
handle: tdd-expected-failure
tags: [testing, tdd, ci]
context: When writing tests before implementation
---

Mark tests as expected failures so CI stays green while you implement:

- Bun/Vitest: `test.failing("should do X", () => { ... })`
- Pytest: `@pytest.mark.xfail(reason="not yet implemented")`

The test passes when it fails (as expected) and fails when it passes
(signaling the implementation is done — remove the marker).
