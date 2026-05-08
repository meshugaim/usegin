---
status: design memo — feature-level, deeper than _lifecycle.md (instance-level structural picture)
authored: 2026-05-08
authored-by: claude (effi-memory R&D, this session)
references:
  - usegin/effi-memory/askeffi-app-really/_conventions.md
  - usegin/effi-memory/askeffi-app-really/_architecture.md
  - usegin/effi-memory/askeffi-app-really/_lifecycle.md
  - usegin/effi-memory/askeffi-app-really/_owners.md
---

# Effi-memory — feature design (deep)

This memo goes one layer below `_lifecycle.md` on the four moving parts
Lihu named: offline processing, gap/conflict detection (auto + manual),
persistence, runtime use. `_lifecycle.md` shows the structure; this doc
shows the choices, the bright lines, and the next experiments that
would close them.

The frame: this is a feature that gets **better the more it gets used**,
because user-corrections in chat-history are the highest-priority source.
The whole design is in service of that flywheel.

---

## 1. Offline processing

### What's the unit of work?

Three candidates, biggest to smallest:

| Unit | What it does | Cost | Idempotency |
|---|---|---|---|
| **Topic-rebuild** | Re-extract a whole topic from scratch (what we did 14× this session, manually) | High — full Effi extraction per topic, 30K+ token transcripts | Trivial — output replaces the note |
| **Topic-delta** | "What's changed about topic X since timestamp T?" — only ingest new artifacts | Medium — Effi extraction over filtered window | Needs watermark-per-topic |
| **Artifact-event** | "This new email/Fathom/JSONL just landed; which topics does it touch?" | Low — keyword/embed match + targeted update | Needs per-source cursors |

**Recommendation**: artifact-event is the right v1 unit. Topic-rebuild is
v0 (manual), retained for cold-starts and quarterly sweeps. Topic-delta
is the *batch* fallback when artifact-event misses (scheduled sweep).

The reason artifact-event wins: the cost of re-extraction grows linearly
with topics (we have 17, will have 25+); the cost of artifact-event grows
with new artifacts per day (~tens). Latter is bounded by data-source
volume; former is bounded by wiki size — and wiki size grows.

### Pipeline vs agent

Two designs for the processor itself:

- **Pure agent** — give an Effi-style agent the toolset (gmail/fathom/drive
  read + wiki write) and let it decide what to do. **Don't.** Non-deterministic
  spend, hard to debug, no idempotency without bolting it on.
- **Pipeline with agent calls only at synthesis** — deterministic stages
  (fetch → filter → match → synthesize → propose), agent invoked only at
  the synthesis stage where reasoning is load-bearing. **Yes.**

Stages, in order:

1. **Fetch new artifacts** since per-source watermarks. Cheap, idempotent.
2. **Match artifacts → candidate topics**. Embedding similarity + keyword
   match against `Current` lines + topic slug. Output: a list of
   (artifact, candidate-topics, relevance-score). Cheap.
3. **Filter low-relevance**. Threshold drops most artifacts here.
4. **Synthesize per (topic, batch-of-relevant-artifacts)**. Agent call.
   Inputs: the existing note + the new artifacts. Output: a structured
   *proposal* (see §2).
5. **Apply auto-resolvable proposals**. Update `Current` / append `History`
   for no-op / promote / supersede-via-priority-1 cases.
6. **Queue conflict-pending proposals** to the owner-ask surface.
7. **Update watermarks** + emit run-report.

### Failure modes worth designing for

- **Socket drop mid-synthesis** (we hit this twice this session). Stage 4
  must checkpoint per-topic — a partial run leaves earlier-topics committed
  + later-topics still queued. Don't lose the work that did succeed.
- **Garbled agent output**. Validate proposals against a JSON schema
  before applying. Reject malformed; queue for retry.
- **Hallucinated citation**. Every citation in a proposal must be
  resolvable against the source — a `gmail:<id>` claim is verified by
  re-reading that gmail message. The processor refuses to apply a
  proposal whose citations don't resolve. **This is non-negotiable** —
  citations without verification destroy the trust-by-default contract.
- **Duplicate processing**. Per-source cursors + per-artifact dedup keys.
  Cheaper than checking the wiki for "did I already write this?"

### Cadence

Three-tier:

- **Real-time event subscription** for chat-history (priority-1 source —
  user corrections must land fast or they get lost). Cheap because we own
  the JSONL pipeline.
- **Hourly batch** for inbound data sources (Gmail, Drive, Fathom, Linear).
  Cheap enough to run continuously, slow enough to amortize embedding /
  match cost.
- **Daily sweep** that pulls topic-delta for any topic whose
  `Last verified` is older than 7 days. Catches what events missed.
- **Quarterly cold rebuild** of any topic whose History is older than 90
  days untouched. Re-grounds drift.

### Cost discipline

Lihu's directive: *"We do not try to optimize on the time it takes to do
the offline processing. It can take three times the amount you just
suggested. Accuracy + completeness + history + citations matter more."*

This means: at the synthesis stage (#4 above), spend liberally — long
context, deep reasoning, multi-pass. The optimization is at stages #1–3
(don't pay for synthesis on artifacts that aren't relevant) and at the
read-side (Architecture B caches the index).

### Open questions on offline processing

- **OP-1** — Where does the processor *run*? Candidates: a Railway service
  reading from Supabase, a CLI invoked locally, a scheduled GitHub Action,
  a Claude-Code routine. v0 is manual one-shot in this Gin chat. v1 most
  likely a Claude-Code routine via the `schedule` skill (already exists
  in this repo); v2 lifts to a service when multi-tenant.
- **OP-2** — How does the processor *find* new artifacts? Effi already
  indexes per-source via VAIS; the processor reuses that index, OR
  subscribes to a separate per-source watermark stream. Reusing VAIS is
  cheaper but couples the processor to product-side infra. Worth measuring.
- **OP-3** — Topic-discovery vs topic-update. The processor can update
  *existing* topics easily; can it propose *new* topics? E.g. when a
  cluster of artifacts mentions "EU sales motion" but no `eu-gtm.md`
  exists. Probably yes via clustering + threshold, but not v1 scope.

---

## 2. Gap & conflict detection — auto vs manual

### The conflict bright line

Naive answer: "new claim text differs from old → conflict". Wrong.
Real cases:

| New | Old | Verdict |
|---|---|---|
| `$25K-33K/mo burn` | `$25K/mo burn` | **Refinement** — promote, no conflict |
| `$30K/mo burn` | `$25K/mo burn` | **Conflict** unless time-slice differs |
| `Team is 4` | `Team is 5` | **Conflict** — could be departure or definitional drift |
| `Mkenga active partner` | `Mkenga active partner` | **No-op** |
| `Mkenga paying customer` | `Mkenga free design partner` | **Conflict** — high-stakes, owner-ask |

Conflict detection needs **semantic** comparison, which means an LLM call.
Cheap if scoped: feed the proposed claim, the existing claim, and a
canned rubric ("is the new claim a strict refinement / corroboration / 
supersession / direct contradiction of the existing claim, or is it on
a different time-slice?"). Output: enum + brief reason + confidence.

### Source priority and the auto-supersede rule

`_conventions.md` already names the priority hierarchy (1: user-correction
in chat, 2: primary-source artifact, 3: pitch/planning, 4: inference).

Auto-supersede is allowed **only** when new is priority-1 and old is
anything else. Why so strict: priority-1 is the only source where the
ground truth is *explicit and recent and human-validated*. Everything
else can be wrong, stale, or contextual.

Auto-promote (no-op) is allowed when:
- New = old (semantic equality), OR
- New is a strict refinement of old (e.g. precision narrowing) AND new
  comes from same-or-higher priority.

Everything else — owner-ask. Keep the bar high. The cost of a wrong
auto-merge propagates to every investor pitch and customer demo; the
cost of an owner-ask is one Slack notification.

### Confidence — the missing field

Today every claim has a citation but no **confidence**. Two claims with
the same citation can have different confidence — a Fathom transcript
where Guy says "we have 5 active partners" carries more weight than a
Fathom transcript where someone *speculates* about partners.

v1 frontmatter addition:

```yaml
---
topic: design-partners
moc: market
updated: 2026-05-08
conflict_pending: false
current_confidence: high      # high / medium / low
current_priority: 2           # 1=user-correction, 2=primary, 3=pitch, 4=inference
last_reconciled_at: 2026-05-08T13:41:10Z
---
```

`updated` is human-edit time. `last_reconciled_at` is automation time.
They diverge — useful diagnostic when the wiki feels stale.

### Owner-ask UX in detail

Channel: **dedicated Slack channel `#wiki-asks`** per project (or per
team for the dogfooding wiki). Not per-conflict DMs. Reasoning: digest
per channel is bounded; DMs scale per conflict.

Message format (one per pending conflict):

```
*Topic:* design-partners
*Owner:* Guy (primary), team (fallback)
*Existing Current:* "Mkenga is the most active design partner; free tier."
*New evidence:* "Mkenga signed first paid invoice $1,200/mo, effective May 1."
  — gmail:abc123 (2026-05-04, from elsante@mkenga.com)
*Recommendation:* SUPERSEDE — new claim from priority-2 source contradicts
existing priority-2 claim by ~2 weeks; high-stakes (paid status).
*Reply with:* 
  - "yes" to apply the recommendation
  - "no" to keep existing
  - or paste corrected text
```

The reconciler reads channel replies (or a small CLI: `effi-memory resolve <id>`)
and applies the resolution. Resolution itself enters History with the
owner's citation (`chat:<slack-message-id>`).

**Cadence on the ask**: same-day DM for high-stakes (financial / compliance
/ customer-positioning); daily digest for others. High-stakes flag is
heuristic — for now: any topic whose MOC is `company` AND whose Current
mentions a number, OR any topic on the `compliance` / `pricing` / `raise`
slug list.

### Gap escalation

A gap stops being a quiet "we don't know" and becomes an owner-ask when:
- A user-question hits the gap (signal that someone outside the team
  cares), OR
- The gap has been listed for >30 days, OR
- New evidence *almost* fills it but not cleanly (the
  refining-but-uncertain case).

Mechanism: gaps get the same `#wiki-asks` treatment.

### What if the owner is wrong?

Real possibility — owner pins "burn is $20K" when bank says "$30K". The
reconciler must:

- Keep the disputed evidence in `History` even when `Current` is pinned.
- Allow a *contest* mechanism: someone else can call out a claim and
  trigger a re-resolution.
- Never silently delete contradicting evidence. The audit trail survives
  human errors.

### Open questions on detection

- **DC-1** — Conflict-detection LLM call cost. At ~tens of artifacts/day
  × ~17 topics × matching threshold, expect <100 conflict-detection calls
  per day. Cheap. But verify in the prototype.
- **DC-2** — Confidence calibration. Adding `current_confidence` is one
  thing; getting it *right* is another. v1: have the synthesis stage
  output a confidence; v2: calibrate against owner-overrides over time
  (high-confidence claims that get owner-corrected = miscalibrated).
- **DC-3** — High-stakes heuristic. The "DM same-day vs daily-digest"
  rule above is a guess. Refine after observing real conflict rates.

---

## 3. Persistence

### The two-tier picture

- **Authoring tier (markdown)** — the human-readable, git-versioned,
  greppable surface. SoT for AskEffi's own dogfooding wiki. Lives at
  `usegin/effi-memory/<instance>/`.
- **Runtime tier (database)** — for production multi-tenant Effi, each
  customer project's wiki lives in Supabase rows. SoT for customer wikis.

These look the same shape but have different SoT. Per-instance the
authoring tier dominates if the wiki is "the team's"; the runtime tier
dominates if the wiki is "the customer's project's".

### Schema for the runtime tier

```sql
CREATE TABLE memory_notes (
  project_id uuid NOT NULL,
  topic text NOT NULL,
  current_claim text NOT NULL,
  current_citations jsonb NOT NULL,    -- [{type, id, observed_at}]
  current_confidence text,             -- 'high' | 'medium' | 'low'
  current_priority int,                 -- 1..4
  history jsonb NOT NULL,              -- chronological log
  gaps jsonb,                          -- numbered list
  see_also text[],                     -- topic slugs
  conflict_pending boolean DEFAULT false,
  owner_primary text,                   -- person id or 'team'
  owner_secondary text,
  updated_at timestamptz NOT NULL,
  last_reconciled_at timestamptz,
  PRIMARY KEY (project_id, topic)
);

-- One write path: the reconciler service. RLS:
-- - service_role: full access (reconciler)
-- - authenticated readers: SELECT only, scoped to projects they have access to
```

The schema mirrors the markdown frontmatter + sections. The reconciler
is the only writer (per `_conventions.md`); RLS enforces it.

### Markdown ↔ DB sync

For the dogfooding case, markdown is SoT and DB is a derived index:
- A repo-side hook on commit serializes touched notes into Supabase.
- Or: the reconciler writes both simultaneously (markdown + DB row).

For the per-customer case, DB is SoT and markdown isn't authoritative —
we *might* periodically export to markdown for human review, but it's
read-only.

### Why not markdown all the way

Two reasons we can't make markdown SoT for production multi-tenant:
- Multi-tenancy. Customer A's wiki cannot live in our git repo (data
  segregation, RLS enforcement, deletion-on-request).
- Read latency. Reading + parsing markdown per query is bounded by
  filesystem; a Supabase row read is faster and amortizes better.

### Open questions on persistence

- **PR-1** — When does the runtime tier become necessary? Today the
  dogfooding wiki is fine in markdown. Multi-tenant Effi is when we need
  the DB. Ramp it then, not before.
- **PR-2** — Bidirectional sync direction. For dogfooding: markdown → DB
  (one-way derived). For customer: DB only (no markdown). Don't try to
  do both bidirectionally — sync conflicts kill you.
- **PR-3** — Schema versioning. As we add fields (`current_confidence`,
  `last_reconciled_at`), the schema migrates. Standard Supabase migration
  flow handles this, but the reconciler needs to be tolerant of older
  rows (default missing fields gracefully).

---

## 4. Effi runtime — tools, citations, raw-data fallback

### Tool surface

Two tools at the runtime layer:

```
memory_lookup(topic: string) -> {
  topic, current_claim, citations, current_confidence,
  current_priority, last_verified, conflict_pending, gaps, see_also
} | null
```

Slug-keyed, deterministic. Returns `null` if topic doesn't exist.

```
memory_search(query: string, top_k: int = 3) -> [{
  topic, current_claim, citations, relevance_score
}]
```

Embedding over `Current` lines + topic slugs (NOT full History — too
noisy). Returns empty list if no result crosses relevance threshold.
**Crucially**: must be willing to return empty. Effi must be able to say
"the wiki doesn't cover that" rather than force a low-relevance match.

### When does Effi call which tool

System prompt heuristic:

- **Question is current-state about a known topic** ("what's our burn?",
  "who are our design partners?") → `memory_lookup(topic)`.
- **Question is current-state but topic is fuzzy** ("are we compliant?",
  "what's our security story?") → `memory_search(query)` to identify
  candidate topics, then `memory_lookup` on each.
- **Question is episode-level** ("what did Elsante say in the May 5
  call?", "what was the response to the security review?") → skip wiki,
  go straight to raw-data tools (canon-browse / VAIS-search).
- **Question is mixed** — wiki first for current state, then raw-data
  for episode detail. Effi should cite both.

The Architecture B preload (MOCs in system prompt) means tool selection
is *"which `notes/<topic>.md`s does this question route to?"* in one
batched round-trip — that's the TTFT win from `_architecture.md`.

### Citation contract — uniform across wiki and raw-data

End user sees the same citation render whether the answer came from
wiki or raw-data:

```
The team's burn is ~$25–33K/mo [drive:abc123][drive:xyz789].

Mkenga is the most active design partner — Hudson Technologies'
Legal Team uses Effi for project-status queries [gmail:b6e37568].
```

Click-to-open per type:
- `gmail:<id>` → Gmail thread
- `fathom:<id>` → Fathom recording (timestamp if present)
- `drive:<id>` → Drive doc
- `linear:ENG-<n>` → Linear issue
- `attachment:<id>` → indexed attachment viewer
- `chat:<id>` → past Effi conversation

The user shouldn't be able to tell whether the answer came from wiki or
raw-data — both are equally substantiated. **Citation parity is the
trust contract.**

### Raw-data fallback triggers

Effi falls through to raw-data tools when:

1. `memory_lookup` returns null (topic not in wiki).
2. `memory_search` returns empty / below-threshold.
3. The note has `conflict_pending: true` and the question is exactly the
   contested claim → Effi should *surface the conflict*, not pick a side.
4. The note's `current_confidence` is `low` and the user is making a
   high-stakes decision (we don't have a signal for this; punt).
5. The note's `last_verified` is older than a topic-specific freshness
   threshold (e.g. `financials.md` ages out in 7 days; `north-star.md`
   is stable for 90).
6. The question requires sub-Current granularity (episode-level detail).

In cases 1–2, raw-data answers stand alone. In cases 3–6, Effi should
*also* mention the wiki state ("our wiki says X, but the most recent
data shows Y") — transparency wins.

### The chat-history feedback loop — the load-bearing insight

This is what makes the feature compound:

1. User asks Effi a question.
2. Effi answers from wiki (if covered) or raw-data (if not).
3. Conversation enters the JSONL.
4. Reconciler reads the JSONL on next pass.
5. **User correction** ("no, it's actually $30K not $25K") becomes a
   priority-1 source artifact.
6. Reconciler auto-supersedes the wiki claim.
7. Next user gets the corrected claim faster (wiki path, not raw-data
   path).

**The wiki gets better the more Effi gets used.** Every conversation is
a potential reconciler input. This is the moat — competitors who treat
their wiki as an authoring artifact (not a feedback substrate) won't
benefit from usage the same way.

Implication for the chat product: Effi should make corrections *easy*.
A "this is wrong, here's the truth" affordance in the UI surfaces the
correction explicitly to the JSONL with a structured tag, so the
reconciler can promote priority-1 immediately rather than parsing it
from natural-language disagreement.

### Latency budget

| Path | Target |
|---|---|
| `memory_lookup` (Supabase row read or md parse) | <100ms |
| `memory_search` (embedding query + top-k filter) | <300ms |
| `raw_data_search` (VAIS) | 1–3s today |
| End-to-end TTFT for a wiki-grounded answer | <5s (per `_architecture.md`) |
| End-to-end TTFT for a raw-data-fallback answer | unchanged from today |

Wiki path is ~10× faster than raw-data path for current-state questions.
That's the user-perceptible value.

### Open questions on runtime

- **RT-1** — Citation rendering: do we need a uniform `effi://citation/<type>/<id>`
  resolver, or does the client render each type natively? Probably native
  per type; build the resolver only if a third citation surface joins
  (web app, Slack, mobile).
- **RT-2** — `memory_search` index. Embeddings over `Current` lines? Or
  also include History? Current alone is cleaner (low-noise, "what is
  true now"). History adds historical-context queries but at a cost.
  Default: Current only; History on opt-in flag.
- **RT-3** — How does Effi *choose* between the wiki path and raw-data
  for a fuzzy question? The system-prompt heuristic above is a starting
  point, but real questions are messy. v1 lets Effi try both in parallel
  for high-stakes queries; v2 learns the routing from outcome data.

---

## The load-bearing question for v1

**Where does the offline processor run, what's its budget, what does it
output?**

Because:
- Cadence determines staleness ceiling.
- Output shape determines the auto-vs-manual line.
- Deployment determines when multi-tenancy becomes the dominant constraint.

We have evidence on the runtime side (experiments 001 + 002 exercised
Architecture B). We have evidence on the *quality* of curated wikis
(this session built 17 topic notes by hand). **We have zero evidence on
the offline processor's automation shape.** That's the gap.

### Next experiment — exp 004

A v0.5 offline processor prototype, scoped to ONE topic to keep the
blast radius small. See `usegin/effi-memory/experiments/004-offline-processor-prototype/PLAN.md`.

Core question: **on a real topic, does an artifact-event pipeline produce
a wiki-correct proposal, automatically?**

Pick `notes/activity.md` as the test topic — it's the freshest, changes
most often, and was just built so we have a known-good starting state.
Watermark it; feed in new gmail/fathom artifacts since the watermark;
have the prototype emit a *proposal*, not a write. Compare proposal
against what a manual extraction would have produced.

If the prototype works on `activity` it likely generalizes. If it fails
we learn whether the failure is in matching, synthesis, or proposal
shape — each of which is a separate fix.

---

## What's NOT in scope at v1

- Cross-instance reconciler (one shared service serving multiple wikis).
- Proposal-review web UI (Slack channel + CLI is enough until volume
  forces a UI).
- LLM-based gap discovery (proposing *new* topics, not just updates to
  existing ones).
- Confidence calibration training loop (we'll add the field, not learn
  it adaptively yet).
- Multi-tenant DB schema rollout — not until production Effi serves
  customer wikis.

---

## Reading order for a new contributor

1. `_conventions.md` — note shape (5 min).
2. `_architecture.md` — retrieval/latency, Architecture B (5 min).
3. `_lifecycle.md` — structural picture of the four moving parts (10 min).
4. `_owners.md` — topic→owner map (3 min).
5. **This doc** — deeper choices + bright lines + open questions (20 min).
6. `experiments/004-offline-processor-prototype/PLAN.md` — the next
   thing we'd build to close the biggest gap.
