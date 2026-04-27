# Findings — what doc forms have actually worked for our team

Code-based investigation of every doc surface we have. Ranked by *evidence
of liveness* — not by what looks tidy, by what actually got written *and*
re-read *and* updated when reality moved.

**Method.** Walked the file tree, counted forms, measured git churn per
artifact, sampled 20+ documents across every form, cross-checked against
memory entries, Linear (`plan` CLI), and the prior R&D whiteboards
(`usegin/zettel/RD/effi-historian/whiteboard.md` already digested the Effi
corpus — re-using rather than re-querying, since `effi ask` timed out
during this session and the historian's coverage already answers the
team-doc-pattern question).

**Friction note (z009).** No `Task` tool was available in this harness —
the charter asked for sub-Gin spawning. I named the fork, did not push
through silently, and ran the four investigations inline as tightly
charted batches (codebase forms / memory shapes / Linear-living-vs-dead /
Effi-side patterns). Depth and coverage held; parallelism was simulated
serially. Manager-relevant: a future Gin orchestrator on this question
should be spawned in a session that exposes `Task`.

---

## What we counted

| Form | Count | Liveness signal |
|---|---:|---|
| `CLAUDE.md` (project + sub-app) | 27 | Auto-loaded every session by harness; high re-read |
| `README.md` (sub-app/tool) | 88 | Read on entry to a sub-app; modest re-read |
| `.claude/skills/*/SKILL.md` | 76 | Read every time skill is triggered; very high re-read; top-15 churned 6–41 commits |
| `.claude/skill-lab/*/{purpose,retro-guide}.md` | ~32 | Read by `skill-retro`; living-by-design |
| Memory entries `~/.claude/projects/-workspaces-test-mvp/memory/*.md` | 67 | Auto-loaded into every session; very high re-read; named churn (supersede chains visible) |
| `docs/decisions/0NNN-*.md` (ADRs) | 17 | **1 commit each** in 14/17 cases — write-once form |
| `docs/*.spec.md` + `docs/*.impl-status.md` (paired) | 41 + 22 | 60/85 last touched Jan 2026 (3+ months stale); 2-of-2 pair pattern is deliberate; mostly post-implementation graveyard |
| `docs/research/<topic>/NN-*.md` (numbered research bundle) | 12 (tdd-skills) | Used heavily during build, then frozen; `SHIPPED.md` is the survivor |
| `usegin/zettel/zettels/zNNN-*.md` | 27 | New form (1 week old); already cross-referenced by 30+ memory entries and 3 CLAUDE.md sections |
| `usegin/zettel/RD/<professor>/whiteboard.md` | 8 (3,481 lines) | One-shot R&D dossiers; cross-cutting synthesis lives in Linear comment, not in any file |
| Linear issue *description* | (per issue) | Lives if structured + sub-issued; e.g. ENG-5379 carries 3KB scoped description |
| Linear issue *comment thread* | (per issue) | The richest single living-doc form for active R&D — see ENG-5379 comment as evidence |

---

## Ranked: what has actually worked

### Tier 1 — load-bearing, demonstrably alive

#### 1. **Memory entries** (`~/.claude/projects/-workspaces-test-mvp/memory/*.md`)

This is the team's de-facto cross-session 2nd brain. ~67 entries, three
families: `feedback_*` (behavior rules), `project_*` (active projects),
`reference_*` (durable facts about the env).

**Why it works:**
- Auto-loaded into every session via the harness — zero retrieval friction.
- Named entries (filenames are claims), so MEMORY.md becomes a
  human-skimmable index of the corpus.
- Supersede chains are visible *in MEMORY.md itself*: e.g.
  `[Always re-review](feedback_always_re_review.md) — SUPERSEDED by single-iteration` (`MEMORY.md:13`).
- Each entry has frontmatter (`name`, `description`, `type`,
  `originSessionId`) — so you can trace *which session created the rule*.
  See `feedback_concise_answers.md`, `feedback_friction_loop.md`.

**Limits we already hit:**
- Solo, flat, untreaded. The Researcher-Missing whiteboard catalogs
  five separate failure modes caused by the flat-file shape:
  re-litigated decisions inside the memory file, ghost decisions, "I
  told you" pattern, repeat-trap re-debugging, memory-as-substitute.
- Per-user, not shared. Lihu's memory ≠ Oria's memory ≠ Nitsan's.
- 6 weeks of accumulation has overflowed the index — `MEMORY.md` is now
  ~70 rows long and skimming it has its own friction.

**Verdict:** The working precedent for the new shape, not the target.
Shape (small, named, frontmatter, claim-as-filename, session-traceable)
is right. Substrate (per-user flat directory) is wrong.

#### 2. **Skill files** — `.claude/skills/<name>/SKILL.md` + `.claude/skill-lab/<name>/{purpose,retro-guide}.md`

The single most-evolved doc form we have. Top-churned skills:
- `implementing-specs/SKILL.md` — 41 commits
- `liaison/SKILL.md` — 31 commits
- `writing-specs/SKILL.md` — 16 commits
- `app-sanity-test/SKILL.md` — 16 commits
- `build-orchestrate/SKILL.md` — 15 commits

The split layout (`SKILL.md` = the *operational* doc, `purpose.md` = the
*why*, `retro-guide.md` = how to evaluate a session that used it) is the
most rigorous doc-trio in the repo. Read
`.claude/skill-lab/tdd-execute/purpose.md` — it is the exemplar. Note
the dense citation graph: every claim hangs off an `ENG-NNNN`, a session
id (`9e966133:L544`), or a memory entry name
(`feedback_companion_session_findings`).

**Why it works:**
- Read-on-trigger (skill description matches → file loaded). Zero
  retrieval friction.
- Empirical anchors named explicitly and re-referenced when the doc
  evolves. `tdd-execute/purpose.md` cites ENG-1809, ENG-2030, ENG-2697,
  ENG-4922, ENG-5023, ENG-5031 by name — every Linear ref a live
  evidence anchor, not a dead pointer.
- The retro-guide format means a *separate session* can grade the doc's
  predictions against reality. Closed loop.

**Limits:**
- Only fits things that are *triggerable workflows*. Cross-cutting
  insight ("we keep getting hit by Wispr mishearings") doesn't fit the
  SKILL.md shape — that's why `usegin/wispr-flow-corrector/dictionary.md`
  exists separately.

#### 3. **CLAUDE.md** (root + sub-app)

27 across the repo. Read every session. Sub-app CLAUDE.mds (e.g.
`nextjs-app/CLAUDE.md`, `python-services/CLAUDE.md`) carry sub-app
conventions; root carries cross-cutting workflow rules.

**Why it works:**
- Auto-loaded by harness; the "instructions OVERRIDE default behavior"
  framing makes them load-bearing.
- `<important if="...">` conditional blocks let one file carry many
  audiences without bloating the always-read part.
- Decision-shape (z020) is *embedded in* root CLAUDE.md — meaning rules
  about how to write rules live in the rules.

**Limits:**
- Becomes a junk drawer if not curated. Several sub-app CLAUDE.mds
  drift toward "everything I learned" rather than "what every session
  needs".
- Cross-app insights have no home — neither nextjs nor python owns the
  rule, so it goes to root, which is already long.

#### 4. **Zettels** (`usegin/zettel/zettels/zNNN-*.md`)

New form, ~1 week old, 27 entries. Already cited by 30+ memory entries
and the consultant charter. Two-faced (Human + Gin), threaded via
front-matter (`threads: [↑placement, ~xref]`), append-mostly.

**Why it works (so far):**
- Atomicity is enforced by file-per-zettel. Easy to thread because each
  is self-contained.
- The Human/Gin split (z022) means one artifact serves two readers
  without multiple copies.
- Front-matter `threads` is mechanically-traversable — sets up the
  associative-retrieval layer that ENG-5381 will build.
- "Open-to-empty" (z003) means the address can exist before the content
  — *no backlog of unwritten zettels*, just empty ones.

**Limits we should name early:**
- One week old. We haven't seen what stale zettels look like, what
  "z028 supersedes z015" feels like at scale, or whether threading
  discipline survives without tooling.
- Currently solo (Lihu only). Multi-author hasn't been exercised.
- No retrieval layer yet — we read by file path, not by query.

### Tier 2 — useful for a specific phase, then frozen

#### 5. **R&D whiteboards** (`usegin/zettel/RD/<professor>/whiteboard.md`)

8 files, 3,481 lines. Each a one-shot deep-dive by a spawned sub-agent.
Load-bearing during the R&D phase, then immediately archival. Their
value *concentrated* into the Linear comment on ENG-5379 once the
synthesis was done.

**Verdict:** Right form for the right phase. Don't try to make
whiteboards living docs — let them be one-shot dossiers, then promote
the distillation.

#### 6. **Linear issue description + comment thread (when long-running)**

Canonical example: `ENG-5379` (rd: Zettelkasten R&D). The *description*
is a 3KB structured spec — Goal, Friction, Two-sided design, Method,
Principles, Sub-issues. The *one comment* is the 1,500-word
cross-cutting synthesis that came out of the R&D whiteboards. That
comment is the single most-load-bearing piece of design context for the
whole zettelkasten work.

**Why this pattern works:**
- Linear's tree (parent + children + comments) maps cleanly to
  "umbrella + execution + synthesis".
- Comments are first-class — long-form synthesis lands there, not in a
  separate doc.
- The sub-issue tree is the work breakdown; the parent's comment thread
  is the conversation about the work.

**Limits:**
- Heavyweight — opening an issue for a cross-cutting *thought* (not a
  *task*) has too much friction (z024 names this).
- Comments are append-only and unthreaded — a long synthesis can't be
  re-revised cleanly without a new comment.
- Lives at company level; Gin-internal R&D pollutes the engineering feed.

#### 7. **`docs/research/<topic>/NN-*.md`** (numbered research bundle)

The `tdd-skills` bundle — 12 numbered files (00-whiteboard, 01-test-inventory,
… 99-design-memo, plus dry-runs/, plus SHIPPED.md). Used heavily during
build, frozen on ship. The `SHIPPED.md` is the survivor: the post-hoc
map.

**Verdict:** Good shape *for cross-cutting research that ends in a
ship*. Less good for ongoing convention work (no "ship" event).

### Tier 3 — visible decay

#### 8. **`docs/decisions/0NNN-*.md`** (ADRs)

17 decisions. Git churn: **14 of 17 have exactly 1 commit each**. The 3
with re-commits are the most recent (0011, 0012, 0015 — Mar–Apr 2026),
which suggests recent decisions are still warm enough to edit. Older
ones are write-once-and-never-revisited.

The *form* still works — the recent dense ones (0012 SharePoint scopes,
0015 Fathom per-recorder) are excellent: dated, evidence-rich, status
explicit, related-Linear-issues catalogued. But the *artifact class* is
graveyard-prone: an ADR captures a single decision in a single moment,
and the world moves on without amending the file.

**Verdict:** Use ADRs only for *truly load-bearing architectural calls*
that you'd want to explain to a new hire. Don't use them as a generic
"I made a decision" log — that's what zettels and memory entries are
for.

#### 9. **`docs/*.spec.md` + `docs/*.impl-status.md` pairs**

41 specs + 22 impl-statuses, 20 fully-paired pairs (`feature.spec.md` +
`feature.impl-status.md`). Heavy decay: **60 of 85 docs in `docs/`
were last touched in Jan 2026**, only 6 in Apr 2026.

The pair format encodes intent (spec) + reality (impl-status). When
both get updated, it's a powerful living-doc — but in practice the spec
freezes on day-1 and the impl-status reaches "shipped" then dies.

**Verdict:** The pair-format itself is good; the discipline of updating
both at every iteration didn't survive contact with shipping pressure.
Linear sub-issues are now where most spec-tracking happens.

#### 10. **`usegin/things-we-grow.md`** — accumulate-as-we-go registry

Useful pattern (a *table* of artifacts that grow), but only 2 active
rows + 3 open-to-empty. Too early to call.

---

## Effi-side patterns (one-paragraph cite, not re-derived)

The Effi Historian whiteboard
(`usegin/zettel/RD/effi-historian/whiteboard.md` lines 1–80) already
digested how the team documents in emails / Drive / meetings. The
finding that matters here: **Drive has only 2 active doc files**;
**meeting recaps via Fathom emails are the dominant durable form**;
**internal-team discussion threads on Apr 16–17 about Effi-feature
requests are the richest single internal-team-debate surface**;
**"Zettelkasten" appears once in the entire ~3,956-email corpus** (the
team coined the word for product architecture, not for itself). The
durable pattern outside the codebase is *emails-as-thread + Fathom
recaps as decision artifacts*. That is the shape we have to *not*
duplicate.

---

## Patterns that recur across all the working forms

Five properties show up in every Tier-1 form, and the absence of any
one predicts decay:

1. **Auto-loaded or auto-triggered.** The harness or a tool reads the
   doc without the human having to remember to open it. (CLAUDE.md,
   skills, memory entries, root README all hit this. ADRs and `docs/*`
   don't.)
2. **Atomic + named-as-claim.** Each file is one idea, and the filename
   is the claim. (Zettels, skills, memory entries. ADRs split this —
   the filename is a number, not a claim. `docs/*` mostly fail this.)
3. **Frontmatter for traversal, body for humans.** The graph lives in
   structured fields; prose is for the reader. (Zettels, memory
   entries, SKILL.md. ADRs don't have it. `docs/*` rarely.)
4. **Append-mostly + explicit supersede.** New supersedes old by name;
   nothing silently overwritten. (Zettels enforce. Memory's
   superseded-by-name rows enforce. CLAUDE.md violates regularly.)
5. **Two faces when both audiences exist.** Human-side + Gin-side in
   the same file when both consume it. (Zettels enforce. Skills do
   this implicitly — SKILL.md is Gin-facing; skill-lab is human-facing.)

The new doc form has to clear all five.

---

## Citations

- Charter: `usegin/research/documentation-method/charter.md`
- Z024 (the trip-wire): `usegin/zettel/zettels/z024-not-everything-in-linear.md`
- Z023 (spawn-as-instantiation): `usegin/zettel/zettels/z023-spawn-as-instantiation.md`
- Z022 (two-faces): `usegin/zettel/zettels/z022-two-faces-when-suitable.md`
- Z003 (open-to-empty): `usegin/zettel/zettels/z003-open-to-empty.md`
- Memory MEMORY.md: `~/.claude/projects/-workspaces-test-mvp/memory/MEMORY.md`
- Skill-lab exemplar: `.claude/skill-lab/tdd-execute/purpose.md`
- Skill-lab retro-guide exemplar: `.claude/skill-lab/tdd-execute/retro-guide.md`
- Recent dense ADRs: `docs/decisions/0012-sharepoint-scopes-are-user-intent-only.md`,
  `docs/decisions/0015-fathom-per-recorder-scoping.md`
- Linear-as-living-doc canonical: `plan show ENG-5379 --comments`
- Effi corpus digest: `usegin/zettel/RD/effi-historian/whiteboard.md` §1.1–1.3
- Researcher-missing failure modes: `usegin/zettel/RD/researcher-missing/whiteboard.md`
- Cross-cutting synthesis on ENG-5379 (the Nitsan comment 2026-04-27)
