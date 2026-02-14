---
name: app-sanity-test
description: Run sanity tests against local, staging, or production using playwright-cli. Triggered by "sanity test", "test staging", "test production", "test the app", "smoke test", or "app sanity".
---

# App Sanity Test

Interactive sanity testing against any environment using `playwright-cli`.

Start by running `playwright-cli --help` to familiarize yourself with available commands.

## Environments

| Env | App URL | Git Branch | Auth File |
|-----|---------|------------|-----------|
| Local | `http://localhost:3000` | `main` | `local-auth.json` |
| Staging | `https://staging.askeffi.ai` | `staging` | `staging-auth.json` |
| Production | `https://app.askeffi.ai` | `production` | `production-auth.json` |

---

## Flow

### 1. Fetch & Ask Environment

```bash
git fetch origin
```

Use `AskUserQuestion` to ask which environment to test: **local**, **staging**, or **production**.

### 2. Explore Recent Changes

How to check changes depends on the environment:

**Staging** — Use `AskUserQuestion` to ask what to diff. Options:
- **Staging vs Production** (recommended) — this is what will be promoted next, most relevant for sanity testing
- **Recent commits by time** — 1 day, 3 days, 1 week, custom

```bash
# Staging vs Production (what's about to be promoted)
git log origin/production..origin/staging --oneline -- nextjs-app/ python-services/

# Or by time
git log origin/staging --oneline --since="<timeframe>" -- nextjs-app/ python-services/
```

**Production** — Diff production vs what's live (recent production commits):
```bash
git log origin/production --oneline --since="<timeframe>" -- nextjs-app/ python-services/
```

**Local** — Diff main vs staging (what hasn't been promoted yet), or recent commits:
```bash
# What's on main but not yet on staging
git log origin/staging..origin/main --oneline -- nextjs-app/ python-services/

# Or by time
git log origin/main --oneline --since="<timeframe>" -- nextjs-app/ python-services/
```

Present the changes to the user — these inform what to focus testing on beyond the basic sanity checks.

### 3. Environment Setup

#### Local

Local requires services to be running. Walk through each step, confirming with the user via `AskUserQuestion` before proceeding:

1. **set-env**: Run `bun set-env` idempotently. Ask the user to confirm the env config is correct (supabase local, urls matching their setup — codespaces/gitpod/localhost).
2. **Supabase**: Ask if Supabase is running or needs to be started/restarted (`just supabase-start`).
3. **App**: Ask if the dev servers are running or need to be started (`just dev`).

#### Staging / Production

No setup needed — the app is already deployed. Skip to auth.

### 4. Authentication

#### Try Existing Session First

Always attempt to reuse an existing auth file:

```bash
playwright-cli open
playwright-cli state-load <env>-auth.json
playwright-cli goto <app-url>
playwright-cli snapshot
```

Check the snapshot — if the page loaded normally (not redirected to `/sign-in`), auth is valid. Proceed to testing.

#### If Auth Expired or Missing

**Local** (fully automated, no human needed):

```bash
bun scripts/pw-auth.ts                    # owner@test.local → local-auth.json
playwright-cli state-load local-auth.json
```

For other local test users: `bun scripts/pw-auth.ts internal@test.local`, etc.

If `pw-auth.ts` fails, fall back to magic link via Inbucket:

1. Navigate to `/sign-in`, fill email, click submit
2. Extract magic link from Inbucket:
   ```bash
   curl -s "http://127.0.0.1:54324/api/v1/messages" | \
     jq -r '.messages[0].ID' | \
     xargs -I {} curl -s "http://127.0.0.1:54324/api/v1/message/{}" | \
     grep -oP 'http://127.0.0.1:54321/auth/v1/verify\?[^"\\]+' | \
     head -1 | sed 's/\\u0026/\&/g'
   ```
3. Navigate to the extracted URL

**Staging / Production** (one-time human in the loop):

1. Use `AskUserQuestion` to ask for the user email to sign in with
2. Navigate to `/sign-in`, fill email, click "Send magic link"
3. Ask the user to check their email and paste the magic link URL
4. Navigate to the magic link URL to complete sign-in
5. Save state for reuse:
   ```bash
   playwright-cli state-save <env>-auth.json
   ```

### 5. Basic Sanity Checks (Must-Pass)

These run first, sequentially. Every sanity test must pass before moving to deeper exploration.

The testing loop for every check:
```
snapshot → interact → snapshot → verify → repeat
```

**Basic checks:**

1. **Workspace loads** — after auth, verify the workspace page renders with project list
2. **Project opens** — click into a project, verify it loads with chat input and summary panel
3. **Chat with Effi** — send a message (e.g., "Summarize this project"), verify Effi responds (wait for streaming to complete, input re-enables)
4. **Navigation works** — breadcrumbs, sidebar links, back to workspace

Report each check as pass/fail to the user.

### 6. Deeper Exploration

After basic sanity passes, explore further — informed by the recent changes from step 2.

Use **sequential sub-agents** (one at a time) for focused testing areas. Each sub-agent should:
- Receive the auth file path and environment URL
- `playwright-cli open` → `state-load` → test their area → report findings
- Use `snapshot` before every interaction

Example areas (pick based on recent changes):
- Project settings and config
- File upload and management
- People/roles management
- Chat export and history
- Workspace settings
- Auth edge cases (session expiry, sign out/in)
- Email integration (if feature-flagged on)
- Admin pages (if applicable)
- Empty states (new project, no files)

Agents have freedom to explore beyond their assigned area if something looks off.

### 7. Report

Summarize all findings to the user:

- **Pass/Fail** for each basic sanity check
- **Observations** from deeper exploration
- **Bugs found** — create Linear issues automatically for obvious bugs (`plan create`)
- **Concerns** — report to user, let them decide

---

## playwright-cli Reference

Run `playwright-cli --help` for the full command list.

Key commands:

| Command | Purpose |
|---------|---------|
| `open [url]` | Launch browser |
| `close` | Close browser |
| `goto <url>` | Navigate |
| `snapshot` | Accessibility tree (preferred — use before every interaction) |
| `screenshot [ref]` | Visual screenshot (of page or specific element) |
| `click <ref>` | Click element |
| `fill <ref> "text"` | Type into input |
| `eval "js"` | Run JavaScript |
| `state-load <file>` | Restore auth state |
| `state-save <file>` | Save auth state |
| `console` | List console messages (check for errors) |
| `network` | List network requests |

`<ref>` values come from snapshots (e.g., `e42`).

---

## Tips

- Prefer `snapshot` over `screenshot` — more token-efficient, shows element refs for interaction
- Always `snapshot` before interacting — refs change between page states
- After Effi responds, wait a few seconds (`sleep 3-5`) before snapshotting — streaming takes time
- Save auth state after successful sign-in to avoid re-auth next time
- Check `console` output if something looks wrong — browser errors are often revealing
- Auth state files (`*-auth.json`) are gitignored
- Session artifacts in `.playwright-cli/` are gitignored
