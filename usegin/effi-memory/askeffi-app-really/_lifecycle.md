---
status: v0 partly-built (wiki substrate); v1 lifecycle largely unbuilt
decided: 2026-05-08
decided-by: lihu + claude (effi-memory R&D, this session)
---

# Effi-memory — feature lifecycle

End-to-end picture of the feature: how raw data becomes a curated claim, how
the curated claim stays accurate, where it lives, how Effi uses it at runtime,
and how a human owner gets pulled in when the system can't decide alone.

Companion docs:
- [_conventions.md](_conventions.md) — note shape, citation format, conflict-handling rules
- [_architecture.md](_architecture.md) — retrieval & latency (Architecture B, TTFT)
- [_owners.md](_owners.md) — topic→owner map (resolves O-1)
- [../DESIGN.md](../DESIGN.md) — feature-level deep-design memo: bright lines, open questions, next experiments. Read this for the *choices*; this file shows the *structure*.

## One-line picture

```
raw data ── offline processor ──▶ reconciler ──▶ wiki (md, SoT)
   │              │                    │              │
   │              │                    └─owner loop───┤
   │              ▼                                   ▼
   │         conversation JSONLs                 derived index ──▶ Effi runtime
   │         (highest-signal source)             (Supabase, v1)         │
   │                                                                    ▼
   └────────── raw-data fallback (when wiki gap / low confidence) ◀─────┘
```

Five moving parts. Three are largely v1 (offline processor, reconciler with
auto resolution, runtime tools). Two have a v0 footprint already (wiki +
manual extraction).

## 1. Offline processing

What ingests raw data and proposes wiki updates. **Never inline with a user
question.** Effi's runtime path stays read-only against the wiki.

**Sources, in priority order** (per `_conventions.md` source-of-signal hierarchy):

1. Conversation JSONLs (Effi's own session transcripts) — user corrections
   are validated ground truth. *"Actually our burn is closer to $30K"* is
   higher signal than any deck. Cheapest to subscribe to, since they land
   in our own infra.
2. Primary-source artifacts — emails / Fathom recordings / Drive files /
   Linear issues authored by an authoritative party.
3. Pitch / planning docs — useful for framing, often stale on numbers.
4. Inference from indirect signals — last resort, mark as such.

**Trigger model — hybrid** (per `_architecture.md`):

- Event-triggered: new datum arrives in an indexed source, or an Effi
  conversation closes.
- Scheduled sweep: periodic pass for what events missed, plus
  re-verification of `Last verified` timestamps drifting past threshold.

**v0 reality**: manual one-shot extraction, exactly like the 12-question
authoring pass that built the current wiki. No cron yet — Lihu's
explicit directive: prove the substrate before automating.

**v1 shape — when we build it**: a scheduled agent that wakes, runs
extract-per-topic against the dogfooding-effi project, diffs against the
current note, and produces a *proposal* per affected note. Not auto-merge.
The `schedule` skill exists for the cron half.

**Cost discipline** — extraction is allowed to take 3× the obvious budget;
accuracy + completeness + history + citations beat speed (Lihu directive).

## 2. Gap & conflict detection — auto vs manual

The reconciler reads a proposal from the offline processor and decides one
of four actions per claim:

| Reconciler action | Trigger | Auto-resolvable? |
|---|---|---|
| **No-op** | Proposal matches `Current` exactly | yes |
| **Promote** | Proposal is newer + agrees with `Current`'s direction | yes — bump `Last verified`, append corroboration to History |
| **Conflict pending** | Proposal contradicts `Current`; neither dominates by source-priority | no — flag, route to owner |
| **Supersede** | Proposal contradicts `Current` AND comes from a higher-priority source (e.g. user correction overrides email) | yes — move old `Current` to History, install new |

**Gaps** — explicit `Gaps:` section in each note enumerates known unknowns.
The reconciler scans new evidence against listed gaps; if a proposal fills
G-3, it appends to History + removes the gap. Agent answering a question
that hits a gap can say *"the wiki has this listed as a gap"* — fact-of-
absence is itself useful.

**Owner-assisted resolution loop** (the manual half):

When a conflict is `conflict_pending: true` or a high-stakes gap blocks an
agent answer, the reconciler:

1. Identifies the **topic owner** (per a topic→owner map we don't have yet
   — open question O-1).
2. Routes a structured ask: *"On topic X, we have evidence A from
   gmail:abc (2026-04-12) and evidence B from fathom:xyz (2026-05-01)
   that disagree on Y. Which is current?"*
3. Channel candidates: Slack DM, dedicated `#wiki-asks` channel, or a
   queue file the owner reviews on a cadence. Open question O-2.
4. Owner reply lands in the conversation history (which is itself an
   indexed source — closing the loop) AND/or directly resolves via a
   small CLI: `effi-memory resolve <topic> --pin "claim text" --citation chat:<id>`.
5. Resolution writes the new `Current`, moves contested claims to History
   with both citations, clears `conflict_pending`.

**Why human-in-loop matters here, not in retrieval** — the wiki is the
team's shared model of itself. A wrong `Current` line propagates to every
investor pitch, every customer demo. The cost of a silent auto-merge of
contradicting evidence is higher than the cost of a Slack ping.

## 3. Persistence — where the canonical bytes live

**Source of truth: repo markdown** in
`usegin/effi-memory/<instance>/notes/*.md`. Decided. Lihu rejected
canon-files-as-storage (which routes to VAIS — wrong shape). Markdown gives
us:

- Git as audit trail (`git log -- notes/raise.md` shows the full evolution).
- Human-editable — anyone on the team can fix a Current line directly; the
  reconciler must respect human edits (treat human-authored claims as
  pinned, per `_conventions.md`).
- Greppable with normal tools.
- No per-tenant complications — one wiki per project-the-wiki-is-about,
  one folder.

**Derived runtime index — Supabase, v1** (per `_architecture.md`):

A `memory_notes(topic, current_claim, citations jsonb, history jsonb,
updated_at, conflict_pending)` table, written *only* by the reconciler.
Effi runtime reads via tool, never writes.

Open question O-3: do we even need the Supabase mirror, or can Effi read
the markdown directly via a `wiki_lookup(topic)` tool? Direct-read avoids
a synchronisation surface. Supabase wins if we need cross-workspace
querying or cheaper repeat lookups. Measure latency on direct-read first.

**Conflict-pending state** — flagged in frontmatter (`conflict_pending:
true`) so it's grep-findable, AND mirrored to a queue surface the owner
sees. The grep-findability matters because any human walking through the
notes can spot the unresolved cases without tooling.

## 4. Effi runtime — tools, citations, raw-data fallback

How Effi the product agent uses the wiki when answering an end-user.

### Tools Effi calls

Two-tool minimum:

- `memory_lookup(topic)` — exact-topic fetch. Returns `Current` + citations
  + `Last verified` + `conflict_pending` flag. Slug-keyed, deterministic.
- `memory_search(query)` — semantic over `Current` claims (and maybe
  History). Returns ranked topics. Used when the question doesn't name a
  topic slug but the wiki probably covers it.

The MOC files are the routing index in Architecture B: preloaded into the
prefix, so tool selection is *"pick which `notes/<topic>.md` paths to
read"* in a single batched round-trip — that's the TTFT win.

### Citation behavior

Every claim Effi quotes from the wiki must surface its citation to the
end user, with the same type-prefix scheme:

> The team's burn is ~$25–33K/mo [cite: drive:abc123].

The end user can click the citation to open the underlying artifact. This
makes Effi-from-wiki and Effi-from-raw-data behave identically from the
user's perspective: every claim is traceable to a primary source.
**Trust-by-default + one-click verification** is the contract. A wiki
claim without a citation is a bug, not a feature — `_conventions.md`
already enforces this at authoring time.

### Raw-data fallback

The wiki is curated and lossy. When it's incomplete or low-confidence,
Effi falls through to existing canon-browse / data-source tools.

Triggers for fallback:
- `memory_lookup` returns "topic not in wiki" (or `memory_search` returns
  no high-relevance match).
- The note's `Last verified` is older than a freshness threshold.
- The note has `conflict_pending: true` and the question is exactly the
  contested claim — Effi should surface the conflict, not pick a side.
- The user's question requires detail below `Current` granularity (e.g.
  *"what exactly did Elsante say in the May 5 call?"* needs the Fathom
  transcript, not a wiki summary).

Behavior: Effi runs the fallback search, cites primary-source artifacts
directly, AND optionally writes a chat-history-tagged signal that the
reconciler picks up on its next pass (*"this question hit a wiki gap —
G-X / new topic candidate / freshness expired"*). Closing the loop again.

## 5. Owner & ownership model

The owner-assisted resolution loop above presupposes a per-topic owner.
We don't have that yet. Open question O-1 covers it.

Candidate shape: a `_owners.md` file at the wiki root mapping topic
slug → person (or `team` for "anyone reviews"). Most topics route to one
of: Guy (commercial / partnerships / financials), Lihu (product /
engineering / compliance), Nitsan (engineering / hiring), Courtney (GTM
/ pricing), specialist-of-the-week for narrow ones.

Default if no owner mapped: `team` — the queue is reviewed on cadence
rather than DM'd to one human.

## Open questions

- **O-1** — Topic→owner map. Where does it live, who maintains it,
  what's the default?
- **O-2** — Owner-ask channel. Slack DM, dedicated channel, file-queue,
  or in-Effi-conversation?
- **O-3** — Supabase mirror vs direct markdown read at runtime. Need
  latency numbers from a `wiki_lookup` probe before deciding.
- **O-4** — Reconciler proposal-review UX. Auto-merge promote/no-op +
  human-review conflict/supersede? Or every proposal queues for
  human glance?
- **O-5** — Cross-instance ownership. If `usegin/effi-memory/` grows
  more wikis (per-customer? per-project?), do they share a reconciler
  or is each self-hosted? Out of scope for now (one wiki today).
- **O-6** — Chat-history-as-source confidentiality. User corrections
  inside a paying customer's session are great signal but may carry
  data we shouldn't promote into a team-wide wiki. v1 needs a filter.

## What we already have (v0 footprint)

- Wiki substrate: 15 topic notes + 3 MOCs + conventions + architecture.
- Manual extraction recipe: per-topic Effi query, ~5–40 KB transcript per
  topic, written to a note following `_conventions.md`.
- Citation discipline enforced at authoring time.
- Conflict-pending grep surface (frontmatter flag).
- Architecture B implemented at the file level (MOCs preloaded, notes
  on-demand) — proven by experiment 002.

## What we're explicitly NOT building yet

- Cron / scheduled reconciler.
- Effi runtime tools (`memory_lookup` / `memory_search`).
- Supabase mirror.
- Owner-routing infrastructure.
- Auto-merge of any proposal kind.

v0 stays manual one-shot. The shape above is the v1 target; we build
toward it slice by slice once the substrate proves out.

## See also

- [_conventions.md](_conventions.md)
- [_architecture.md](_architecture.md)
- [MEMORY.md](MEMORY.md) — wiki entry point
