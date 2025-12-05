---
description: Toggle autosync (automatic git push after commits)
---

Check current status:

!`bun run autosync status`

Ask the user if they want to enable or disable autosync.

- Enable: `bun run autosync enable`
- Disable: `bun run autosync disable`

When enabled, commits on `main` will automatically fetch, rebase, and push.
