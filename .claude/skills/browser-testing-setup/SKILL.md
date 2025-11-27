---
name: browser-testing-setup
description: This skill sets up prerequisites for browser testing with Chrome DevTools MCP. Triggered by phrases like "set up for testing", "testing prerequisites", "prepare for e2e tests", or when other testing skills need environment setup.
---

# Browser Testing Setup

Shared toolbox for browser testing with Chrome DevTools MCP. Use this skill to set up the environment before running tests or doing closed-loop web development.

## Justfile Commands

Entry point for most actions. Run `just --list` to see all available commands.

| Command | Description |
|---------|-------------|
| `just dev` | Start Next.js + Python API |
| `just supabase-start` | Start local Supabase |
| `just supabase-reset` | Reset DB with seed data |
| `just supabase-status` | Check Supabase status |
| `just chrome-start` | Start headless Chrome |
| `just chrome-stop` | Stop Chrome |
| `just chrome-restart` | Restart Chrome |
| `just chrome-status` | Check Chrome status |

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
| Chrome Debug | `http://127.0.0.1:9222` |

## Gitpod URLs

In Gitpod, use public URLs. Get them with:

```bash
gitpod env ports list
```

**Important:** Chrome DevTools MCP must navigate to Gitpod public URLs (e.g., `https://3000--...gitpod.dev`), not localhost.

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

## Chrome DevTools MCP

### Verify MCP is Available

```bash
# Check Chrome is running
just chrome-status
curl -s http://127.0.0.1:9222/json/version
```

Then try `mcp__chrome-devtools__list_pages`.

### If MCP Tools Not Available

1. Chrome must be running BEFORE Claude Code starts
2. If Chrome is running but tools aren't available → **ask user to restart Claude Code**
3. The MCP connection is established at startup and cannot be refreshed mid-session

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Chrome not responding | `just chrome-restart` |
| MCP tools unavailable | Restart Claude Code after Chrome is running |
| Stale browser state | `just chrome-stop && rm -rf /tmp/chrome-profile-stable && just chrome-start` |
| Mailpit not showing emails | Check `just supabase-status`, ensure using `@test.local` emails |

## Production Testing

For production testing with real Supabase and real emails, see `docs/PRODUCTION_TESTING.md` (if exists) or configure with:

```bash
bun set-env --supabase prod --urls gitpod
```

Production uses real email delivery - magic links go to actual inboxes, not Mailpit.
