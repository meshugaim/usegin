---
title: Query local traces from terminal
handle: spotlight-traces
tags: [debugging, sentry, performance]
context: When investigating slow requests or errors locally
---

`spotlight-dev traces --slow` shows slow spans without opening a browser.
Add `--transaction /api/v1/chat` to filter by route.

See also: `spotlight-dev errors`, `spotlight-dev logs`
