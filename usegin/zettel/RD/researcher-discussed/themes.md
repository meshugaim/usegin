# Themed digest — patterns across the prior discussions

The corpus is small (one Linear issue + ~3 substantive sessions over six
months) but the convergence is striking. Every theme below appears in
both the foundational ENG-1727 pitch *and* the 2026-03-11 skill-lab
session *and* the 2026-04-01 daily-extraction session — three
independent contexts arriving at the same shapes.

---

## Theme A — "Atomic, append-mostly, assembly-on-read"

**Where it appears:**
- ENG-1727 (issue body): "Each note is an **atom** — one fact, one
  concept, one observation. Not a growing wiki page." +
  "Append-mostly growth — New information doesn't edit existing notes
  — it creates **new atoms that link back**." +
  "Nobody reads atoms directly. The read path is always an agent that
  **assembles** atoms"
- Current `principles/02-decisions-preserved.md`: "zettels are
  append-mostly. Updates note the prior state, never silently
  overwrite."
- Current `README.md`: "Each zettel is **atomic** ... but **distilled
  in light of its threaded neighbors**"

The exact triad — atomic / append-only / assembled-on-read — predates
this R&D effort by 6+ months. The current principles are essentially
re-discovering ENG-1727's design vocabulary.

---

## Theme B — "Lab vs Linear" — knowledge accumulation is structurally
different from work tracking

**Where it appears (most explicit):**
- 2026-03-11 (`426a2e6d`), Lihu: "linear manage work. i imagine some
  sort of 'skill lab' where we have the skill idea, have retros, have
  half baked ideas.. and im not sure linear is the place"
- Same session, assistant: "A skill lab is: here's an observation.
  Here's another one from three weeks later. Oh, those two connect.
  Now here's a half-baked idea. Let it sit." → "**The lab is the soil.
  Linear is the harvest.**"

The dev team has already *built one instance* of the 2nd brain pattern
(`.claude/skill-lab/`) for skills specifically. The R&D effort here is
generalizing that pattern beyond skills, to all team knowledge.
**Critically:** the existing skill-lab structure (Intent / Success
Signals / Known Limitations / Retro Guide / Retros / Ideas / Changelog)
is a worked example of what a 2nd-brain "section" can look like — and
the user designed it himself.

---

## Theme C — "Threaded retrieval, not flat reads"

**Where it appears:**
- ENG-1727: "Reports as graph nodes — A meeting prep brief links to
  the atoms it was assembled from. Next week, the assembler finds last
  week's brief, sees what's changed since"
- 2026-04-01 (`1576b024`), assistant naming the long-term shape:
  "atomic notes, assembly-on-read, reports as graph nodes"
- Current `README.md`: "Pulling one wire reveals the whole rope.
  Frustrations in DX → threaded back to every prior zettel that
  contributed to the path that led there."

Same shape: the value is at the *traversal* layer, not in any single
note. Zettels are cheap; assemblers are where the leverage is.

---

## Theme D — "Solve the friction first, or it doesn't get used"

**Where it appears:**
- ENG-1727 on Rowboat (the contrast case): "Entry is complex — the
  note creation agent must parse templates, edit fields in place,
  maintain sections, deduplicate against a rigid schema" → that's why
  Rowboat had to add a "strictness" gate, because creation was
  expensive. Atomic notes dissolve the gate by making creation cheap.
- 2026-04-01, Lihu: "maye a first small step is the statuc tool to
  say what's new since date" — cheap, no-AI-needed step, reduce
  friction first.
- Current `principles/01-intuitive-workflows.md`: "If capturing or
  retrieving a zettel takes more than a few seconds of friction, it
  will not happen and the whole thing collapses."

Friction = death is a stable conviction across all three time-points.

---

## Theme E — "Trajectory of thinking, not just conclusions"

**Where it appears:**
- ENG-1727: "Old reports become historical artifacts, not stale caches
  — 'what did I know about this project in January?' is a free query"
- 2026-03-11 skill-lab session, the *Changelog* slot in the per-skill
  template — explicitly "links observations to changes. The git log
  has this but scattered — curated here it tells the design story."
- Current `principles/02-decisions-preserved.md`: "preserve the
  trajectory of thinking — including dead ends, abandoned branches,
  and superseded conclusions"

History as a first-class consumable, not just an audit trail. This
shows up in three different domains (per-project knowledge, per-skill
evolution, per-decision rationale) and gets the same answer each time.

---

## Theme F — "It's been deferred several times"

This is a meta-theme but the most actionable one:

- **2026-Sep-ish (estimated from backlog position #601)**: ENG-1727
  filed. Never implemented.
- **2026-04-01**: brought up explicitly — "an idea that we've been
  talking about for a long time, and I think it's time we start
  working on it" — and then *deliberately deferred again*: "we're
  not there yet."
- **2026-04-27**: brought up *again* as the R&D parent ENG-5379, this
  time staffed with a researcher team (us).

Each time it surfaces, the user splits it into "do the cheap thing
first" + "the real thing is the representation, and that needs proper
exploration." The R&D effort here is the first time the "real thing"
has been given dedicated resourcing instead of being deferred behind a
shippable shortcut.

The current `principles/03-pull-claude-into-our-world.md` ("our domain
is the *management world* ... the meta layer — intent, rationale,
lessons, frustrations, decisions — not the implementation details") is
also Lihu's answer to a recurring tension visible in the 04-01 session,
where the assistant kept proposing schema/runner/endpoint code and
Lihu kept saying "too early — we need to explore representations
first."

---

## Theme G — Effi-side vs Team-side framing

ENG-1727 is **Effi-side** — atomic knowledge graph for users' project
data. The current R&D effort is **team-side** — atomic knowledge graph
for the dev team building Effi. The current README explicitly closes
this loop: "Effi gets an interface to manage *her own* 2nd brain, the
same way." So the team uses what they're building, and what they're
building eventually ships to Effi users. **Same architecture, two
audiences.** This was implicit in earlier sessions (ENG-1727 talked
only about end-users) but is now explicit.
