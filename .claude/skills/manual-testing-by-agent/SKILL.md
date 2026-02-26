---
name: manual-testing-by-agent
description: Complete guide for manual testing and UI development using playwright-cli. Triggered by phrases like "test this manually", "verify the feature", "check the UI", "manual testing", "test with browser", or "iterate on the UI".
---

# Manual Testing by Agent

Browser testing and iterative UI development using `playwright-cli`.

## Quick Start

```bash
# 1. Environment (creates .env files)
bun set-env --supabase local --urls codespaces  # or --urls localhost / --urls gitpod

# 2. Start services (agent-dev uses ports 63000/58000, won't conflict with human's `just dev`)
just supabase-start
just agent-dev

# 3. Generate auth state
bun scripts/pw-auth.ts                          # owner@test.local → local-auth.json
bun scripts/pw-auth.ts internal@test.local       # other users

# 4. Open browser and authenticate
bunx playwright-cli open
bunx playwright-cli state-load local-auth.json
bunx playwright-cli goto http://localhost:63000
```

---

## Core Commands

| Command | Purpose |
|---------|---------|
| `bunx playwright-cli open` | Launch browser (headless) |
| `bunx playwright-cli goto <url>` | Navigate |
| `bunx playwright-cli snapshot` | Accessibility tree (preferred over screenshot) |
| `bunx playwright-cli screenshot` | Visual screenshot |
| `bunx playwright-cli screenshot <ref>` | Screenshot specific element |
| `bunx playwright-cli click <ref>` | Click element |
| `bunx playwright-cli fill <ref> "text"` | Type into input |
| `bunx playwright-cli eval "js"` | Run JavaScript |
| `bunx playwright-cli state-save <file>` | Save cookies/storage |
| `bunx playwright-cli state-load <file>` | Restore cookies/storage |
| `bunx playwright-cli close` | Close browser |

`<ref>` values come from snapshots (e.g., `e42`).

## The Testing Loop

```
snapshot → interact (click/fill) → snapshot → verify → repeat
```

For UI development (edit → verify):
```
snapshot → edit code → goto same URL (reload) → snapshot → verify → repeat
```

---

## Authentication

### Option 1: Pre-generated Auth (Fastest)

```bash
bun scripts/pw-auth.ts owner@test.local          # → local-auth.json
bunx playwright-cli state-load local-auth.json
```

The script generates a fresh Supabase session via admin API. Tokens expire in 1 hour — re-run to refresh.

### Option 2: Magic Link via Mailpit

For testing the actual sign-in flow, or when `pw-auth.ts` isn't available:

1. Navigate to `/sign-in`, fill email, click submit
2. Get the magic link:
   ```bash
   curl -s "http://127.0.0.1:54324/api/v1/messages" | \
     jq -r '.messages[0].ID' | \
     xargs -I {} curl -s "http://127.0.0.1:54324/api/v1/message/{}" | \
     grep -oP 'http://127.0.0.1:54321/auth/v1/verify\?[^"\\]+' | \
     head -1 | sed 's/\\u0026/\&/g'
   ```
3. Navigate to the URL with `goto`

Magic links expire in ~60 seconds. The Mailpit API method is fastest.

---

## Test Data

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

The `/admin/gfs` page requires users in the `admins` table. Seed data does NOT add admins.

```bash
docker exec -i supabase_db_ona-test-mvp psql -U postgres -c \
  "INSERT INTO admins (user_id) VALUES ('11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING;"
```

---

## Local URLs

| Service | Agent URL (`just agent-dev`) | Human URL (`just dev`) |
|---------|-----|-----|
| Next.js App | `http://localhost:63000` | `http://localhost:3000` |
| Python API | `http://localhost:58000` | `http://localhost:8000` |
| Supabase API | `http://127.0.0.1:54321` | (same) |
| Supabase Studio | `http://127.0.0.1:54323` | (same) |
| Mailpit (emails) | `http://127.0.0.1:54324` | (same) |

**Agents should always use `just agent-dev`** (ports 63000/58000) to avoid conflicting with the human's dev server. Use `just agent-dev-status` to check if it's running, `just agent-dev-kill` to stop.

In Codespaces/Gitpod, use `localhost` URLs — `playwright-cli` runs locally, not in Docker.

---

## Database Operations

```bash
# Run SQL
docker exec -i supabase_db_ona-test-mvp psql -U postgres -c "SELECT * FROM feature_toggles;"

# Reset database (destructive — re-run pw-auth.ts after)
just supabase-reset
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Redirected to sign-in | Auth expired — re-run `bun scripts/pw-auth.ts` and `state-load` |
| `playwright-cli open` fails | Run `npx playwright install chrome` to install browser |
| Magic link expired | Use Mailpit API (see Option 2 above) |
| Page loads empty | Check console errors: look at `.playwright-cli/console-*.log` |
| Screenshot command fails | Use `screenshot --filename /path/to/file.png` (not positional) |

---

## Tips

- Prefer `snapshot` over `screenshot` — more token-efficient, shows accessibility tree
- Use `state-save` to checkpoint browser state mid-session
- Session data in `.playwright-cli/` is gitignored
- Auth state files (`*-auth.json`) are gitignored
- `bunx playwright-cli --help` for full command list
