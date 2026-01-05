# Working with Sentry

Use this skill when the user asks about Sentry error monitoring, debugging production errors, or investigating Sentry issues.

## MCP vs CLI

### Sentry MCP Limitations

The Sentry MCP (`mcp__sentry__*` tools) has limitations:
- Requires `OPENAI_API_KEY` environment variable for semantic search features
- `search_issues` and `search_events` will fail without this key
- Other tools work fine: `whoami`, `find_organizations`, `find_projects`, `get_issue_details`, etc.

### Sentry CLI (Recommended)

For better experience, use the **Sentry CLI** instead:

```bash
# Install globally with bun
bun add -g @sentry/cli

# CLI is at: ~/.bun/bin/sentry-cli
```

**Authentication**: Uses `SENTRY_AUTH_TOKEN` environment variable (already configured in Railway).

**Common Commands**:

```bash
# List issues for a project
~/.bun/bin/sentry-cli issues list --org askeffi --project nextjs-app
~/.bun/bin/sentry-cli issues list --org askeffi --project python-fastapi

# Get issue details
~/.bun/bin/sentry-cli issues show ISSUE-ID --org askeffi

# List releases
~/.bun/bin/sentry-cli releases list --org askeffi
```

## GitHub + Railway Integration

### What's Configured

Our Sentry setup integrates with:
1. **GitHub** - Commit linking, suspect commits, stack trace links
2. **Railway** - Release tracking via commit SHA, deployment context

### How It Works

**Release Tracking**:
- Every Railway deployment automatically sets `release` to the git commit SHA
- Railway provides: `RAILWAY_GIT_COMMIT_SHA`, `RAILWAY_DEPLOYMENT_ID`, `RAILWAY_GIT_BRANCH`
- Sentry uses this to correlate errors with specific commits

**Suspect Commits**:
- When error occurs, Sentry analyzes stack trace
- Checks git blame for files/lines in the stack trace
- Identifies commits made <1 year ago as "suspects"
- Shows in Sentry UI with author and commit message

**Resolving Issues via Commit**:
- Include `Fixes SENTRY-XXX` or `Closes SENTRY-XXX` in commit message or PR body
- When merged to main, Sentry auto-resolves the issue
- Works because release tracking connects commits to errors

### SDK Configuration

**Python** (`python-services/agent_api/main.py`):
```python
import os
import sentry_sdk

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    environment=os.getenv("RAILWAY_ENVIRONMENT", "development"),
    release=os.getenv("RAILWAY_GIT_COMMIT_SHA"),  # Release tracking
    traces_sample_rate=0.1,
    profiles_sample_rate=0.1,
    send_default_pii=True,
)

# Add Railway deployment context
sentry_sdk.set_tags({
    "railway_deployment_id": os.getenv("RAILWAY_DEPLOYMENT_ID"),
    "railway_branch": os.getenv("RAILWAY_GIT_BRANCH"),
})
```

**Next.js** (3 files: `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`):
```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || "production",
  release: process.env.RAILWAY_GIT_COMMIT_SHA,  // Release tracking

  initialScope: {
    tags: {
      railway_deployment_id: process.env.RAILWAY_DEPLOYMENT_ID,
      railway_branch: process.env.RAILWAY_GIT_BRANCH,
    },
  },

  tracesSampleRate: 0.1,
  // ... other config
});
```

**Client-side env vars** (`nextjs-app/next.config.ts`):
```typescript
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_RAILWAY_GIT_COMMIT_SHA: process.env.RAILWAY_GIT_COMMIT_SHA,
    NEXT_PUBLIC_RAILWAY_DEPLOYMENT_ID: process.env.RAILWAY_DEPLOYMENT_ID,
    NEXT_PUBLIC_RAILWAY_GIT_BRANCH: process.env.RAILWAY_GIT_BRANCH,
  },
};
```

## Common Workflows

### 1. Investigating a Production Error

```bash
# List recent issues
~/.bun/bin/sentry-cli issues list --org askeffi --project nextjs-app

# Get details for specific issue
~/.bun/bin/sentry-cli issues show NEXTJS-APP-1 --org askeffi
```

In Sentry UI:
- Check "Suspect Commits" section for likely culprit
- Click stack trace links to view exact source code
- Filter by deployment ID to isolate specific deploy
- Check release to see which commit introduced the error

### 2. Correlating Error with Deployment

```bash
# Find errors from specific deployment
# Filter by railway_deployment_id tag in Sentry UI
```

### 3. Resolving Issues

**Via Commit Message**:
```bash
git commit -m "Fix authentication bug

Fixes NEXTJS-APP-1"
```

**Via PR Description**:
```markdown
## Summary
Fixes timeout in API calls

Fixes PYTHON-FASTAPI-T
Closes PYTHON-FASTAPI-X
```

When merged to main, Sentry auto-resolves these issues.

### 4. Tracking Releases

```bash
# List all releases
~/.bun/bin/sentry-cli releases list --org askeffi

# Check which issues were introduced in a release
# (View in Sentry UI under Releases → [commit-sha])
```

## Environment Variables (Railway Auto-Provides)

These are automatically available in all Railway deployments:

| Variable | Description | Example |
|----------|-------------|---------|
| `RAILWAY_GIT_COMMIT_SHA` | Git commit hash | `40ffa74...` |
| `RAILWAY_GIT_BRANCH` | Git branch name | `main`, `staging` |
| `RAILWAY_ENVIRONMENT` | Environment name | `production`, `staging` |
| `RAILWAY_DEPLOYMENT_ID` | Unique deployment ID | `abc123...` |
| `SENTRY_AUTH_TOKEN` | Sentry API token | `sntryu_...` |

**No configuration needed** - these are injected by Railway during deployment.

## Best Practices

1. **GitHub Integration First**: Install GitHub integration before using release tracking
2. **Set Release Before Deploy**: SDK configured to set release from `RAILWAY_GIT_COMMIT_SHA`
3. **Use CLI for Debugging**: MCP requires OpenAI key, CLI is more reliable
4. **Tag Errors**: Use `railway_deployment_id` and `railway_branch` tags to filter errors
5. **Commit Message Convention**: Use `Fixes SENTRY-XXX` to auto-resolve issues
6. **Stack Trace Root**: Ensure code mappings have Stack Trace Root configured for best suspect commit detection

## Troubleshooting

**Release not showing in Sentry UI**:
- Verify `RAILWAY_GIT_COMMIT_SHA` is set in Railway deployment
- Check SDK init has `release` parameter configured
- For Next.js client-side: verify `next.config.ts` exposes env vars

**Suspect commits not appearing**:
- GitHub integration must be installed
- Code mappings must be configured (auto-configured for Python/JS)
- Commits must be <1 year old

**Can't resolve via commit message**:
- Ensure format is `Fixes SENTRY-XXX` or `Closes SENTRY-XXX`
- Must be in commit message or PR description
- PR must be merged to tracked branch (main/staging/production)

## References

- [Sentry Releases Documentation](https://docs.sentry.io/product/releases/)
- [Suspect Commits](https://docs.sentry.io/product/issues/suspect-commits/)
- [GitHub Integration](https://docs.sentry.io/organization/integrations/source-code-mgmt/github/)
- [Railway Variables](https://docs.railway.com/reference/variables)
- [Sentry CLI Documentation](https://docs.sentry.io/cli/)
