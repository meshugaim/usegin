---
title: Inbox — pending asks for Lihu
owner: gin-main (this session) + Zisser
purpose: Single living file for everything Gin/Zisser/sub-agents need from Lihu, until the real Inbox app (ASK-5..11) ships.
updated: 2026-04-30
---

Read top-down. Strike rows when answered (don't delete — leave the strike for traceability).

## P0 — urgent / blast radius

| # | Ask | From | Why blocking | Default if you don't answer |
|---|---|---|---|---|
| P0-1 | Fix SharePoint Azure-AD redirect URI: register `https://oauth.askeffi.ai/oauth/code` in the customer's Azure app `c51474f5-b0ec-…`. **Or** confirm we're rotating the OAuth domain. | tmunat-matzav-2026-04-30 | 33,051 Sentry events since 2026-04-12; 9 alive SharePoint connections, 0 new content in 21 days. Pure config fix, you/Brown side. | None — I cannot fix Azure-side. Will keep bleeding until you do. |
| P0-2 | Confirm scope of ENG-5507 vs my tmunat matzav — is the other Gin session (`372412f6`, assigned `nitsan@askeffi.ai`) owning Fathom + SharePoint OAuth fixes, or do you want me to take Fathom-side (commit `4654f8f82` revert/fix) here? | gin-main | Risk of two sessions stepping on each other on the same code path. | Stay off ENG-5507; surface my findings to that session via Linear comment. |
| P0-3 | Decide on Google Drive reconcile: it's been failing for 23 days (74,282 events, 224 items stuck `blocked` since 2026-04-04). Want me to investigate root-cause read-only and propose a fix as a Linear bug, or leave it for the OAuth-fix wave? | tmunat-matzav-2026-04-30 | Silent failure — no user has reported it. Burning Sentry events at ~3,200/day. | Open a Linear bug under integrations cluster, investigate read-only, no code edits without your sign-off. |
| P0-4 | **Relay to Brown**: upload AskEffi logo to OAuth consent screen on `effi-integrations`. Charter at `zisser/dispatched/2026-04-30-oauth-consent-logo-brown.md`; asset at `zisser/handoff/2026-04-30-oauth-consent-logo/askeffi-logo-180x180.png`. gcloud auth does NOT unblock — Web App OAuth client branding is Console-UI only (`gcloud iap oauth-brands` deprecated, `gcloud iam oauth-clients` is wrong client type). | Zisser 2026-04-30 (Lihu's ask) | Step 7 of ENG-5186 polish; logo only renders post-verification but upload is the predicate. | Relay charter to Brown; if Brown unavailable, you can do it yourself in 90 seconds. |

## P1 — fortress chores (would unblock me)

| # | Ask | From | Why |
|---|---|---|---|
| P1-1 | Grant this devcontainer prod-DB read access (Supabase service-role key in env, or `supabase link` to prod ref). | tmunat-matzav | Today the OAuth fork installed `psql` + used the Supabase Management API; the cross-cutting fork couldn't query `sync_items` at all. Read access would let future grounding be 1 fork instead of 3. |
| P1-2 | Grant this devcontainer's GH token read access to `meshugaim/oria-crazy-world`. | Zisser (recurring) | Personas/values SoT lives there; values doc currently lives at `usegin/values.md` as fallback (per Zisser's note). |
| P1-3 | Authorize Wes dispatch for Inbox walking-skeleton — charter is at `zisser/dispatched/2026-04-30-inbox-app-walking-skeleton-wes.md`. Walking skeleton = S0+S1+S2+S3 = one Q end-to-end, no LLM. | Zisser | This file (`inbox-pending.md`) is the temporary patch; Wes builds the real `/inbox` Next.js page. |

## P2 — Zisser plan ↑Qs (defaults already taken)

| # | Ask | Default Zisser took |
|---|---|---|
| P2-1 | Inbox route: `/inbox` vs `/admin/inbox` vs subdomain | `/inbox`, Lihu-only via workspace-owner check |
| P2-2 | Should Effi (customer-facing) also drop questions here? | Yes — `asked_by="effi:<workspace_id>"`, Lihu-only visibility |
| P2-3 | Slack app identity for customer surface: repurpose `Effi Spike` Slack app, or register a separate one? | Parked — blocks ENG-5409 OAuth-UI smoke |
| P2-4 | C4 ingestion shape: `data_items` row per message with `entity_type="slack_message"`? | Parked — blocks Slack message ingestion slice |

## P3 — observed but not yet decisions

- `google_calendar`, `notion`, `gmail` are NOT separate integrations in prod schema. If users think they exist, the UI may be misleading them. Worth a sweep — but not urgent.
- `email_attachments` Apr 28 rename `is_external → access_level` likely caused NEXTJS-APP-6B (1 user, 15h ago, `/projects/[id]/config` page broken). Cluster with NEXTJS-APP-25 + NEXTJS-APP-31 on same route.
- Cross-cutting Sentry top-event issues for 7d: PYTHON-FASTAPI-GM (74,282 / Drive reconcile), JJ (33,051 / SP OAuth), MA (7,850 / Fathom). All pre-existing, none new today.

## How to use this file

When you're back, scan top-down. Each row I add or strike here is a commit (you'll see it in git log). When the real Inbox ships (ASK-5..11), this file gets retired and we move to `/inbox`.
