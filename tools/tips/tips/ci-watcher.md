---
title: Auto-investigate CI failures with ci-watcher
handle: ci-watcher
tags: [ci, automation, troubleshooting]
context: After pushing to main
---

`ci-watcher` monitors your push and auto-investigates if CI fails.
It fetches logs, identifies the failing step, and suggests a fix —
all without you switching context.

Enable via `dx enable ci-watcher` (disabled by default for some users).
