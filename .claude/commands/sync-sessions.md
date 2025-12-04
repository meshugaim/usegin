---
description: Sync Claude sessions from another Gitpod environment
---

First, list available environments:

!`bun run gitpod-claude-sync envs --running`

Ask the user which environment to sync from. Then run:

```bash
bun run gitpod-claude-sync pull <env> --all --dry-run
```

Show the dry-run output and ask if they want to proceed. If yes:

```bash
bun run gitpod-claude-sync pull <env> --all
```

Confirm sync completed.
