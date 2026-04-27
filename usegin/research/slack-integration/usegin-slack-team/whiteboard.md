# Whiteboard — angle D: usegin-slack-team

The UseGin-Slack integration as a **Gin-mediated team R/W surface** — the Slack equivalent of `plan` (Linear-via-Gin) and `effi` (Effi-via-Gin).

## Top — the click

**UseGin-Slack is a single bot user (`@usegin`) installed once into the team's Slack workspace, written-to and read-from via a `dx slack` CLI that mirrors `plan`'s shape. Discovery is dual: (a) `@usegin` mentions and slash command `/usegin` for human → Gin asks; (b) a dedicated `#usegin` channel for Gin's proactive write surface (where Gin posts what it would otherwise stash in a chat-only buffer). Auth is one bot token (shared across team-Gin instances, like `plan`'s shared Linear API key — NOT per-user OAuth like `effi`). Per-human attribution is in-message (`*[Lihu via UseGin]*`) — bot identity stays single. Cross-env: pull-only by default (Gin reads on invoke, doesn't subscribe to events); upgrade-path to Events API only if asynchronous Slack→Gin triggers prove load-bearing.**

The shape rhymes with `plan`, not `effi`. Slack is a **team artifact** like Linear, not a **per-person identity** like Effi-on-our-team-tenant. One bot, one token, attribution in the payload.

## Middle — the body

### Actor model — one bot, attribution in the message

**Decision:** `@usegin` is a single Slack bot user. Every team member's Gin instance posts as the same bot.

**Why:**
- Mirrors `plan`'s shared-Linear-API-key model (memory: `plan docs show attribution`, "shared API key, treat issues as team-owned"). When Gin is the actor, the actor *is* Gin — attributing across humans on the wire dilutes that.
- Per-user OAuth would require each engineer to install/authorize the Slack app individually. That's the `effi` shape and it pays for itself there because Effi is reading per-user mailboxes. Slack on the team workspace is one shared surface — one install suffices.
- Avoids the Fathom-per-recorder trap (memory: `reference_fathom_per_recorder_scoping`) — one Slack OAuth covering "team coverage" is exactly what we want here, *because* the team surface IS the workspace, not per-person inboxes.
- Cleaner mental model in Slack: when `@usegin` posts, every human knows it's Gin, regardless of which engineer prompted it.

**Attribution in payload:**
```
@usegin: *[via Lihu]* deploying staging now per your /deploy request — eta 4 min.
```
- Prefix `*[via <human>]*` is appended automatically by `dx slack send` when the invocation has a resolvable human (from `dx whoami` / git config).
- For Gin-autonomous posts (no human prompt — e.g. CI watcher findings), no `via` prefix; bot speaks for itself.

**Rejected alternatives:**
- *Per-user OAuth post-as-human* — costs N installs, breaks the "one Gin" mental model, and the Slack workspace IS our shared surface (unlike per-user mailboxes for Effi).
- *No attribution at all* — would obscure provenance in threads where multiple engineers' Gins are posting; humans need to know who-asked-what.

### Discovery model — three modes

Mirrors how Gin currently reads-and-writes: a CLI (`dx slack`), a mention surface (`@usegin`), and a dedicated channel (`#usegin`).

| Mode | Who initiates | What it's for | Implementation |
|---|---|---|---|
| **Direct CLI** | Human → Gin → `dx slack send/read` | Most common: human says "Gin, post to #engineering that staging is deploying" → Gin runs `dx slack send #engineering "..."` | Web API via bot token. Pull-only — no subscription. |
| **`@usegin` mention** | Human in Slack → Gin (later) | Human pings `@usegin` in any channel; Gin sees it on next invocation when prompted to "check Slack" | Slack Events API → store in queue; `dx slack inbox` lists pending mentions |
| **`#usegin` channel** | Gin → channel | Gin's proactive write surface — posts session summaries, decision breadcrumbs, /end ratings, friction zettels worth surfacing | Bot is permanently joined; `dx slack post --channel=usegin` is the default target for non-channel-specific posts |

**Why three:** the CLI handles the "Gin, do X in Slack now" path (highest volume, hot loop). The mention handles "humans want to ping Gin from Slack itself" (lower volume, but matches the `effi-slack` user expectation). The dedicated `#usegin` channel handles Gin's *outbox* — places to drop things that don't belong in any specific channel but are worth being readable across the team.

### CLI surface — `dx slack`

Lives under `tools/dx/src/commands/slack/` (sibling to `his/`, `zettel/`). Auth via env: `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID` (Doppler-stored, mirroring `UNIFIED_API_KEY` pattern in `tools/unified-cli/`).

```bash
# Write
dx slack send <channel> "<message>"             # post to channel (resolves #engineering, C-IDs, @user)
dx slack send <channel> --thread <ts> "<msg>"   # reply in thread
dx slack send --channel=usegin "<msg>"          # default outbox post
dx slack react <channel> <ts> <emoji>           # add reaction (e.g. "ack" → ✅)

# Read
dx slack read <channel> [--since 1d] [--limit N]   # recent messages
dx slack thread <channel> <ts>                     # full thread
dx slack inbox [--unread]                          # @usegin mentions waiting
dx slack search "<query>" [--channel #x]           # Slack search-as-bot

# Discovery / debug
dx slack channels [--joined]                       # channels bot can post to
dx slack whoami                                    # bot identity, scopes, workspace
dx slack docs                                      # embedded docs (mirrors plan/effi pattern)
```

**Output convention:** human → stderr, JSON → stdout. `--json` flag and `DX_OUTPUT=json` env, exactly like `dx` and `effi` (memory: `tools/dx/CLAUDE.md` "Output Convention").

**Prefix matching + standard aliases:** inherits from `applyStandardAliases` and `enablePrefixMatching` (used everywhere in dx/effi/plan).

### Auth / identity

| | UseGin-Slack | `plan` (Linear) | `effi` |
|---|---|---|---|
| Token type | Bot token (xoxb-) | API key | OAuth-bearer + per-user profile |
| Scope | One per Slack workspace | One per Linear org | One per human × env |
| Where stored | Doppler → env | Doppler → env | `~/.effi/` profile |
| Provenance in payload | `*[via <human>]*` prefix | None (treated as team-owned) | Per-user (it IS the user) |
| Cross-team install | One install per workspace | N/A | N/A |

The bot token is **infrastructure**, not per-person credentials. Treat like `LINEAR_API_KEY`: one shared secret, attribution lives in the message, not the wire.

### Cross-env continuity

- **Pull-only baseline:** `dx slack read` and `dx slack inbox` query Slack on demand. No persistent subscription. Cross-env is automatic — any env with the bot token can read.
- **Events API (upgrade path):** if we want Gin to *react* to Slack messages without being invoked first (e.g. someone posts a question Gin should auto-answer), we need an Events API receiver. That's a separate service, not a CLI concern. Defer.
- **Session-resume parity:** when Gin resumes a session in a new env (per `use-gin` SKILL — `session resume <id>`), the Slack state is *external* (Slack itself owns the message history), so resume is trivially correct: just re-query.

This is the inverse of Effi's pull/sub split (Effi has long-running async ingestion). Slack-via-Gin starts pull-only because the use case is "Gin, check Slack now and tell me / write into it" — a synchronous CLI invocation, like `plan show`.

### Parity matrix vs Linear-via-Gin and Effi-via-Gin

| Aspect | `plan` (Linear) | `effi` (AskEffi) | `dx slack` (proposed) |
|---|---|---|---|
| Identity | Shared team API key | Per-human profile | **Shared bot token** |
| Attribution | Implicit (team-owned) | Explicit (it IS the user) | **In-message `*[via X]*`** |
| Read shape | `plan list/show/search` | `effi ask` (synthesizes) + tool-direct | **`dx slack read/thread/search`** (raw) |
| Write shape | `plan create/update/close` | `effi files add` (canon) | **`dx slack send/react`** |
| Discovery into Gin | Human → Gin command | Human → Gin command | Human → Gin command **+ `@usegin` mentions + `#usegin` outbox** |
| Cross-env | Stateless API | Stateless API + profile | Stateless Web API |
| Embedded docs | `plan docs` | `effi docs` | **`dx slack docs`** |
| Connects out | — | Linear (optional) | **Linear (auto-link ENG-IDs)** |

**Two divergences from `plan` worth flagging:**
1. **`@usegin` mentions** — Linear has no equivalent. Slack is a chat surface, so Gin must be addressable from inside it. This is new.
2. **`#usegin` outbox channel** — Linear is structured (every issue has a place); Slack is unstructured (where do you put a thought that doesn't belong to any channel?). The dedicated channel solves that — it's the Slack-shaped equivalent of `usegin/zettel/zettels/` (a place that exists *because* the surface lacks a natural home).

### Cross-surface linking

When Gin reads/writes Slack, it auto-links to other surfaces:

- **Slack → Linear:** any `ENG-\d+` token in a Slack message Gin reads is auto-resolved via `plan show` and the metadata is enriched in the Gin context. When Gin posts, Linear-IDs in the body get `<https://linear.app/.../issue/ENG-X|ENG-X>` formatting automatically.
- **Slack → Zettel:** Gin can quote-link to `usegin/zettel/zettels/zNNN-...md` in posts. Useful when explaining a decision in #engineering ("we landed on this — see z026").
- **Slack → Session:** `dx slack send` can include a `code-history` permalink or `session resume <id>` pointer when posting "Gin finished work on X" outbox messages.

These are autoreferences — no special config; happens whenever the IDs are recognized. Same shape as how `plan` recognizes `usegin/zettel/zettels/...md` in issue descriptions.

### What this is NOT

- Not a customer-facing channel→project binding (angle C).
- Not the AskEffi-Slack integration on our own tenant (angle E).
- Not a real-time conversational agent in Slack (no Events API receiver in scope here).
- Not a per-user identity surface — humans don't post-as-themselves through Gin.

### Build order (rough)

1. `dx slack send` + `dx slack read` against bot token (manual install, no Events API). Makes Gin-write-to-Slack work.
2. `dx slack inbox` reading mentions via Web API `conversations.history` filtered by mention syntax — no Events API yet, just polled-on-invoke.
3. `#usegin` channel convention + `--channel=usegin` default in `dx slack post`.
4. Cross-surface ENG-ID auto-link on read; Linear-permalink-on-write in send.
5. (Later, if needed) Events API receiver service for true async Slack→Gin triggers.

Steps 1–4 are CLI-only; no service to deploy. That matches `plan`'s shape (zero infra beyond the API key).

## Bottom — the open ends

### Dilemma D1: per-user OAuth vs single bot — closed *but* could re-open

**Decision needed:** do we need per-user OAuth (post-as-human) for any future use case?
**Options:**
- A. Single bot + in-message attribution (recommended above).
- B. Hybrid: single bot for Gin-autonomous, per-user OAuth for "post as me" mode.
- C. Per-user OAuth only.
**Gin's lean:** A.
**Why:** Slack workspace IS the team surface; the bot is the right granularity. B adds N installs and dual-mode complexity for a use case (impersonating humans) we haven't actually had. C breaks parity with `plan`.
**Price (A):** humans can't ask Gin to "post as me in #design" — Gin always posts as Gin. If a human wants their name on the post, they post themselves.
**Risk:** if leadership wants Gin to ghost-write announcements *as the human*, A is wrong. Likely we'll keep A and humans post their own important announcements.
**For Lihu to weigh:** is there a use case where Gin should post AS a human, not on their behalf? If yes → revisit. If no → A is final.

### Dilemma D2: pull-only vs Events API receiver

**Decision needed:** do we deploy a long-running Events API receiver for async Slack→Gin triggers?
**Options:**
- A. Pull-only — `dx slack inbox` polls on Gin invocation. No service.
- B. Pull-only **plus** mentions queued via Events API into a small Supabase table; Gin reads that table on invoke. (No Gin-side daemon, but receiver service required.)
- C. Full Events API + Gin-side reactor process (Gin auto-replies to Slack messages without human prompt).
**Gin's lean:** A for now; B if we observe humans pinging `@usegin` and getting stale responses on the next invoke.
**Why:** A is zero-infra and matches the synchronous Gin-invocation model. B is a small lift that buys us "no missed mentions" without committing to a daemon. C is a different product entirely (autonomous Slack agent) and out of scope here.
**Price (A):** mentions sent while Gin is idle are seen only when a human says "Gin, check Slack". Lag = next-Gin-invocation.
**Risk:** humans get used to ignored pings; the surface feels broken.
**For Lihu to weigh:** how synchronous does this need to feel? If Slack is just a transcript Gin reads on demand, A wins. If `@usegin` is meant to behave like a Slack bot users *expect* (replies in seconds), we need B at minimum.

### Dilemma D3: shared `#usegin` outbox vs per-engineer `#usegin-<name>`

**Decision needed:** is the outbox channel shared or per-engineer?
**Options:**
- A. Shared `#usegin` — everyone's Gin posts here, attribution via `*[via X]*`.
- B. Per-engineer `#usegin-lihu`, `#usegin-oria`, `#usegin-nitsan`.
- C. Both — shared for team-relevant, personal for "session breadcrumbs / Gin's own thinking".
**Gin's lean:** A.
**Why:** matches the `usegin/` philosophy of one-shared-brain (memory: `project_zettel_no_privacy` — "no privacy / RLS / drafts on dev-team Zettel; full team+Gin transparency by design"). Per-engineer channels recreate the privacy split we explicitly rejected.
**Price (A):** noisier channel; everyone sees everyone's Gin breadcrumbs.
**Risk:** signal-to-noise rots — `#usegin` becomes a spam channel and gets muted.
**For Lihu to weigh:** is the no-privacy principle from `project_zettel_no_privacy` load-bearing here, or do session breadcrumbs justify per-engineer split? Lean: keep it shared, mirror zettel design.

### Open gaps

- **Slack identity vs git identity:** how do we map a Slack user (`U01ABCD`) to a git config name (`Lihu Berman`) for `*[via X]*` rendering? Probably one-time `dx slack identify --slack-user U01ABCD --as=lihu` populates a mapping in `.dx/config.json`. Worth a slice of its own.
- **Threads as conversation:** if a human starts a thread asking Gin a question (e.g. replies to a Gin post in #engineering), how does Gin discover it? `dx slack inbox` filtering on threads-with-recent-replies-to-bot might be enough; needs a real test.
- **Rate limits:** Slack's tier-2 rate limits (60/min for `chat.postMessage` per channel, lower for some methods). For our volume this is fine — but `dx slack send` should retry with backoff, not panic. Standard concern, no novel risk.
- **Message edits / deletes:** Gin's posts may need correction. `dx slack edit <channel> <ts> "..."` and `dx slack delete <channel> <ts>` mirror what we'd do mentally. Not load-bearing for v1.
- **Multi-workspace:** if AskEffi later operates in a customer Slack workspace via an OAuth install, the bot-token-per-workspace assumption holds — but `dx slack` would need a `--workspace` flag and a profile system (effi-shape, not plan-shape). Defer; angle H ("auth-identity-cardinality") owns this question.

### Friction zettels captured this round

None this turn — the design landed cleanly because the existing `plan` shape mapped almost 1:1. If implementation surfaces friction (most likely: the Slack-user → git-identity mapping, or rate-limit retries blowing up), capture as `dx zettel add --as=usegin` per `project_dx_app_session_vibe`.

### Cross-cuts to other angles

- **Angle A (Unified.to):** if we go via Unified, the bot-token model still holds — Unified abstracts the auth; the CLI shape (`dx slack send/read/inbox`) doesn't change. The choice is *under* the CLI, not *of* the CLI.
- **Angle B (direct platform):** the CLI ends up calling `chat.postMessage`, `conversations.history` directly. Bolt SDK is overkill for our surface (no event handling in v1).
- **Angle E (AskEffi-Slack on our tenant):** if Effi reads our `#usegin` outbox as a data source, that's free — Effi's Slack connector ingests team channels, and `#usegin` becomes part of the project canon. Worth coordinating with E.
- **Angle F (comparative paths):** the build cost of this angle is nearly zero on either path (Unified vs direct) — it's just CLI wrapping. The decision on F isn't blocked by D.
- **Angle H (auth-identity-cardinality):** the bot-token-per-workspace model is the simplest endpoint; if our org→workspace migration introduces multi-Slack-workspace ambitions, H reopens this.
