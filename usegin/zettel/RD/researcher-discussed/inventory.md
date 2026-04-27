# Chronological inventory — every prior session/artifact discussing the 2nd-brain idea

Verbatim quotes. Session ID + date + role for each entry. Excludes the
current parent session `5d7f3c80-227d-4d0e-87ac-1574f3501c93` (2026-04-27),
which is the R&D kickoff for this very effort.

Cross-store search procedure (so you can re-run): see `zk_search.py` in
`/tmp` — it walks `~/.claude/projects/` (jsonl) and `~/agent-records/`
(jsonl.gz + .txt), yanks the `message.content` text-parts only (not tool
results / tool uses), and matches against a high-confidence regex set
(`zettel*`, `second/2nd brain`, `obsidian|logseq|roam research`,
`atomic notes`, `associative notes`) plus a soft-confidence regex set
(`knowledge graph`, `pull a wire`, `place to (hold|capture)`, etc.).
277 raw hits → ~5 substantive after filtering tool-output noise and
incidental ENG-1727 plan-list citations.

---

## Anchor: Linear issue ENG-1727 (pre-existing, the foundational pitch)

**Title:** `design: atomic knowledge graph — zettelkasten-inspired note model`
**Status:** Backlog
**URL:** https://linear.app/askeffi/issue/ENG-1727/design-atomic-knowledge-graph-zettelkasten-inspired-note-model
**Position in backlog:** #601 (very old / long-lived)

This issue *names the concept* — Zettelkasten-inspired, atomic notes,
append-mostly, assembly-on-read — for **Effi's** internal knowledge layer
(per-project / per-user knowledge graph), not for the dev team's shared
brain. It's the source the 2026-04-01 conversation below points at.

Verbatim from the issue body (key passages):

> "Rowboat uses big mutable wiki-page-per-entity notes (one file per
> person/org/project/topic) with fixed categories and template-based
> formatting. The copilot retrieves via grep + readFile — no graph
> traversal, no semantic search. This pitch proposes an alternative model
> inspired by Zettelkasten: **atomic notes, append-mostly growth, and
> assembly-on-read.**"

> "Each note is an **atom** — one fact, one concept, one observation. Not
> a growing wiki page. ... A meeting that covers 3 topics produces 3+
> atoms, not one meeting note with 3 sections."

> "Append-mostly growth — New information doesn't edit existing notes — it
> creates **new atoms that link back**. The graph grows by accretion, not
> mutation. History is free — the graph is its own changelog."

> "The note creation agent should be biased toward **splitting, not
> merging**. Entry standards should nudge toward right-sized atoms.
> Elaboration happens by adding connected notes (appendices, related
> atoms), not by editing existing ones."

> "Nobody reads atoms directly. The read path is always an agent that
> **assembles** atoms into something useful for the current context"

> "Reports as graph nodes — Assembled reports get stored back into the
> graph: A meeting prep brief links to the atoms it was assembled from.
> Next week, the assembler finds last week's brief, sees what's changed
> since, does an incremental update. **Layers emerge:** atoms (raw facts)
> → reports (assembled views) → meta-reports (quarterly summaries
> referencing weekly briefs)"

Almost every principle currently in `usegin/zettel/principles/` rhymes with
this 6-month-old pitch. The vocabulary ("atom", "append-mostly", "assembly
on read") is identical to the principles' "atomic but distilled in light
of threaded neighbors", "append-mostly", "pulling one wire reveals the
whole rope".

---

## Session 1 — 2026-03-11, oria-masas, `426a2e6d-6a7b-4aa7-9114-1ad943fd2c08`

**Topic:** Audit of `/build-orchestrate` skill → evolved into a discussion
about **where accumulated, half-baked, slow-moving knowledge should live**
→ produced the `.claude/skill-lab/` directory.

This is the most directly-on-point prior conversation. Lihu (the user)
explicitly distinguishes "work" (Linear) from "knowledge accumulation"
(needs a different shape).

**USER (mid-session, after the assistant proposed Linear):**

> "im not sure. linear manage work. i imagine some sort of 'skill lab'
> where we have the skill idea, have retros, have half baked ideas.. and
> im not sure linear is the place. im also not sure it isnt. wdyt?"

**ASSISTANT response (the formative move):**

> "You're right to hesitate. The word 'lab' tells you something — a lab
> is a workspace where things brew, not a board where things flow through
> states.
>
> Linear is good at: this needs doing → someone's doing it → it's done.
> That's work.
>
> A skill lab is: here's an observation. Here's another one from three
> weeks later. Oh, those two connect. Now here's a half-baked idea. Let
> it sit. A retro just added evidence. Now it's baked — push it into the
> skill.
>
> That's **knowledge accumulation**, not work management. Linear's
> primitives (issue, status, assignee) don't fit 'let it sit and ferment.'
>
> But the codebase already holds this kind of thing — `docs/decisions/`,
> `docs/incidents/`, `.claude/research/` whiteboards. Knowledge that
> accumulates, gets referenced, and occasionally graduates into action.
>
> I think the answer might be: **the lab lives in the codebase**
> (accumulation, context, fermenting ideas), and **when something becomes
> actionable, it spawns a Linear issue** (work). The lab is the soil.
> Linear is the harvest."

**USER (designing the per-skill record):**

> "let's design it for the research and the build-orchestrate skill. i
> want - what the skill supposed to do, place for the half baked ideas or
> notes, definision of the specific-skill-retro that is trigged from a
> general skill-retro skill (we finish a session, we trig skill-retro, it
> send the agent to read the specific-skill-retro and do a retro), a
> place for the retros. what more?"

**ASSISTANT structure proposed (and shipped that session):**

> "## Intent  ## Success Signals  ## Known Limitations  ## Retro Guide
> ## Retros  ## Ideas / Notes  ## Changelog"

**Sub-agent survey of where knowledge already lives (commissioned by Lihu
during the session):**

> "Where accumulated knowledge lives today:
> 1. **MEMORY.md** — Claude's auto-memory, injected into every session
>    context. Contains verified findings, workflow lessons, tool
>    references. Flat structure, append-only.
> 2. **`.claude/research/`** — Structured investigation archives. Each
>    has phased files, a `whiteboard.md` (running scratchpad), and
>    optionally `judgment-answer.md` and `retro.md`. This is the closest
>    thing to a 'staging area'.
> 3. **`.claude/handoffs/`** — Session continuity transcripts and handoff
>    notes.
> 4. **`docs/`** — Human-facing knowledge: `decisions/` (ADRs),
>    `incidents/`, `bugs/`, `brainstorm/`, `vision/`, `audits/`, `specs/`.
> 5. **`.claude/rules/`** — Auto-loaded Claude rules. Always in context.
> 6. **`.claude/logs/self-awareness.log`** — meta-observations from a
>    self-reflection system.
>
> Patterns: Knowledge flows from `.claude/research/` whiteboards and
> retros into either MEMORY.md (for cross-session lessons) or specs."

**Output of the session:** `.claude/skill-lab/{build-orchestrate,research,
liaison,ralph-loop}.md` — actually created and committed. The entire
`/skill-retro` skill was rewritten to dispatch into per-skill lab files.

---

## Session 2 — 2026-04-01, nitsan-avni, `1576b024-50be-40da-94ca-9af34af56db6`

**Topic:** "Daily extraction" / "daily newspaper" agent — a background
agent that runs per project, extracts insights, persists deltas. Lihu
(via "the user" framing) is explicitly broaching the long-deferred
Zettelkasten conversation.

**USER (opening prompt):**

> "I want to explore an idea that we've been talking about for a long
> time, and I think it's time we start working on it. I want to build a
> background agent that runs, let's say, daily on every project on our
> platform. It will attempt to extract insights and other stuff from
> project data and from recent interactions. ... I'm imagining that we
> kind of create a kind of a daily newspaper for each person and for
> each project, and every day we are kind of concerned with whatever is
> new. ... How we persist the data, what shape it takes, what kind of
> things we want to extract, at what rate, and what goes into the agent
> ... are all up for design. ... It has to have a kind of a comparative
> nature. It has to be able to compare to what it already knows and
> understand what's new since the last thing"

**USER (steering away from premature schema, naming the open
representational question and citing the Linear issues):**

> "new data items - this should be a statuc analysis tool, no need for
> AI to tell us this
> if the unit of extraction includes the user - we could use their
> previous conversations too; which we currently store as raw jsonl
> files in a dedicated bucket
> about db table design - it's too early in our exploration to define
> it; we need to explore potential data representations
> what to extract - this also eeds discussion (see linear issues about
> zettlekasten), 'topics' etc.
> maye a first small step is the statuc tool to say what's new since
> date"

**ASSISTANT (naming the long-term vs short-term split, citing
ENG-1727 directly):**

> "**ENG-1727 (zettelkasten)** is the long-term vision for how extracted
> knowledge lives — atomic notes, assembly-on-read, reports as graph
> nodes. The 'daily extraction' is essentially the assembly agent that
> composes atoms into useful views. But we're not there yet."

**ASSISTANT (closing the session, naming the deferred threads):**

> "The next conversation threads are:
> 1. **What to extract** — the Zettelkasten/topics/atomic notes
>    discussion (ENG-1727)
> 2. **How to represent** — what shape does the output take, where does
>    it live
> 3. **User-level view** — combining deltas across projects +
>    conversation content
> 4. **Scheduling** — on-demand endpoint, then automation"

This session is significant for *what it postponed*: it built the
"what's-new-since" delta query (in
`python-services/agent_api/project_delta.py`), deliberately leaving the
representation/extraction model for the zettelkasten conversation that
ENG-1727 always pointed at. The 2026-04-27 R&D kickoff is the resumption
of exactly that postponed thread.

---

## Session 3 — 2026-03-17, nitsan-avni, `ce3ed451-001f-4ef5-9c0d-c3533ea2d681`

**Topic:** Designing the "companion" agent skill. Single tangential hit:
the assistant offered "Like a shared brain" as one of four AskUserQuestion
options for what a companion is, when companion is *to* the liaison.

**Verbatim (assistant tool_use input options):**

> "**Companion to the liaison** — Helps the orchestrator think.
> Maintains context across slices, keeps state, so the liaison can stay
> lean. Like a shared brain."

Lihu (then nitsan, in this session it's the 'user' input) didn't pick up
on this metaphor in his replies; the conversation moved on to lifecycle
/ process questions about companion. Listed for completeness — it shows
the "shared brain" framing was already in ambient agent-design
vocabulary. Not a substantive 2nd-brain discussion.

---

## Session 4 — 2026-04-27, oria-masas, `5d7f3c80-227d-4d0e-87ac-1574f3501c93` (CURRENT — excluded)

The R&D kickoff for this whole effort (parent ENG-5379, this researcher's
ENG-5385). Every "zettel" / "second brain" hit there is part of the
present work, not prior discussion. Listed only so the reader knows we
filtered it out on purpose.

---

## Hits inspected and ruled non-relevant (audit trail)

These appeared in the raw regex sweep but were verified to be incidental.
Documenting so a re-runner doesn't re-investigate them:

- `957b3876` (oria, 2026-03-11) — sub-agent spec audit; "zettelkasten" was
  inside a Mermaid diagram referenced from a spec being audited (the
  email-pipeline spec used `cards (Zettelkasten atoms)` as undefined
  jargon, which the auditor flagged as a weakness).
- `470106d8` (oria, 2026-03-11) — CLI table-layout discussion; ENG-1727
  appeared as a sample row in a "card layout at narrow widths" mockup.
- `44bc059d` (oria, 2026-02-09) — "Velociraptor Spectroscopy Obsidian"
  used as deliberately unique search keywords for a Gemini File API CSV
  experiment. False positive on "obsidian".
- `a927fb98` (oria, 2026-02-26) — Vertex AI search chunk attribution
  research. False positive on "knowledge graph".
- `955562a2` (oria, 2026-02-27) — UI conversation about whether
  `conversations` table or browser state should hold a suggestion id.
  User said "i dont know, im not sure browser is the natural place to
  hold info about the conversation" — different "hold info" meaning,
  not 2nd brain.
- `d51af7e0` (lihub, 2026-03-26) — `plan list` tool result happened to
  list ENG-1727; never discussed.
- `426a2e6d` sub-agent surveys of GFS sync history (~10 sessions on
  2026-03-17) — repeat boilerplate analysis with "lessons learned"
  phrasing; not 2nd-brain.
- Various TDD / handoff / phase-summary "lessons learned" mentions —
  all routine session-process artifacts, not the team-knowledge concept.
