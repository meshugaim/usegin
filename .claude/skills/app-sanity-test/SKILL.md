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
| Local | `http://localhost:63000` | `main` | `local-auth.json` |
| Staging | `https://staging.askeffi.ai` | `staging` | `staging-auth.json` |
| Production | `https://app.askeffi.ai` | `production` | `production-auth.json` |

**Local uses port 63000** (not 3000) to avoid conflicting with the developer's own `just dev` instance. Agents use `just agent-dev` for isolated processes.

## Known Users

Persisted across sessions — when the user tells you to use a specific account on an environment, add it here so future runs don't have to ask. Default to offering the matching env's user first (with "Other" as fallback) when prompting for sign-in.

| Env | Email | Role | Notes |
|-----|-------|------|-------|
| Staging | `nitsan+staging.owner@askeffi.ai` | owner | Nitsan's owner account on staging |
| Production | `nitsan@askeffi.ai` | owner | Nitsan's owner account on production |

For local, see `bun scripts/pw-auth.ts` (uses `owner@test.local` by default).

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
3. **App**: Start the agent dev instance with `just agent-dev`. This runs Next.js on port 63000 and Python API on port 58000 — isolated from the developer's `just dev` on ports 3000/8000. Check status with `just agent-dev-status`. When done, clean up with `just agent-dev-kill`.

#### Staging / Production

No setup needed — the app is already deployed. Skip to auth.

### 4. Browser Preflight

Before any browser interaction, ensure playwright-cli is ready:

```bash
playwright-cli install
```

This is idempotent — it creates the `.playwright/` workspace sentinel and verifies Chrome is available. If Chrome is missing, it installs Chromium as a fallback. Without this step, `open` may fail with "Chromium distribution 'chrome' is not found."

### 5. Authentication

#### Try Existing Session First

Always clean up stale daemons before opening the browser. Before loading auth state, **check whether the tokens are usable** to avoid a stale-token retry storm that triggers Supabase rate limiting. `auth-check` reports one of three states — `valid`, `refreshable`, or `expired` — and the flow branches accordingly:

```bash
playwright-cli kill-all 2>/dev/null || true
playwright-cli open

state=$(auth-check <env>-auth.json)
case "$state" in
  valid*)
    # Access token still good — load state and go.
    playwright-cli state-load <env>-auth.json
    playwright-cli goto <app-url>
    playwright-cli snapshot
    ;;
  refreshable*)
    # Access token expired but refresh token still present — let Supabase
    # auto-refresh on first navigation, then save the refreshed state.
    playwright-cli state-load <env>-auth.json
    playwright-cli goto <app-url>
    sleep 3   # give the Supabase client time to refresh
    playwright-cli snapshot   # if not on /sign-in, we're in
    playwright-cli state-save <env>-auth.json
    ;;
  *)
    # Truly expired or invalid — fresh sign-in (see below).
    playwright-cli goto <app-url>/sign-in
    ;;
esac
```

**Never load `expired` (vs `refreshable`) state** — that's the case `auth-check` flags as unusable, and loading it triggers a token refresh retry storm that rate-limits the Supabase auth endpoint. The `refreshable` path is the supported way to skip OTP re-entry between hourly access-token rotations.

#### If Auth Expired or Missing

**Local** (fully automated, no human needed):

```bash
bun scripts/pw-auth.ts                    # owner@test.local → local-auth.json
playwright-cli state-load local-auth.json
```

For other local test users: `bun scripts/pw-auth.ts internal@test.local`, etc.

If `pw-auth.ts` fails, fall back to OTP sign-in via Inbucket:

1. Navigate to `/sign-in`, fill email, click "Send code"
2. Wait 2 seconds, then extract the 6-digit OTP code from Inbucket:
   ```bash
   MSG_ID=$(curl -s "http://127.0.0.1:54324/api/v1/messages" | jq -r '.messages[0].ID') && \
     curl -s "http://127.0.0.1:54324/api/v1/message/$MSG_ID" | jq -r '.Text' | grep -oP '^\d{6}$'
   ```
3. Fill the code into the "Verification code" input, click "Verify"
4. OTP codes expire quickly — extract and enter within a few seconds

**Staging / Production** (one-time human in the loop):

1. Use `AskUserQuestion` to ask which email to sign in with. Offer the matching env's entry from the **Known Users** table at the top of this skill as the default option — "Other" lets them type a different one. If the user supplies a new email, update the Known Users table so the next run already has it.
2. Navigate to `/sign-in`, fill email, click "Send code"
3. Ask the user to paste the 6-digit code from their email (plain text — don't use `AskUserQuestion` for this, just ask and wait for their response)
4. Fill the code into the "Verification code" input, click "Verify"
5. Save state for reuse:
   ```bash
   playwright-cli state-save <env>-auth.json
   ```

### 6. Testing via Sub-Agents

**The main thread orchestrates. Sub-agents do the browser work.**

**IMPORTANT: Run sub-agents sequentially — one at a time, never in parallel.** `playwright-cli` controls a single browser instance. Parallel agents will conflict. Wait for each agent to complete before spawning the next.

After auth is established, delegate all testing to Opus sub-agents. Each sub-agent receives:
- The environment URL (e.g., `https://staging.askeffi.ai`)
- The auth file path (e.g., `staging-auth.json`)
- A focused testing mission
- Instructions to use `playwright-cli` (start with `playwright-cli --help`)
- The testing loop: `snapshot → interact → snapshot → verify → repeat`
- Instruction to `snapshot` before every interaction
- Reference to the `manual-testing-by-agent` skill for playwright-cli details — specifically its **"Known harness friction"** section, which lists the working forms (`fill <ref>` over `type`, ref-form selectors over string-form, no `--submit`, streaming-done signals). Tell the sub-agent to start with the working forms; this saves rediscovering them.
- **Tooling-friction instruction** — every sub-agent's reporting block must include a "Tooling friction" line: any `playwright-cli` (or other harness) hiccup they hit and how they worked around it — *especially* anything not already covered by the "Known harness friction" section in `manual-testing-by-agent`. New friction is the load-bearing signal; rediscovered friction means we forgot to read the section. If nothing tripped them, the line says "none." Silent inline workarounds are how skill bugs hide — force them into the report.

**Feature toggles:** Before spawning Phase B agents, check toggle state:

1. Navigate to `<app-url>/toggles` and snapshot to see all browser flags and their current values
2. For each approved test area, identify which toggles are relevant (e.g., "Email Exclusion" for data/email testing, "Data Tab" for file management)
3. Include toggle instructions in each sub-agent prompt: which toggles to enable at `/toggles` before testing, and which to leave at default
4. Features behind toggles that are **off by default** should still be tested if the test area covers them — the sub-agent enables the toggle, tests the feature, then moves on
5. If a toggle-gated feature is clearly under construction (broken UI, placeholder content), note it in findings rather than reporting as a bug

#### Phase A: Basic Sanity (Must-Pass)

Spawn a sub-agent for basic sanity. It must verify all of these:

1. **Workspace loads** — after auth, the workspace page renders with project list
2. **Project opens** — click into a project, verify it loads with chat input and summary panel
3. **Chat with Effi** — send a message (e.g., "Summarize this project"), verify Effi responds (wait for streaming to complete, input re-enables)
4. **Navigation works** — breadcrumbs, sidebar links, back to workspace

If basic sanity fails, report to user and stop — no point in deeper exploration.

#### Phase B: Deeper Exploration

After basic sanity passes, propose a list of deeper testing areas based on recent changes from step 2. Present the plan to the user via `AskUserQuestion` (multi-select) and get approval before proceeding. Let the user add, remove, or reorder areas.

Then spawn sequential sub-agents for approved areas. One area per agent.

Example areas:
- Project settings and config
- File upload and management
- People/roles management
- Chat export and history
- Workspace settings
- Auth edge cases (session expiry, sign out/in)
- Admin pages (if applicable)
- Empty states (new project, no files)

Agents have freedom to explore beyond their assigned area if something looks off.

### 7. Report

After all sub-agents complete, summarize findings to the user:

- **Pass/Fail** for each basic sanity check
- **Observations** from deeper exploration
- **Bugs found** — create Linear issues automatically for obvious bugs (`plan create`)
- **Concerns** — report to user, let them decide
- **Tooling friction** — collect the "Tooling friction" lines from every sub-agent report. Surface them as a short table to the user (one row per hiccup). For every non-"none" item, propose a concrete next step inline — codify the workaround in `manual-testing-by-agent`, file a Linear issue, or check for a newer `@playwright/cli` release. Don't end the run with friction items unaddressed; silent inline workarounds are how the same bugs get rediscovered three sanity tests in a row. `playwright-cli` is upstream `@playwright/cli` (shimmed at `tools/bin/playwright-cli`) — we don't fix it directly, but we do learn the working subset and write it down.

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

- **Always run `playwright-cli` from the repo root** (`/workspaces/test-mvp`). The daemon uses a cwd-based hash to find the browser — if cwd differs between commands, you get "browser not open" errors.
- Prefer `snapshot` over `screenshot` — more token-efficient, shows element refs for interaction
- Always `snapshot` before interacting — refs change between page states
- After Effi responds, wait a few seconds (`sleep 3-5`) before snapshotting — streaming takes time
- **Streaming-done signals (chat):** the Send button stays `[disabled]` *both* during streaming AND when the input is empty post-send. Don't use button-disabled as the "streaming finished" signal — you'll loop forever. Use one of: chat-input ref becomes `[active]` again, or a new top-level assistant `paragraph` ref appears that wasn't there before send.
- **`playwright-cli upload` allowed-roots:** the upload command rejects files outside an allow-list with "outside allowed roots" — `/tmp/...` is NOT allowed. Place upload fixtures under `/workspaces/test-mvp/.playwright-cli/` (or another path inside the repo) instead.
- Save auth state after successful sign-in to avoid re-auth next time
- Check `console` output if something looks wrong — browser errors are often revealing
- Auth state files (`*-auth.json`) are gitignored
- Session artifacts in `.playwright-cli/` are gitignored
