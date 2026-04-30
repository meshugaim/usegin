# Plan — Inbox app for Lihu (async Q&A surface)

**Authored:** 2026-04-30 by Zisser
**Pour origin (verbatim, via Gin-main):**
> "Give me an app that will help me manage. You will have an inbox, and I
> will have a nice experience answering your questions. You can put there
> an LLM. You can put there another ZSR. You can send someone to work on it.
> You should do everything. You are free to establish everything and lay
> any foundation to make us more productive, more effective, more
> collaborative, more communicative. Write those values somewhere."

**Connects to:**
- z113 (`usegin/zettel/zettels/z113-bidirectional-comfort-feedback-gin-human.md`)
  — the bidirectional comfort/feedback channel. The Inbox is *one*
  materialization of that.
- `tools/bin/question` + `parking-question` skill — Lihu→Gin non-blocking.
  The Inbox is the inverse + persistent surface: Gin→Lihu non-blocking,
  *with state*.
- Values doc (`usegin/values.md`) authored same turn — "more
  communicative" + "lower-friction always" are the reason this exists.

## What this is (and isn't)

**Is:**
- A persistent table of questions agents have parked for Lihu, with
  state, draft answers, and a low-friction surface for him to answer.
- Async: Lihu answers when he's at the keyboard; agents read back later.
- Source-of-truth for "what's pending Lihu's input across all of Gin's
  work."

**Isn't:**
- Not a chat. No threading, no real-time. Each row is a parked Q with
  an addressee + an answer + a status.
- Not a replacement for `parking-question`. That's the *other* direction
  (Lihu→Gin, ephemeral, in-session). The Inbox is Gin→Lihu, persistent,
  cross-session.
- Not a productivity app. Lihu doesn't curate it; it curates itself.

## Domain model

```
agent_questions
  id              uuid pk
  asked_by        text          -- agent name (e.g. "zisser", "wes",
                                --   "gin-main", "consultant")
  asked_for       text          -- addressee, default "lihu"
  asked_at        timestamptz   -- when the question was parked
  question        text          -- the Q itself (verbatim from agent)
  context         text          -- link to charter/plan/zettel/issue, or
                                --   inline context (1-3 sentences)
  urgency         text          -- "low" | "normal" | "blocking"
  draft_answer    text          -- LLM-suggested answer (S4+); nullable
  status          text          -- "open" | "answered" | "stale" | "wontfix"
  answered_by     text          -- who answered (default "lihu")
  answered_at     timestamptz   -- when
  answer          text          -- Lihu's answer (verbatim)
  comfort_axis    text          -- (S5+) "ask" | "friction" | "gratitude"
  visibility      text          -- "team" | "lihu-only" (default "team"
                                --   per project_zettel_no_privacy memory)

indexes:
  (status, urgency, asked_at desc)  -- inbox view
  (asked_by, asked_at desc)         -- per-agent thread
  (asked_for, status)               -- per-addressee inbox
```

## Slices (vertical)

Walking skeleton = **S0 + S1 + S2 + S3**. One question end-to-end. Then
S4 (LLM draft) and S5 (comfort axis) follow.

### S0 — schema + migration (foundation)

- Supabase migration creating `agent_questions` table + indexes above.
- RLS: per `project_zettel_no_privacy` memory, no privacy by default —
  team-readable, team-writable. Lihu-only flag for the rare exception.
- Seed: zero rows.
- Tests: unit on the migration shape (column presence, defaults, indexes).

**Done when:** `bunx supabase migration up` applies cleanly local; one
hand-written `INSERT` round-trips through `SELECT`.

### S1 — ingest CLI (`ask-lihu`)

- New script `tools/bin/ask-lihu` (bash → calls `dx` or direct supabase
  insert via service role; pattern-clone from `tools/bin/question`).
- Usage:
  ```bash
  ask-lihu "should we use Postgres or sqlite for the inbox?" \
    --context "zisser/plans/2026-04-30-inbox-app-...md" \
    --urgency normal
  ```
- Defaults: `--asked-by` from `git config user.name` or `$AGENT_NAME`;
  `--asked-for lihu`; `--urgency normal`.
- Output: prints inserted row id + URL to inbox page.

**Done when:** `ask-lihu "test"` puts a row in, prints id + URL.

### S2 — minimal Next.js inbox page

- New route: `nextjs-app/app/inbox/page.tsx` (server component) +
  `[id]/page.tsx` for detail/answer view.
- Auth: Lihu-only initially (workspace owner check; use existing patterns
  from other admin pages).
- List view: open Qs grouped by `urgency` (blocking → normal → low),
  showing asker, age, question, context-link.
- Detail view: question + context + textarea for answer + status
  buttons (answer & close / stale / wontfix). On submit, write back
  to DB.
- No LLM in S2. Plain textarea.
- Tests: component test on list + detail; nextjs-db test on the answer
  flow.

**Done when:** Lihu can see one parked question on `/inbox`, click it,
type an answer, submit, and the row updates.

### S3 — read-back CLI/surface for agents

- New script `tools/bin/inbox-status` — query open/answered Qs scoped by
  asker:
  ```bash
  inbox-status                          # all my parked Qs
  inbox-status --status answered        # my answered ones
  inbox-status --question-id <uuid>     # specific Q
  inbox-status --watch                  # block until answered
  ```
- Default `--asked-by` from same source as `ask-lihu`.
- Output: TSV by default; `--json` for programmatic use.

**Done when:** Spawning Zisser can `ask-lihu "Q"` then later
`inbox-status --question-id <id>` to see Lihu's answer.

### S4 — LLM-suggested draft answer (post-skeleton)

- Background worker (Python `agent_api` slot, or just an API route that
  fires on insert) that reads the question + context-link contents and
  generates a 3-4 sentence draft using Claude Haiku.
- Draft lands in `draft_answer` field; Lihu sees it pre-filled in the
  textarea, edits or accepts.
- Cost-bounded: cap context fetch to ~5KB; cap completion to 400 tokens.

### S5 — comfort axis (z113 materialization)

- Add `comfort_axis` column usage. New CLI: `gin-feedback "Lihu, this
  is uncomfortable: <X>" --axis friction` — Gin→Lihu friction note
  surfaces in the same Inbox with axis tag.
- UI: a separate filter pill on `/inbox` for "comfort signals" vs
  "questions."
- Closes the bidirectional channel z113 sketches.

## Constraints

- **No production code from Zisser.** I write the spec + charter; Gin
  (via Wes) builds. (Not deviating from the rule even though Lihu
  authorized "lay any foundation" — the rule is what makes "lay any
  foundation" safe to grant.)
- **Walking skeleton today, not full feature.** S0+S1+S2+S3 is the
  bar for "one Q end-to-end." S4+S5 are next-day work.
- **No new auth model.** Use whatever AskEffi already does for
  workspace-owner-only pages.
- **No deploys.** Land on `main`. Lihu promotes when ready.
- **Migrations land local-only today.** Don't apply to staging/prod.

## Linear shape (created 2026-04-30)

- **ASK-5** (parent): `feat(inbox): async Q&A surface for Lihu`
  - **ASK-6** S0: `feat(inbox): S0 — schema migration + agent_questions table`
  - **ASK-7** S1: `feat(inbox): S1 — ask-lihu CLI ingest`
  - **ASK-8** S2: `feat(inbox): S2 — minimal Next.js inbox page (no LLM)`
  - **ASK-9** S3: `feat(inbox): S3 — inbox-status read CLI for agents`
  - **ASK-10** S4: `feat(inbox): S4 — LLM draft answers (post-skeleton)`
  - **ASK-11** S5: `feat(inbox): S5 — comfort axis (z113 materialization)`
- **ASK-12** (separate chore): `chore(values): authored usegin/values.md`

## Dispatch shape

Charter in `zisser/dispatched/2026-04-30-inbox-app-walking-skeleton-wes.md`.
**Parked, not dispatched** — Agent tool unavailable in this Zisser
sub-agent context (4th confirmation, see z114). Gin-main (the parent of
this Zisser invocation) has the Agent tool and should spawn Wes against
that charter today.

## Open for Lihu

- ↑ Q1: Confirm route shape — `/inbox` (Lihu's personal inbox under
  the workspace), or `/admin/inbox`, or its own subdomain? Default
  on lack of answer: `/inbox` Lihu-only via workspace-owner auth check.
- ↑ Q2: Should Effi (the customer-facing agent) also be able to ask?
  Default on lack of answer: yes, with `asked_by="effi:<workspace_id>"`
  but Lihu-only visibility (no spillover to other workspaces).

## Connection to existing work

- **`tools/bin/question` stays.** Different direction (Lihu→Gin,
  in-session). The Inbox doesn't replace it.
- **z113** (bidirectional comfort) — S5 is the implementation of the
  Gin→Lihu side of z113.
- **`parking-question` skill** — its inverse is what we're building; the
  doc in `parking-question/SKILL.md` should eventually link to the
  Inbox doc once S0+S1 are live.
