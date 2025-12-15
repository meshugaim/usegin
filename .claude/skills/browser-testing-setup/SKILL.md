---
name: browser-testing-setup
description: This skill sets up prerequisites for browser testing with Playwright MCP. Triggered by phrases like "set up for testing", "testing prerequisites", "prepare for e2e tests", or when other testing skills need environment setup.
---

# Browser Testing Setup

Shared toolbox for browser testing with Playwright MCP. Use this skill to set up the environment before running tests or doing closed-loop web development.

## Justfile Commands

Entry point for most actions. Run `just --list` to see all available commands.

| Command | Description |
|---------|-------------|
| `just dev` | Start Next.js + Python API |
| `just supabase-start` | Start local Supabase |
| `just supabase-reset` | Reset DB with seed data |
| `just supabase-status` | Check Supabase status |

## Environment Configuration

Use `bun set-env` to configure environment variables for different contexts.

```bash
bun set-env --help           # See all options
bun set-env --supabase local --urls localhost   # Local development
bun set-env --supabase local --urls gitpod      # Gitpod with local Supabase
bun set-env --supabase prod --urls gitpod       # Gitpod with production Supabase
```

## Local URLs

| Service | URL |
|---------|-----|
| Next.js App | `http://localhost:3000` |
| Python API | `http://localhost:8000` |
| Supabase API | `http://127.0.0.1:54321` |
| Supabase Studio | `http://127.0.0.1:54323` |
| Mailpit | `http://127.0.0.1:54324` |

## Gitpod URLs

In Gitpod, use public URLs. Get them with:

```bash
gitpod env ports list
```

**Important:** Playwright MCP must navigate to Gitpod public URLs (e.g., `https://3000--...gitpod.dev`), not localhost.

## Test Users (Local)

| Email | Role | User ID |
|-------|------|---------|
| `owner@test.local` | Owner | `11111111-1111-1111-1111-111111111111` |
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

This adds `owner@test.local` as an admin. Verify with:
```bash
docker exec -i supabase_db_ona-test-mvp psql -U postgres -c \
  "SELECT a.*, u.email FROM admins a JOIN auth.users u ON a.user_id = u.id;"
```

## Playwright MCP

The Playwright MCP runs via Docker and provides browser automation tools. Use `mcp__playwright__*` tools for navigation, snapshots, clicking, typing, etc.

### Persistent Sessions

Browser sessions persist across Claude Code restarts. Once you sign in, the session is saved to `.ignored/playwright-storage/` and reused automatically. No need to go through the magic link flow every time.

To clear the session (e.g., to test as a different user), delete the profile:
```bash
rm -rf .ignored/playwright-storage/profile
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| MCP tools unavailable | Restart Claude Code to reconnect MCP servers |
| Mailpit not showing emails | Check `just supabase-status`, ensure using `@test.local` emails |
| Redirected to sign-in after db reset | Clear profile: `rm -rf .ignored/playwright-storage/profile` |
| Admin/GFS returns 500 error | Ensure `SUPABASE_SERVICE_ROLE_KEY` is set (run `bun set-env`) |

## Production Testing

For production testing with real Supabase and real emails, see `docs/PRODUCTION_TESTING.md` (if exists) or configure with:

```bash
bun set-env --supabase prod --urls gitpod
```

Production uses real email delivery - magic links go to actual inboxes, not Mailpit.
