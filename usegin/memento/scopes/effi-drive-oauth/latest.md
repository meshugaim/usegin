# Polaroid — 2026-04-28 11:48 UTC (scope: effi-drive-oauth, session "[effi] [chore] [priority 1] drive")

> **Concurrency note.** A separate session ("[Effi] [slack] 2nd and latest 28.4") is actively writing `usegin/memento/latest.md`. Do not write to `latest.md` from this scope — keep this Polaroid here. Resume m-stop/m-resume against this path.

## Who am I

UseGin in oria@askeffi.ai's session, no persona. Branch `main` in `/workspaces/test-mvp`. gcloud authed as `oria@askeffi.ai` (ADC updated this session via `gcloud auth login --update-adc`). Unified CLI (`unified`) is read-only.

## The kill

Flip Google's Drive OAuth consent screen from "to continue to **unified.to**" → "to continue to **AskEffi**" on every env we operate. Tracked in **ENG-5186**.

**Lihu's posture this session:** *verify on dev first*, then prod — DO NOT touch Unified-prod until dev's empirical probe is green.

## Where I am

- **Phase:** mid-flow, blocked on Lihu's two dev-env clicks (GCP redirect URI add + Unified custom-domain flip on dev env).

- **Done (verified):**
  - Probed all 4 envs via `unified_client.py:get_auth_url`. Production / staging / dev all return `redirect_uri=https://api.unified.to/oauth/code`. Sandbox returns no URL (synthetic). Custom domain not yet flipped on Unified anywhere.
  - Playwright-rendered the prod OAuth URL → Google sign-in page reads "to continue to **unified.to**" with `app_domain=https://api.unified.to` baked in. Snapshot at `.playwright-cli/page-2026-04-27T11-19-33-027Z.yml`.
  - Curl-probed each client_id directly:
    - prod `…-nhv0gu1k9f3…` (effi-integrations) — ALIVE
    - dev `…-3a3mcnhqj…` (askeffi-staging) — ALIVE
    - staging `…-path8ugae3m9j…` (askeffi-staging) — **DELETED** at Google (`authError=…deleted_client…`)
  - **PROD GCP** OAuth client: redirect URI `https://oauth.askeffi.ai/oauth/code` added (Lihu's browser agent did it; visually confirmed).
  - CNAME `oauth.askeffi.ai` → Unified ELB live.
  - **Tikur** filed: `.claude/tikur-records/2026-04-28-stale-client-ids-in-browser-prompt.md` (file's internal date string says 2026-04-27 — clock drift; same record). Cluster: 4-touch on "verify external state before baking into action artifact."
  - **Memory:** `feedback_preflight_external_identifiers_in_dispatched_prompts.md` written + indexed in MEMORY.md.
  - **Zettels:** `zettelkasten/zettels/z018-investigate-then-ask-narrowly.md`, `z019-comfort-axes-per-addressee.md`.

- **Not done (open-to-empty):**
  - `gin-lab/comfort/G-to-Lihu.md`, `G-to-Oria.md`, `G-to-Nitsan.md`, `G-to-Claude.md` — addresses named in z019. Wait for friction.
  - Linear sub-issues under ENG-5186: `recreate staging+dev Drive OAuth client (deleted)` and `investigate when staging client was deleted` — drafted in chat, NOT yet `plan create`d.
  - Cloud Audit Log query for staging client deletion — gcloud is authed; query was started (`gcloud logging read 'protoPayload.methodName=~"clientauthconfig"…' --project=askeffi-staging`) but Lihu interrupted to run the tikur first.

- **In flight (uncommitted):**
  - `.claude/tikur-records/2026-04-28-stale-client-ids-in-browser-prompt.md` — new untracked.
  - `~/.claude/projects/-workspaces-test-mvp/memory/feedback_preflight_external_identifiers_in_dispatched_prompts.md` — new (outside repo).
  - `~/.claude/projects/-workspaces-test-mvp/memory/MEMORY.md` — index appended (outside repo).
  - `zettelkasten/zettels/z018…md`, `z019…md` — new untracked.
  - `usegin/memento/scopes/effi-drive-oauth/latest.md` — this Polaroid.
  - `usegin/memento/archive/2026-04-28-114530.md` — Zisser's prior `latest.md` archived (NOT mine; the slack session has since rewritten its own latest.md).
  - **`tools/e2e/src/lib/{build,cleanup,database,services}.ts`** — modified BEFORE this session started. NOT mine. Do not `git add` blindly.
  - `.playwright-cli/` artifacts — disposable.

## THE ONE THING

> **Wait for Lihu to say "dev flipped". Then run the dev probe BEFORE touching prod. Verify empirically per the new preflight memory — do not trust Lihu's report alone, do not skip to prod.**

## Pending decisions / questions

- ↑ Commit boundary: probably commit tikur + memory-index + zettels + this polaroid after dev-probe-green (natural boundary). Don't commit mid-fight.
- ↑ When to `plan create` the two staging sub-issues — after dev-flip green, before prod-flip.
- ↑ Whether to do the Cloud Audit Log query autonomously after dev-flip — gcloud authed, no destructive risk.

## Don't-trust-yourself warnings

- **Frozen-in-time → live (this session's tikur cluster).** When Lihu says "flipped", PROBE empirically before reporting green. Recurrence shape: trusted a 5-day-old Linear comment, baked dead client IDs into a dispatched prompt, browser agent ate the cost. Memory: `feedback_preflight_external_identifiers_in_dispatched_prompts.md`. Canonical OAuth-client preflight: `curl -sL -o /dev/null -w "%{url_effective}\n" "https://accounts.google.com/o/oauth2/auth?client_id=<id>.apps.googleusercontent.com&scope=openid&response_type=code&redirect_uri=<any>"` — alive renders sign-in URL; deleted carries `authError=…deleted_client…`.
- **Concurrent UseGin session is alive.** "[Effi] [slack] 2nd and latest 28.4" is writing `usegin/memento/latest.md` simultaneously. Do not race them. This Polaroid lives at the scoped path; touch only that.
- **`gcloud iam oauth-clients` is the WRONG client type.** Workforce/workload federation, NOT Web Application. Web App OAuth clients can't be listed/edited via gcloud — Console UI only. Audit-log is the only programmatic observation path.
- **Unified CLI is read-only.** `unified --help` confirms — no integration-config mutation. Custom-domain flip MUST be human-in-UI.
- **Don't fold staging-deleted into prod's narrative.** Sideways finding. Carve.
- **z018 posture.** Give Lihu the click; proof chain in tikur/memory/zettel, not chat.
- **z032 / laconic.** Probe results = one sentence. Skip celebration.
- **4 `tools/e2e/` mods predate this session.** Don't auto-stage.

## Resume cue

> **First action on wake:** read this file, then read the most recent user message in transcript.
>
> **If most recent message contains "dev flipped" or similar:** run the dev probe.
> ```bash
> cd /workspaces/test-mvp/python-services && UNIFIED_ENV=dev uv run python -c "
> from dotenv import load_dotenv; load_dotenv('.env')
> from agent_api.connectors.unified_client import UnifiedClient
> import urllib.parse as up
> url = UnifiedClient().get_auth_url('http://x/ok','http://x/fail',state='probe')
> q = up.parse_qs(up.urlparse(url).query)
> print('redirect_uri:', q.get('redirect_uri',['?'])[0])
> print('client_id:   ', q.get('client_id',['?'])[0])
> "
> ```
> Expect `redirect_uri=https://oauth.askeffi.ai/oauth/code`. If green, optionally Playwright-render the URL and check consent screen text. Report ONE sentence to Lihu. Then propose moving to prod (only Unified-prod flip remains; GCP-prod already done).
>
> **If most recent message is anything else:** react to that first.

## Tattoos still holding

- z003 (open-to-empty) · z032 (laconic) · z002 (no later) · z018 (investigate unbounded, ask bounded) · z019 (per-addressee comfort axes)
- Session-specific: **verify-on-dev-first** (Lihu, this session — not zettel-ified yet; consider promoting if recurs)
- Session-specific: **preflight every external identifier before baking into a dispatched prompt** (`feedback_preflight_external_identifiers_in_dispatched_prompts.md`)
- 4 stray `tools/e2e/` mods are NOT mine — leave alone unless asked

## Pointers

- ENG-5186 — `plan show ENG-5186 --comments` (Nitsan's 2026-04-22 / 04-23 status comments are the source of the now-stale staging client_id).
- Tikur: `.claude/tikur-records/2026-04-28-stale-client-ids-in-browser-prompt.md`
- Memory: `~/.claude/projects/-workspaces-test-mvp/memory/MEMORY.md`
- Probe code path: `python-services/agent_api/connectors/unified_client.py:190-220` (`get_auth_url`)
- CNAME: `getent hosts oauth.askeffi.ai` → `unified-domains-us-…elb.us-east-1.amazonaws.com`
- `git log --oneline -5` — top: `f5cadebeb slack(housekeeping): rename [LIHU UNKNOWN] → [ORIA]`
- Live client IDs (preflighted this session):
  - prod ALIVE: `1055972347278-nhv0gu1k9f3qbee1bvgjq59hedaacv6o` (effi-integrations) — redirect URI ADDED ✓
  - dev ALIVE: `77535818695-3a3mcnhqj594bjm1i9nnt7949nfd1dtu` (askeffi-staging) — redirect URI **NOT YET ADDED** (Lihu's about to click)
  - staging DELETED: `77535818695-path8ugae3m9j08bmvc97uicalchr5e4` — separate sub-issue, do not retry
