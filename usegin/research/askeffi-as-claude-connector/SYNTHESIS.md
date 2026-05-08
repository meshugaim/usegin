---
date: 2026-05-08
synthesizer: Sam
inputs: A, B, C, D, E whiteboards (committed)
audience: nitsan + lihu — 5-minute decision read
---

# Synthesis — AskEffi as a Claude connector

## TL;DR — the click

**The work is real but bounded — about 4–5 weeks of eng to a working
custom-URL connector, another 4 weeks to a directory listing.** Anthropic
accepts arbitrary HTTPS MCP URLs today with no review (Pro/Max/Team/Ent users
paste-and-go); the directory listing is a separate, optional, ~2-week review
track with a meaningfully lower bar than Slack's marketplace. The single
load-bearing piece is `mcp.askeffi.ai` standing up an OAuth 2.1 authorization
server (DCR + PKCE + RFC 8707 audience binding) plus a Streamable-HTTP MCP
endpoint that wraps the LLM-facing subset of our existing internal tool
catalog. **We are not designing a new product surface; we are exposing the one
Effi already uses, to a third audience.** The one genuinely new posture
question — prompt injection from canon content into Claude's loop — has a
structural mitigation (delimited untrusted-content blocks) but no provable
defense, same as every other connector ships with.

## The shape of the work

```
claude.ai (web/Desktop/Cowork/mobile)
   │  HTTPS, Anthropic egress IPs, public internet
   ▼
   ┌─────────────────────────────────────────────────┐
   │ NEW: mcp.askeffi.ai  (Next.js routes)           │
   │  - Streamable HTTP endpoint (POST + GET /mcp)   │
   │  - /.well-known/oauth-protected-resource (RFC 9728)
   │  - /.well-known/oauth-authorization-server (RFC 8414)
   │  - /oauth/{register,authorize,token,revoke}     │
   │  - Consent screen (project picker + scopes)     │
   │  - mcp_authz middleware: token→user→workspace   │
   └────────────┬─────────────────────────┬──────────┘
                │ Railway private net      │ Postgres
                ▼                          ▼
       python-services/agent_api    NEW: oauth_clients,
       (existing internal MCP        oauth_authorization_codes,
        tool catalog — UNCHANGED)    oauth_access_tokens,
                                     oauth_refresh_tokens,
                                     oauth_consents,
                                     mcp_tool_audit
```

Three principles fall out of the shape:

1. **Next.js is the public surface, Python stays internal.** This honors
   `project_python_api_internal_only` and reuses Supabase cookie auth in the
   one place we need it (the consent screen).
2. **The MCP server is a thin adapter, not a new product.** Tool descriptions,
   `inputSchema`, and output shapes are ported near-verbatim from
   `agent_api/agent_tools/` — the descriptions are already battle-tested
   against an LLM reader.
3. **Token flow goes Anthropic → us → user-scoped Supabase.** Tokens we issue
   resolve to `auth.users.id`; downstream queries either generate a real
   Supabase session (read paths, RLS-enforced) or use service-role with
   explicit `user_id` filter (write paths, tool-author-enforced). This is the
   same RLS-floor / tool-ceiling pattern we already run.

## Cross-cutting patterns

1. **Anthropic's bar today is technical, not editorial.** Custom-URL add is
   live, no review, no install threshold, no demo video, no SOC 2 gate
   (A, E). The directory listing is ~2-week review with concrete, mostly
   mechanical asks (tool annotations, privacy policy clause, dual
   `claude.ai`/`claude.com` callback allowlist). **Implication:** the
   ship-vs-wait decision collapses — we ship custom-URL the moment the server
   works and submit to the directory in parallel.

2. **RFC 8707 (Resource Indicators) and audience binding show up everywhere.**
   A mandates it on the spec side; B builds the validation; D treats it as a
   load-bearing threat-model control. **Implication:** if our token verifier
   doesn't enforce audience match against the canonical MCP URL on every
   request, we silently degrade three layers of defense at once. This must
   land in the first slice, not as a follow-up.

3. **The internal tool catalog is the third-audience surface.** B, C, D all
   converge: Effi's existing tools (already callable from agent + dev CLI)
   are what the connector exposes. C explicitly: "we are not designing a new
   surface; we are exposing the one we already trust." D's RLS-floor /
   tool-ceiling pattern is unchanged. B's auth seam mints the user identity
   the existing tools already expect. **Implication:** scope creep here =
   "let's also add a write tool" or "let's also add a meta-tool". Resist for
   v1.

4. **Three connectors converge on a "minimum lovable" shape: search + read +
   draft (no sends).** Drive (8 tools), Gmail (10), Slack (13) all split
   "find" from "fetch full body" and Gmail's only writes are *drafts*, not
   sends (C's table). Our v1 of 8 read-only tools is conservative-on-purpose
   and matches Drive's profile. **Implication:** v2 writes start with
   *draft a scheduled report*, not *send*.

5. **Anthropic is already our subprocessor; the connector adds a data-flow,
   not a vendor.** D §8 + the existing
   `2026-04-02-subprocessor-inventory.md` agree — no DPA expansion, no new
   row, just a one-line clarification that connector-queried content snippets
   flow to Anthropic. **Implication:** the "build vs buy" debate on the auth
   server (§Tensions below) is decided by *not adding a vendor we don't
   already have*.

6. **Prompt injection from canon content is the one genuinely new posture
   question.** D §1 + §9 name it; A, B, C don't address it because it's not
   in their lane. Effi-internal handles it informally (tool descriptions tell
   the model "this is data"); a connector serving claude.ai's general
   assistant cannot rely on Anthropic's system-prompt hardening. **Implication:**
   §Wire-probe-2 below + a structural mitigation (delimited
   `<askeffi_canon_content>` blocks) ship in v1; provable defense isn't
   available and isn't a launch gate for any other connector either.

## Tensions held open

**T1 — Build vs buy the auth server (B-poll vs hypothetical WorkOS lean).**
B is decisive: build with `oidc-provider` (MIT, OpenID-certified, MCP-spec
coverage). The pull toward WorkOS AuthKit is real (3 days vs 10 days to first
token, MCP-marketed) but every other column favors build: zero new
subprocessor, zero token-shape constraint, zero vendor lock, $0 ongoing cost
overlap with Supabase Auth. **My read:** B is right — single-maintainer risk
on `oidc-provider` (Filip Skokan) is the only real fragility, and tokens are
opaque so we can swap implementations behind discovery URLs later. The
~7-day delta vs WorkOS does not justify a new DPA row. **Lands: build.**

**T2 — Ship custom-URL beta first, or ship custom-URL + submit-to-directory
in parallel (E-poll D-1 vs A-poll Dilemma 2).**
A leans sequential (Day-1 first, listed later — pure function of our work).
E leans the same way but argues for *parallel submit* once Day-1 works (D-1).
Both agree: custom-URL is unblocked entirely by us; listing adds no signal
custom-URL doesn't already give. **My read:** sequential — submit ~4 weeks
*after* custom-URL ships, not in parallel. Reason: the most-common rejections
(tool annotations 30%, dual-callback URL, privacy-policy gaps) are exactly
the things that mature naturally during a private beta. Submitting before
that maturity wastes a review cycle. **Lands: custom-URL → 4 weeks of pilot
use → submit.**

**T3 — `ask_effi` meta-tool: ship or skip in v1 (C-poll z026/C-1).**
C leans skip: two LLMs in series defeats the point of MCP, every other
connector exposes ground-truth tools instead. Pro-side: matches the in-app UX
users already know. **My read:** skip for v1. Slack/Drive/Gmail all expose
search + read, not "ask the assistant". Add `ask_effi` only if v1 dogfood
shows users miss the conversational surface. **Lands: skip; reserve the
name.**

**T4 — Token binds to (user, workspace) or (user) with workspace per-call
(D-poll §4).**
D picks B (per-call workspace) over A (one-token-per-workspace). The
compliance argument for A ("a token that physically cannot read other
workspaces") is real but small; B matches Slack/Linear, avoids token
proliferation, and `mcp_tool_audit.workspace_id` gives forensic single-query
review. **My read:** D is right — B for v1, revisit if a customer
escalates. **Lands: per-call workspace.**

**T5 — Inline sign-up in OAuth flow vs login-wall (E-poll D-2).**
E leans login-wall MVP — no inline tenant creation. Pro inline: directory-
discovery users hit a flow that converts. Pro wall: inline-sign-up-in-OAuth
is a UX rabbit hole (which workspace? which plan? which project?) and
multiplies review surface. **My read:** wall is right for v1, but it depends
on E's W-1 probe — *what share of installs come from directory discovery*.
If 0/3 pilot customers say "directory", the wall is fine. **Lands: wall;
keep W-1 in pre-submit checklist.**

## Phased plan

| Phase | Calendar | What ships | Who/what's needed | Eng-weeks (rough) | Exit gate |
|---|---|---|---|---|---|
| **0 — POC** | T0 → T+1w | Throwaway MCP server, hardcoded OAuth, one tool (`search_canon`). Paste URL into Lihu's claude.ai Pro account, ask Effi a question. | 1 eng (Wes), no consent UI, no DCR | ~1 | URL pastes → Claude calls our tool → we return content with citations. Answers wire-probes W-A1 / W-D-W2 (does claude.ai accept the URL? does it send the `resource` param? what headers?). |
| **1 — Private beta (custom-URL)** | T+1w → T+5w | `mcp.askeffi.ai` Next.js host with full OAuth 2.1 AS (DCR, PKCE, RFC 8707), 8 read-only tools, consent screen, `mcp_tool_audit`, `/account/connectors` revoke UI, prompt-injection delimiters. | 2 engs (Next.js OAuth + Python tool wrapping), Lihu (consent screen copy + privacy policy clause) | ~6 | 3 pilot customers self-add, run for 2 weeks, no security incidents, `mcp_tool_audit` shows expected shapes. |
| **2 — Directory submission** | T+5w → T+9w | Listing copy, branding pass, reviewer test tenant, `askeffi.ai/integrations/claude` landing page, audit of tool annotations against the 30%-rejection list, dual-callback allowlist. Submit. ~2 weeks review + likely 1 fix-and-resubmit round. | Lihu (90%), 1 eng (10%) | ~1 | Approval mail; listing live at `claude.com/partners/mcp`. |
| **3 — GA + v2 surface** | T+9w → ongoing | Public PR, marketing push. Then: write tools (drafts, not sends), `ask_effi` meta-tool if pilot signal supports it, optional Interactive App tier. | TBD by signal | n/a (signal-driven) | First non-pilot install via directory. |

**Total to a custom-URL working connector: ~5 calendar weeks, ~7 eng-weeks
of work.** Total to a listed directory connector: ~9 calendar weeks. Phase 0
is a 1-week spike that de-risks every assumption in Phases 1–2.

## Top 3 wire-probes

These are the questions only-a-real-test-can-answer. Each is the cheapest
experiment that retires the most decision risk.

**Probe 1 — Does claude.ai accept arbitrary HTTPS MCP URLs without review,
today, in May 2026, from a Pro account?** *(A's wire-probe 1; E's
implicit-Phase-0 gate.)* If yes (public docs say yes, third-party reports say
yes, directory has 40+ partners doing it), the entire Phase-0 path is
unblocked and the ship/wait dilemma collapses. If no — find out what the
gate is. **Cheapest experiment:** stand up a 50-line MCP server (a single
hardcoded tool that returns "hello"), paste the URL into Lihu's Pro account.
~2 hours total.

**Probe 2 — What does claude.ai actually send during DCR + first authorize
+ first token request?** *(A's wire-probes 3+4; B's wire-probes 1+2; D's
wire-probe W2.)* Logs the empirical contract: which `resource` URL it uses,
whether it sends `client_name` we should display, what `MCP-Protocol-Version`
header value, whether it DCR-registers per workspace or per user or once
globally. This single probe answers ≥6 open questions across A, B, D.
**Cheapest experiment:** the Phase-0 server, but with a logging proxy in
front that captures every header + body verbatim. Run for one day.

**Probe 3 — When a claude.ai user revokes our connector from claude.ai's
Settings UI, do we get a signal — webhook, revoke endpoint hit, anything?**
*(D's wire-probe W1; partly E's W-2.)* If no signal, our refresh tokens
become orphaned-but-valid until they expire, and the only defenses are short
TTLs + AskEffi-side auto-expire on stale `last_used_at`. This shapes our
revocation posture and our DPA story. **Cheapest experiment:** in the
Phase-0 server, log every inbound request. Add the connector, then disconnect
it from claude.ai. See what (if anything) lands.

## Decisions for nitsan (z026 shape)

**D1 — Greenlight the round into Phase 0?**
- Decision needed: do we move from research to a 1-week spike?
- Options: (a) Yes, spawn a Wes for Phase 0. (b) No, hold for more research.
  (c) No, parking for now.
- Lean: **(a)**.
- Why: Phase 0 is 1 eng-week and answers all three wire-probes above —
  research-by-running. The research round has surfaced enough to know the
  shape; we now need the empirical contract.
- Price: 1 eng-week of someone's time, throwaway code.
- Risk: if Phase 0 reveals a hard blocker (e.g. claude.ai *doesn't* accept
  custom URLs from our DNS for some reason), we lose the week. Low-likelihood
  given 40+ existing partners.
- For you to weigh: is now the right calendar moment vs other priorities
  (Slack marketplace, scheduled reports, dogfooding-effi)?

**D2 — Build vs buy the OAuth AS.**
- Decision needed: confirm B's lean (build with `oidc-provider`).
- Options: (a) Build with `oidc-provider`. (b) Buy WorkOS AuthKit. (c) Roll
  by hand with `oauth4webapi`.
- Lean: **(a) build with `oidc-provider`**.
- Why: zero new subprocessor, zero vendor lock, opaque-token control, $0
  ongoing cost. ~7-day delta vs WorkOS is paid back many times in DPA
  simplicity.
- Price: single-maintainer dependency on Filip Skokan's library;
  ~10 dev-days vs WorkOS's ~3.
- Risk: if MCP's auth profile diverges fast (still draft), `oidc-provider`
  may lag — mitigation is opaque tokens behind our discovery URLs, can swap
  later.
- For you to weigh: does the DPA / "no new vendor" simplicity argument hold
  given any other compliance work in flight?

**D3 — Ship sequence: custom-URL first, then submit ~4 weeks later.**
- Decision needed: confirm sequential vs parallel-submit.
- Options: (a) Custom-URL → 4 weeks pilot → submit. (b) Custom-URL +
  submit-on-day-1 in parallel. (c) Listed-only (skip custom-URL).
- Lean: **(a) sequential**.
- Why: rejection-causes (tool annotations, privacy policy, dual callbacks)
  mature naturally during pilot. Custom-URL gives all the product signal
  without consuming a review cycle.
- Price: ~2-week extra delay to "verified" badge.
- Risk: directory policy may include rules we haven't seen yet (canonical URL
  404'd in E's research). Mitigation: submit early-version once pilot
  stabilizes, treat first review as the read.
- For you to weigh: any external pressure (customer ask, partner-launch
  window) that wants the listing sooner?

**D4 — Prompt-injection posture: ship best-effort + accept residual.**
- Decision needed: explicit acceptance.
- Options: (a) Ship with §9-style delimiters + audit + runbook + named
  residual risk in security overview. (b) Block launch on stronger defense
  we'd have to invent.
- Lean: **(a)**.
- Why: there is no provable defense; every other connector ships this way;
  the structural mitigation (untrusted-content delimiters) plus
  `mcp_tool_audit` plus T1-classed Sentry alerts is the industry shape.
- Price: a sufficiently-clever injection still wins; we name this
  explicitly in customer security materials.
- Risk: a public incident attributed to us. Mitigation: incident-response
  runbook, fast revoke path, audit trail.
- For you to weigh: is the security-questionnaire posture comfortable
  saying "we cannot prevent prompt injection from canon content; here are
  our compensating controls"?

**D5 — `ask_effi` meta-tool in v1 — skip.**
- Decision needed: confirm C's lean.
- Options: (a) Skip; ship 8 read-only direct tools. (b) Add `ask_effi` as
  9th tool in v1.
- Lean: **(a) skip**.
- Why: defeats the point of MCP; two LLMs in series; matches Slack/Drive/Gmail
  shape.
- Price: in-app conversational-Effi surface isn't 1:1 mirrored.
- Risk: v1 feedback shows users miss it. Mitigation: name reserved, add in
  v2 if signal warrants.
- For you to weigh: does Lihu have product intuition that would override
  this — e.g. "the `ask_effi` shape *is* our brand"?

## What this synthesis deliberately did NOT include

- **Cost projections.** None of A/B/C/D/E surfaced concrete usage estimates
  or per-tool-call cost. The `agent:ask` cost-exposure dilemma (D z-DIL-002)
  is real but the inputs to size it (expected MAU, per-user call rate)
  weren't gathered.
- **Compliance audit beyond the DPA / GDPR / SOC 2 surface.** No CASA delta
  analysis (D notes it's clean — connector uses no restricted Google
  scopes), no enterprise-customer questionnaire dry-run.
- **Concrete rate-limit numbers under load.** D's table (§6) is a starting
  proposal; calibration is post-Phase-0.
- **Multi-workspace UX detail.** All three of (B, D, E) handle workspace via
  per-call param; no one designed the consent-screen project-picker UI
  detail.
- **Anthropic Messages-API path as a distribution surface.** A flagged it as
  free upside (same server contract, different client); not designed in.
- **What v2 looks like beyond "drafts, not sends".** Bounded by signal we
  haven't gathered.

A future round (post-Phase-0) should pick up: cost sizing, concrete consent
UX, the `ask_effi` decision based on real pilot signal.

## Pointer index

- `usegin/research/askeffi-as-claude-connector/A-anthropic-spec/whiteboard.md` — Anthropic spec, MCP transport, OAuth + DCR contract, directory submission rules
- `usegin/research/askeffi-as-claude-connector/B-askeffi-oauth-idp/whiteboard.md` — `oidc-provider`-based AS design, full schema DDL, build-vs-buy matrix, route paths
- `usegin/research/askeffi-as-claude-connector/C-mcp-tool-surface/whiteboard.md` — 8 v1 tools mapped to existing capabilities, prompts, output shape, comparison vs Drive/Slack/Gmail
- `usegin/research/askeffi-as-claude-connector/D-security-multitenancy/whiteboard.md` — 5 scopes, scope×RLS interaction, audit DDL, top-5 threat model, prompt-injection defense depth
- `usegin/research/askeffi-as-claude-connector/E-distribution-ux/whiteboard.md` — two-doors framing, comparison vs 5 connectors, submission process detail, branding checklist, realistic timeline
