---
description: Sync Claude sessions from another Gitpod environment
---

First, list available environments:

!`claude-sync envs --running`

Ask the user which environment to sync from. Then run:

```bash
claude-sync pull <env> --all --dry-run
```

Show the dry-run output and ask if they want to proceed. If yes:

```bash
claude-sync pull <env> --all
```

Confirm sync completed.
