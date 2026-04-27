# Effi Historian — Whiteboard (ENG-5387)

Sub-issue of ENG-5379. Mandate: pull *everything* the team has discussed
about Zettelkasten / 2nd brain / shared knowledge / atomic-associative
notes / capture tools — across emails, Drive, meetings, Linear — via the
`effi` CLI against the **AskEffi App (really)** project.

Method: 8 parallel `effi ask` sweeps from distinct angles + project-delta
inventory. Each was re-resumed without `tail` truncation so the full hit
inventory survives. Citations are preserved as Effi returned them. Raw
per-sweep output in `raw-quotes/qN-*-FULL.txt` (full prose) plus
`raw-quotes/qN-*.json` (truncated tail of streaming JSON, kept for source
provenance).

Coverage caveats Effi surfaced itself:
- **Linear is not indexed** for this project — zero hits across all sweeps.
- **Drive** has only two files (`Data Model`, `Effi for multiple parties`,
  both Apr 12 2026); semantic search returned nothing matching for them.
- **Fathom direct integration** is "coming" per the mandate, but Fathom
  recap *emails* are abundant and indexed via the email channel.
- All sweeps converged on the same ~10 source clusters with high overlap
  — strong sign that the corpus is well-covered, not that we missed it.

---

## 1. Distilled reading — what the team has actually said

### 1.1 The headline finding

The word **"Zettelkasten"** appears **exactly once** in the entire corpus
of ~3,956 emails, 182 attachments, 2 Drive files, and all meeting
transcripts (`raw-quotes/q1-zettelkasten-FULL.txt`). That single mention
is in the Fathom recap of an **internal team meeting on Jan 29, 2026**
— and there it is the team's own *named architecture* for replacing the
RAG-only approach. Not a quote of someone else's idea, not a book the
team is reading. We coined it for our own design.

> **"Solution: 'Zettelkasten' Context Graph — Concept:** An emergent
> knowledge graph that connects ideas based on their content, not a
> pre-defined structure. **Process:** 1. Ingest data (e.g., email,
> transcript). 2. Extract its essence (summarize, tag). 3. Map it to
> the existing graph, connecting to related nodes. **Key Feature:
> Time-Awareness** — The graph tracks how ideas and policies evolve
> over time."
> — Fathom recap of Jan 29 2026 internal meeting (4 identical email
> copies: `11a36f84`, `38211683`, `40581fd4`, `65a26c84`)

This is striking. The R&D track (ENG-5379) is *not* importing Zettelkasten
from the outside — it's reactivating language we already used three months
ago for our **product architecture** and now reframing it for our own
**team workflow**. That symmetry is itself a zettel.

### 1.2 The deeper thread the corpus is actually about: "the WHY gets lost"

Zettelkasten is the *named* concept, but the *underlying* concern —
"decisions get made, the rationale evaporates, the team relitigates" —
is the single most repeated theme across **at least six independent
customer/advisor conversations** spanning Nov 2025 → Mar 2026, with Guy
articulating it in nearly identical words each time
(`raw-quotes/q5-FULL.txt §1`, `q8-distillation-FULL.txt §4`).

Effi's own self-generated portrait of Guy (Apr 24 2026 weekly status email):

> "Your pitch has been remarkably consistent across hundreds of
> conversations: you believe the biggest drag on organizations is the
> cost of reconstructing shared context — and you experienced this
> personally at Google, Yahoo, and Meta (you've cited spending ~40% of
> your time just explaining things and having things explained to you).
> This isn't just a market hypothesis for you; it's autobiographical."

This is *exactly* the principle-2 framing ("preserve, don't delete; the
trajectory carries the meaning") and exactly what Zettelkasten R&D is
trying to install for the dev team. The product thesis and the team
workflow thesis are the same thesis at different scales.

### 1.3 The most-developed *internal* discussion is the "feature request" thread

The single richest single internal debate about a 2nd-brain–style
capture surface is the **Apr 16–17 2026 email thread "Re: Effi made its
first feature request :-)"** (`raw-quotes/q2-second-brain-FULL.txt §HIT 2`).
The exchange — Guy → Oria → Lihu, with Nitsan and Chris CC'd — names
all three load-bearing problems:

- **Guy (Apr 16):** "imagine that I can tell her what happened (less
  relevant for Fathom, more relevant for **corridor conversations,
  phone calls and whatsapp**)" — the on-the-go capture problem.
- **Oria (Apr 16):** the "softer" parts of work — "*independent
  decisions, insights, lessons learned, watchouts, things we want 'the
  project to remember' but don't deserve a spec or a meeting*" — and
  proposes the framing **"remember it for me"**, which Nitsan pushed
  back on as outside Effi's official use case.
- **Lihu (Apr 17):** flags the open UX question to Chris.

Nitsan's pushback ("not Effi's official use case/story") was the right
*product* call at the time. ENG-5379 is the answer to *"OK, but
internally we still need this — let's build it for the dev team
first."* The reverted-from-product-direction is exactly the kind of
trajectory principle 2 says to preserve.

That thread converged a week later in the **Apr 23 2026 feature
prioritization meeting** (Fathom summary `7aa1c1a1`,
`raw-quotes/q5-FULL.txt §3,4`, `q6-capture-FULL.txt`):

- **"Need:** Users require a way to **write *to* Effi** to log
  decisions, save chats, and provide direct inputs"
- **Action assigned to Oria:** *"Design Notes/Decisions/Action Items
  data type; implement CLI; add UI"*
- **Action assigned to Nitsan:** *"Develop a 'save chat' feature,
  starting with an opt-in model"*

This is highly relevant: **the writing is already on the wall in the
product roadmap**, and Oria is on the hook for the data-type design.
Whatever shape the team-2nd-brain takes, it should plug into — or at
minimum not contradict — the Note/Decision/Action Item data type Oria
is already designing.

### 1.4 Tools the team actually uses

`raw-quotes/q4-FULL.txt` is unambiguous:

- **Obsidian, Logseq, Roam, Karpathy:** zero mentions, anywhere, ever.
  No team member is bringing a PKM tradition to the table.
- **Wispr Flow:** the *only* note/thought-capture tool with real team
  engagement — Nitsan introduced it (Nov 19 2025 invite from Wispr to
  Guy: *"Nitsan has invited you to their team on Flow Pro"*); the whole
  team is on a paid Pro subscription (renewals Jan→Feb→Mar→Apr 2026);
  Chris explicitly recommended it as a UX reference for Effi:
  > *"(Have y'all tried Whispr Flow? I really like how it VERY fluidly
  > takes your voice input. I made the bold statements in it; took about
  > 5 seconds, with 15 seconds to review and edit. This sentence took
  > about 70 seconds to write and edit. Just a thought...)"*
  > — Chris Baum, "Re: UX iterations", Jan 7 2026
  > — *Lihu's reply Jan 10:* "Yup, Nitsan introduced me to Wispr a while
  > ago, and now we're telling Claude what to code without even
  > writing it.., living in the future :)"

  Guy uses it live in customer demos as voice input ("I'll use the
  Whisperflow"). For our 2nd brain: **voice → text capture via Wispr is
  the existing low-friction path**, already in everyone's hands. Build
  on it; don't reinvent it.
- **Notion:** mentioned once, by an external customer (David), as a
  meeting note-taking preference. Not adopted internally.

### 1.5 The "Claude as the interface" pattern is explicit and growing

A separate but tightly coupled thread runs through the corpus
(`raw-quotes/q7-claude-context-FULL.txt §8`): both Guy externally and
the team internally are converging on **Claude as the surface**, with
Effi reachable through it.

> *"They're like, because for them, it's all Claude in the end of the
> day. Claude is writing, even like our linear, the only seat we have
> on linear, it's Claude is the seat owner... let's have Claude, the
> only, the interface to it can be Claude."*
> — Guy, meeting with Omer Khalid, Mar 2 2026

> *"my interface is Claude for my work. It's great that you can give me
> all the context from the engagement, but let me talk with you through
> Claude"*
> — Guy, meeting with Chandra, Apr 17 2026

> *"Nitsan asks Claude... Claude is plugged into Effie through a command
> line interface, of course, he can, so he just asked... hey, Claude,
> what did the customer ask for, and Claude goes to Effie"*
> — Guy describing the team's actual workflow, Apr 24 2026

This is exactly principle 3: pull Claude into our world. The team is
already doing it. The Zettelkasten 2nd brain should be reachable through
Claude — capture via `/zettel` or similar in any Claude session, query
via natural language — not via a separate UI we have to context-switch
to. The Effi CLI already proves the pattern works (`effi ask`, `effi
chat`).

### 1.6 Parallel internal struggles that confirm the design pressure

`raw-quotes/q7-claude-context-FULL.txt` documents the team's *own*
context-loss pain (which is what makes Zettelkasten R&D urgent for *us*,
not just our customers):

- **Phil Lau (Mar 24):** *"I lost my chat history within a specific
  project."* — A design partner reporting the basic
  refresh-loses-everything bug.
- **Effi diagnosing herself** (Apr 12, forwarded by Guy): *"That
  summary is lossy — exact transcript text, specific quotes, and
  intermediate tool results don't survive it... the context filled up
  before I could write it... the session needs to be managed like a
  resource."*
- **Cross-session memory** named as a "we should fix" item (Guy ↔ Joshua
  Mindel, Jan 21 2026).
- **Chris Baum's mind-blown moment:** Claude Memory in Projects —
  *"That comes directly from your own work and insights that I've
  learned from our conversations. I was speechless."* — directly framed
  as *"now take that and add what happens when Effi is the memory for
  everyone in the org"*.

The 2nd brain effort sits **in the same problem space** the team is
already chipping at for the product. Reusing infrastructure (the
Note/Decision data type Oria's designing; the chat/session JSON log;
the CLI) is the path of least friction.

### 1.7 Theoretical grounding the team has already absorbed

Two attachments in the corpus carry the deepest conceptual framing
(`raw-quotes/q8-distillation-FULL.txt §5`, `q2-second-brain-FULL.txt §9,10`):

- **"The New Physics of Project Intelligence"** (circulating
  internally, Jan 2026 era): introduces *"decision record that captures
  multiple perspectives on the rationale — not a sanitized single
  narrative... spaced repetition for organizational memory"*. This is
  principle 2 ("preserve, don't delete; many perspectives") in
  somebody else's words.
- **The Dave Snowden / SenseMaker prep doc**: *"capture organizational
  patterns without requiring centralized interpretation... carrying
  context so stakeholders don't have to... most organizational failures
  occur not because individuals don't know things, but because the
  system fails to maintain shared context across roles"*. The
  *enabling-constraint* framing maps almost 1:1 onto principle 1
  (low-friction, amplify how we already think).
- **"Agentify"** book chapter "Dream, Distill, Differentiate":
  background offline knowledge refinement for agents — *"compresses
  memories, refines skills, seeks knowledge"* from transcripts, tool
  traces, retrieval logs, error/outcome summaries. This is the
  *consume*-side architecture prefigured.

### 1.8 Themes / disagreements / evolution

| Theme | First seen | Most recent | Direction of travel |
|---|---|---|---|
| "Why behind decisions is lost" | Nov 20 2025 (Guy ↔ Andrea Jones) | Apr 24 2026 (Effi's self-portrait of Guy) | Stable, repeated nearly verbatim across 6+ external conversations |
| Knowledge-graph / context-graph as solution | Dec 5 2025 (MoVi/Pablo) | Mar 24 2026 (Chris on incremental graph building) | Evolving from "future architecture" → "do it incrementally now" |
| "Zettelkasten" as our named architecture | Jan 29 2026 | Jan 29 2026 (only) | Coined once internally; revived now in ENG-5379 |
| Cross-session memory in Effi | Dec 13 2025 (Effi self-acknowledges) | Apr 23 2026 (session history on roadmap) | From "missing feature" → assigned work |
| Write-to-Effi / Note/Decision data type | Apr 16 2026 ("first feature request" thread) | Apr 23 2026 (Oria assigned implementation) | From open question → in-flight build |
| Wispr Flow as low-friction capture | Nov 19 2025 (Nitsan invites team) | Apr 16 2026 (Guy demos with it live) | Universally adopted; the de facto capture rail |
| Claude as the surface for Effi | Mar 2 2026 (Omer meeting) | Apr 24 2026 (Elsante meeting) | Strengthening — Guy increasingly pitches "Claude as the only interface" |
| Tribal/implicit knowledge | Dec 3 2025 (Dorina) | Dec 12 2025 (AlignOrg) | Customer validation; not actively in dev |
| "Effi mental model" visibility | Multiple Fathom recaps | Recent | Decision: **punt visual diagrams; text first** |

**Disagreement on record (and unresolved):** Nitsan's pushback that
"remember it for me" is *not* Effi's official use case, vs. Oria's
"informal off-the-record channel" framing, vs. Chris's "Effi is the
memory for everyone in the org" framing. ENG-5379 is implicitly the
team agreeing to **build the team-internal version of this without
forcing the product question yet** — and the trajectory of that
disagreement is itself zettel material.

### 1.9 What "atomic / threaded / associative notes" looks like in this corpus

`raw-quotes/q3-knowledge-graph-FULL.txt` is decisive: the phrases
"atomic notes", "threaded notes", "associative notes", and
"note-linking" appear **zero times**. The team has the *concept* —
emergent edges, semantic similarity, time-aware evolution, weak-signal
detection — but has not adopted the Zettelkasten-method *vocabulary*.
This means we get to seed it. Which words we choose for the team will
stick.

### 1.10 What's missing from the corpus that we'd want to know

- **No Linear coverage.** Whatever gets discussed in Linear comments,
  issue descriptions, or sub-issue threads is invisible to Effi today.
  ENG-5379 itself and its eight sibling issues are not retrievable
  here. This is a real gap for the historian role; flagging upward.
- **The two Drive files** (`Data Model` and `Effi for multiple
  parties`, both Apr 12 2026) returned no semantic hits but were not
  read directly. If they cover the Note/Decision data type, they're
  highly relevant. **Worth a direct file read** in a follow-up.
- **Fathom direct integration** is coming; once live, transcripts will
  be queryable beyond the recap-email summaries.

---

## 2. Themed digest

(Quotes here are the load-bearing ones. The full text per theme lives
in the `raw-quotes/qN-*-FULL.txt` files cited in each subsection.)

### 2.1 The Zettelkasten word itself
*Source: `raw-quotes/q1-zettelkasten-FULL.txt`*

**Exactly one occurrence in the corpus, in the Jan 29 2026 internal team
meeting Fathom recap (4 email copies: `11a36f84`, `38211683`,
`40581fd4`, `65a26c84`):**
> "**'Mental Model' Strategy:** The team will build a 'Zettelkasten'-style
> knowledge graph. This will move beyond simple RAG by pre-processing
> data and tracking how ideas evolve over time, enabling queries like
> 'How did our policy on X change?'"

> "**Solution: 'Zettelkasten' Context Graph — Concept:** An emergent
> knowledge graph that connects ideas based on their content, not a
> pre-defined structure. **Process:** 1. Ingest data (e.g., email,
> transcript). 2. Extract its essence (summarize, tag). 3. Map it to
> the existing graph, connecting to related nodes. **Key Feature:
> Time-Awareness** — The graph tracks how ideas and policies evolve
> over time. **Example Query:** 'How did our policy on X change from
> Q3 to Q4?' **Value:** Enables proactive guidance by detecting shifts
> in team sentiment (e.g., from 80/20 confidence in option A to 51/49
> against it) before a hard pivot is necessary."

No misspelling variants found.

### 2.2 "Second brain" / shared / team brain
*Source: `raw-quotes/q2-second-brain-FULL.txt`*

**Literal "second brain" mention** — Guy → Chris, Feb 3 2026, "Re: A
few contacts":
> "Will be interesting to add you if you are up for it - I would
> appreciate a **second brain** digesting the feedback with me"

**"Genetic memory of a team or institution"** — Pablo / Collective
Team to Guy, MoVi check-in, Dec 5 2025:
> "our mission was to build, like, an intuitive knowledge management
> solution that was, like, knowledge graph-based, where... You could
> semantically search across sort of the building like a **genetic
> memory of a team or an institution** and be able to query across that."

**"Notebook LM on steroids, but shared"** — Jonathan Wu, Mar 5 2026:
> "I can see, kind of, like, it's like **Notebook LM on steroids,
> right, but shared**."
> Guy: "It's like notebook LLM that you can share across a group,
> including people outside your company."

**"Effi is the memory for everyone in the org"** — Chris Baum, Jan 7
2026:
> "I've had my mind blown by Claude using memory in Projects... 'That
> comes directly from your own work and insights that I've learned from
> our conversations.' I was speechless... Now take that and add what
> happens when Effi is the memory for everyone in the org."

**"Shared, referenceable mental model for both people and machines"**
— Chris Baum, Jan 7 2026, "Re: Keep an eye on?":
> "The lack of persistent understanding is just glaringly missing from
> AI systems... Can you imagine what it looks like when there is an
> actual **shared, referenceable mental model for both people and
> machines**???"

### 2.3 The internal "feature request" debate (the central thread)
*Source: `raw-quotes/q2-second-brain-FULL.txt` §HIT 2*

**Email thread "Re: Effi made its first feature request :-)", Apr 16–17
2026** — Guy, Oria, Lihu, Nitsan (CC), Chris (CC).

**Guy (Apr 16):**
> "She also suggested updating her record, which she currently cannot
> do. But it suggests that she expects the user to find it valuable -
> imagine that I can tell her what happened (less relevant for Fathom,
> more relevant for **corridor conversations, phone calls and
> whatsapp**)"

**Oria (Apr 16):**
> "It makes me think of Effi as an **'informal, non mandatory channel
> to catch off the record decisions/actions/changes'**"
>
> "we had some debate in the dev team, about us missing a place/platform
> to record all the 'softer' parts of the work process - **independent
> decisions, insights, lessons learned, watchouts, things we want 'the
> project to remember' but don't deserve a spec or a meeting**. I
> imagined telling Effi **'remember it for me'**, Nitsan argued
> (rightly) that this is not Effi's official use case/story."

**Lihu (Apr 17):**
> "I completely agree with the points you both wrote - concerning ways
> in which Effi gets to know about things that DID NOT appear in her
> data sources. @Chris Baum, I'd be happy to hear your thoughts on the
> matter. How do you think it should work, UX-wise?"

### 2.4 The roadmap commitment a week later
*Source: `raw-quotes/q5-FULL.txt` §3, §4 — Apr 23 2026 feature prioritization meeting (Fathom summary `7aa1c1a1`)*

> "**Need:** Users require a way to write *to* Effi to log decisions,
> save chats, and provide direct inputs, making it a more active
> project manager.
>
> **Proposed Features:**
> - **Save Chat:** An opt-in button to save a chat as project data,
>   with visibility controls (internal/external).
> - **Direct Input:** A new data type (e.g., 'Note,' 'Decision') for
>   logging information directly.
> - **Long-term Vision:** A chat-first UX for all actions, with the
>   current UI becoming a 'power user' alternative."

**Action items from that meeting:**
- Oria: *"Design Notes/Decisions/Action Items data type; implement CLI;
  add UI"*
- Nitsan: *"Develop a 'save chat' feature, starting with an opt-in
  model."*

### 2.5 The "WHY gets lost" thesis (most-repeated thread in the corpus)
*Source: `raw-quotes/q5-FULL.txt` §1, `q8-distillation-FULL.txt` §4*

**Guy ↔ Lorne Novolker (Feb 4 2026):**
> "Many times we take a note of the decision we made, but not of the
> options we considered. And then you run into, oh, why did we decide
> this thing again? I remember that there was a debate. Or maybe, you
> know, the option we didn't take, we learned something new later that
> actually made this option more compelling."

**Guy ↔ Maggie Copeland & Lopa Shah (Feb 25 2026):**
> "you can write a one-liner in a decision that we decided X, but the
> reason, you at some point somebody goes to implement it, or you learn
> something new, and somebody's asking like, why did we decide it
> again? And you remember like, oh, I remember there was a lot of
> discussion, I don't remember why."
>
> Lopa: *"Even if I have notes from five different meetings... these
> tools are not evolved in a way that they can synthesize and
> understand that this one topic was discussed on four different
> meetings, and this is the decision that was taken."*

**Guy ↔ Jason T. (Mar 9 2026):**
> "the leaders either don't remember what was agreed to, or they are
> not able to stay on top of like what the progress is."

**Guy ↔ Andrea Jones (Nov 20 2025):**
> "There's only all these insights coming in the meeting, and nobody
> remembers them... I see a bunch of smart people talking, and I'm
> quite sure that everything they said in the meeting, they already
> said before, and they will need to say it again if they want it to
> make an impact... Nobody ever listens to the recording."

**Guy ↔ Robert Janecek (IAS, Jan 21 2026):**
> "Like somebody opens a ticket and is like, why are we doing it this
> way? It's like, oh, there was like a 30-minute conversation about
> why we're doing it this way versus the other and all the options we
> considered... maybe actually the other option is a good option. But
> all this stuff never make it to a ticket or to an approval request.
> And you later revisit, like, hey, why did we do it? Should we
> actually flip our decision? **All this stuff is lost currently**".

**Pain-point document (attachment `560e52be`):**
> "**Decision Re-Litigation Loop** — Past decisions get re-opened
> because no one captured the 'why,' the alternatives considered, or
> the tradeoffs discussed. Three months later, someone questions a
> decision, and the team must reconstruct the rationale or worse —
> revisit it from scratch."

### 2.6 Knowledge-graph framing across the corpus
*Source: `raw-quotes/q3-knowledge-graph-FULL.txt`*

**MoVi / Collective Team (Dec 5 2025) — the "knowledge-graph obsessed"
counterpart story:**
> "we sort of built this like knowledge graph software where users can
> build out topic-specific context windows, essentially using
> embeddings. And like it automatically builds out the edges between
> those nodes that you upload."

**Guy's own framing in the same meeting:**
> "I started the opposite way from you. You thought knowledge graph. I
> said, I don't care. I'm licensing... It's not exactly knowledge graph
> because they have documents in it. It's not organized."

**Chris ↔ Guy "Keep an eye on?" thread (Jan 7–8 2026):**
> Chris: "let the agents create the context graph 'of record'. They
> aren't 'choosing' that mental model or making different ones for the
> same context, they are **emergently building the context graph for
> everyone**."
>
> Chris (PS): "Even originally, I wasn't advocating for us to have a
> mental model set for the projects. I wanted that mental model to
> **emerge from the uploaded content** and interactions with Effi."

**Nitsan in "latency" thread (Mar 24 2026):**
> "A tool that can create a view of a project's raw data (and later
> including Effi's mental model of the project) with a token budget...
> This tool can then be used by the system or by Effi herself."

**Guy concluding the same thread:**
> "if Effi had her own two-line project summary that she could submit
> as a recommendation. **This will be the first time a graph is
> *needed* for a feature to work well.** Lihu is on it."

### 2.7 Cross-session memory + "Claude as interface"
*Source: `raw-quotes/q7-claude-context-FULL.txt`*

**Guy ↔ Joshua Mindel (Jan 21 2026):**
> "doesn't have cross-session memory, which is, again, we should fix,
> but imagine over time if she can start saying, like, okay, I have an
> idea of who you are."

**Guy's manual workaround → asks Lihu to bake it in (Feb 3 2026):**
> "Keep the context you gained in your working memory. If the user is
> asking a follow up question on the same topic answer from memory —
> it reduces latency"

**Effi's own context-overflow diagnosis, forwarded by Guy (Apr 12 2026):**
> "That summary is lossy — exact transcript text, specific quotes, and
> intermediate tool results don't survive it. That's why some tasks...
> were 'completed' in tool calls but the actual response never landed —
> the context filled up before I could write it."
>
> "Session breaks between heavy tasks — starting a fresh session for
> each major analysis keeps the buffer clean."

**"Claude as the surface" — three meetings, escalating conviction:**
- Guy ↔ Omer (Mar 2 2026): *"let's have Claude, the only, the
  interface to it can be Claude. Claude reads into it and Claude
  writes, writes out of it."*
- Guy ↔ Chandra (Apr 17 2026): *"my interface is Claude for my work...
  let me talk with you through Claude"*
- Guy ↔ Elsante (Apr 24 2026, describing the team's actual workflow):
  *"Nitsan asks Claude... Claude is plugged into Effie through a
  command line interface, of course, he can, so he just asked... hey,
  Claude, what did the customer ask for, and Claude goes to Effie"*

### 2.8 Capture mechanics + Wispr Flow
*Source: `raw-quotes/q4-FULL.txt`, `q6-capture-FULL.txt`*

**Wispr Flow inventory** (the only capture tool with team adoption):
- Nov 19 2025 — invite from Wispr Flow to Guy: *"Nitsan
  (nitsanav@gmail.com) has invited you to their team on Flow Pro"*
- Jan 7 2026 — Chris recommends in "Re: UX iterations" (quote in §1.4)
- Jan 10 2026 — Lihu reply: *"Yup, Nitsan introduced me to Wispr a
  while ago, and now we're telling Claude what to code without even
  writing it.., living in the future :)"*
- Jan 12 2026 — Oria forwards Wispr onboarding email to project inbox
- Mar 10 2026 — Guy ↔ Caro meeting, Guy: *"I'll use the Whisperflow."*
- Apr 16 2026 — Guy ↔ Will/Uri demo: *"I'm going to do it with the
  Whisperflow"*
- Subscription records confirm active Pro team plan billing
  Jan→Feb→Mar→Apr 2026.

**Voice-notes external suggestion** — Andrea Jones, Dec 3 2025:
> "I could see voice notes being a huge component. That way instead of
> a bunch of typing or even opening apps, people could record a voice
> note and have it saved in their phones or even email it to each
> other"

**Implicit/tribal knowledge** — Dorina, Dec 3 2025:
> "the really, really valuable stuff is the implicit knowledge that is
> not written down, that is not in emails... it's basically the
> experience."
> Guy: *"Knowing what wasn't said, for example."*

**Feature-prio meeting Hebrew exchange (Apr 23 2026), the
"take-a-note" turn:**
> Guy: *"Sometimes [Effi] asks, I give some feedback, and says, 'Oh, do
> you want me to take a note for it for last time?'"*
> Oria: *"Sure, can you take a note?"*
> Guy: *"Actually I can't, take a note for it for last time."*
> Oria: *"Yeah, so that's actually a very natural expectation... it's
> not exactly Effi's job, to write things down, to be that recorder —
> what decisions we received."*

### 2.9 Distillation as a named feature
*Source: `raw-quotes/q8-distillation-FULL.txt` §1*

**"Distilled Context Feature Concept"** — labeled in team meeting
notes (~early Apr 2026):
> "**Inspiration:** A user's Claude workflow for synthesizing career
> history. **Workflow:** 1. Raw Input: Uploaded unedited,
> stream-of-consciousness notes. 2. AI Synthesis: Claude, with human
> guidance, distilled the raw data into structured markdown documents.
> 3. Application: These distilled documents were then used as the core
> context for new tasks, leading to more consistent and accurate
> results."
>
> "**Potential for Effie:** Using distilled context could significantly
> improve AI efficiency and consistency... Effie could **proactively
> ask clarifying questions** to help users create these distilled
> summaries, which would then become part of the project's persistent
> context."

**Effi's own "mental model" decision** — UX wireframe meeting (Fathom
summary):
> "**Concept:** Make Effi's internal understanding of a project visible
> to the owner. **Decision:** Punt on visual diagrams for now. Text is
> simpler to build and iterate on."

### 2.10 Theoretical sources the team is reading
*Source: `raw-quotes/q8-distillation-FULL.txt` §5, `q2-second-brain-FULL.txt` §9–10*

**"The New Physics of Project Intelligence"** (attachment, circulating
internally Jan 2026 era):
> "**Use Case 6: Decision Documentation — Collecting Memo as Memory**
> The old physics: Decisions are made in meetings. Rationale is
> partially captured in notes, partially lost. When stakeholders
> rotate, context is lost and decisions get relitigated.
> The new physics: After any significant decision, the system prompts
> key participants (in parallel): 'What was your understanding of why
> we made this decision? What tradeoffs did we accept?' Synthesizes
> into a 'decision record' that captures multiple perspectives on the
> rationale — not a sanitized single narrative... It's spaced
> repetition for organizational memory."

> "**Use Case 5: Cross-Project Weak Signal Detection** — The most
> valuable patterns are often emergent across projects but not named by
> anyone, present in the negative space (what's conspicuously absent
> across multiple contexts), or contradictions between what different
> teams believe to be true."

**Snowden / SenseMaker prep doc** (attachment "Research & Questions for
Conversation with Dave Snowden"):
> "SenseMaker®... was explicitly designed to capture organizational
> patterns without requiring centralized interpretation — a direct
> parallel to askeffi.ai's goal of 'carrying context so stakeholders
> don't have to.'"
>
> "most organizational failures occur 'not because individuals don't
> know things, but because the system fails to maintain shared context
> across roles.'"

> Snowden's framework: askeffi.ai should be designed as an **'enabling
> constraint'** — a system that **carries context and creates
> connections without dictating behavior or replacing judgment.**

**"Agentify"** book (chapter "Dream, Distill, Differentiate: Your
Agent's Data Moat"):
> "Competitive AI agents will need an engineered analog: a background
> phase for offline knowledge refinement... It compresses memories,
> refines skills, seeks knowledge, and can explore counterfactuals
> without interrupting service."

---

## 3. Raw inventory

Every meaningful hit, with source / date / entity ID, in chronological
order. Full quotes live in the cited per-sweep files.

### Pre-2026

| Date | Source | What | Where |
|---|---|---|---|
| Nov 19 2025 | Email — Wispr Flow → Guy | Nitsan invites whole team to Wispr Pro | q4-FULL §Source 1 |
| Nov 20 2025 | Meeting — Guy ↔ Andrea Jones | "all these insights coming in the meeting, and nobody remembers them" | q5-FULL §1 |
| Dec 3 2025 | Meeting — Dorina Buehrle ↔ Guy | "the really, really valuable stuff is the implicit knowledge" / "knowing what wasn't said" | q5-FULL §5, q8-FULL §7 |
| Dec 3 2025 | Meeting — Stephen ↔ Guy | "they don't say everything that happened in a meeting that resulted in creating the Jira ticket" | q6-FULL |
| Dec 3 2025 | Email — Andrea Jones → Guy, "Re: Pain points for Ask Effi" | external "voice notes being a huge component" suggestion | q2-FULL §HIT 8, q6-FULL |
| Dec 5 2025 | Meeting — Pablo / Collective Team ↔ Guy (MoVi check-in, transcript `fad4633c`) | "knowledge graph obsessed... genetic memory of a team or institution"; "first social knowledge exchange platform" | q3-FULL §Hit 1, q2-FULL §HIT 4 |
| Dec 5 2025 | Email — Fathom recap of MoVi meeting (`d83674ec`) | "Maverick: solution-first knowledge graph"; AskEffi problem-first | q3-FULL §Hit 2 |
| Dec 12 2025 | Email — AlignOrg design partner notes (Guy) | "tribal knowledge that isn't always well documented" | q8-FULL §7 |
| Dec 12–13 2025 | Email — Guy → Dave Snowden | introduces AskEffi as "help executives, SMEs, and clients re-enter a project... without forcing the project team to restate the narrative each time"; SenseMaker / enabling-constraint reply | q8-FULL §9 |
| Dec 13 2025 | Email — Guy → team, "This is cool: Feedback mechanism" | Effi self-acknowledges no cross-session visibility | q7-FULL §3 |

### Jan 2026

| Date | Source | What | Where |
|---|---|---|---|
| Jan 7 2026 | Email — Chris Baum → team, "Re: UX iterations" | recommends Wispr Flow ("VERY fluidly takes your voice input"); pushes for big chat box / "talk to Effi, add documents" | q4-FULL §Source 2, q6-FULL |
| Jan 7 2026 | Email — Chris Baum → Guy, "Re: Keep an eye on?" | "lack of persistent understanding glaringly missing... shared, referenceable mental model for both people and machines" | q2-FULL §HIT 7, q3-FULL §Hit 3, q7-FULL §1 |
| Jan 7 2026 | Email — Chris Baum → Guy, "This is cool: Feedback mechanism" | mind-blown by Claude Memory in Projects; "Effi is the memory for everyone in the org" | q7-FULL §2 |
| Jan 8 2026 | Email — same thread, Chris's clarification | "let the agents create the context graph 'of record'... emergently building the context graph for everyone" | q3-FULL §Hit 3, q7-FULL §1 |
| Jan 10 2026 | Email — Lihu reply | "Nitsan introduced me to Wispr a while ago, and now we're telling Claude what to code without even writing it" | q4-FULL §Source 3 |
| Jan 12 2026 | Email — Oria forwards Wispr onboarding to project inbox | confirms team-wide adoption | q4-FULL §Source 4 |
| Jan 21 2026 | Meeting — Joshua Mindel ↔ Guy | "doesn't have cross-session memory, which is, again, we should fix" | q7-FULL §4 |
| Jan 21 2026 | Meeting — IAS / Robert Janecek ↔ Guy | "All this stuff never make it to a ticket or to an approval request... All this stuff is lost currently" | q8-FULL §4 |
| Jan 29 2026 | Email — Fathom recap of internal team meeting (4 copies: `11a36f84`, `38211683`, `40581fd4`, `65a26c84`) plus Lihu's copy `cd1d8bb9`, 54 min meeting | THE "Zettelkasten" Context Graph proposal — only verbatim Zettelkasten mention in corpus | q1-FULL, q3-FULL §Hit 4, q8-FULL §6 |
| ~Jan 2026 | Attachment — "The New Physics of Project Intelligence" (entity `838b8826`) | "spaced repetition for organizational memory"; weak-signal detection; decision records with multiple perspectives | q2-FULL §HIT 9, q5-FULL §6, q8-FULL §5 |
| ~Jan 2026 | Attachment — "Research & Questions for Conversation with Dave Snowden" | Snowden / SenseMaker / enabling-constraints framing | q2-FULL §HIT 10, q8-FULL §9 |

### Feb 2026

| Date | Source | What | Where |
|---|---|---|---|
| Feb 2 2026 | Email — Guy → team (Email Integration progress) | "email per project... sandbox... inbox must be empty after processing" | q6-FULL §Inbox |
| Feb 3 2026 | Email — Guy → team, "Quick helpful fix: augmenting system prompt" | "Keep the context you gained in your working memory" — manual workaround Guy asks Lihu to bake in immediately | q7-FULL §6 |
| Feb 3 2026 | Email — Guy → Chris, "Re: A few contacts" | literal **"second brain"** mention | q2-FULL §HIT 1 |
| Feb 4 2026 | Meeting — Lorne Novolker ↔ Guy | "we take a note of the decision we made, but not of the options we considered" | q5-FULL §1 |
| Feb 9 2026 | Meeting — Impromptu Google Meet (Chris ↔ Guy) | "doing work in the project by talking to Effie that needs to actually be part of that knowledge graph" | q2-FULL §HIT 6 |
| Feb 25 2026 | Meeting — Maggie Copeland & Lopa Shah ↔ Guy | "tools are not evolved in a way that they can synthesize and understand that this one topic was discussed on four different meetings" | q5-FULL §1 |
| ~Feb 2026 | Meeting — Guy ↔ David (note-taking tools chat) | David prefers Notion as it "runs invisibly in the background during meetings" | q4-FULL §Notion |

### Mar 2026

| Date | Source | What | Where |
|---|---|---|---|
| Mar 2 2026 | Meeting — Omer Khalid ↔ Guy | "let's have Claude, the only, the interface to it can be Claude" | q7-FULL §8 |
| Mar 5 2026 | Meeting — Jonathan Wu ↔ Guy | "Notebook LM on steroids, but shared" | q2-FULL §HIT 5 |
| Mar 9 2026 | Meeting — Jason T. ↔ Guy | "leaders either don't remember what was agreed to" | q5-FULL §1 |
| Mar 10 2026 | Meeting — Guy ↔ Caro | "I'll use the Whisperflow" (live demo) | q4-FULL §Source 6 |
| Mar 18 2026 | Email — Guy → Ricky Green (Epsilon) | Fathom incoming as "first of many note takers" | q6-FULL |
| Mar 23–24 2026 | Email thread — "Small change to drop latency to 12 seconds" (Guy, Nitsan, Oria, Lihu, Chris) | Nitsan: token-budget data view + Effi's mental model; Chris: incremental context-graph building / markdown summaries; Guy: "first time a graph is *needed* for a feature to work well" | q3-FULL §Hit 5 |
| Mar 24 2026 | Email — Phil Lau → Guy | "I lost my chat history within a specific project" — design partner reports refresh-loses-everything bug | q5-FULL §3, q7-FULL |
| Mar 24 2026 | Meeting — Manoj Swaminathan (SAP) ↔ Guy ↔ Noela Nakos | "almost like a postmortem... we had to go and relive the part to get that data" | q8-FULL §3 |
| Multiple | Fathom internal meeting summaries (Mar–Apr) | "stateless agent rebuilding from scratch for every query" — root-cause framing | q7-FULL §5 |

### Apr 2026

| Date | Source | What | Where |
|---|---|---|---|
| Apr 8 2026 | Email — Chris → team | "Are you syncing just the transcript, or more than that?" | q6-FULL |
| ~early Apr 2026 | Team meeting notes (Fathom) | "Distilled Context Feature Concept" labeled and assigned | q8-FULL §1 |
| Apr 12 2026 | Email — Guy → team, "Testing Effi with a large project" | Effi's own diagnosis of context overflow / lossy summarization | q7-FULL §7, q5-FULL §2 |
| Apr 16 2026 | Email thread "Re: Effi made its first feature request :-)" | **The central internal debate.** Guy: corridor-conversation capture; Oria: "remember it for me" / "off the record decisions" / Nitsan's pushback; Lihu: open UX question to Chris | q2-FULL §HIT 2 |
| Apr 16 2026 | Meeting — Will / Guy / Uri | "I'm going to do it with the Whisperflow" demo | q4-FULL §Source 5 |
| Apr 16 2026 | Meeting — Elaine Edmiston ↔ Guy | "It's not like structured to capture all of this information" | q6-FULL |
| Apr 17 2026 | Meeting — Chandra ↔ Guy | "my interface is Claude for my work... let me talk with you through Claude"; Chandra venting about token-burn debugging | q7-FULL §8, §10 |
| Apr 23 2026 | Feature-prioritization meeting (Lihu, Guy, Nitsan, Oria) — Hebrew transcript `c6bbd156`, Fathom summary `7aa1c1a1` | The "take-a-note" exchange + assigned features: Save Chat (Nitsan), Notes/Decisions/Action Items data type + CLI + UI (Oria), Session History | q5-FULL §3,4; q6-FULL; q7-FULL §9 |
| Apr 24 2026 | Email — Guy → team, "Weekly status update" | "I didn't know I could ask Effi 'who am I'..."; Effi's self-portrait of Guy and his ~40% explaining-things autobiography | q5-FULL §7 |
| Apr 24 2026 | Meeting — Elsante ↔ Guy / AskEffi | describes team workflow: "Nitsan asks Claude... Claude is plugged into Effie through a command line interface" | q7-FULL §8 |

### Reading material attachments (undated or "circulating")

| Source | What | Where |
|---|---|---|
| Attachment — *Agentify* book chapter "Dream, Distill, Differentiate" (entity `5d6af7dd`) | Background offline knowledge refinement; "compresses memories, refines skills"; "Groundhog Day" agent forgetting | q5-FULL §2, q8-FULL §2 |
| Attachment — Pain-point document (entity `560e52be`) | "Decision Re-Litigation Loop"; "Knowledge Lives in People's Heads"; tribal knowledge | q5-FULL §1 |
| Attachment — "Systemic Inefficiency" analysis | "Task trackers capture 'what' but not 'why'... institutional knowledge evaporates" | q8-FULL §4 |
| Attachment — "The New Physics of Project Intelligence" (`838b8826`) | "spaced repetition for organizational memory"; cross-project weak-signal detection; false-alignment detection | q2-FULL §HIT 9, q5-FULL §6, q8-FULL §5 |
| Attachment — "Research & Questions for Conversation with Dave Snowden" | SenseMaker; enabling constraints; distributed cognition | q2-FULL §HIT 10, q8-FULL §9 |

---

## Closing notes for ENG-5379

1. **Reuse, don't reinvent**: Oria's already-assigned `Notes / Decisions
   / Action Items` data type (Apr 23 commitment) is the natural backbone
   for zettel storage. The team-internal 2nd brain is the same shape;
   just different visibility/scope.
2. **Wispr → Claude → effi CLI is the existing capture rail.** Voice
   into Wispr → text into Claude → `effi files add` or a future
   `/zettel` slash command. No new app, no new install. Principle 1
   satisfied for free.
3. **Claude is already the interface** the team converged on. Make
   capture and retrieval Claude-first; the UI can be the power-user
   surface (mirrors Guy's Apr 23 long-term vision verbatim).
4. **The "Effi made its first feature request" debate is not closed**;
   the Nitsan-vs-Oria framing is exactly the trajectory principle 2
   says to preserve. ENG-5379 should record this as its zettel-zero:
   the dev-team 2nd brain *is* "remember it for me", scoped to the dev
   team, before/instead of bolting it onto the product.
5. **Linear is invisible to Effi today.** ENG-5379 should be on someone's
   radar as a connector to add — otherwise Zettelkasten R&D itself will
   not be retrievable from Effi. Surfaced upward.
6. **Two unread Drive files** (`Data Model`, `Effi for multiple
   parties`, both Apr 12 2026) deserve a direct read in a follow-up if
   ENG-5379 wants the full picture of Oria's data-type design.
