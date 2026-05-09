#!/bin/bash
# PreToolUse Bash wrapper: route through `rtk hook claude` if rtk is installed,
# silently no-op otherwise.
#
# `rtk` (Rust CLI proxy) rewrites common Bash commands into token-optimized
# forms before they reach the agent (e.g. `git diff` → `rtk git diff`, dropping
# `index`/`diff --git`/`---`/`+++` noise; `ls` → token-optimized listing).
#
# Why the wrapper: when this hook was wired directly as `rtk hook claude` in
# 2026-04, the rtk binary wasn't reliably on the agent PATH in fresh
# devcontainers. Claude Code hooks fail-open on exit 127, so the breakage was
# silent — the hook ran and did nothing, and nobody noticed for weeks
# (.claude/tikur-records/2026-04-28-app-driver-silent-exit-1-and-rtk-hook-missing.md).
# This wrapper makes the missing-binary case explicit: skip cleanly, exit 0.

if command -v rtk >/dev/null 2>&1; then
  exec rtk hook claude
fi
exit 0
