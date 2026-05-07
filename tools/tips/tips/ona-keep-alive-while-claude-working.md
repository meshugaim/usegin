---
title: Keep Ona alive only while Claude is working
handle: ona-keep-alive-while-claude-working
tags: [ona, gitpod, environment, claude]
context: When you walk away with Claude codes running and want the env to idle out after they're quiet
---

Sends Ona keep-alive heartbeats only while a Claude session has been
active recently. Run it in a spare pane and Ctrl-C when you're done.

## How it decides "Claude is working"

Every `CHECK_INTERVAL` seconds, it asks: *did any
`~/.claude/projects/**/*.jsonl` get written within the last
`BUFFER_MIN` minutes?*

Claude appends to its session JSONL on every assistant message and
every tool result, so a quiet file means the agent isn't producing
anything. Subagent JSONLs (under `<session>/subagents/`) and worktree
sessions (under `~/.claude/projects/-tmp-wt-*`) are included — `find`
recurses everything under `~/.claude/projects/`.

## How it heartbeats

- **Active** (recent JSONL write): spawns `gitpod environment keep-alive
  -- sleep infinity` as a child. The `keep-alive` command pings Ona's
  control plane every 5 min for as long as its child lives; the
  `sleep infinity` is just a no-op so it has something to watch.
- **Idle** (no recent write): kills that child. `keep-alive` exits, no
  more pings, env idles out on Ona's normal timeout.

## Defaults and overrides

| Var | Default | Meaning |
|---|---|---|
| `BUFFER_MIN` | `10` | Minutes of JSONL silence before "idle" |
| `CHECK_INTERVAL` | `120` | Seconds between polls |

```
BUFFER_MIN=20 ona-keep-alive-while-claude-working
```

The invariant: keep `CHECK_INTERVAL << BUFFER_MIN * 60` so each write
is visible to several polls before it ages out.

## Caveats

- **Long single tool calls read as idle.** A 20-min `bun test` or a
  `ScheduleWakeup` nap writes nothing to the JSONL until it returns,
  so mid-tool the watcher sees no recent mtime. With the default 10m
  buffer this is rare; raise `BUFFER_MIN` if you regularly run very
  long tools unattended.
- **Test fixtures count as activity.** Some test suites write fake
  JSONLs into `~/.claude/projects/-tmp-tmp*-workspace/`. Worst case
  the env stays alive an extra `BUFFER_MIN` after a test run.

For the unconditional version (always ping while it's running), see
`ona-keep-alive`.
