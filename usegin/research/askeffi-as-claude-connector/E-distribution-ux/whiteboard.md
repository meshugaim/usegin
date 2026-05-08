---
angle: E — distribution & UX
poll: Poll-E
date: 2026-05-08
status: returned
sources fetched 2026-05-08:
  - https://claude.com/blog/connectors-directory
  - https://claude.com/partners/mcp
  - https://claude.com/connectors
  - https://claude.com/docs/connectors/building/submission
  - https://support.claude.com/en/articles/11176164 (use connectors)
  - https://support.claude.com/en/articles/11175166 (custom connectors UX)
  - https://support.claude.com/en/articles/11503834 (build custom connectors — redirect note only)
  - https://sunpeak.ai/blogs/claude-connector-directory-submission/
  - https://sunpeak.ai/blogs/claude-connector-oauth-authentication/
  - https://max-productive.ai/blog/claude-ai-connectors-guide-2025/
  - https://claudeimplementation.com/blog-claude-cowork-connectors-guide
  - https://medium.com/@george.vetticaden/the-missing-mcp-playbook-...
prior R&D read:
  - usegin/research/slack-marketplace/{listing-draft,submission-checklist,review-blockers}.md
  - usegin/research/askeffi-as-claude-connector/README.md
  - PRODUCT.md
charter scope: distribution surface (add-flow, listing/review, branding, consent UI, post-add UX, discovery). Out: protocol (A), OAuth-IdP (B), tool design (C), security model (D).
---

## Top — the click

**Two doors, not one. Pick door 1 today and walk through door 2 in 8–12 weeks.**

Door 1 is **custom-URL connectors**. Anyone on Pro / Max / Team / Enterprise (and Free, capped at 1) can paste an MCP URL into Settings → Connectors → "Add custom connector" today; Anthropic doesn't review or list them — they just call your URL and run the OAuth dance. The instant we have `mcp.askeffi.ai` live with DCR + OAuth 2.1, an AskEffi customer can self-add it. This is the beta surface; the listing isn't on the critical path.

Door 2 is the **directory listing** at `claude.com/partners/mcp`. There is a real submission form at `clau.de/mcp-directory-submission`, a real ~2-week manual review by Anthropic, a real (published) MCP Directory Policy, and ~40+ partner connectors already listed (Notion, Asana, Linear, Atlassian Rovo, Stripe, Canva, Airtable, Amplitude, 10x Genomics, …). The bar is concrete and lower than Slack's: OAuth 2.0, every tool annotated `readOnlyHint`/`destructiveHint` (this single miss is **30% of all rejections** — sunpeak.ai), privacy policy that names the data, working test account, branding assets, allowlisted callbacks for *both* `claude.ai` and `claude.com`. No SOC 2, no install-count threshold, no demo video. Significantly lighter than Slack Marketplace's gauntlet (which needed ≥5 active workspaces, 30–90s demo video, security questionnaire).

**The single biggest gap between us and the existing bar is not security or branding — it's a public, working `mcp.askeffi.ai` with OAuth 2.1 + DCR + tool annotations.** Once that exists, branding/listing copy is ~1 day of work. Everything else (consent screen, post-add UX, disconnect) is rendered by Anthropic and our existing Supabase auth — we don't have to build any of that frontend.

Single load-bearing dilemma for the team (Mark's slot): **ship as a custom-URL beta before submitting**, or **submit and wait**. The directory is discoverable; custom-URL is not. But custom-URL needs zero review, and existing AskEffi users already have a session — for them the listing is a vanity surface, not a discovery surface.

---

## Middle — the body

### 1. The two add-flows, walked

#### 1a. Custom-URL flow (no review, available today)

Source: `support.claude.com/en/articles/11175166` + `sunpeak.ai/blogs/claude-connector-oauth-authentication`.

| Step | Who renders | What user sees | Notes |
|---|---|---|---|
| 1 | Claude.ai | Settings → Connectors, click `+ Add custom connector` | Pro/Max: any user. Team/Enterprise: Owner only enables org-wide; members then individually connect. Free: 1-connector cap. |
| 2 | Claude.ai | Modal: name + remote MCP server URL + (optional) "Advanced settings" → custom OAuth Client ID / Secret | The optional client-id/secret slot is the "BYO OAuth credentials" pattern (cf. memory `project_unified_byo_credentials`). Without it, Anthropic uses Dynamic Client Registration. |
| 3 | Claude.ai → AskEffi | Browser redirect to AskEffi's `/oauth/authorize` | Anthropic's spec: DCR-enabled, supports auth specs `2025-03-26` / `2025-06-18` / `2025-11-25` (`claude.com/docs/connectors/building`, redirect-resolved). |
| 4 | **AskEffi** | Login + consent screen — "Claude wants to access your AskEffi project. Scopes: …" | **AskEffi renders this**, not Anthropic ("OAuth provider renders the consent screen" — sunpeak). This is the place where our branding, scope wording, and project-picker live. |
| 5 | AskEffi → Claude.ai | Redirect to `https://claude.ai/api/mcp/auth_callback` (or `claude.com/api/mcp/auth_callback`) with code | **Both URIs must be allowlisted** — missing the `.com` variant is the 2nd-most-common rejection class per sunpeak. |
| 6 | Claude.ai | Banner: "AskEffi connected." Connector card visible in Settings → Connectors. | |
| 7 | Claude.ai | In a chat: `+` → "Search and tools" → toggles AskEffi tools on. Per-tool `Always allow / Needs approval / Blocked` granularity is rendered by Anthropic from our `readOnlyHint`/`destructiveHint` annotations (max-productive.ai). | We don't render any per-tool consent UI; we just annotate correctly. |
| 8 | Claude.ai | Disconnect: Settings → Connectors → 3-dot menu → Remove. We get a token-revocation event if we implement it; otherwise the next refresh fails. | No requirement to surface disconnect on our side. |

What we **don't** build: the consent shell (Anthropic), the per-tool toggles (Anthropic), the connector card in chat (Anthropic), the disconnect UI (Anthropic).

What we **do** build: the OAuth authorize+token endpoints, the consent screen (project picker, scope confirmation), the MCP server itself. *(Out of scope for this whiteboard — see Polls A and B.)*

#### 1b. Directory-listed flow (post-review, ~2 weeks after submit)

Same as 1a, except step 1 changes:

> Settings → Connectors → "Browse connectors" → directory at `claude.ai/settings/connectors` → click "AskEffi" card → "Connect"

The card itself shows: name, logo, tagline, description, category, capabilities (read/write per tool annotations), test-account setup link. Then the OAuth flow is identical — Anthropic does not gate or re-render anything mid-flow.

Discovery delta: directory adds a search-index slot at `claude.com/partners/mcp` (organic SEO), an in-product browse path, and a category filter. Custom-URL has none of those.

### 2. Comparison table — 5 existing connectors

Sources: `claude.com/partners/mcp` (categories + cards), `max-productive.ai/blog/claude-ai-connectors-guide-2025` (UX details), `support.claude.com/en/articles/11176164`, `claudeimplementation.com/blog-claude-cowork-connectors-guide`. **Tool counts and exact scope counts are not published in the directory cards** — I report what's published; gaps are flagged.

| Connector | Category | Built by | Card description (verbatim or paraphrased) | Tool granularity exposed | Read/write | Interactive App? | Where add-button surfaces |
|---|---|---|---|---|---|---|---|
| **Slack** | Productivity / Comms | Salesforce/Slack (partner) | "Read channel history, post messages, create channels and DMs" (claudeimplementation.com paraphrase) | Per-tool `readOnlyHint`/`destructiveHint`; Anthropic renders Always-allow/Needs-approval/Blocked toggle per category | both | **Yes** — interactive app (live UI inline; Pro+ only) | Directory card + chat `+` menu + admin enablement (Team/Ent) |
| **Notion** | Productivity / Content | Notion (partner) | "Connect Claude Desktop or Claude.ai to your Notion workspace" (notion.com/help) | "MCP tools act with your full Notion permissions — they can access everything you can access" (notion.com) — coarse, no scope picker | both | No (not in 9-app list) | Directory card + admin enablement |
| **Linear** | Productivity / Engineering | Linear (partner; named in Anthropic's launch blog) | (not directly fetched; listed under Productivity category) | Per-tool annotations | both | No | Directory card + chat `+` menu |
| **Google Drive** | Content | Anthropic-built | "Search, read, and create documents, spreadsheets, and folders" (claudeimplementation.com paraphrase) | Per-tool annotations | both | No | Directory card; available across all paid plans |
| **Asana** | Productivity | Asana (partner) | "Connect to Asana to coordinate tasks, projects, and goals" (claude.com/partners) | Per-tool annotations | both | **Yes** — interactive app | Directory card + chat `+` menu |

**Patterns that fall out of the table:**

- **One-line tagline + one-line description** is the published shape. Slack-style "≤10-word short + long markdown description" is *also* what Anthropic accepts (sunpeak), but the rendered card is closer to a tagline.
- **Tool count is not surfaced as a number** to the end user; granularity is per-tool toggles in settings, after add. Counts probably range from 3 (DocuSign-style narrow) to 30+ (Notion/Atlassian-style broad), based on the published surface.
- **Interactive Apps (live UI inline)** is a real upgrade tier — only 9 connectors today: Slack, Canva, Figma, Box, Clay, Asana, Amplitude, Hex, Monday.com (max-productive.ai). Pro+ only. AskEffi shouldn't aim for this in v1; it adds review surface area and isn't on the critical path for "addable."
- **Anthropic-built vs partner-built** is invisible in the card. The blog launch (`claude.com/blog/connectors-directory`) explicitly credited Notion/Canva/Stripe/Linear/Figma/Socket/Prisma as **partner-built** at directory launch — there is no in-product "official" badge.
- **Gmail / Drive / Calendar are listed as "web connectors"** available across all paid plans; the rest are remote MCP. AskEffi falls in the "remote MCP" bucket — same submission process as Notion/Linear/Stripe.

### 3. Submission / review process — what's actually published

Sources: `claude.com/docs/connectors/building/submission`, `sunpeak.ai/blogs/claude-connector-directory-submission/`, `claude.com/connectors` ("Get started" CTA).

**Submission form** (`clau.de/mcp-directory-submission`) requires:

| Section | Fields | AskEffi readiness |
|---|---|---|
| Server basics | name, URL, tagline, description, use cases | Easy — listing-copy pass, ~2h |
| Connection details | auth type (must be **OAuth 2.0**), transport (Streamable HTTP preferred; legacy HTTP+SSE deprecated), read/write capabilities | Depends on Poll A (transport choice) + Poll B (OAuth) |
| Data & compliance | data handling practices, third-party connections, **health-data access flag** | Privacy policy must enumerate connector-collected data |
| Tools documentation | full list with human-readable `title` + every tool annotated `readOnlyHint:true` OR `destructiveHint:true` | **30% of rejections fail here** (sunpeak) — Poll C must produce annotations |
| Support | docs link, privacy policy URL, support contact | We have `support@askeffi.ai` per slack-marketplace prior R&D; privacy policy needs an "MCP / Claude" section |
| Test credentials | working account + setup instructions | Need a reviewer-only AskEffi tenant — same shape as the Slack-marketplace plan |
| Launch readiness | GA date + tested platforms (Claude.ai / Desktop / Mobile) | Just a date field |
| Branding | server logo + favicon (+ promotional screenshots if pursuing MCP App / interactive UI) | See §4 |
| Allowed link URIs | declare HTTPS origins your tools may open ("suppresses confirmation prompts" — claude.com/docs) | Need to enumerate before submit; currently zero |

**Review process:**

| Field | Value | Source |
|---|---|---|
| Review timeline | "roughly two weeks" | sunpeak.ai (corroborated by claude.com/docs phrasing "variable based on queue volume") |
| Reviewer | Anthropic's review team (humans) | claude.com/docs/connectors/building/submission |
| Status tracking | "Self-serve dashboard rolling out" + escalation email `mcp-review@anthropic.com` | claude.com/docs |
| Pre-submission test option | sunpeak (third-party) offers local validator; "prevents roughly 80% of delays" | sunpeak.ai (judgment, not Anthropic-confirmed) |
| Common rejection reasons | (1) missing tool annotations 30%, (2) missing `claude.com` callback URL, (3) incomplete privacy policy → immediate reject, (4) undeclared link URIs | sunpeak.ai + claude.com/docs |

**What's NOT required** (in published policy, vs. what Slack required):

- No minimum install count (Slack required ≥5 in 28 days).
- No demo video (Slack required 30–90s on YouTube).
- No SOC 2 (recommended-not-required for both, but no checklist item).
- No vulnerability-management questionnaire (Slack had one).
- No category-of-business gating (Slack rejected crypto/NFT outright; Anthropic policy fetched returned 404 for the canonical URL, so the *full* exclusion list is unread — see §Open ends gap-1).

**The directory bar is meaningfully lower than Slack's bar.** Most of what we wrote in `usegin/research/slack-marketplace/` translates, but the asks are 60–70% smaller in calendar-time and human-effort.

### 4. Branding checklist

From the submission form fields + general directory inspection. Specs that the docs page didn't quote are flagged "judgment, not evidence" with sizing inferred from existing cards.

| Asset | What's required | Spec | Status |
|---|---|---|---|
| Server name | display name | concise; existing cards run 1–4 words ("AskEffi", "AskEffi for Claude", "AskEffi Knowledge") | TBD — Lihu pick |
| Tagline | ≤1 line, capability statement | judgment: 5–10 words; example: "Search your team's project knowledge with citations" | draft below |
| Description | 1–3 paragraphs markdown | model after Slack-marketplace `listing-draft.md` long-description shape | draft below |
| Logo | server logo for card | judgment: square PNG/SVG, transparent bg, ≥256×256; the rendered cards on `claude.com/partners/mcp` look ~64–96px | We have `landing-app/public` assets — Lihu confirms which |
| Favicon | OAuth-shell favicon | judgment: 32×32 ICO/PNG, same mark | derives from logo |
| Promotional screenshots | only required for **MCP Apps** (interactive inline UI) — we are not doing this in v1 | n/a | n/a v1 |
| Test account | working AskEffi tenant for reviewers + setup steps | a reviewer-only project on prod, seeded with safe data; document login | needs Lihu spin-up at submission time |
| Privacy policy URL | must cover connector data | existing `askeffi.ai/privacy` likely missing an "MCP/Claude integration" section | gap (carry-over from slack P3) |
| Terms of service URL | required field | `askeffi.ai/terms` | gap (carry-over from slack P4) |
| Support contact | reachable | `support@askeffi.ai` (per slack P6) | already-needed |
| Allowed link URIs | declare every domain our tool results may link to | judgment: at minimum `https://app.askeffi.ai`, `https://askeffi.ai` for citation/file-detail links — enumerate as soon as Poll C settles tool surface | depends on C |

**Draft listing copy (for Sam to harvest, not for me to commit):**

> **Tagline:** "Ask Effi about your team's projects, grounded in your real files and meetings."
>
> **Description:** AskEffi connects Claude to your team's project knowledge. Effi searches across your project's Google Drive files, SharePoint documents, Fathom meeting transcripts, Linear issues, and emails — and returns answers with citations back to the original source. Pick a project, pick what tier of access to share (internal vs. external), and ask Claude questions grounded in your actual work.
>
> **Use cases:** "What did we agree about Q3 with Acme Corp?" · "Summarize last week's customer calls about the new feature." · "Find the latest spec for the workspace migration."

(Cf. Slack listing-draft for the longer markdown shape if we go bigger; the directory card is shorter than Slack's marketplace listing.)

### 5. AskEffi-side surfaces needed (pre-launch + post-launch)

#### Pre-launch (must exist before submit)

| Surface | Owner | Why | New or existing |
|---|---|---|---|
| `mcp.askeffi.ai` MCP server, public HTTPS | Eng (Polls A/C) | The connector points here | new |
| OAuth 2.1 authorize + token + revoke endpoints + DCR | Eng (Poll B) | Anthropic spec | new |
| Consent screen (logged-in path) | Eng (Poll B) | "Claude wants to access AskEffi" + project picker + scope confirmation | new |
| Sign-up + sign-in path inside OAuth flow | Eng | A discovery-first user (no AskEffi account) lands at our authorize URL with no session — need to handle "create account" inline | new (gap; see §6 dilemma D-2) |
| Privacy policy "Claude / MCP" section | Lihu | submission requirement | edit existing |
| `askeffi.ai/integrations/claude` landing page | Marketing | the "Get started" CTA from `claude.com/connectors` lands generically; we want our own deep-link with a "Connect to Claude" button | new (small) |
| Reviewer test tenant + credentials doc | Lihu | submission requirement | new (small) |
| Logo / favicon in submission-spec format | Marketing | submission requirement | derive from existing brand |

#### Post-launch (good UX, not gating)

| Surface | Owner | Why |
|---|---|---|
| "Connected to Claude" indicator in AskEffi project settings | Eng | so admins can see/audit the connection from our side |
| Per-project connection toggle (admin can revoke from AskEffi) | Eng | symmetric to disconnect from Claude side; prevents "Claude got fired but token still valid" class |
| Audit log of MCP-tool calls | Eng | maps to Poll D's security model |
| Help-center article: "Using AskEffi from Claude" | Lihu / Marketing | reduces support load; reviewers also read help docs |

The interesting observation: **Anthropic's UI handles ~70% of the post-add UX for free.** The connector card, the per-tool toggles, the disconnect button, the in-chat affordance — all rendered by Claude.ai. We don't even need a "view in Claude" button on our side; users come to *us* through Claude, not the other way.

### 6. Realistic timeline estimate

Phases are calendar-week buckets assuming the Eng work from Polls A/B/C/D ships in parallel. **Distribution-side work is ~2 calendar weeks of effort, plus a 2-week review wait, plus an indeterminate fix-and-resubmit loop.**

| Phase | Calendar | Distribution-side work (this Poll) | Phase-boundary signal |
|---|---|---|---|
| **Phase 0 — custom-URL beta** | T0 → T+0 | None (gated only by Polls A/B/C: server + auth live) | An employee at a pilot customer pastes `mcp.askeffi.ai` into Claude.ai and asks Effi a question. |
| **Phase 1 — listing prep** | T+0 → T+2w | (a) draft listing copy, (b) brand asset pass, (c) privacy-policy update for "Claude integration" section, (d) reviewer test tenant, (e) `askeffi.ai/integrations/claude` page with "Add to Claude" button, (f) audit tool annotations for `readOnlyHint`/`destructiveHint` (depends on Poll C) | All submission-form fields filled, no `[LIHU]` placeholders. |
| **Phase 2 — submit + wait** | T+2w → T+4w | Submit at `clau.de/mcp-directory-submission`. Monitor `support@askeffi.ai` and `mcp-review@anthropic.com` thread. | Reviewer mail. |
| **Phase 3 — fix + resubmit (likely 1 round)** | T+4w → T+6w | Apply reviewer feedback. Most-likely fix-class: tool annotations (30% of rejections), missing `claude.com` callback (2nd-most-common), privacy-policy clause. | Approval mail; listing live. |
| **Phase 4 — listed + GA** | T+6w → ongoing | Add directory link to `askeffi.ai`; PR/Slack announcement; track installs in directory dashboard. | First non-pilot directory install. |

**Compared to Slack timeline** (`usegin/research/slack-marketplace/`): Slack's calendar was ~6–10 weeks driven mostly by demo-video production + ≥5 active workspaces gate. Anthropic's is ~6 weeks driven mostly by review wait + likely-one-round of annotation fixes. **Net: ~25–40% faster** than Slack to the equivalent listing milestone, assuming the server itself is live.

The **rate-limiting step is always the Eng side** (Polls A/B/C/D shipping a working `mcp.askeffi.ai`). Distribution-side never blocks; it's ~10 working days end-to-end across Lihu + Marketing + 1 eng for the listing-page button.

---

## Bottom — the open ends

### Dilemmas (z026 shape — emit "decided X because Y; price Z; risk W" pairs)

**D-1. Custom-URL beta first, or wait for directory listing?**
Lean: **ship custom-URL the moment the server works**, target directory submission ~4 weeks later.
Why: custom-URL is the validated-shape proof; listing is a marketing/discovery surface. The actual product risk (does Claude render our tools well? do customers like asking Effi from Claude?) gets answered ~6 weeks earlier with custom-URL. Listing gets *no* extra signal we can't get from pilot installs.
Price: pilot customers carry a ~2-line setup ("paste this URL").
Risk: skipping listing means zero organic discovery. Mitigation: the audience for the beta is "existing AskEffi customer who also uses Claude" — they don't discover us via the directory anyway.
Alternative rejected: wait-for-listing-before-touching-Claude. Loses 4–6 weeks of real-user signal.

**D-2. Sign-up-in-OAuth-flow, or "you must have an AskEffi account first"?**
Lean: **MVP requires existing account**. Land users without a session at `app.askeffi.ai/login?return_to=oauth_authorize&...`. Don't build inline sign-up.
Why: discovery-first users (someone who finds AskEffi only through Claude's directory) are the strongest reason to build inline sign-up — but they're also low-volume v1 (existing customers come in via in-app "Connect to Claude" button on our side). Inline sign-up means new-tenant-in-OAuth-flow mid-consent, which is a real UX rabbit hole (where does the project go? what workspace? do they pick a plan?).
Price: directory-discovery user hits a login wall, has to context-switch to claim AskEffi access first. Conversion drops vs. an inline flow.
Risk: low if directory-discovery is a small share of v1 installs. **Probe required before assuming this** — see W-1.
Alternative rejected: build inline sign-up in v1. Adds eng surface and review-time surface (privacy policy needs to cover sign-up-via-Claude data path).

**D-3. One generic "AskEffi" connector, or per-project connectors?**
Lean: **one generic connector; project chosen at consent time** (project-picker in our consent screen).
Why: matches AskEffi's existing model — users see all their projects, pick one per chat. Avoids combinatorial directory listings ("AskEffi for Acme", "AskEffi for Globex"). Notion does it this way (one connector, "MCP tools act with your full Notion permissions" — notion.com/help/notion-mcp).
Price: a Claude chat is bound to one AskEffi project at a time; switching projects = re-consent or token swap.
Risk: token-per-project storage on Anthropic's side may not be straightforward; Poll B should verify.
Alternative rejected: per-project listings. Bad shape; not how the directory works.

**D-4. Pursue Interactive App (inline UI) status in v1?**
Lean: **no, not in v1**. Aim for the standard "remote MCP" bucket like Notion/Linear/Stripe.
Why: Interactive Apps require additional submission artifacts (promotional screenshots, inline UI components, Pro+-only availability) and only 9 connectors today have it. Adds ≥1 more review-rejection class for low marginal value when Effi's value is text Q&A with citations.
Price: Effi answers render as plain Claude text; no inline cards.
Risk: feels less premium than Slack/Canva/Asana. Mitigation: cite-rich text answer is exactly Effi's brand; an inline UI might dilute it.
Alternative rejected: pursue MCP App in v1. Adds at least 2 weeks and an asset-generation step.

### Wire-probes — small live tests against the real system before committing

**W-1. Probe directory-discovery share.** Before D-2 lands, talk to 3 pilot customers: "if AskEffi were in Claude's connector directory, would you have found us via the directory or via our marketing?" If 2+ say "directory" → revisit D-2 toward inline sign-up. (Judgment: 0/3 is more likely.)

**W-2. Probe partner program.** Anthropic's blog ("connectors built by our partners") implies a softer partner-relationship layer separate from the public submission form. Ask `mcp-review@anthropic.com`: is there a private-beta or partner-launch channel — or is `clau.de/mcp-directory-submission` the only door? Mark.

**W-3. Probe `claude.com` callback URL pattern.** Once Poll B has DCR working, probe both `https://claude.ai/api/mcp/auth_callback` and `https://claude.com/api/mcp/auth_callback` against our authorize endpoint to make sure both pass our redirect-URI validation. This is the 2nd-most-common rejection class (sunpeak); pre-flight it.

**W-4. Probe whether Anthropic's directory crawls our `/integrations/claude` page** (SEO behavior of the directory). Inspect `claude.com/partners/mcp` for whether listings backlink to the partner's docs, and what the `nofollow`/canonical posture is. If they pass link juice, our integrations page is also an SEO surface; if not, it's just a deep-link landing.

### Friction zettels captured

None this round — the charter was interpretable end-to-end and the public docs covered the load-bearing questions. (If the directory-policy 404 turns out to hide a categorical exclusion that bites us, that becomes z9XX-friction-anthropic-directory-policy-page-missing.)

### Known gaps — couldn't read

- **gap-1:** `claude.com/docs/connectors/policy` and `claude.com/docs/connectors/directory-policy` both 404'd. The MCP Directory Policy is referenced from `claude.com/connectors` ("review criteria referenced in their MCP Directory Policy") but the canonical URL is not where the link expects. Practical impact: I cannot enumerate Anthropic's full forbidden-categories list (parallel to Slack's crypto/NFT/financial bar). Risk-bound: the categories Anthropic is likely to forbid (Slack-comparable) almost-certainly don't bite an enterprise-knowledge-search product.
- **gap-2:** Per-connector tool counts and exact scope strings are not surfaced in the public directory. The comparison table reports descriptions and tooling-shape; precise tool counts for Slack/Notion/Linear would require installing each connector, which is out of scope for this charter (and would only refine row-level cells, not the top-section finding).
- **gap-3:** The actual claude.ai consent-screen UI (what banner Anthropic wraps around the OAuth provider's screen) is not screenshot-documented in any source I found. Sunpeak/Medium describe it conceptually ("OAuth provider renders the consent screen; Claude redirects in and back out") but no screenshot. Practical impact: low — we render our own screen anyway. If Anthropic adds chrome around it, that's surface area we don't control.
- **gap-4:** Branding spec exact dimensions (logo px, favicon format) were not in any fetched doc; I inferred from existing cards. Pre-submission step Lihu can resolve in 5 minutes by inspecting the submission form itself.
