---
name: closed-loop-web-development
description: This skill enables autonomous web development with visual feedback. Triggered by phrases like "fix the UI", "adjust the styling", "add a new feature", or "iterate on this". Uses Playwright MCP to verify changes in a closed feedback loop.
---

# Closed Loop Web Development

Iterate on UI fixes and features by making code changes and visually verifying them using Playwright MCP.

**Prerequisites:** !IMPORTANT! Run the `browser-testing-setup` skill first to ensure environment is ready, and more info about local/prod supabase and users.

## When to Use

- Fixing UI bugs or styling issues
- Adding new UI features or components
- Adjusting layouts, colors, spacing
- User asks to test changes in the browser
- Need to verify UI changes visually

## The Loop

```
┌─────────────────────────────────────────┐
│  1. Take snapshot (understand current)  │
│              ↓                          │
│  2. Edit code                           │
│              ↓                          │
│  3. Reload page                         │
│              ↓                          │
│  4. Take snapshot (verify change)       │
│              ↓                          │
│  5. Repeat or done                      │
└─────────────────────────────────────────┘
```

## Workflow

Use `mcp__playwright__*` tools for all browser interactions:

1. **Navigate** to target page with `browser_navigate`
2. **Take snapshot** with `browser_snapshot` to understand current state
3. **Edit code** to make changes
4. **Reload** and take another snapshot to verify
5. **Iterate** until UI matches expectations

## Authentication

Sessions persist across Claude Code restarts, so you usually won't need to sign in.

If redirected to sign-in (first time or after clearing profile):

1. Take snapshot → find email input
2. Type email (e.g., `owner@test.local`) with `browser_type`
3. Click submit with `browser_click`
4. Navigate to Mailpit (`http://127.0.0.1:54324`)
5. Find and click magic link
6. Navigate to magic link URL

To switch users, clear the profile: `rm -rf .ignored/playwright-storage/profile`

## Environment Setup Checklist

Before testing, verify the environment is correctly configured:

1. **Run `bun set-env`** (if env was recreated or Supabase reset):
   ```bash
   bun set-env --supabase local --urls gitpod
   ```

2. **Start services**:
   ```bash
   just dev  # Starts Next.js + Python API
   ```

3. **Verify Supabase is running**: `supabase status`

4. **Reset database if needed** (invalidates existing browser sessions!):
   ```bash
   supabase db reset --yes
   ```
   After reset, clear browser profile: `rm -rf .ignored/playwright-storage/profile`

## File Uploads with Playwright

The Playwright MCP runs in Docker with a volume mount. Files must be placed in the shared volume:

| Host Path | Container Path |
|-----------|----------------|
| `.ignored/playwright-storage/` | `/data/` |

**To upload files:**

1. Copy files to the shared volume:
   ```bash
   cp /path/to/test-file.pdf .ignored/playwright-storage/
   ```

2. Click "Choose File" button with `browser_click`

3. Use `browser_file_upload` with the container path:
   ```
   paths: ["/data/test-file.pdf"]
   ```

4. Click the upload/submit button

## Admin/GFS Verification

To verify files are synced to Google File Search:

1. **Add user to admins table** (required for /admin/gfs access):
   ```bash
   docker exec -i supabase_db_ona-test-mvp psql -U postgres -c \
     "INSERT INTO admins (user_id) VALUES ('11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING;"
   ```

2. **Navigate to** `/admin/gfs`

3. **Check store status**:
   - **Synced**: Store has matching docs in GFS and DB
   - **Orphan**: Store exists in GFS but not linked to a project
   - **Missing**: Store referenced in DB but not found in GFS

4. **Click a store** to see individual file sync status

5. **Verify in chat**: Ask Effi about file content to confirm RAG is working

## Tips

| Tip | Why |
|-----|-----|
| Prefer `browser_snapshot` over `browser_take_screenshot` | More token-efficient |
| Reload after code changes | Hot reload may not catch all changes |
| Check console for errors | `browser_console_messages` |
| Multiple iterations are normal | UI work is inherently iterative |
| Clear profile after db reset | Old session cookies become invalid |
| Use Gitpod URLs, not localhost | Playwright MCP uses `--network=host` but runs in Docker |
