---
topic: product
moc: product
updated: 2026-05-08
conflict_pending: false
---

# Product — what Effi does

User-visible capabilities of the AskEffi product as of 2026-05-08. For data-source integrations (what Effi ingests, how access control works), see [data-sources](data-sources.md). For LLM / vendors / hosting, see [tech-stack](tech-stack.md). For pipeline of upcoming features, see [roadmap](roadmap.md).

## Current

Effi has **three agent surfaces** the user sees:

| Surface | Mode | Status |
|---|---|---|
| **Web Chat** | Project-scoped, multi-turn, streaming | 🟢 Shipped |
| **Scheduled Reports** | Saved prompt + cadence + recipients → automated email delivery | 🟢 Shipped (core mechanism complete + live as of 2026-05-06) |
| **Effi CLI (`effi`)** | Internal team tool — interactive REPL + sub-commands | 🟢 Shipped (team-only, not customer-facing) |

Behind these, **four agent runners** share the same lockdown (production tool allowlist preventing harness tools from leaking in): **chat agent, assessment runner, risk runner, report-agent runner** — attachment:223abc60. The user-facing function of the *risk runner* is not documented in indexed corpus (see Gap G-5).

- Source: attachment:80d51643 (production report week 2026-05-02 → 2026-05-08); attachment:223abc60 (week 2026-04-25 → 2026-05-01); attachment:0f530be9 (week 2026-04-18 → 2026-04-24); attachment:b897a1d6 (weeks 2026-04-04 → 2026-04-10); fathom:c12a3f81 (Feature prioritization 2026-05-06).
- Last verified: 2026-05-08

---

### Web Chat — feature breakdown

- **Project outline injected into every turn** — budget-aware multi-tier summary of all project content (meetings, files, emails, attachments, SharePoint/Drive files, risks, action items, identities). Parallelised so adds no latency. — attachment:b897a1d6, linear:ENG-4183, linear:ENG-4835
- **User identity + timezone in every turn** — email, full name, current date/weekday/time in user's local timezone (with UTC echo). — attachment:0f530be9
- **Tool-use indicator with user-friendly labels** (e.g. *"Searching emails," "Reading file"*) — replaced raw MCP tool names. — linear:ENG-5858 (shipped 2026-05-08)
- **Interrupt** — user can cancel Effi mid-turn via `client.interrupt()`. — linear:ENG-5857 (shipped 2026-05-08)
- **Rich-text copy** — copying a message writes both HTML and plain text; Gmail/Docs/Notion preserve rendering, plain editors get raw markdown. — attachment:0f530be9
- **Jump-to-bottom pill** above input when scrolled up in long conversation. — attachment:0f530be9
- **Compact tool calls** — consecutive tool indicators grouped into one block. — attachment:0f530be9
- **Chat-input focus retention** — textarea stays focused across send + during streaming. — attachment:0f530be9
- **Stale-action dialog** — long-idle tab failures show a reload prompt rather than silent failure. — attachment:0f530be9
- **Anchored chat** — deep-link from a delivered scheduled report email opens chat pre-anchored to that report run; URL convention `?anchor=<type>:<id>`; `run_id` bound at agent factory (not in prompt). — attachment:80d51643, linear:ENG-5750, linear:ENG-5767, linear:ENG-5768
- **Architectural blocker noted (2026-05-06):** current architecture requires a URL to provide chat context, blocking natural follow-up flows. Logged as must-fix. — gmail:444de44f

### Scheduled Reports — feature breakdown

The product mechanism described internally in May 2026 as *"the core mechanism is complete and live"* — fathom:c12a3f81.

- **Save a prompt + cadence + recipient list** from the project config "Scheduled Reports" tab. A Python worker polls every minute, claims due reports, mints an authenticated session for the creator, runs the agent, delivers via Resend. Agent runs as the creator → RLS limits to creator's accessible data. — attachment:223abc60, linear:ENG-5318
- **Cadence:** list of (day(s) of week, time, timezone) entries — e.g. *"Mondays 09:00 Europe/Madrid + Thursdays 18:00"*; or one-off. DST handled (skipped hours push forward, repeated hours fire once). No mixing recurring with one-off. — attachment:223abc60
- **Send modes:**
  - *"Preview to me first, then send to recipients 1 hour later unless I veto"* — default
  - *"Send right away"*
  Dynamic button label reflects mode. — attachment:80d51643, linear:ENG-5789
- **Recipients v2** (shipped 2026-05-06): chip + autocomplete over project members; external email addresses still accepted with soft-warning banner if mixing internal+external; *"Also send to me"* checkbox; zero recipients allowed → report shows *"Inactive"* chip and skips at fire time with a clear reason. — attachment:80d51643, linear:ENG-5782 → 5787
- **Test-fire loop** — `[Test this prompt now]` button fires synthetic run, delivers to creator only with `[TEST]` in subject, anchored-chat link opens scoped chat. Test fires don't enter project canon, don't consume schedule. CLI: `effi reports fire <id>`. Endpoint locked to creator + project-owner. — attachment:80d51643, linear:ENG-5673 → 5675
- **Live progress** — run page streams tool-call count + last action + last activity timestamp via SSE; ~15s heartbeat keeps proxy from dropping idle connection. — linear:ENG-5846
- **Runs join the project's searchable canon** — delivered runs are indexed in VAIS alongside emails/Drive/meetings. Three agent tools: `get_report` (fetch a specific run), `list_reports` (project's reports), `access_prior_runs` (prior runs of a given report — enables *"show me how this report changed over the last month"*). Excluded runs stay visible to curators but not in semantic results. — attachment:80d51643, linear:ENG-5802 → 5809
- **Run history per fire** — status: sent / agent-failed / no-recipients / delivery-failed / test-complete / skipped / cancelled-vetoed. Per-run page; list of past + test + pending runs. — attachment:80d51643
- **Wall-clock cap: 10 min** (raised from 3 min after Guy's *"Loose ends"* report timed out twice in production on 2026-05-06). Env-overridable. Session transcript captured even on timeout. — linear:ENG-5817
- **CLI surface:** `effi reports list / show / create / edit / delete / add-recipient / remove-recipient / enable / disable / fire / veto / runs / run` — attachment:223abc60
- **Slash-command trigger** (partial): chip rendering in chat input is shipped (linear:ENG-5856); triggering a report as `/report-name` from chat is OPENED (linear:ENG-5845); full UX restructure spec OPENED (linear:ENG-5854).
- **Feature gates:** `scheduledReportsTab` browser flag REMOVED 2026-05-06 (everyone on); `scheduledReportsAsSlashCommands` flag REMOVED 2026-05-08. — linear:ENG-5795, linear:ENG-5860
- **Per-report internal/external scope toggle** — OPENED, linear:ENG-5812 (not yet shipped).
- **Audience-scope for reporting agent** (`external_only` filter on tools) — IN_PROGRESS, linear:ENG-5848 + child linear:ENG-5849 / 5850 / 5851.

### Effi CLI (`effi`) — internal team tool

- `chat` — interactive REPL.
- `reports` — full sub-command suite (above).
- `files` — manage project files.
- `meetings show` — with transcript/speaker/time filters.
- `workspace` — workspace ops.
- `auth` — credential management; refresh command was added in the 2026-04-04 → 10 release.
- `anchor` — anchored chat from run-id or web URL.

The CLI is **not a customer-facing surface** — it's internal team / advanced-dogfooding only. — attachment:223abc60, attachment:80d51643

### Agent's data-browse tool surface (what Effi can call)

`semantic_search`, `browse_emails`, `get_email`, `browse_attachments`, `get_attachment`, `browse_files`, `get_file`, `browse_data_items`, `get_sharepoint_file`, `get_drive_file`, `browse_meetings`, `get_meeting` (with `time_start`/`time_end`), `list_reports`, `get_report`, `access_prior_runs`. — attachment:80d51643 (tool-count assertions in tests, linear:ENG-5819).

**Discoverability rule** applied uniformly: agent only sees content with indexable content — excluded and sync-pending items don't leak into answers. — attachment:b897a1d6.

---

## History — major release weeks

```
~2025-Q4 — Product conceived. AI agent over project data. Initial build: RAG + GFS (Google File Search) backend + Anthropic Claude LLM. — fathom + early customer calls
2026-01-13 — Guy internal test: Effi on her own data; intake-form fill, gap flagging. Latency ~45s. Self-rated accuracy ~40-50%. — gmail:25ab0d09
~2026-01-mid — Priyank (iPaaS) demo: positioned as "LLM (Claude) on RAG architecture." Pitched: instant onboarding, decision context, exec briefing, work-style analysis, automated reporting. File upload + chat working; email/Drive not yet. — email:54d241df
~2026-01-mid — Nido design-partner meeting: email integration "in ~2 weeks"; auto-categorise threads internal vs external. Baseline product = file uploads + chat. — email:ead4a697
2026-02-03 — Oria: email integration first-loop closed on staging. Emails to {project}@mail.askeffi.ai arrive + are accessible to Effi. "We wouldn't call it a feature yet." — gmail:f39047e8
~2026-02-mid — Email architecture finalised: address `[workspace-prefix]-[project-name]-[hash]@mail.effi.ai`; Mailgun routing; security: only project-members or replies to known threads; emails deleted from inbox after processing; Message-ID/In-Reply-To threading. — email:9206b79b
2026-02-16 — Guy → Nido: "we now support email integration for Effi, which was the blocker for actual project testing." — gmail:bb7db759
2026-02-18 — Guy → Elsante: email integration ready; Drive expected end-of-week; Fathom "in the works." — gmail:07af50c3
~2026-Feb–Mar — Email live on staging via full Mailgun pipeline. Routing-rules UI in build. "Zettelkasten" knowledge-graph concept discussed as future direction beyond RAG. — email:40581fd4
~2026-Mar — Drive UX: folder-tree picker; modal management pattern for all integrations. — emails:c795e606, b1ce5db6
2026-03-23 — Guy experiment: full project data into context (Vertex, not GFS) drops latency 45s → 12s for small projects. Drives the project-outline system shipped in Apr 4-10 release. — gmail:715f2515
2026-03-24 — Internal email thread: 1M-token context on Vertex; GFS deprecated in favour of Vertex AI for full-file retrieval. — gmail:715f2515, gmail:058072bd

2026-04-04 → 04-10 release — Major:
  - SharePoint v3 ground-up rewrite (tree picker, worker-driven pull, site-as-first-class). — linear:ENG-4482 → 4820
  - Fathom: non-blocking sync; rules-editor UX overhaul (tag inputs, glob wildcards, match counts, Apply button); collapsible rules; stale-sync recovery.
  - Drive: sync-state lifecycle fixes; soft-deleted files revivable on reconnect; cross-provider bleed fixed.
  - **Project outline in every chat** (budget-aware summary). — linear:ENG-4183
  - Agent data-browse tools: discoverability rule (excluded/pending items don't leak).
  - VAIS admin + Data tab: sortable, 8 status badges, force-resync, per-row error reasons.
  - Security: CVE upgrades; CSP; search-path pinned on 57 SECURITY DEFINER functions; RLS write-validation lint rule.
  - Subprocessors list as versioned legal doc.
  - Auth CLI: credential refresh command. — attachment:b897a1d6

2026-04-11 → 04-17 release — Major:
  - Data tab rebuilt end-to-end (no stale-after-toggle, no vanishing optimistic updates, no max-update-depth crash, bulk-delete ack waits).
  - **Organization model fully removed** — workspace is now top-level ownership unit. — attachment:8e0be2b6
  - Fathom: 90-meeting cursor-pagination stall fixed; rule edit during sync fixed; "Still Syncing" strip cleared correctly; enrichment feature flag.
  - Unified.to webhook path: HMAC verify + edge proxy + Python internal RPC — foundation for push-based sync.
  - **Editable project email address** — changeable after creation.
  - Effi CLI: interactive chat REPL (team dogfooding).
  - Email ingestion: plus-address normalisation; duplicate-key race fixed.

2026-04-18 → 04-24 release — Major:
  - **Email browser v2 rolled out to everyone** (table view, detail pane, filters, grouping, resizable split, bulk toggle, per-row internal/external toggle). Legacy modal removed.
  - **Per-project sender allowlist** as configurable toggle. Existing projects migrated allowlist=on; new projects default off.
  - Fathom: two production data-loss bugs fixed (cursor-switch stall at 122/231 meetings; disconnect soft-deleting other recorders' meetings).
  - **Identity + timezone context** in every Effi prompt.
  - **Drive integration card hidden** behind hardcoded test-user allowlist (Google OAuth verification pending).
  - Chat: rich-text copy, jump-to-bottom, compact tool calls, focus-fix on send.
  - Sign-in: amber notice after resend; SR announcement; email+redirect preserved through *"Go to sign-in"*.
  - Stale-action dialog replaces silent failures. — attachment:0f530be9

2026-04-25 → 05-01 release — Major:
  - **Scheduled Reports goes live.** Saved prompt + cadence + recipients; Python polling worker; Resend delivery; run history; preview-then-send; Generate-now. Workspace-toggle gated. `effi reports` CLI surface. — attachment:223abc60, linear:ENG-5318 area
  - **Slack workspace connect + per-project channel binding shipped.** OAuth + Events API (uninstall/revoke/rename). Customer-facing app live. (Message ingestion: NOT yet — see Conflicts.)
  - "Connect Linear" broken since early April — fixed (Next.js caller missing service-role bearer).
  - `get_meeting(time_start, time_end)` were being ignored, falling through to head-clip — fixed.
  - **Agent tool-surface lockdown** — harness tools (Cron*, RemoteTrigger, EnterWorktree, ScheduleWakeup, ToolSearch) stripped from production model's tool list.
  - Scheduled-report runs terminal-status bug — Supabase SDK listener was overwriting Authorization header → silent RLS deny on every status update.
  - Orphaned preview-pending runs reclaimed by worker.
  - Email browser v2 fully permanent (legacy path + toggle + 700 lines of markup deleted).
  - XLSX re-enabled in attachment-sync allowlist. — linear:ENG-5828
  - Drive RLS column rename: `is_external` → `access_level`.
  - Python backend reorganised into topical subpackages.

2026-05-02 → 05-08 release (current) — Major:
  - **Scheduled Reports: runs become searchable canon.** Delivered runs indexed in VAIS. Three agent tools added: `get_report`, `list_reports`, `access_prior_runs`. Data-tab surfacing. — linear:ENG-5802 → 5809
  - **Recipients v2** — chip + autocomplete; external still allowed with warning; *"also send to me"*; zero-recipient → "Inactive". — linear:ENG-5782 → 5787
  - **Test-fire loop** — test-fire button → creator-only `[TEST]` email → anchored chat. CLI: `effi reports fire`. — linear:ENG-5673 → 5675
  - **Live progress** on run page via SSE. — linear:ENG-5846
  - **Anchored-chat rebuilt** — SECURITY DEFINER RPC; `run_id` bound at factory; `?anchor=<type>:<id>` URL convention. — linear:ENG-5750, linear:ENG-5767, linear:ENG-5768
  - **Wall-clock cap 3 min → 10 min.** Session transcript captured on timeout. — linear:ENG-5817
  - Fathom integration card scoped to connector identity.
  - Slack admin-grade ops IN_PROGRESS. Post-install smoke.
  - Project config page parallelised (was ~7s on real-data projects). — linear:ENG-5763
  - .xlsx allowed in project file upload. — linear:ENG-5830
  - Chat: **interrupt Effi mid-turn**. — linear:ENG-5857
  - Chat UI: **user-friendly labels on MCP tool-use indicator**. — linear:ENG-5858
  - Slash-command chip renders in chat input. — linear:ENG-5856
  - Server actions migration: all client-island /api/v1 calls → typed server actions; ESLint rule bans old pattern. — linear:ENG-5735
  - Report emails: prominent in-body *"AskEffi about this report"* link. — linear:ENG-5859
  - Email loading indicator on Emails tab for large projects. — linear:ENG-5821 — attachment:80d51643

2026-05-06 — Feature prioritization meeting (Guy + Lihu + Nitsan + Oria):
  - Scheduled Reports: *"the core mechanism is complete and live."*
  - Next integration priorities (in order): (1) Slack message ingestion; (2) workspace-level email integration; (3) push to Slack/email.
  - Agent capabilities next: memory layer (Lihu); citations surfaced in UI with source-file links (Lihu).
  - Architectural blocker: URL required for chat context blocking natural follow-ups. — gmail:444de44f, fathom:c12a3f81

2026-05-06 — Guy → Elsante: *"Scheduled Updates is live. You set a prompt, a schedule, and a recipient list — Effi delivers an automated email report."* First customer notification. — gmail:04611c8d
```

---

## Conflicts to flag

**C-1 — LLM version cited in pitch materials.** IAS demo summary (email:cd62b195): *"Anthropic's Claude 2 LLM, chosen for its power and ability to highlight risks."* Reality: production has been on Claude Sonnet 4 / 4.5 / 4.6 family (Anthropic billing notice + 1M-context retirement notices in Apr–May 2026 — emails:d7dafa02, c423881c, 38bd394b). The May 2026 deck says *"Anthropic's Claude"* without version (safe). The "Claude 2" wording is stale demo language.

**C-2 — Slack: pitch language vs. shipped reality.**
- Investor deck (May 7, attachment:e7da01c3): *"Connect Effi to project data through integrations with Email, notes takers, documents, CRM."* Doesn't name Slack explicitly, but visual impression is "Slack connected."
- Feature prioritization meeting (2026-05-06, gmail:444de44f): Slack is *"Priority #1: pull information from Slack"* — explicitly framed as next, not shipped.
- Production report 2026-04-25 → 05-01 (attachment:223abc60): Slack shipped = workspace install + per-project channel binding. linear:ENG-5409 (*"first slice toward functional AskEffi-Slack"*) IN_PROGRESS.

**As of 2026-05-08, zero Slack messages are indexed.** Slack is wired at OAuth/connect-binding level only. Pitch framing overstates.

**C-3 — Google Drive: pitch vs. shipped.**
- Investor deck: *"Pull information across project — not tied to a single user"* — implies Drive works.
- 2026-04-18 → 24 production report (attachment:0f530be9): *"The Drive integration card … is hidden for anyone not on the hardcoded test-user list."* Google OAuth verification for `drive.readonly` restricted scope pending.

Drive works for team-internal test users only. Non-allowlisted users cannot connect Drive. Meaningful gap vs. the pitch.

**C-4 — Proactive risk / escalation alerting: pitch vs. shipped.**
- Investor deck (attachment:e7da01c3): *"Effi guides stakeholders through project (Reactive + Proactive)"* and *"alerting on specific risks and escalations"*; *"Portfolio risk overview"* and *"Root cause of risk"* with screenshots.
- No production report, Linear issue, or meeting summary in the indexed corpus describes a shipped portfolio-risk dashboard or proactive alerting feature. The *"risk runner"* is one of the four agent runners (attachment:223abc60), but its user-facing function is not documented.

Portfolio-risk overview + proactive alerting are deck-level future-state language. No evidence shipped.

**C-5 — Insights / project-questions analytics dashboard.**
- IAS meeting summary (email:cd62b195): *"Future Roadmap: Insights Dashboard — Anonymized analytics on user questions to reveal key concerns."*
- Deck (attachment:e7da01c3): *"Project Manager get insights to help direct project."*

Roadmap-only — no production-report or Linear evidence of build.

**C-6 — Email-address format inconsistency.**
- 2026-02-18 to Elsante (gmail:07af50c3): *"generate an email mailbox per project and CC that address."*
- Architecture-finalisation email (email:9206b79b): `[workspace-prefix]-[project-name]-[hash]@mail.effi.ai`.
- Actual production project email (this project's inbox): `effi+caf_=askeffi-app-really=mail.askeffi.ai@askeffi.ai` — domain is `mail.askeffi.ai` not `mail.effi.ai`.

Treat the architecture-doc domain as outdated. **`mail.askeffi.ai` is live.**

---

## Gaps

**G-1 — Agent latency: no current benchmark.** Historical: 45s in Jan 2026 (gmail:25ab0d09), ~12s for small projects in Mar 2026 experiment (gmail:715f2515), Feb 2026 quote to design partner *"~40 seconds for answering"* (gmail:879f8405). No production report or internal email states the current P50/P90 chat latency as of 2026-05-08.

**G-2 — Citations in the UI are not yet shipped.** 2026-05-06 meeting (gmail:444de44f) explicitly assigns Lihu to build *"Citations: Add citations to answers, including links to source files (e.g. Excel, schematics), to increase credibility."* Agent tool-results carry source metadata, but whether citations are surfaced as clickable links/download buttons in the chat UI is not confirmed shipped. No Linear issue marked COMPLETED for "citations in UI."

**G-3 — Agent memory layer not shipped.** 2026-05-06 meeting: *"Memory: Build a memory layer to improve answer quality and reduce latency"* — Lihu assigned (gmail:444de44f). No completed Linear issue.

**G-4 — Chat history / session continuity uncertain.** `spec: web chat — return to active chat + history dropdown` is IN_PROGRESS (linear:ENG-5765). Whether previous chat sessions are currently retrievable by users, or whether every project page-load starts a fresh session, is not documented as shipped.

**G-5 — Risk runner: function unknown to users.** The production report (attachment:223abc60) names four agent runners — *chat agent, assessment runner, risk runner, report-agent runner* — all share the strict-tools lockdown. **No user-facing description of what the risk runner does**, when it fires, or whether customers can see its output appears anywhere in the indexed corpus.

**G-6 — Linear integration: data scope unknown.** Connection was restored 2026-04-25 → 05-01 after being broken since early April. The indexed corpus does not describe which Linear entities (issues? comments? projects?) are indexed into VAIS or what agent tools surface Linear data. CLI `pr` sub-command visible in linear:ENG-5691 type signatures — unclear if customer-facing.

**G-7 — Workspace-level email integration not built.** Multiple documents describe a future workspace-level email address (e.g. `effi@yourdomain.com`) auto-routing to the right project. Guy → Nido 2026-02 said *"in the near future"* (gmail:bb7db759). 2026-05-06 meeting: Oria just being assigned (gmail:444de44f).

**G-8 — Personal Workspace exists but unused.** Guy (2026-05-06 transcript, fathom:c12a3f81): *"Every user who gets added gets a Personal Workspace, but I don't think we're using that."* Feature in the data model, not surfaced.

**G-9 — External-collaborator experience differentiation.** Internal/external item flag is in place. Whether external users see a meaningfully different agent surface (different prompt, branding, tool list) is not documented. The per-report `external_only` scope is being built (linear:ENG-5848 → 5851).

**G-10 — Insights / portfolio dashboard.** Pitched in deck + early customer meetings as future capability. No design, spec, or Linear issue in indexed corpus.

---

## See also
- [data-sources](data-sources.md) — what Effi ingests and access-control model
- [tech-stack](tech-stack.md) — LLM, vendors, hosting
- [roadmap](roadmap.md) — explicit upcoming work
- [design-partners](design-partners.md) — Mkenga's ask drove Scheduled Reports
- [compliance](compliance.md) — security posture, agent-tool lockdown, RLS-as-floor finding
