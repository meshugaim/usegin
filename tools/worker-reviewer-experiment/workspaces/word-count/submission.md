---
phase: impl
iteration: 1
targetTest:
  index: 4
  name: "help flag shows usage information"
testResults:
  - index: 0
    name: missing argument exits with error
    status: pass
  - index: 1
    name: nonexistent file exits with error
    status: pass
  - index: 2
    name: empty file outputs zero words
    status: pass
  - index: 3
    name: file with content outputs correct word count
    status: pass
  - index: 4
    name: help flag shows usage information
    status: pass
filesChanged:
  - path: src/word-count.test.ts
    action: modified
  - path: src/word-count.ts
    action: modified
---

## Summary

Added test for `--help` flag and implemented the handler. The `--help` check is placed before the missing argument check so that `word-count --help` outputs usage information and exits 0 rather than treating `--help` as a missing file argument.
