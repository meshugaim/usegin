# Anthropologist — Whiteboard

ENG-5383. For a developer about to design the Effi 2nd brain. Read top
to bottom; the top is the load-bearing part.

---

## 1. Design implications — what the system must do (or refuse to do)

These are the demands a real dev team's *culture* will place on this
thing. If the design doesn't satisfy these, the artifact will become a
graveyard within a quarter, no matter how clean the data model is. This
is the lesson every wiki has had to learn the hard way.

### I-1. Capture must happen *inside* the workflow, never as a destination
The single most consistent failure mode across two decades of
internal-knowledge tooling: the tool is a **place you go**. Confluence,
Notion, the wiki — all destinations. Engineers don't go there during
work, so capture doesn't happen during work, so the content drifts out of
sync, so search returns junk, so trust collapses, so nobody contributes,
so it's a graveyard. (See P-WIKI-FAIL, P-DESTINATION below.)

→ Zettel capture must live in the surfaces already open: the terminal
  where Claude is running, the chat we're already in, the editor. A
  `/zettel` slash command, a "save this" gesture during a Claude turn, a
  voice line that becomes a note. Anything that requires opening a
  separate app loses.

→ **Ties to Principle 1** (intuitive workflows). Principle 1 isn't a
  nice-to-have; it is *the* survival constraint.

### I-2. Claude must be the primary author, but humans must be the legitimizers
This is the agent-augmented twist on the old "who writes the docs"
problem. Historically docs failed because the people who *could* write
them (senior engineers) were the ones who *needed* them least, so they
had no incentive (P-INCENTIVE). With Claude in the loop, the writing
labor collapses to near-zero — Claude can emit a zettel as a side-effect
of working. **This dissolves the labor problem and creates a new one:
the trust problem** (P-AI-TRUST).

→ Default authorship: Claude proposes a zettel; the human flicks it to
  accept / edit / reject in <2 seconds. Humans don't write from blank
  page; they curate. Stripe's "we give you a sample document so you're
  not staring at a blank page" lesson, taken to its limit.

→ Authorship attribution must be visible. A zettel by Claude (unverified)
  is read differently from a zettel by Lihu (lived experience).
  Source-attribution is a known requirement of trustworthy AI artifacts;
  hide it and the whole corpus loses signal.

### I-3. Consumption must be *involuntary* — pull a wire, get the rope
Wikis fail at retrieval before they fail at capture. Search is universally
bad (P-SEARCH-DEAD). Even the rare team that captures faithfully then
discovers nobody reads the captures because nobody knows what's there.

→ The right consumption pattern is **ambient pop-up**, not search. When
  Claude is about to touch the email-splitter code, the ENG-5197
  "no-LLM, regex-only" decision *appears in the prompt*, unbidden. When
  the human types "let's add a Notion integration" and the cluster of
  prior frustration zettels with Notion is dense, those frustrations
  surface before the work starts. *Pulling a wire reveals the whole
  rope.* (Principle 1, second paragraph; the README's framing.)

→ Concretely: zettel retrieval is a hook on Claude's pre-tool / pre-task
  flow, plus a "what's nearby?" affordance, not a search bar.

### I-4. Atomicity is non-negotiable; threading is what makes it useful
Luhmann's 90,000 cards across 40 years produced 60 books because of two
disciplines: **one idea per card**, and **explicit links between cards**.
Most "Zettelkasten apps" honor (1) and skimp on (2), and become note
piles. (P-LUHMANN.)

→ Each zettel is one thought. Multi-thought zettels split.

→ Thread metadata is first-class: a zettel without at least one link to
  prior zettels (or an explicit "new thread" marker) is incomplete. Make
  the system *help* generate these links — e.g., when a new zettel is
  proposed, surface the 3 most-related existing zettels and ask "thread?"

### I-5. Append-mostly with visible trajectory, never silent overwrite
**Principle 2** demands this directly, but the ethnographic evidence
also demands it. The single most important property of post-mortem
culture (Google SRE, PagerDuty) is that **the trail of how you got the
wrong answer is preserved**, because that trail is what teaches the next
person not to walk it again. ADRs (Architecture Decision Records) make
the same bet: the *rationale* and the *alternatives considered* are the
load-bearing parts, not the decision itself. (P-ADR, P-POSTMORTEM.)

→ Updates are new zettels that link back ("supersedes Z-0142, because…"),
  never edits-in-place. Reverted choices stay visible as reverted, with
  the why.

→ This is also a hedge against AI authorship: a Claude-written zettel
  that turns out wrong becomes evidence of *what the team thought at the
  time*, not pollution to be scrubbed.

### I-6. Capture must be ritualized at session boundaries, not "whenever"
Every team that succeeds at knowledge capture does it at a *fixed
beat*: Basecamp's 6-week Heartbeats, Stripe's friction logs at end of
flow, blameless post-mortems triggered by incidents, ADRs triggered by
decision points. "Capture whenever" reliably produces zero capture.
(P-RITUAL, P-HEARTBEAT.)

→ For us: end-of-session is the ritual. When a Claude session closes
  (or when `/zettel` is invoked), the agent proposes 0–N zettels distilled
  from the session. The human accepts/edits/rejects. Beat: every session.

→ Do not also try to do "real-time" zettels and "weekly digest" zettels
  and "incident" zettels at launch. One ritual, the session-close ritual,
  must work first. Multiple competing rituals dilute each.

### I-7. Status, ego, and the politics of being seen writing
Underrated failure mode: in any team larger than ~3, what one writes
where teammates can see it is a status performance. Junior engineers
under-write because they fear exposing ignorance. Senior engineers
over-write or refuse to write because polished prose is a
reputation-defining artifact (P-EGO). This is *why* every "everyone
should contribute to the wiki" mandate dies in a quarter.

→ Default zettel author is Claude. The human is the *editor*. This
  reframes the social act: I'm not "writing a doc on the wiki"
  (high-stakes, ego-loaded); I'm "okaying Claude's note" (low-stakes,
  curatorial). This is the most important leverage Claude gives us
  culturally, and the design must lean into it.

→ Voice / tone of zettels should be flat and observational, not
  performative. Avoid prose that invites the writer to flex.

### I-8. The 2nd brain serves the management layer, not the implementation layer
**Principle 3.** The ethnographic evidence supports this strongly:
ADRs, friction logs, decision logs, heartbeats — *all the durable
artifacts that survive in successful teams are meta-layer*. They are
about why, when, who, what-we-tried-and-rejected. Implementation details
live in code and `git log`, and successful teams know not to duplicate
them. (P-ADR, P-FRICTION-LOG.)

→ Zettel taxonomy should bias toward: decision, frustration, lesson,
  ID/reference, "good thing observed", "bad thing observed", intent. NOT:
  how-to guides, code snippets, architecture diagrams. Those belong
  elsewhere; surfacing them through zettels invites the wiki failure mode.

### I-9. Frustration clusters are a first-class signal
**Principle 4** says when we're fighting Claude, that's itself a zettel.
The anthropology backs this up at the team level: blameless post-mortems
work because they *aggregate* failures into systemic signal, not because
any single failure was insightful. A density-of-frustration map is the
team-scale version of the same instinct.

→ The system should *count* frustration zettels per topic and surface
  density. "We've now hit 7 frustrations in the email-splitter area in
  3 weeks" is a stronger argument for re-architecting than any single
  rant. This is a feature, not an afterthought.

### I-10. The half-life is shorter than you think; design for the next 6 months, not 5 years
Tribal knowledge has a documented half-life of months, not years
(P-TRIBAL). Engineers who left 6 months ago are functionally
unreachable. Documentation built for "future generations" is built
for an audience that doesn't exist; documentation built for the team
member joining next month is built for an audience that *does*.

→ Design for: "Lihu in 4 weeks, who has forgotten why we picked X" and
  "Claude in a fresh session next Tuesday, who needs to not redo the
  ENG-5197 LLM-vs-regex argument." Don't design for "the developer in
  2031." If the 6-month case works, the 5-year case mostly works too;
  the reverse is not true.

---

## 2. The patterns — success, failure, and the texture between

### Success patterns

**P-LUHMANN — Atomic + threaded + restated, sustained for decades.**
Luhmann produced ~90,000 cards over 40 years, generating ~60 books and
~600 papers. Three disciplines made it work: (a) one atomic idea per
card, (b) every card has explicit alphanumeric links to others, (c) he
*restated* sources in his own words rather than copying — the
restatement was what drove understanding. Most "Zettelkasten apps" honor
(a), skimp on (b), and skip (c) entirely. The system breaks down to
about 100–200 notes before threads start producing surprise; below that
it just feels like extra work. → For us: the design must *help generate
links* and must reward restatement (Claude paraphrasing the gist, not
quoting the transcript).

**P-HEARTBEAT — Basecamp's 6-week written digest.**
Team leads write a long-form summary every ~6 weeks of what the team did,
published to a company-wide message board. Async. People read when they
read. Critically: "creates a wonderful record of everything that's
happening across the whole company on a regular basis" — *the archive is
a side-effect of the ritual, not the goal*. New hires read past
Heartbeats to understand culture. Works because (a) fixed beat, (b)
single author per heartbeat (no diffuse responsibility), (c) async
removes scheduling friction, (d) the act of writing forces the lead to
think.

**P-STRIPE-WRITING — Sample docs, leadership-by-example, friction logs.**
Stripe's writing culture survives because the CEO and CTO write
substantial internal memos themselves (modeling), because every new doc
ships with a *sample document* (no blank-page terror), because writing
classes are part of onboarding, and because specific genre-conventions
(friction logs, decision logs) are named and shared. The two patterns
that travel best to us: the *sample document* (huge friction reducer)
and *named genres* (a "frustration zettel" is a different artifact from
a "decision zettel" — the affordance shapes the content).

**P-ADR — Architecture Decision Records, ~2 pages, in-repo, append-only.**
The ADR pattern (Michael Nygard, 2011) survives where wikis don't,
because: (a) lives in the repo, next to code, version-controlled — no
context switch; (b) one decision per record (atomic); (c) records both
*the decision* and *the alternatives considered with their trade-offs*
(this is the load-bearing part); (d) status is "proposed | accepted |
superseded" — superseding produces a new ADR linking back, never an
edit. Notice how cleanly this maps to Principle 2 (preserve trajectory)
and our zettel model.

**P-POSTMORTEM — Blameless incident write-ups as ritual.**
Google SRE's blameless post-mortem culture is the most durable
documentation ritual the industry has produced. It works because: (a)
the trigger is automatic (an incident happened, you write one — no
judgment call about whether it's "worth it"), (b) the audience is
explicit (everyone, indefinitely), (c) the genre is rigid (timeline,
contributing factors, action items) — the rigidity *removes* the
writing-friction by removing structural decisions, (d) the
no-blame frame makes contribution low-cost socially. Organizations with
mature post-mortem cultures see ~50% fewer repeat incidents.

**P-FRICTION-LOG — End-to-end user-flow notes.**
Stripe's "friction logger" deliberately gets into a user's mindset and
notes every friction point with timestamps. The ritual is bounded (one
flow, one sitting), the artifact is reusable (next person reads instead
of re-discovering), and the genre is forgiving (rough notes accepted).
This is close to what an *end-of-session zettel batch* should feel
like: a friction log of working with Claude on this slice.

**P-AMAZON-MEMO — Forced narrative discipline at decision points.**
Bezos's 6-page narrative memo, read in silence at the start of meetings,
is the strong-form version of P-ADR. The key insight: the *narrative
form* (vs. bullets) forces understanding of which things are more
important than which, and how things connect. This matters for us
because Claude defaults to bulleted output; without explicit pressure,
zettels will degrade to bullet soup, which loses the relational
information that makes them worth threading.

**P-GITLAB-HANDBOOK — "Look it up before you ask."**
GitLab's 2,700-page handbook works because of *one* cultural rule: any
change is documented *before* it's communicated or implemented. The
handbook is therefore always ahead of practice, which means looking
things up actually returns current information, which means people
actually look things up, which means the handbook gets used, which means
people maintain it. This is a flywheel; without "doc-first," it
collapses. For a small team, the equivalent is: a decision is not made
until the zettel exists. Zero exceptions. (Hard to enforce socially —
this is the rule that's most likely to die first.)

### Failure modes

**P-WIKI-FAIL — The destination problem.**
Confluence, Notion, internal wikis — all share one failure mode: they
are *places you go*. The work happens elsewhere. So capture and
consumption are both interruptions to the work. Interruptions don't
happen at scale. Survey data: engineers spend 6.5 hours/week
(GitLab) — 3–10 hours by other estimates — looking for information that
"should be documented." That's not a search problem; that's a
"never-got-captured" problem.

**P-DESTINATION — Tool fragmentation accelerates decay.**
When docs live across Confluence + Notion + Google Docs + READMEs +
Slack pins, the answer to "where is this written down?" is "ask
someone." Every new doc surface multiplies the search space and divides
the maintenance attention. For us: resist the temptation to add a
"second" zettel surface (a separate web UI, a notion-export, a wiki
mirror) "for convenience." Single canonical store. Multiple capture
*entry-points* fine; multiple *stores* fatal.

**P-INCENTIVE — The economics make documentation irrational.**
The people who *can* write the docs (senior engineers) are the people
who *need* them least. They get no individual benefit from writing,
and they bear the cost. Worse: in some orgs, being the keeper of tribal
knowledge is a *status asset* — writing it down is, individually,
economically irrational (P-EGO overlaps here). HN comment summarizes:
"Forcing tribal knowledge to be written documented is the issue."
Solving this requires either making writing nearly free (Claude does it)
or making it socially rewarded (post-mortem culture, Heartbeats — the
*reading* validates the writer).

**P-SEARCH-DEAD — Every wiki has bad search; this is structural.**
The HN consensus: "I have yet to actually use a platform with a good
search functionality." This is partly a tooling failure but mostly
structural — large corpora of inconsistently-tagged, inconsistently-
maintained documents resist search regardless of indexer. The escape
hatch is *not better search*; it's *push, not pull* — the system surfaces
relevant zettels into the work, rather than waiting for someone to query.

**P-OUTDATED-WORSE-THAN-NOTHING — Stale docs poison the well.**
"Out-of-date documentation can be worse than no documentation at all
when it's actively wrong." This is the strongest argument for
append-mostly with visible supersession (Principle 2): stale info marked
as superseded is *less* harmful than stale info that looks current.

**P-EVERYONE-NO-ONE — Diffuse responsibility kills capture.**
"What becomes everyone's responsibility effectively becomes no one's
responsibility." Every wiki failure post-mortem mentions this. The
counter is *named ritual ownership* (one author per Heartbeat; the
on-call writes the post-mortem; the DRI writes the ADR). For us, the
session-close ritual has a default DRI: Claude proposes, the human in
the session approves. No diffusion.

**P-EGO — Writing-where-others-can-see-it is a status performance.**
Less talked about, fully real. Engineers who would happily write a
private note balk at writing the same content in a shared space because
the shared space invites judgment. Notion/Confluence make this *worse*
by being visibly polished (page templates, formatting tools,
publishing-feel). Successful patterns *de-formalize* the artifact: a
post-mortem is "rough", a Heartbeat is "informal", an ADR is "just a
markdown file." For us: zettels should look raw. No rich-text editor,
no publishing flow. A zettel is a paragraph in a markdown file, full
stop.

**P-AI-TRUST — Agent-authored content has a credibility floor.**
~96% of developers don't fully trust AI-generated *code*; the same
gradient applies to AI-generated *notes*. A corpus of unverified
Claude-written zettels degrades to "noise we ignore" within weeks.
Mitigations: visible authorship attribution (this zettel is unverified
Claude-generated; this one is human-edited), source-pinning (which Claude
session, what was the trigger, what tools were called — `session
code-history` style), and the human-as-editor default (I-2). Without
these, the design has the *opposite* effect of intended: more zettels,
less trust, less use.

### Texture observations (smaller patterns worth knowing)

- **Async vs sync teams differ on what gets captured, not whether.**
  Sync teams capture less and forget more, but recover via
  hallway-conversation and tribal-knowledge. Small co-located teams can
  survive *without* a 2nd brain longer than they think — until someone
  leaves. Async teams (GitLab, Basecamp) capture more because they
  *have to*; the tooling demands surface from necessity. We're sync
  (Lihu + Claude pairing in real time) but with Claude as the
  perpetually-amnesiac team member, which makes us behave like an async
  team. The 2nd brain is the bridge memory across Claude's session
  resets.

- **Engineering blogs are usually side-effects of internal practice,
  not deliberate marketing.** Stripe's external docs are exceptional
  because Stripe's internal writing is exceptional — the external is a
  side-effect. Implication: don't try to design for *external* publishing
  later; build the internal practice well and external surfaces become
  cheap.

- **The 100–200 note threshold.** Zettelkasten practitioners report the
  system feels like extra work until 100–200 notes accumulate; above that
  threshold, surprising connections start appearing. Below, it feels
  pointless. This is the **first-quarter trough**; the design must
  account for it (e.g., Claude seeds the corpus aggressively early so
  the threshold is crossed before the human loses faith).

- **15-minute "teach the team something" rituals work surprisingly well**
  in small teams as a sustaining ritual — but only when the artifact
  (the recorded teach) ends up in the corpus. Without capture, it's
  evanescent. For us: when Lihu pauses to explain something to Claude,
  *that explanation is a zettel*. The capture should be automatic.

- **Authorship spectrum ambiguity.** Research on co-creative writing
  shows people develop fluid, spectrum-like ownership feelings about
  AI-assisted artifacts. They neither fully own nor fully disclaim them.
  The system can lean into this — zettels can be tagged
  human-authored / human-edited-Claude-draft / Claude-only — without
  forcing a binary attribution.

---

## 3. Sources

### Books / canonical references
- Niklas Luhmann, *Zettelkasten* (the original — 90,000 cards, 60
  books, 600 papers; sociology dept., Bielefeld). Survey via
  Wikipedia and zettelkasten.de.
- Michael Nygard, *Documenting Architecture Decisions* (2011, the
  origin of the ADR format). https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- Martin Fowler on ADRs: https://martinfowler.com/bliki/ArchitectureDecisionRecord.html
- Google SRE Book, Postmortem Culture chapter:
  https://sre.google/sre-book/postmortem-culture/
- PagerDuty Postmortem Documentation, "The Blameless Postmortem":
  https://postmortems.pagerduty.com/culture/blameless/

### Case studies
- **Stripe writing culture:** Pragmatic Engineer, "Inside Stripe's
  Engineering Culture":
  https://newsletter.pragmaticengineer.com/p/stripe
  Slab, "How Stripe Built a Writing Culture":
  https://slab.com/blog/stripe-writing-culture/
- **Basecamp Heartbeats:** Jason Fried, "What's in a Heartbeat":
  https://world.hey.com/jason/what-s-in-a-heartbeat-4fd72d0e
  Basecamp Handbook, "How We Work":
  https://basecamp.com/handbook/how-we-work
- **GitLab handbook-first culture:**
  https://handbook.gitlab.com/handbook/company/culture/all-remote/
  Async section:
  https://gitlab.com/gitlab-com/content-sites/handbook/blob/main/content/handbook/company/culture/all-remote/asynchronous.md
- **Amazon 6-page memo:** Slab, "How Jeff Bezos Turned Narrative into
  Amazon's Competitive Advantage":
  https://slab.com/blog/jeff-bezos-writing-management-strategy/

### Wiki failure post-mortems / practitioner voice
- Hacker News, "Is every company's internal wiki just broken by
  default?" — most-cited failure modes summarized in P-WIKI-FAIL,
  P-EVERYONE-NO-ONE: https://news.ycombinator.com/item?id=44507780
- DEV Community, "Why Your Engineering Wiki is a Graveyard":
  https://dev.to/kislay/why-your-engineering-wiki-is-a-graveyard-and-how-to-fix-it-2eme
- Notion, "The hidden cost of disconnected knowledge" (note: by
  Notion, but the framing of "knowledge as destination" is the
  insight): https://www.notion.com/blog/the-hidden-cost-of-disconnected-knowledge

### Tribal-knowledge / capture-economics
- DevHuddle, "Untangling Tribal Knowledge":
  https://devhuddle.ai/untangling-tribal-knowledge-in-software-development/
- Glue, "Tribal Knowledge in Software Teams — The Silent Killer":
  https://getglueapp.com/blog/tribal-knowledge-software-teams
- DX, "Motivating developers to care about documentation":
  https://getdx.com/blog/documentation-culture-engineering/
- Microsoft Premier Developer, "Tribal Knowledge — The Anti-DevOps
  Culture": https://devblogs.microsoft.com/premier-developer/tribal-knowledge-the-anti-devops-culture/

### Human-AI collaboration / agent-augmented teams
- Springer, "Designing Transparency for Effective Human-AI
  Collaboration":
  https://link.springer.com/article/10.1007/s10796-022-10284-3
- IBM Research, "Building Trustworthy AI Collaborators: Factuality
  and Source Attribution in Agentic Workflows":
  https://research.ibm.com/publications/building-trustworthy-ai-collaborators-factuality-and-source-attribution-in-agentic-workflows
- Focused, "Retrospective on Rituals in a World of Human + Agent
  Collaboration":
  https://focused.io/lab/retrospective-on-rituals-in-a-world-of-human-agent-collaboration
- arXiv, "Evaluating Human-AI Collaboration: A Review and
  Methodological Framework":
  https://arxiv.org/html/2407.19098v2
- Stack Overflow Developer Survey 2025 (cited via Graphite, IBM,
  multiple) — ~25% of developers using AI for documentation.

### Friction / DX context
- DX, "Developer documentation: how to measure impact":
  https://getdx.com/blog/developer-documentation/
- Pragmatic Engineer, "Frictionless: why great DX wins in the AI
  age":
  https://newsletter.pragmaticengineer.com/p/frictionless-why-great-developer
- Atlassian Developer Experience Report 2025:
  https://www.atlassian.com/blog/developer/developer-experience-report-2025

### Collateral notes file
- See `notes-source-quotes.md` (sibling file) for the verbatim
  practitioner quotes and direct excerpts that power the
  texture-observations and P-* failure summaries above.
