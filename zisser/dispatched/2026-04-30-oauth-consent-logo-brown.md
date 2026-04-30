---
title: AskEffi OAuth consent screen — upload logo (Brown task)
chartered: 2026-04-30
chartered_by: Zisser (for Lihu)
operator: Brown (relay via Lihu)
status: drafted, awaiting Lihu's relay to Brown
linear: ENG-5186 (parent — Drive OAuth migration + verification); this is step 7 polish
---

## Why Brown, not gcloud

Web Application OAuth client branding (app name + logo) on the OAuth
consent screen is **Console-UI only** in Google Cloud. `gcloud iap
oauth-brands` is deprecated and was IAP-only; `gcloud iam oauth-clients`
is the wrong client type (workforce/workload federation). Verified by:

1. `gcloud iap --help` (oauth-brands group flagged DEPRECATED).
2. Web search 2026-04-30 (Google support: logo via Console Branding page).
3. Memento `usegin/memento/scopes/effi-drive-oauth/latest.md:61` — same
   conclusion reached this past week.

So gcloud auth doesn't unblock this. Brown's a 5-minute click in the
console (or Lihu, same time). Both have the access; Brown saves Lihu's
attention.

## The relay message (paste to Brown verbatim)

> Hi Brown — quick console click for AskEffi.
>
> **Goal:** upload the AskEffi logo to our Google OAuth consent screen
> so it appears when users grant consent (instead of nothing).
>
> **Steps:**
>
> 1. Open https://console.cloud.google.com/auth/branding?project=effi-integrations
>    — log in with `oria@askeffi.ai` if prompted (you have Owner on
>    that project; verified 2026-04-23).
> 2. On the **Branding** page, find **App logo**. Click the upload /
>    "Change logo" control.
> 3. Upload the file at `zisser/handoff/2026-04-30-oauth-consent-logo/askeffi-logo-180x180.png`
>    in the test-mvp repo (or the copy attached to this thread). It's
>    180×180 PNG, 47KB — fits Google's spec (square, ≥120×120,
>    PNG/JPG/BMP, <1MB).
> 4. Save.
> 5. While you're there, two follow-up checks (30 seconds each):
>    - **App name field**: should read `AskEffi` (proper case). If it
>      currently reads `askeffi.ai`, update to `AskEffi`. (Per Nitsan's
>      ENG-5186 comment 2026-04-22, step 7.)
>    - **Publishing status**: note whether it's "In production" or
>      "Testing". Tell Lihu what it says — does NOT change anything.
> 6. **Important caveat to relay back:** the logo only *displays* to
>    end-users after Google's brand-verification process passes. So
>    even after upload, the consent screen may continue to show no
>    logo until verification is submitted + approved (ENG-5186 step 9,
>    weeks of Google review). The upload is necessary but not
>    sufficient. Don't let this stop the upload — we want it staged
>    and ready.
>
> **Project to confirm you're in:** `effi-integrations` (the dropdown
> at the top of the Cloud Console — NOT `askeffi-staging` or any
> `effi-vais-*`).
>
> **OAuth client this affects** (FYI, not something to edit):
> `1055972347278-nhv0gu1k9f3qbee1bvgjq59hedaacv6o.apps.googleusercontent.com`.
>
> **Reply with:** "uploaded" + screenshot of the Branding page after
> save + the publishing-status field's current value. That's it.

## Don't-trust-yourself for Brown

- Do **not** change the Authorized Domains list (still has `unified.to`
  on it; removal is queued for after the Unified custom-domain CNAME
  flip lands — see ENG-5186 status comment 2026-04-23).
- Do **not** click "Submit for verification" — that's a separate
  multi-week Google review, queued as ENG-5186 step 9 once
  prerequisites (CASA C1/C2 fixes, demo video, scope justification
  doc) are complete.
- Do **not** touch `askeffi-staging` project — its dev OAuth client is
  alive but the staging client is deleted and being recreated under a
  different sub-issue.

## What Zisser will do when "uploaded" comes back

1. Add a comment to ENG-5186 with the screenshot path + publishing-status
   value Brown reported.
2. Strike the row from `usegin/inbox-pending.md`.
3. Append a closing line to `zisser/log/2026-04.md`.
4. If publishing-status is "Testing" (not "In production"), open a
   sub-issue under ENG-5186 — "promote effi-integrations OAuth
   consent screen from Testing → In production" — gated on the
   verification prerequisites (steps 5–8 of Nitsan's status comment).

## What I did NOT do (and why)

- **Did not generate a higher-resolution logo** (e.g. 512×512 or
  1024×1024). Google displays the consent-screen logo at 120×120 in the
  browser; 180×180 is plenty. Upscaling a 32×32 source would just be
  smoothing.
- **Did not edit the App name from console autonomously** — coupled to
  the upload click; cheaper to ask Brown for both at once than two
  trips.
- **Did not submit for verification** — out of scope per ENG-5186
  sequencing; multiple non-trivial prerequisites pending.

## Pointers

- Asset: `zisser/handoff/2026-04-30-oauth-consent-logo/askeffi-logo-180x180.png`
- Parent issue: ENG-5186 — `plan show ENG-5186 --comments`
- Source-of-truth memento (logo step is "step 7 polish"): `usegin/memento/scopes/effi-drive-oauth/latest.md`
- Google's logo spec: https://support.google.com/cloud/answer/15549049
