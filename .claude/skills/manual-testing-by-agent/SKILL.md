---
name: manual-testing-by-agent
description: Complete guide for manual testing and UI development using Playwright MCP. Triggered by phrases like "test this manually", "verify the feature", "check the UI", "manual testing", "test with browser", or "iterate on the UI".
---

# Manual Testing by Agent

Everything you need for manual browser testing and iterative UI development using Playwright MCP.

## Quick Start Checklist

Run these commands in order before testing:

```bash
# 1. Configure environment (creates .env files)
bun set-env --supabase local --urls localhost
# For Gitpod: bun set-env --supabase local --urls gitpod
# For Codespaces: bun set-env --supabase local --urls codespaces

# 2. Start Supabase (handles API_EXTERNAL_URL automatically)
just supabase-start

# 3. Start web app and API
just dev

# 4. Verify everything is running
just supabase-status
curl -s http://localhost:3000 > /dev/null && echo "Next.js OK"
```

Then use Playwright MCP tools (`mcp__playwright__*`) to navigate and interact with the app.

---

## When to Use

- Manual verification of UI features or bug fixes
- Iterative UI development with visual feedback (edit code → reload → verify)
- Testing authentication flows and magic links
- Verifying file uploads and admin features
- Adjusting layouts, colors, spacing with immediate feedback
- Any browser-based testing that requires visual confirmation

---

## Part 1: Environment Setup

### Justfile Commands

| Command | Description |
|---------|-------------|
| `just dev` | Start Next.js + Python API |
| `just supabase-start` | Start local Supabase (sets API_EXTERNAL_URL) |
| `just supabase-reset` | Reset DB with seed data |
| `just supabase-status` | Check Supabase status |
| `just supabase-restart` | Stop and start Supabase |

### Environment Configuration

```bash
bun set-env --help                              # See all options
bun set-env --supabase local --urls localhost   # Local development
bun set-env --supabase local --urls gitpod      # Gitpod with local Supabase
bun set-env --supabase local --urls codespaces  # GitHub Codespaces
bun set-env --supabase prod --urls gitpod       # Gitpod with production Supabase
```

### Local URLs

| Service | URL |
|---------|-----|
| Next.js App | `http://localhost:3000` |
| Python API | `http://localhost:8000` |
| Supabase API | `http://127.0.0.1:54321` |
| Supabase Studio | `http://127.0.0.1:54323` |
| Mailpit (emails) | `http://127.0.0.1:54324` |

### Gitpod URLs

In Gitpod, use public URLs. Get them with:

```bash
gitpod env ports list
```

**Important:** Playwright MCP must navigate to Gitpod public URLs (e.g., `https://3000--...gitpod.dev`), not localhost.

### GitHub Codespaces URLs

Get port URLs:
```bash
gh codespace ports -c $CODESPACE_NAME
```

**Required setup:**
```bash
# Make ports public (required for browser CORS)
gh codespace ports visibility 3000:public 54321:public -c $CODESPACE_NAME

# Restart Supabase and dev servers
supabase stop && supabase start
just dev
```

**Important:** Playwright MCP must navigate to Codespaces public URLs (e.g., `https://<name>-3000.app.github.dev`), not localhost.

---

## Part 2: Test Data

### Test Users (Local)

| Email | Role | User ID |
|-------|------|---------|
| `owner@test.local` | Owner | `11111111-1111-1111-1111-111111111111` |
| `owner2@test.local` | Owner 2 | `44444444-4444-4444-4444-444444444444` |
| `internal@test.local` | Internal | `22222222-2222-2222-2222-222222222222` |
| `external@test.local` | External | `33333333-3333-3333-3333-333333333333` |

### Test Organization & Project

| Entity | Name | ID |
|--------|------|-----|
| Organization | Test Organization | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` |
| Project | Demo Project | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` |

### Admin Access

The `/admin/gfs` page requires users to be in the `admins` table. Seed data does NOT add admins automatically.

**To grant admin access:**
```bash
docker exec -i supabase_db_ona-test-mvp psql -U postgres -c \
  "INSERT INTO admins (user_id) VALUES ('11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING;"
```

**Verify:**
```bash
docker exec -i supabase_db_ona-test-mvp psql -U postgres -c \
  "SELECT a.*, u.email FROM admins a JOIN auth.users u ON a.user_id = u.id;"
```

---

## Part 3: Playwright MCP Usage

### Core Tools

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Go to a URL |
| `browser_snapshot` | Get page accessibility tree (preferred over screenshot) |
| `browser_take_screenshot` | Visual screenshot when needed |
| `browser_click` | Click an element |
| `browser_type` | Type into an input |
| `browser_console_messages` | Check for JS errors |
| `browser_wait_for` | Wait for text/element |

### The Testing Loop

```
┌─────────────────────────────────────────┐
│  1. Navigate to target page             │
│              ↓                          │
│  2. Take snapshot (understand current)  │
│              ↓                          │
│  3. Interact (click, type, etc.)        │
│              ↓                          │
│  4. Take snapshot (verify result)       │
│              ↓                          │
│  5. Repeat or done                      │
└─────────────────────────────────────────┘
```

### For UI Development (Edit → Verify Loop)

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

### Persistent Sessions

Browser sessions persist across Claude Code restarts. Once you sign in, the session is saved to `.ignored/playwright-storage/` and reused automatically.

**To clear session (test as different user):**
```bash
rm -rf .ignored/playwright-storage/profile
```

---

## Part 4: Authentication

### If Already Signed In

Sessions persist - just navigate to the target page.

### If Redirected to Sign-In

**Option 1: Use Mailpit API (Fastest - ~10 seconds)**

1. Type email and submit on sign-in page
2. Get magic link via API:
   ```bash
   curl -s "http://127.0.0.1:54324/api/v1/messages" | \
     jq -r '.messages[0].ID' | \
     xargs -I {} curl -s "http://127.0.0.1:54324/api/v1/message/{}" | \
     grep -oP 'http://127.0.0.1:54321/auth/v1/verify\?[^"\\]+' | \
     head -1 | sed 's/\\u0026/\&/g'
   ```
3. Navigate directly to the URL with `browser_navigate`

**Option 2: Navigate Mailpit UI**

1. Send magic link via app
2. Navigate to `http://127.0.0.1:54324` immediately
3. Click the email to open it
4. **Copy the magic link URL** (don't click it in the iframe)
5. Navigate directly to the copied URL

### Why Copy URL Instead of Clicking?

Clicking links inside Mailpit's iframe is unreliable:
- Opens new window/tab that Playwright doesn't track
- CORS issues
- Simply doesn't respond to clicks

**Always copy the URL and navigate directly with `browser_navigate`.**

### Magic Link Timing

Magic links expire in ~60 seconds. Work quickly between sending and using the link. The Mailpit API method is fastest.

---

## Part 5: File Uploads

The Playwright MCP runs in Docker with a volume mount:

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

---

## Part 6: Database Operations

### Using Supabase Studio

Navigate to `http://127.0.0.1:54323` to:
- View/edit table data
- Run SQL queries
- Check feature toggles
- Inspect user data

### Direct SQL via psql

```bash
# Run a query
docker exec -i supabase_db_ona-test-mvp psql -U postgres -c "SELECT * FROM feature_toggles;"

# Interactive psql session
docker exec -it supabase_db_ona-test-mvp psql -U postgres
```

### Reset Database

```bash
just supabase-reset
```

**Important:** After reset, clear browser profile (old sessions become invalid):
```bash
rm -rf .ignored/playwright-storage/profile
```

---

## Part 7: Troubleshooting

| Issue | Solution |
|-------|----------|
| MCP tools unavailable | Restart Claude Code to reconnect MCP servers |
| Mailpit not showing emails | Check `just supabase-status`, ensure using `@test.local` emails |
| Redirected to sign-in after db reset | Clear profile: `rm -rf .ignored/playwright-storage/profile` |
| Admin/GFS returns 500 error | Ensure `SUPABASE_SERVICE_ROLE_KEY` is set (run `bun set-env`) |
| Magic link expired | Use Mailpit API for faster retrieval (see Part 4) |
| Page shows "loading" forever | Check `browser_console_messages` for JS errors |
| Hot reload not working | Manually reload with `browser_navigate` to same URL |

### Supabase Startup Issues

If `supabase start` fails with:
```
Failed to load configuration: parse "env(API_EXTERNAL_URL)": invalid URI for request
```

Fix:
```bash
# Option 1: Use justfile (recommended)
just supabase-start

# Option 2: Set env var manually
export API_EXTERNAL_URL="http://127.0.0.1:54321"
supabase start
```

---

## Part 8: Tips & Best Practices

| Tip | Why |
|-----|-----|
| Prefer `browser_snapshot` over `browser_take_screenshot` | More token-efficient, shows accessibility tree |
| Use Mailpit API for magic links | Faster and more reliable than UI navigation |
| Check console for errors | `browser_console_messages` reveals JS issues |
| Reload after code changes | Hot reload may not catch all changes |
| Clear profile after db reset | Old session cookies become invalid |
| Use public URLs in Gitpod/Codespaces | Playwright MCP runs in Docker with `--network=host`, needs public URLs |
| Multiple iterations are normal | UI work is inherently iterative |
| Run quick start checklist first | Ensures environment is ready before testing |

---

## Part 9: Admin/GFS Verification

To verify files are synced to Google File Search:

1. **Add user to admins table** (see Part 2)

2. **Navigate to** `/admin/gfs`

3. **Check store status**:
   - **Synced**: Store has matching docs in GFS and DB
   - **Orphan**: Store exists in GFS but not linked to a project
   - **Missing**: Store referenced in DB but not found in GFS

4. **Click a store** to see individual file sync status

5. **Verify in chat**: Ask Effi about file content to confirm RAG is working

---

## Part 10: Production Testing

For production testing with real Supabase:

```bash
bun set-env --supabase prod --urls gitpod
```

**Differences from local:**
- Magic links go to real email inboxes (not Mailpit)
- Real user accounts required
- Database changes affect production data
