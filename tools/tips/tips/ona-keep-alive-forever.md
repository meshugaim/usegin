---
title: Keep the Ona environment from auto-stopping (unconditional)
handle: ona-keep-alive-forever
tags: [ona, gitpod, environment]
context: When you need the env to stay up past idle timeout, no matter what
---

`ona-keep-alive-forever` runs `gitpod environment keep-alive -- sleep infinity`,
sending activity signals every 5m so the environment doesn't auto-stop
while you're away.

Run it in a spare pane and Ctrl-C when you're done. Pass `-q` for quiet,
or `--interval 1m` to tune the heartbeat.

For an activity-gated version that stops heartbeating once Claude goes
quiet (so the env can idle out), see `ona-keep-alive-while-claude-working`.
