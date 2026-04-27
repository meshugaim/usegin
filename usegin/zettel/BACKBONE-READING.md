# Backbone Reading — what exists today vs. the Apr 23 commitment

**Date:** 2026-04-27
**Author:** usegin (session run from main)
**Frame:** Per z032 (D-coord lean — build first, then converge), we need to
know what the convergence target *actually looks like* before slice 2 of
`dx zettel` invests in a schema that may diverge from Oria's
`Notes/Decisions/Action Items` data type. The Effi Historian whiteboard
(`RD/effi-historian/whiteboard.md`) cites the Apr 23 2026 feature-prio
meeting as the team-decided "backbone" we should reuse.

**TL;DR:** the backbone is a **commitment, not code**. Nothing tagged
"Notes/Decisions/Action-Items data type" exists in the repo, the migrations,
or Linear today. The pieces that *do* exist (the `action_items` table,
the `conversations` table, ENG-5335 chat-history) are adjacent — they
share *names* but not the *shape* of what was promised at the Apr 23
meeting.

---

## 1. What exists in the codebase today

### 1.1 `action_items` table — exists, but **not** the Apr 23 backbone

- **File:** `supabase/migrations/20260316212334_create_action_items_table.sql`
- **Origin:** ENG-2797 (Phase 1 of the project-risk pipeline), shipped
  March 16 2026 — five weeks before the Apr 23 meeting.
- **Shape:**
  ```
  id, project_id, title, description, context, prompt,
  status (new|seen|discussed|dismissed|done),
  priority (high|medium|low),
  outcome (action|clear|skipped),
  assessment_run_id, created_at
  ```
- **RLS:** `SELECT only` for end users; **service role writes** during
  generation. End users cannot insert.
- **Producer:** `python-services/agent_api/assessments/action_item_runner.py`
  — an LLM-driven assessment pipeline. Mirrors the `risks` table.
- **Consumer:** `nextjs-app/lib/action-items.ts` (typed read-only for
  workspace project cards) + `nextjs-app/components/stale-action-dialog.tsx`.
- **Why this is *not* the backbone:** the Apr 23 commitment was
  *"Direct Input: A new data type for logging information directly"* — i.e.
  a **user-write** surface. Today's `action_items` is **read-only for
  users**, written only by the assessment LLM. Same word, different
  semantics.

### 1.2 No `notes` table. No `decisions` table.

Searched all 200+ migration files in `supabase/migrations/`. Full table
inventory grep shows zero matches for `CREATE TABLE notes`,
`CREATE TABLE decisions`, `CREATE TABLE decision_records`,
`CREATE TABLE user_notes`, etc.

### 1.3 No `save-chat` tool, command, or branch.

- `find tools/ -type d -iname 'save-chat'` → empty.
- `grep -r 'save.?chat\|saveChat\|save_chat'` across `nextjs-app/`,
  `python-services/`, `tools/` → only matches are inside
  `.claude/memory/project_zettelkasten_rd_track.md` (planning doc).
- No branch named `*save-chat*`, no commit since 2026-04-15 mentioning it.

### 1.4 What exists adjacent: `conversations` + ENG-5335 (CLI chat-history)

This is the **closest thing to "save chat" that's actually shipping**, but
it's a different shape:

- **Table:** `conversations` (user_id, project_id, claude_session_id,
  created_at, updated_at + Apr 24 additions: `title TEXT`, `archived_at
  TIMESTAMPTZ`).
- **Storage:** raw JSONL transcripts in the `conversations` Supabase
  storage bucket, uploaded end-of-turn by
  `python-services/agent_api/chat/conversation_service.py:persist_session`.
- **API surface:** `GET /api/v1/conversations` (list, search, paginate)
  shipped behind toggle `chat-history`. `PATCH` for rename/archive
  shipped in ENG-5363.
- **CLI surface:** `effi chat-history list / show / rename / archive /
  unarchive / resume` (via `tools/effi-cli/src/commands/chat-history.ts`).
- **Toggle:** server-driven, single-entry-point gate — feature
  invisible until enabled.

Crucially: this is **chat metadata + transcript persistence**, not a
"save this chat as project knowledge" surface. The semantic act in the
Apr 23 framing is *"this conversation produced a decision/insight worth
keeping; promote it"*. ENG-5335 keeps every chat by default and lets you
*rename/archive* — much weaker than "save as project data with
visibility controls" (Apr 23 commitment).

### 1.5 The dev-team Zettel slice 1 — already shipped (this session)

For completeness — what we already built that needs to converge with
whatever Oria/Nitsan ship:

- **Storage:** markdown files at `usegin/zettel/zettels/z<NNN>-slug.md`.
- **CLI:** `dx zettel add / show / list / link` (in
  `tools/dx/src/zettel/`).
- **Schema** (TypeScript, `tools/dx/src/zettel/types.ts`):
  ```
  id (z003-style), title, type, authoredBy, threads (placement|cross),
  created (YYYY-MM-DD), session, body, path
  ```
- **No DB writes**, no API, no UI. Per z034: "markdown + git" was the
  explicit slice-1 decision; Supabase is slice-2.
- **Producer:** humans + Claude via CLI; Wispr Flow as voice rail.
- **Consumer:** `dx zettel show/list` + `rg` against the directory.

---

## 2. What's in flight (Linear + branches)

| Issue | Status | Owner | Relation to backbone |
|---|---|---|---|
| ENG-5335 cli-chat-history (browse/rename/search) | Backlog (parent); sub-issues Done | Mark | **Adjacent** — different shape than Nitsan's "save chat as project data" Apr 23 commitment. Persists ALL chats; doesn't promote selected chats to "project knowledge". |
| ENG-5364 chat resume across redeploys | Backlog (slices 0–1 done; 2–4 pending) | (Nitsan-territory in chat infra) | Resilience plumbing — not the user-facing "save chat" surface Nitsan was assigned. |
| ENG-5019 stream richer chat events | In Progress | Nitsan | Tool-call/thinking visibility — orthogonal to backbone. |
| ENG-5379 Zettelkasten R&D | Backlog (8 of 9 sub-issues Done) | (us) | Parent of slice-1 work; the "convergence with backbone" question lives here. |
| ENG-5398 Gin cleanup agent | Backlog | (us) | Sub of ENG-5379; not backbone. |

**No Linear issue** for Oria's *"Design Notes/Decisions/Action Items
data type; implement CLI; add UI"* assignment from the Apr 23 meeting.
**No Linear issue** for Nitsan's *"Develop a 'save chat' feature,
starting with an opt-in model"*. The Effi Historian flagged that "Linear
is not indexed for this project" — a direct `plan list` query
(`grep -iE 'note|decision|save.?chat|action.?item|backbone'`) returns
only ENG-5379 and one unrelated `decision:` chore.

**Read:** the Apr 23 commitments are **not yet ticketed**. They're
floating between the Fathom recap and someone's mental queue. This is
itself the most actionable convergence finding — see Convergence Options
below.

### 2.1 Recent commits (since 2026-04-15) touching this space

```
27cfd9691 test(chat-history): server↔CLI round-trip for display_title
eb1459858 zettel(z020) + wispr(settled): decision-shape-in-claude-md
56d321fe2 docs(decisions): 0015 — Fathom is per-recorder, not per-team
f256c9a62 docs(decisions): 0014 — stale user-action shows dialog
```

The `docs(decisions)` commits write to `docs/decisions/0015-*.md` —
markdown ADRs in the repo, not a DB table. **This is yet another
in-repo "decisions" surface** that already exists alongside ours. See §3.

---

## 3. Schema overlap — `dx zettel` slice-1/slice-2 vs. existing surfaces

| Field / concept | `dx zettel` (slice 1) | `dx zettel` slice-2 (planned, pgvector) | `action_items` (existing) | `conversations` (existing) | `docs/decisions/*.md` (existing) | Apr 23 backbone (intended) |
|---|---|---|---|---|---|---|
| Primary key | `z003`-style sequential | UUID + `z003` display id | UUID | UUID | filename `0015-*.md` | unknown |
| Author / actor | `authored-by: human\|usegin\|consultant` | same | (system; no user) | `user_id` (auth.users) | (git author) | unknown — likely `user_id` |
| Scope / tenancy | global (one shared brain, z028) | global with optional `kind` discriminator | `project_id` (per project) | `user_id`+`project_id` | repo-global | per `project_id` (per Apr 23 framing) |
| Threading / links | `threads: [↑z003, ~z015, ~ENG-5379]` | edges table; recursive CTE walks | `assessment_run_id` only | `claude_session_id` only | manual cross-refs in body | unknown |
| Body | markdown | markdown + embedding | `description` (TEXT) + `context` (TEXT) | (transcript JSONL in storage) | markdown | "data type" — unknown |
| Status / lifecycle | none (forward-only versioning, z039) | versioning bumps | `status (new\|seen\|discussed\|dismissed\|done)` | `archived_at` | none | unknown |
| RLS write surface | filesystem (no DB) | TBD — workspace-scoped | service-role only | user-owned | git push | end-user write (per Apr 23 *"write to Effi"*) |
| Visibility control | none (one shared brain) | none planned | per-workspace toggle | per-user | repo-public | "internal/external" per Apr 23 |

**Overlap signal:** the *atomic-content + threading* shape of `dx zettel`
has **no current sibling in the DB**. `action_items` is closest by name
but it's a structured project-task record (title + priority + status +
outcome), not an atomic associative note. `docs/decisions/*.md` is
closest by filesystem-shape (markdown ADRs in the repo) but they're
*formal*, *per-decision*, and tracked in a different convention
(Markdown ADR template, numeric counter, no front-matter threads).

**Divergence signal:** the Apr 23 backbone presumably needs `project_id`
(it's a user-facing data type per project) and `visibility` ("internal /
external"). Our slice-1 zettels have neither (z028 — one shared brain;
no privacy). If the backbone arrives shaped per-project per-visibility,
**we cannot trivially merge** — our zettels would need a synthetic
`project_id` (the AskEffi App project? a fake "dev-team" project?) and
visibility=internal default.

---

## 4. Convergence options

The convergence target genuinely doesn't exist yet — Oria's Apr 23
assignment is unbuilt and unticketed. So "what does integration look
like" is **partially a forward-looking design choice we still get to
shape**, not a reverse-engineering exercise. Three live options:

### Option A — Shared Supabase table with `kind`/`scope` discriminator

- **Shape:** one `notes` table with `kind ENUM ('zettel','note','decision','action_item')`, `scope ENUM ('dev-team','project')`, optional `project_id`, optional `visibility`.
- **`dx zettel`** writes rows with `kind='zettel'`, `scope='dev-team'`,
  `project_id=NULL`. Oria's UI writes `kind='note'|'decision'|'action_item'`,
  `scope='project'`, `project_id=<...>`.
- **Pro:** one shared brain literally — slice-2 retrieval queries (vector
  top-k → recursive walk) span both corpora. The Effi-eats-its-own-2nd-brain
  vision (per ENG-5379 mandate) becomes free.
- **Con:** requires Oria to commit to a schema that includes our weird
  fields (`threads` JSON, `authored-by` enum that includes `usegin`).
  Negotiation surface is wider. RLS gets complicated (dev-team rows must
  be readable to anyone in the AskEffi workspace, not just project
  members).
- **Risk:** if the Apr 23 backbone ships first (without us in the
  conversation), they'll pick a schema that doesn't have a slot for our
  shape, and "convergence" becomes a migration.

### Option B — Separate tables with a sync layer

- **Shape:** `zettels` table (ours) and `project_notes`/`project_decisions`/`project_action_items` (theirs) live independently. A sync layer
  promotes selected zettels into project-notes (or vice versa) when
  scope changes.
- **Pro:** neither team blocks the other. Each schema is exactly right
  for its use case. The sync layer is the only contract surface.
- **Con:** retrieval is split — querying "what does the team know about
  X" requires hitting two tables. Vector index lives in two places.
  Sync drift becomes a class of bug we don't have today.
- **Risk:** "I'll sync it later" rarely happens. Two stores diverge
  silently.

### Option C — Export pipeline only (zettels → Notes)

- **Shape:** `dx zettel` stays markdown-on-git forever. A new command —
  `dx zettel promote <id> --to project-note --project <id>` — POSTs the
  zettel to Oria's API surface as a project note. One-way export.
- **Pro:** zero coupling to the backbone schema. Slice 2 (pgvector) can
  proceed independently. The convergence is a *workflow* (export when a
  zettel becomes load-bearing for a customer), not a *schema*.
- **Con:** the team-internal 2nd brain stays separate from the
  product-side 2nd brain forever — violates ENG-5379's stated long-term
  vision ("Effi gets an interface to manage her own 2nd brain in the
  same way"). Two sources of truth.
- **Risk:** export is lossy by definition (threads in our world don't
  map to project-notes); the *"why"* lives in zettels and stays there
  even after the *"what"* is exported.

---

## 5. Bringing the dilemma to Lihu (z026 shape)

> **Decision needed:** How should the dev-team Zettel (ours, in flight)
> converge with Oria's `Notes/Decisions/Action Items` data type
> (committed Apr 23, not yet ticketed or built)?
>
> **Options:**
> A — Shared Supabase table with `kind`/`scope` discriminator (one brain,
>     literally — but requires Oria to accept our schema's weird fields).
> B — Separate tables + sync layer (no blocking, but a sync layer is
>     a class of drift bug we don't have today).
> C — Export pipeline only (zettels stay markdown forever; "promote to
>     project-note" is a CLI verb).
>
> **usegin's lean:** **A — but only after a demo conversation, not before.**
>
> **Why:** The Apr 23 backbone is a *commitment, not code*. There is no
> Linear ticket, no migration draft, no in-progress branch. The schema is
> still in Oria's head. This is the cheapest possible moment to reshape
> it — much cheaper than after she ships v1. A 30-minute demo of `dx
> zettel add` + show + list, plus a sketch of the slice-2 graph
> retrieval, gives Oria & Nitsan the missing concrete reference point
> their data-type design needs. The risk z032 names — "arriving with a
> working prototype could feel like an end-run" — is real, but
> *bigger* if we wait until they've ALSO built something to defend.
>
> **Price:** ~one hour of Oria & Nitsan attention for the demo, plus
> negotiation cost on the shared schema (workspace RLS is the gnarly
> part). Adds a week to slice 2 in exchange for not having to migrate
> twice.
>
> **Risk:** if they say "no, we want our shape" and we accept Option B/C,
> we've spent a week of discovery for a "no". Mitigation: arrive at the
> demo with Options B and C explicitly on the table — Lihu doesn't have
> to be the one carrying the alternatives, the demo can.
>
> **For you to weigh:**
> - **Timing of the demo** — z032 says you own when to surface the
>   "ready to converge" trigger. Slice 1 ships today; slice 2 (pgvector
>   substrate, ENG-5381) is weeks away. Demo now, or wait until slice 2
>   is dry-runnable so the retrieval story is more concrete?
> - **Who initiates** — usegin pings Oria & Nitsan directly (consistent
>   with "build first, then converge") vs. you frame the convergence
>   in your next 1:1 with each (consistent with "you own coordination
>   capital").
> - **Whether to ticket the Apr 23 commitments yourself** — the
>   `Notes/Decisions/Action Items` and `save-chat` assignments aren't in
>   Linear. If Oria is waiting on capacity / blocked on something, they
>   may stall. Filing the issue (with you as the author) reframes from
>   "are you doing this?" to "here's the issue, here's the demo, want
>   to align?".

---

## 6. The smallest demo we could show Oria & Nitsan

Per D-coord lean: a working demo earns convergence cheaper than a spec
conversation. Today's shippable demo, with no further dev work:

### 6.1 The 5-minute demo script

1. **Open a terminal.** `dx zettel add "Fathom is per-recorder — a single OAuth covers one user's scope, not team coverage" --title "Fathom is per-recorder, not per-team"` — show it lands in `usegin/zettel/zettels/zNNN-...md` instantly.
2. **Show the file.** Open the resulting markdown — 8-line frontmatter, body, threads. *"This is a zettel — atomic claim, threaded."*
3. **`dx zettel link <new-id> z015 --placement`** — show that linking is one command, frontmatter updates in place.
4. **`dx zettel list --by usegin`** — show that filtering by author works; show the 40 existing zettels including the seed corpus.
5. **`dx zettel show 32`** — show retrieval-by-prefix; show that our z032 (the *coord-vs-doc decisions* zettel) has the full decision shape (Why / Price / Risk / Alternatives).
6. **Open the corresponding `docs/decisions/0014-*.md`** — show the *parallel* surface that already exists for formal product decisions, and contrast: zettels are *thinking-in-public* + atomic; ADRs are *formal* + per-decision.
7. **Pivot to the proposal.** *"This is the dev-team flavor. The Apr 23 backbone is the project-team flavor. Three options for how they relate — A/B/C — leaning A. What's the shape of the data-type you've been sketching, Oria?"*

### 6.2 Why this is the right "smallest demo"

- **No new dev work** — slice 1 is already shipped. The demo *is* the
  proof that the lean direction works.
- **Concrete enough to react to** — they see actual frontmatter, actual
  CLI ergonomics, actual file paths. Not a wireframe.
- **Asks the convergence question with options on the table** — Lihu
  isn't the one carrying A/B/C alone; the demo carries them.
- **Doesn't lock anything** — if Oria says "actually our Notes data type
  needs `due_date` and `assignee`, we don't see how zettels merge in,
  let's go Option C", we've lost an hour and learned the right thing
  early. If she says "wait, your `threads` field is exactly the
  associative-link primitive I was about to design — let's share a
  table", we've saved a month.
- **Surfaces the un-ticketed work** — by the end of the meeting, the
  Notes/Decisions/Action-Items issue and the save-chat issue should
  exist in Linear (filed by Oria/Nitsan, owned by them, with us
  CC'd) — that alone is a win.

### 6.3 Followup — the demo opens, doesn't close

After the meeting, regardless of A/B/C choice, write a z020-shape
decision zettel in `usegin/zettel/zettels/` recording what was decided
and why. Thread it from z032 (replaces the "convergence is deferred"
note with the actual outcome). That zettel becomes the spec input for
slice 2.

---

## 7. Friction captured (will land as zettels)

- **z041 candidate:** "Linear is invisible to Effi — every zettel that
  references an ENG-XXXX is a corpus dead-end until ENG-5396 lands"
  (the Effi Historian flagged this; reconfirmed by my `plan list`
  needing direct CLI calls because Effi can't surface it).
- **z042 candidate:** "The Apr 23 backbone is a *commitment in a Fathom
  recap*, not in Linear. The team's "decisions live where the work is"
  principle (z032) breaks when the work hasn't started — there's no
  artifact to attach the decision to. Filing the Linear issue *is* the
  artifact, even if the work doesn't start for weeks."
- **z043 candidate:** "Two surfaces named 'decisions' already exist in
  the repo (`action_items` table for risk pipeline + `docs/decisions/*.md`
  for ADRs). Adding a third (Apr 23 backbone) without renaming or
  reconciling will compound the namespace problem. usegin should
  surface this in the demo."

These are not yet written as zettels — flagging here so the next
organizing pass captures them.
