# Railway CLI

Interact with Railway deployments - view logs, check status, debug failed builds.

**Trigger:** "railway logs", "check railway", "deployment failed", "railway status"

## Prerequisites

### 1. Use `bun` not `bunx`

Railway CLI is installed as a dev dependency. Always use:

```bash
bun railway <command>
```

### 2. Check Auth Status

Before running commands, verify login:

```bash
bun railway status
```

If you see "Unauthorized" or login errors, **STOP and ask the user** to login:

> "Railway CLI requires authentication. Please run `bun railway login` in a terminal and complete the browser authentication, then let me know when done."

Use the `interactive-cli` skill if needed - login requires browser interaction.

### 3. Link to Project

```bash
bun railway status  # Check if linked
bun railway link    # Link if needed (also interactive)
```

## Common Commands

| Command | Purpose |
|---------|---------|
| `bun railway status` | Show linked project/service/environment |
| `bun railway deployment list` | List recent deployments with IDs and status |
| `bun railway logs` | Stream logs from latest successful deployment |
| `bun railway logs --build` | Stream build logs |
| `bun railway logs --lines 100` | Fetch last 100 lines (no streaming) |

## Viewing Logs

### Important: Default Behavior

```
Defaults to most recent successful deployment,
or latest deployment if none succeeded
```

**This means failed build logs won't show by default if there's a successful deployment!**

### To See Failed Build Logs

1. List deployments to find the failed one:
   ```bash
   bun railway deployment list --limit 5
   ```

2. Get logs for specific deployment:
   ```bash
   bun railway logs --build <DEPLOYMENT_ID>
   ```

### Log Types

| Flag | Shows |
|------|-------|
| (none) | Runtime logs |
| `--build` | Build logs (compilation, Docker build) |
| `--deployment` | Deployment/startup logs |

### Filtering

```bash
bun railway logs --lines 50 --filter "@level:error"
bun railway logs --lines 50 --filter "TypeError"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Unauthorized" | Run `bun railway login` |
| "No linked project" | Run `bun railway link` |
| Can't see failed build | Use `deployment list` + specific ID |
| Command hangs | Use `--lines N` instead of streaming |
