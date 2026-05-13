---
date: 2026-05-13
charter_for: Wes (general-purpose worker, dev-side)
caller: Zisser (live-user: oria; "get slack done — see the gaps, try to get it done")
status: in-flight
parent_session_id: ab35e1e1-7ac2-4250-993d-9e6eeb40c4bb
expected_duration: <90m
sector:
  paths_in:
    - zisser/plans/2026-05-12-slack-mvp-ground-down.md
    - zisser/dispatched/2026-05-08-slack-local-smoke-and-private-channel-banner.md
    - nextjs-app/lib/browser-flags/registry.ts
    - nextjs-app/app/workspaces/[id]/settings/slack-integration-card.tsx
    - nextjs-app/app/projects/[id]/config/slack-integration-card.tsx
    - nextjs-app/app/api/slack/callback/route.ts
  paths_out:
    - nextjs-app/.env.local        # local-only, gitignored; ok to create
    - zisser/dispatched/2026-05-13-slack-mvp-boot-fix-wes.md   # this charter (append findings)
  external_systems:
    - local Supabase (already up at 127.0.0.1:54321)
    - askeffiworkspace.slack.com (read-only OAuth bounce; no writes)
  mutable_state:
    git_worktree: /workspaces/test-mvp
    dev_server_ports: [63000, 58000, 8969]
neighbors: []
---

# Charter — Slack MVP: unblock local boot, flip toggles, smoke

## Why

Oria narrowed Slack to a two-click MVP on 2026-05-12 (see
`zisser/plans/2026-05-12-slack-mvp-ground-down.md`). The two clicks
(workspace install + channel bind) are built and merged. Four local-dev
gaps stop `just agent-dev` from completing the round-trip. Three are
Wes-doable. One is a human click in api.slack.com (step 4 below).

## End state

`just agent-dev` boots green; sign-in works; the "Connect Slack" card
appears on `/workspaces/[id]/settings`; channel-picker modal opens from
project config; smoke either completes end-to-end (DB rows for
`slack_installs` and `slack_channel_bindings`) OR parks cleanly at
step 4 waiting on the redirect-URL human-click.

## Steps

### Step 1 — Drop `nextjs-app/.env.local` (uncommitted; `.gitignore`d)

Local Supabase is already running:

- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`
- `SUPABASE_URL=http://127.0.0.1:54321`
- `SUPABASE_ANON_KEY=<same as NEXT_PUBLIC_SUPABASE_ANON_KEY>`

(Anon key + URL came from `bunx supabase status -o env`; if anything
else complains at boot, add it the same way — do NOT touch Doppler.)

Verify boot by `just agent-dev` then `curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:63000/`.
HTTP 200 (or 307 to sign-in) = green. HTTP 500 = read the log
(`just agent-dev-logs`) and add whichever env var the error names.

### Step 2 — Flip `slackIntegration` browser flag ON

The flag lives at `nextjs-app/lib/browser-flags/registry.ts` and is
per-browser via localStorage. Easiest: navigate to
`http://127.0.0.1:63000/toggles` in playwright-cli and click the
`slackIntegration` toggle ON in this session's browser profile. Not a
code change.

### Step 3 — Flip `slack_unified_install_modal` DB toggle ON

```sql
UPDATE feature_toggles SET enabled = true
WHERE name = 'slack_unified_install_modal';
```

Run against local Supabase. Verify by `SELECT name, enabled FROM
feature_toggles WHERE name = 'slack_unified_install_modal';`.

### Step 4 — (HUMAN, blocking) Add local-dev redirect URL

The Slack app `Slack integration for Effi` (`A0B1QH8KLLS`) needs
`https://local-dev.askeffi.ai/api/slack/callback` on its OAuth &
Permissions → Redirect URLs. **Wes cannot do this** — Slack admin API
does not let our tokens edit redirect URLs.

If `_NEEDS-FROM-LIHU.md` does not already name this exact ask (the
current TOP item there points at the OLDER `ingest-poc` app, not
A0B1QH8KLLS), append a new TOP item or replace the stale one — your
call, but the live human must see the right app id.

Then park step 5 until the human comes back saying "added."

### Step 5 — Smoke via playwright-cli

After step 4 lands:

1. Sign in as a test user.
2. `/workspaces/[id]/settings` → Connect Slack → OAuth bounce →
   callback returns to settings.
3. DB check: `SELECT id, workspace_id, team_id, created_at FROM slack_installs ORDER BY created_at DESC LIMIT 3`.
4. Project config → "Connect Slack" card → unified modal opens →
   bind one public test channel.
5. DB check: `SELECT * FROM slack_channel_bindings ORDER BY created_at DESC LIMIT 3`.
6. Capture screenshots of both DB rows + the success-state UI.

Append all findings (green/red/screenshots/SQL output) to this charter
file under a `## Findings — Wes return (2026-05-13)` heading.

## Constraints

- **DO NOT** touch `effi/*` Doppler configs (the Doppler-track agent
  owns that sector — see `feedback_parallel_workers_shared_state`).
- **DO NOT** touch Railway, staging, or production.
- **DO NOT** commit `.env.local`. Verify `.gitignore` already covers it.
- **DO NOT** edit anything under `oria-crazy-world/` from inside the
  monorepo without `cd oria-crazy-world/` first — that's a separate
  repo (see CLAUDE.md). The `_NEEDS-FROM-LIHU.md` update is the one
  expected world-side edit; commit it from inside `oria-crazy-world/`.
- One commit per logical change in the monorepo (toggles=0 commits;
  charter findings + NEEDS update only). If no production code
  changes, do NOT create empty commits in the monorepo.
- Stay laconic.

## Stop condition

- Steps 1–3 green → park at step 4 (human-click); leave `just agent-dev`
  running so the human can verify by clicking through themselves.
- Step 4 lands during the run → run step 5 and append findings.
- Smoke green → return to Zisser with 5-line summary.
- Hit anything that needs Doppler/Railway/staging — STOP, append to
  findings, return to Zisser.

## Findings — Wes return (2026-05-13)

Status: parked at step 1 (Doppler login, human-only) AND step 4 (Slack admin redirect URL, human-only). Steps 2 + 3 are green. `just agent-dev` left running (it carries env from the now-deleted `.env.local` in process memory; will need restart through Doppler once auth lands).

**Path pivot mid-run.** Coordinator reversed the `.env.local` route in favor of the "new organized Doppler" path (alternative #1 from the 2026-05-08 note): patch `justfile`'s `agent-dev-web` to wrap `bun run dev` in `doppler run --project effi --config dev --`. Probed first per coordinator instruction: `doppler secrets get SLACK_CLIENT_ID --project effi --config dev --plain` → **`Doppler Error: you must provide a token`**. Per coordinator's halt rule for that exact error, STOPPED step 1. Did NOT patch the justfile (can't validate the change without Doppler auth, and the patch would block boot for the next reader if pushed un-verified).

Cleanup: deleted `nextjs-app/.env.local` since the new path supplies env via Doppler instead. The running `just agent-dev` still serves 307 because the process loaded env at start time; it will need a kill + restart through Doppler once auth lands. **Did not** commit any justfile change.

**Step 1 (original, now reverted) — `.env.local`.** Wrote `nextjs-app/.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (values from `bunx supabase status -o env`). `curl http://127.0.0.1:63000/` → `307` (green). File deleted on coordinator pivot. The file was gitignored throughout (verified against root `.gitignore`).

**Step 1 (revised) — justfile Doppler-wrap (PARKED on human).** `justfile:148-153` is the target:

```
agent-dev-web:
    cd nextjs-app && PORT=63000 NEXT_PUBLIC_SITE_URL=http://localhost:63000 \
      PYTHON_API_PRIVATE_URL=http://localhost:58000 \
      nohup bun run dev > /tmp/agent-dev-nextjs.log 2>&1 &
```

Intended edit (NOT applied — awaiting Doppler login): prepend `doppler run --project effi --config dev --` before `nohup bun run dev`. The Python API target at `justfile:156-160` was not flagged by the original boot test and stays as-is. Human action: `doppler login` (interactive browser flow) in this devcontainer, then re-run this charter or apply the one-line patch directly.

**Step 2 — `slackIntegration` browser flag (green).** Cookie `effi-slack-integration` = `true` on a persistent playwright-cli profile (session `wes`, profile dir `/tmp/wes-pw-profile`). Verified via `playwright-cli -s=wes cookie-get effi-slack-integration`. The persistent profile carries into step 5.

**Step 3 — `slack_unified_install_modal` DB toggle (green).** Row did not exist; upserted via `INSERT ... ON CONFLICT (name) DO UPDATE SET enabled = true` against local Postgres (`docker exec supabase_db_test-mvp psql -U postgres -d postgres`). `psql` is not on PATH in this container; used `docker exec`. Verified `SELECT name, enabled` → `slack_unified_install_modal | t`.

**Step 4 — human click (parked).** `_NEEDS-FROM-LIHU.md` was pointing at the OLDER `ingest-poc` Slack app from the 2026-04-28 POC (no app id named). Took the **append** path (not replace): added a new `## ⚡ TOP` block naming the correct app — `A0B1QH8KLLS` "Slack integration for Effi", workspace `askeffiworkspace.slack.com`, with direct link `api.slack.com/apps/A0B1QH8KLLS`. Demoted the stale 2026-04-28 block to a `## 🗄️ HISTORY — superseded TOP` section beneath it so the banner reads the right ask first and traceability survives. Committed in the `oria-crazy-world/` repo.

**Step 5 — smoke (parked).** Pending human-click at step 4. The playwright session (`wes`) is preserved so the cookie carries through; resume by setting Slack creds into `.env.local`, restarting Next.js, then `playwright-cli -s=wes open http://127.0.0.1:63000/`.

**Anomalies / notes.**

- The toggle row was absent (default of the migration is `enabled=false` and apparently no seed inserts this name). Upsert was the right call; no schema or policy issues. Toggle table has RLS but `docker exec` runs as superuser and bypasses it.
- Local Supabase was already running but with several services stopped (realtime, imgproxy, edge_runtime, analytics, vector, pooler) per `bunx supabase status`. None of those should affect the Slack OAuth callback flow; flagging in case the smoke trips on something unexpected.
- The browser flag cookie was set against domain `127.0.0.1`. If the smoke hits `localhost`/`local-dev.askeffi.ai` instead, the cookie won't carry — re-set per domain at the start of step 5.
