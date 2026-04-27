# Researcher (discussed) — Sessions where we talked about the 2nd brain

**Issue:** ENG-5385 (parent: ENG-5379)
**Sources searched:**
- Live: `~/.claude/projects/` (uncompressed JSONLs, ~4800 files)
- Archive: `~/agent-records/{oria-masas,lihub,nitsan-avni}/`
  (~10K files, mix of `.txt` and `.jsonl.gz`)

**Method:** `/tmp/zk_search.py` walks both stores, extracts only
`message.content` text-parts (skipping tool_use / tool_result blobs that
otherwise drown the signal in `plan list` and `Bash` output), then
matches against high-confidence terms (`zettel*`, `second/2nd brain`,
`obsidian|logseq|roam research`, `atomic notes`, `associative notes`)
plus soft terms (`knowledge graph`, `pull a wire`, `place to (hold|
capture)`, `lessons learned`, `ferment`, etc.). 277 raw matches → ~5
substantive prior conversations after manual filtering.

**Excluded:** the current parent session
`5d7f3c80-227d-4d0e-87ac-1574f3501c93` (2026-04-27) — every "zettel"
hit there is from this very R&D effort, not prior discussion.

**Sister files:**
- `inventory.md` — chronological, verbatim, with session IDs and dates
- `themes.md` — clustered analysis

---

## TOP — distilled reading for the parent issue

### 1. The corpus is much smaller than the search-space suggests.

Six months of session history, ~4800 live JSONL files + 10K archived,
277 regex hits — but only **3 substantive prior conversations** plus
**1 long-standing Linear issue (ENG-1727)** actually discuss this idea.
The rest is incidental: tool output that mentioned ENG-1727, "lessons
learned" in TDD retrospectives, false positives like "Velociraptor
Spectroscopy Obsidian" used as a unique search keyword. We are *not*
re-discovering a hot, well-developed thread. We're **resurrecting an
old, recurring one**.

### 2. The vocabulary is already settled — we're just not using it.

ENG-1727 was filed long ago (backlog position #601) and named the
exact triad the current `principles/` re-discovers:

> "atomic notes, append-mostly growth, and assembly-on-read"

Current README: "Each zettel is **atomic** ... distilled in light of
its threaded neighbors." Current principle 02: "zettels are
append-mostly." If you read ENG-1727 cold and then read
`usegin/zettel/principles/`, they sound like the same author writing
six months apart — because they are. The R&D effort should treat
ENG-1727 as a load-bearing precursor, not as background.

### 3. The team has already shipped one instance of this pattern.

The 2026-03-11 session (`426a2e6d`) didn't just *talk* about a 2nd
brain — Lihu and the assistant designed and committed
`.claude/skill-lab/` that day, with the structure:

> Intent / Success Signals / Known Limitations / Retro Guide / Retros
> / Ideas-Notes / Changelog

That directory exists in this repo right now. It is a worked example
of "the lab is the soil, Linear is the harvest" — accumulation lives
in the codebase, work lives in Linear. The R&D effort should look at
how skill-lab is *actually used today* (is it? are agents writing to
it? are humans reading from it?) before designing the general 2nd
brain — there's a live A/B already running.

### 4. The framing has stabilized around three pillars.

Across all three substantive sessions and the foundational issue, the
same three convictions recur:

| Pillar | First seen | Current expression |
|---|---|---|
| **Atomic + append-mostly + assembly-on-read** | ENG-1727 | README + principle 02 |
| **Knowledge accumulation ≠ work tracking** | 2026-03-11 (`426a2e6d`) | implicit in the "aside from production code" repo layout |
| **Friction kills it** | ENG-1727 (Rowboat critique) | principle 01 |

What has *evolved*: from ENG-1727's narrow framing (per-end-user
project knowledge graph, Graphiti-backed) to the current broader
framing (team-side first, Effi-side second, same architecture, same
team eats its own dogfood). The current README's "Effi gets an
interface to manage *her own* 2nd brain, the same way" is the
explicit closing of that loop.

### 5. What's *new* in the current R&D framing (not in prior discussion).

These pieces don't appear in any prior session:

- **"Producing vs Consuming"** as a two-sided design problem — prior
  thinking emphasized creation-side (atom granularity, entry agent
  heuristics); current README adds the consumption side as equal weight
  ("when we touch an area that has a cluster of related zettels, the
  relevant zettels should *pop*").
- **The "fighting Claude vs asking Claude" frame** (principle 04) —
  has no precedent in the corpus. New observational vocabulary.
- **Trajectory-as-meaning** ("they started something, said no-no,
  changed direction, and the trail of that thinking is part of the
  meaning" — principle 02) — partially in ENG-1727's "old reports as
  free history queries", but the *meaning-of-the-detour* claim is new.
- **The "manager world vs Claude's executing world" split** (principle
  03) — also new framing.

### 6. The risk the prior discussion didn't surface.

Every time this idea has come up, it has been **postponed in favor of
a cheap shipping increment**: ENG-1727 sat in backlog while Graphiti
spikes happened; 2026-04-01 deferred Zettelkasten in favor of building
the `project_delta.py` change-report; 2026-03-11 narrowed scope from
"general knowledge accumulation" down to "skills only" and shipped
`.claude/skill-lab/`. Three for three. The current R&D effort is the
first time it has been given dedicated headcount instead of being
re-deferred behind a shortcut. Worth naming so we don't unconsciously
do it again.

---

## MIDDLE — themed digest

See `themes.md` for the seven themes (A through G), each tying back
to verbatim quotes in `inventory.md`.

---

## BOTTOM — chronological inventory

See `inventory.md`. Quick index:

| Date | Session / Issue | Source | Person | Substance |
|---|---|---|---|---|
| (~6 mo old) | **ENG-1727** Linear issue | Linear | (filed by team) | Foundational pitch — atomic notes, append-mostly, assembly-on-read |
| 2026-03-11 | `426a2e6d` | oria-masas (Lihu) | Lihu | Skill-lab session — "lab is the soil, Linear is the harvest"; shipped `.claude/skill-lab/` |
| 2026-03-17 | `ce3ed451` | nitsan-avni | (nitsan) | Tangential — "Like a shared brain" used as one option in a companion-skill question |
| 2026-04-01 | `1576b024` | nitsan-avni | (nitsan, Lihu-style framing) | Daily-extraction skeleton — explicitly defers Zettelkasten ("we're not there yet"); cites ENG-1727 |
| 2026-04-27 | `5d7f3c80` (CURRENT) | oria-masas | Lihu | Excluded — this R&D effort itself |
