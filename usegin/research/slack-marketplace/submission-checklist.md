# AskEffi-Slack — Marketplace Submission Checklist

**Linear:** ENG-5414. **Audience:** Lihu (and only Lihu — these are
human-only steps the agent cannot do).

Ordered by dependency: do not skip. Each item has a ✅ check, the artifact
location, and the upstream blocker (if any). When an item is ✅ in the
"Done" column the row should be left in place — append-mostly per
`usegin/research/CLAUDE.md`.

The full set is acted-on in **roughly 1 working day** (~5–8 focused hours)
once the **Pre-submit blockers** below are clear. The longest natural pole
is the demo video.

---

## Pre-submit blockers (clear these first — agent surfaced gaps)

These are items the agent could not fabricate; they need a Lihu pass before
submission is honest.

| # | Blocker | Why it blocks | Owner | Done |
|---|---|---|---|---|
| P1 | **ENG-5410 token-encryption helper landed** + Slack callback updated to call it + backfill any raw-text rows. | `security-questionnaire.md` §1 only honest if encryption is real at submission time. | Eng (Lihu/Gin) | ☐ |
| P2 | **ENG-5415 Events receiver landed** (or questionnaire §3 reworded to describe planned architecture). | Marketplace requires demonstrably-working Events flow. | Eng | ☐ |
| P3 | **Privacy policy** at `askeffi.ai/privacy` covers Slack data fields, retention, deletion procedure. | Slack reviewer reads it; missing Slack-specific clauses = rejection (review-blockers §B5). | Lihu + legal | ☐ |
| P4 | **Terms of service** live at `askeffi.ai/terms`. | Marketplace required field. | Lihu + legal | ☐ |
| P5 | **Incident-response runbook** exists in writing (~1–2 pages). | Audit-DPA Commitment 1 flags this gap; Slack questionnaire §7 asks. | Lihu (~half day) | ☐ |
| P6 | **Confirm support@askeffi.ai is monitored.** | Slack requires reachable support contact. | Lihu | ☐ |
| P7 | **Confirm dependency-scanning state** (gitleaks, Dependabot, `bun audit`, `pip-audit`). If still gapped, attach Linear ETA to questionnaire §10. | Audit-DPA Commitment 4 was Non-Compliant; reviewer point of friction. | Lihu (lookup) | ☐ |

---

## Phase 1 — Slack app configuration (~1 hour, all in api.slack.com UI)

The C1 callback assumes an app already registered and `SLACK_CLIENT_ID` /
`SLACK_CLIENT_SECRET` set. Verify the app config matches our submission.

| # | Step | How | Done |
|---|---|---|---|
| 1.1 | Sign in to api.slack.com → Your Apps → AskEffi-Slack app. | UI | ☐ |
| 1.2 | **Basic Information** → set Display Name = "AskEffi for Slack", Short description = (per listing-draft.md), tagline if shown. | UI | ☐ |
| 1.3 | **App Icon & Preview** → upload icon (1600×1000, .png). | UI; from Marketing | ☐ |
| 1.4 | **OAuth & Permissions** → confirm bot scopes match `listing-draft.md` table exactly: `channels:read`, `channels:history`, `groups:read`, `groups:history`, `users:read`, `team:read`. **Remove** any other scopes. **No** user token scopes at MVP. | UI | ☐ |
| 1.5 | **OAuth & Permissions** → Redirect URLs — confirm `https://askeffi.ai/api/slack/callback` is the **only** entry. Remove staging/dev URLs from the production app config (use a separate Slack app for non-prod, R5 architectural note). | UI | ☐ |
| 1.6 | **Event Subscriptions** → enable; set Request URL to `https://askeffi.ai/api/slack/events` (ENG-5415); Slack will challenge it — **must** return 200. Subscribe to bot events: `message.channels`, `message.groups`, `channel_rename`, `channel_archive`, `channel_unarchive`, `channel_deleted`, `app_uninstalled`, `tokens_revoked`. | UI; depends on P2 | ☐ |
| 1.7 | **Interactivity & Shortcuts** → leave **disabled** at MVP (read-only per R2). | UI | ☐ |
| 1.8 | **Slash Commands** → leave **empty** at MVP (read-only). | UI | ☐ |
| 1.9 | **Socket Mode** → confirm **disabled**. Marketplace forbids Socket Mode (review-blockers §B6). | UI | ☐ |
| 1.10 | **App Home** → set "Home Tab" off, "Messages Tab" off (read-only at MVP). | UI | ☐ |
| 1.11 | **Manage Distribution** → "Public Distribution" toggle should remain off until Marketplace approval. Use "Add to Slack" button URL for pilot installs in the meantime. | UI | ☐ |

---

## Phase 2 — Listing copy & assets (~3–4 hours, mostly Marketing)

| # | Step | Source | Done |
|---|---|---|---|
| 2.1 | Paste app name "AskEffi for Slack". | listing-draft.md §App identity | ☐ |
| 2.2 | Paste short description (≤10 words). | listing-draft.md §App identity | ☐ |
| 2.3 | Paste long description (markdown). Render preview; confirm headings/bullets render. | listing-draft.md §Long description | ☐ |
| 2.4 | Set Pricing Model. Default suggestion: Free and paid plans; confirm with Lihu. | listing-draft.md §App identity | ☐ |
| 2.5 | Upload icon (Phase 1.3 artifact, restated here for the Marketplace listing). | Marketing | ☐ |
| 2.6 | Upload 3–6 screenshots (1600×1000) — channel picker, citation in Effi's answer, disconnect flow, error toast. | Lihu / Marketing | ☐ |
| 2.7 | Record + upload demo video to YouTube (30–90s, captions on, ads off). | Script in listing-draft.md "Demo-video script outline" | ☐ |
| 2.8 | Paste YouTube URL into listing. | UI | ☐ |
| 2.9 | Paste support email `support@askeffi.ai` (or webform URL). | listing-draft.md | ☐ |
| 2.10 | Paste privacy policy URL `https://askeffi.ai/privacy`. | depends on P3 | ☐ |
| 2.11 | Paste terms URL `https://askeffi.ai/terms`. | depends on P4 | ☐ |
| 2.12 | Paste landing-page URL `https://askeffi.ai/integrations/slack`. **Page must work at review time** (review-blockers §B11). | Lihu / Marketing | ☐ |
| 2.13 | Set primary category "Productivity"; secondary "Analytics". | UI | ☐ |
| 2.14 | Paste 6 feature bullets. | listing-draft.md §Feature-list bullets | ☐ |

---

## Phase 3 — Scope justifications (~30 min)

Slack's Marketplace form prompts a free-text justification per scope.

| # | Step | Source | Done |
|---|---|---|---|
| 3.1 | For each of the 6 bot scopes, paste the matching row from `listing-draft.md` §Scope-justification table into Slack's form. | listing-draft.md | ☐ |
| 3.2 | Re-verify no extra scopes are present (consent modal screenshot). Slack reviewers flag any scope not justified. | UI screenshot | ☐ |

---

## Phase 4 — Security questionnaire (~1–2 hours)

Slack will surface a security questionnaire — exact form varies; the topic
universe is covered.

| # | Step | Source | Done |
|---|---|---|---|
| 4.1 | Open `security-questionnaire.md` side-by-side with the Slack form. | this folder | ☐ |
| 4.2 | For each Slack-form question, paste the matching answer. | security-questionnaire.md | ☐ |
| 4.3 | For every `[ORIA]` flagged in the questionnaire appendix, fill in the live answer **before** pasting. Do **not** ship raw `[ORIA]` to Slack. | security-questionnaire.md §Appendix | ☐ |
| 4.4 | If the form asks anything not covered, do **not** invent an answer. Stop, ping Gin to research, then resume. | — | ☐ |

---

## Phase 5 — Pre-submit smoke-test (~30 min)

Slack reviewers test installation. Make sure it works.

| # | Step | How | Done |
|---|---|---|---|
| 5.1 | Fresh-install the app on a clean reviewer test workspace (or the team dogfood workspace). Confirm OAuth flow completes, bot lands, redirect to AskEffi works. | Manual | ☐ |
| 5.2 | Bind one channel to a project. Post a message in that channel. Wait ~30s. Ask Effi a question grounded in the message. Confirm the citation links back to Slack. | Manual | ☐ |
| 5.3 | Disconnect from AskEffi. Confirm `slack_installs.status` flips, message disappears from search after sync-worker run. | Manual + DB query | ☐ |
| 5.4 | Reconnect. Confirm in-place token replacement (no duplicate row). | Manual + DB query | ☐ |
| 5.5 | Trigger `tokens_revoked` (uninstall app from Slack workspace UI). Confirm we handle event correctly. | Manual | ☐ |
| 5.6 | Verify the `Add to Slack` button on `askeffi.ai/integrations/slack` works end-to-end. | Browser | ☐ |
| 5.7 | Verify privacy policy and terms URLs load. | Browser | ☐ |

---

## Phase 6 — Submit (~5 min)

| # | Step | Done |
|---|---|---|
| 6.1 | Final scan of the entire form for `[ORIA]` / placeholder text. | ☐ |
| 6.2 | Submit. | ☐ |
| 6.3 | Note submission timestamp + reviewer ticket ID into ENG-5414 comment. | ☐ |

---

## Phase 7 — During review (2–6 weeks; ~1 hour/week)

| # | Step | Done |
|---|---|---|
| 7.1 | Monitor `support@askeffi.ai` for reviewer questions. SLA: respond ≤ 2 business days. | ongoing |
| 7.2 | If reviewer asks for changes, capture the request as a Linear sub-issue under ENG-5414, fix, resubmit. Don't argue minor stylistic asks; Slack reviewer rules > our taste. | as needed |
| 7.3 | If reviewer flags a known-blocker we haven't fixed (see `review-blockers.md`), pull from that doc's response template. | as needed |

---

## Items deliberately **not** in this checklist

- Writing the privacy policy / terms (legal — out of scope per ENG-5414).
- Building the demo (Lihu / Marketing — out of scope).
- Implementing ENG-5410 / ENG-5415 (separate tickets — listed as P1/P2
  blockers above so we don't ship a dishonest questionnaire).
- Setting up `support@askeffi.ai` infrastructure if not yet wired (P6
  surfaces it; actually wiring it is a Lihu IT task).
