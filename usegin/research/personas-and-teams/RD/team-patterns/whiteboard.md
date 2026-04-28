# Team-composition patterns — whiteboard

> **Angle 3 of 5** in the personas-and-teams R&D round.
> Charter: catalogue team-composition shapes from outside AI we should steal
> for our personas+teams system, and recommend which to instantiate.
> Author: RD-team-patterns manager. Date: 2026-04-27.

---

## Top — the click

The team-composition vocabulary we're missing splits into **four orthogonal axes** that
should each become a slot in our future `usegin/teams/<name>.md` files:

1. **Cardinality + parallelism.** 1 / N-parallel-independent / N-debating-each-other / 1+crew (chief-and-supports) / sequential-pipeline.
2. **Stance distribution.** Symmetric (everyone same stance) vs. asymmetric (one is
   the surgeon, one is devil's advocate, one is the facilitator).
3. **Convergence mechanism.** Vote / lead-synthesizes / debate-to-agreement /
   veto-by-one / blameless-distillation / no-convergence-by-design.
4. **Time shape.** One-shot, iterating-loop, append-mostly-corpus, on-demand-tripwire.

Most "team patterns" from human practice are *just configurations of these four*.
We already implement a few inside skills (rnd is N-parallel-independent + lead-
synthesizes; tikur is blameless-distillation; brainstorm is N-parallel-independent
+ no-convergence). What we're **missing** as named team compositions:

- **adversarial-pair shapes** (red/blue, devil's advocate, advocatus-Dei vs diaboli)
- **role-asymmetric crews** (surgical team, six-hats with a Blue-Hat facilitator)
- **failure-imagination shapes** (pre-mortem)
- **debate-to-agreement** (Du-et-al multi-agent debate, AutoGen GroupChat)
- **empowered-tripwire** (andon-cord — any worker can stop the line)
- **public-defense** (crit)

These are the eight we should instantiate. The shape-personas matrix and a worked
example are below.

---

## Middle — the catalogue

Each entry: **Origin → Roles → Interaction shape → Best-for → Failure mode → Translatability**.

### 1. Six Thinking Hats (de Bono)

- **Origin.** Edward de Bono, *Six Thinking Hats* (1985). Used heavily in Lean and
  product-strategy meetings.
- **Roles.** Six framings of *the same problem* — a team rotates through them.
  - **Blue** (facilitator / process owner) — opens and closes the cycle, sets
    the order, calls time.
  - **White** (facts) — neutral data only, no inference.
  - **Red** (gut/feel) — emotion, intuition, no justification required.
  - **Yellow** (benefits) — best-case framing, value, upside.
  - **Black** (risks/critique) — pitfalls, what could break.
  - **Green** (creative) — new options, "what if".
- **Interaction shape.** Sequential, time-boxed, *all participants wear the same
  hat at the same time*. Blue Hat starts and ends every sequence (meta-frame +
  retro). Pure framing rotation, not role specialization.
- **Best-for.** A single decision where the team would otherwise let one person's
  stance (the loud Black-Hat skeptic, the loud Yellow-Hat optimist) dominate.
  Forces every framing to be explicitly visited.
- **Failure mode.** Performative hat-switching where the team doesn't really
  re-orient; the Black-Hat-by-nature person stays Black under every hat.
- **Translatability.** Excellent. We can instantiate as **N=6 parallel sub-Gins,
  each primed with one hat, run on the same artifact, then a Blue-Hat synthesizer**.
  Maps cleanly onto our existing parallel-team mechanics (rnd / brainstorm).

### 2. Red Team / Blue Team / Purple Team (cybersecurity)

- **Origin.** Cold-War wargaming → cybersecurity (NIST SP 800-160, ~2000s
  formalization). Now industry-standard.
- **Roles.**
  - **Red** — adversary; tries to break the system, find exploits, evade detection.
  - **Blue** — defender; monitors, detects, responds, hardens.
  - **Purple** — collaborator/synthesizer; bridges Red and Blue, ensures the
    learnings actually land in defenses. Often facilitates a *joint debrief*.
- **Interaction shape.** Adversarial-but-bounded. Red and Blue act independently
  during the exercise; Purple debriefs after. Rules-of-engagement (ROE) constrain
  Red's blast radius.
- **Best-for.** Anything where "does this defense actually work" matters more
  than "is it well-designed on paper". Pre-launch security review, spec
  robustness, stress-testing assumptions.
- **Failure mode.** Red wins too easily and Blue gets demoralized; or Purple is
  absent and learnings don't land back in code.
- **Translatability.** Excellent. We have an unrigged precedent (z090 — wispr-
  corrector cold-read sub-agent). Worth a dedicated `red-blue-purple.md` team.

### 3. Devil's Advocate / Advocatus Diaboli vs Advocatus Dei (Roman Catholic, 1587–1983)

- **Origin.** Pope Sixtus V formalized the office of *Promoter of the Faith*
  (devil's advocate) in 1587, paired with the *Promoter of the Cause* (God's
  advocate). Their job: a public, structured, *opposed-pair* argument before a
  jury (the cardinals) over whether to canonize.
- **Roles.**
  - **Promoter of the Cause** (advocatus Dei) — argues *for* canonization;
    presents virtues, miracles, evidence.
  - **Promoter of the Faith** (advocatus diaboli) — argues *against*;
    skeptical of evidence, finds character flaws, challenges miracle claims.
  - **The jury** (cardinals) — decides; both advocates argue *to them*, not
    against each other directly.
- **Interaction shape.** Asymmetric pair + jury. The two advocates do *not*
  debate to agreement — they each build the strongest case for their side; the
  jury synthesizes. Reduced after Vatican II (1983) but the *shape* survived in
  decision theory.
- **Best-for.** Decisions where the cost of false-positive (canonizing the wrong
  person, shipping the wrong feature, hiring the wrong person) is high and
  consensus-bias is the failure risk.
- **Failure mode.** Devil's-advocate role gets diluted into "play devil's advocate
  for 5 min" — half-hearted critique. The discipline is that the advocate is
  *fully* committed to their side for the duration.
- **Translatability.** Excellent and **distinct from Red/Blue**: Red/Blue is about
  finding exploits in a *system*; Dei/Diaboli is about evaluating a *proposal*.
  Worth instantiating as a dedicated `devils-advocate.md` team for high-stakes
  decisions (architectural calls, big spec acceptance).

### 4. Pre-mortem (Klein, HBR 2007)

- **Origin.** Gary Klein, "Performing a Project Premortem", HBR Sept 2007. Built
  on the Mitchell-Russo-Pennington (1989) finding that *prospective hindsight*
  improves risk identification by ~30%.
- **Roles.** Symmetric — no specialization. *Everyone* on the team imagines the
  project has already failed badly and writes (silently, ~3 min) every reason
  they can think of. Then a facilitator collects, dedupes, surfaces.
- **Interaction shape.** Silent-individual → collect → discuss. Critical that
  the *imagined-failure framing* comes first, before any sharing — otherwise the
  loudest voice anchors. ~20–30 minutes.
- **Best-for.** Right *before* committing to a big plan. Catches the failure
  modes that the team's optimism filtered out during brainstorming.
- **Failure mode.** Run too late (after commitment) → it becomes blame
  rehearsal. Run with sharing enabled too early → groupthink.
- **Translatability.** Excellent. Maps to **N parallel pessimist-Gins, each
  imagining a different failure mode**, then a synthesizer. Distinct from
  Red/Blue (which is *active* attacking) and from tikur (which is *retrospective*).
  Worth a dedicated `pre-mortem.md` team.

### 5. Surgical Team / Chief-Programmer Crew (Brooks, 1975)

- **Origin.** *The Mythical Man-Month*, Chapter 3. Mills/Brooks model. ~10
  specialized roles in service of one chief programmer. Echoes the OR surgical
  team: one surgeon, supported by anesthesiologist, scrub nurse, etc.
- **Roles.**
  - **Surgeon (Chief Programmer)** — defines spec, designs, codes, tests, owns
    the conceptual integrity.
  - **Co-pilot** — alter ego, can do any part but less senior; reviews and
    backs up the surgeon.
  - **Toolsmith** — builds tools the surgeon needs, on demand.
  - **Tester** — writes and runs tests against the surgeon's code.
  - **Language Lawyer** — language/idiom expert; consulted, doesn't write
    production code.
  - **Editor / Secretary / Clerk / etc.** — admin and documentation roles.
- **Interaction shape.** Star topology — surgeon is the hub; everyone else is a
  spoke serving the surgeon's flow. *One mind* drives the design; the crew
  amplifies that mind's bandwidth.
- **Best-for.** Conceptual-integrity-critical work — a spec, an API design, a
  refactor that needs a unified taste. We already do something like this with
  `liaison`-mode + Opus sub-agents for execution; the shape is in the air.
- **Failure mode.** Bus factor of 1; surgeon burns out; junior crew never grows
  into surgeons.
- **Translatability.** Strong but already partially implemented. Worth naming
  and distinguishing — `surgical-crew.md` for "one named persona drives, rest
  amplify". Different from `liaison` (which is process-orchestration, not
  conceptual-integrity ownership).

### 6. Multi-Agent Debate (Du, Li, Torralba, Tenenbaum, Mordatch — ICML 2024)

- **Origin.** Du et al, "Improving Factuality and Reasoning in Language Models
  through Multiagent Debate" (arXiv 2305.14325, ICML 2024).
- **Roles.** Symmetric — N (typically 3) agents independently produce an
  initial answer, then in subsequent rounds each agent reads the others' answers
  and *revises* its own. Continue until convergence (or N rounds max).
- **Interaction shape.** N independent draft → N rounds of cross-reading +
  revision → final answer (often by majority or last-round consensus).
- **Best-for.** Factual-accuracy questions, math, reasoning where one model's
  hallucination can be caught by another's grounding. They show meaningful
  improvements on MMLU, MATH, GSM8K.
- **Failure mode.** Agents converge on a *wrong* answer because the most
  confident agent dominates; or agents echo-chamber.
- **Translatability.** Strong but with a twist — debate-to-agreement is a
  *different convergence mechanism* than what our `prioritize` skill does
  (which is Borda-style aggregation, not iterative revision). Worth instantiating
  as `debate.md` for high-stakes factual questions or for review of an artifact
  where we want N independent reads to converge before acting.

### 7. Tikur / Blameless Post-Mortem (IDF tarbut ha-tikkur)

- **Origin.** IAF and IDF — culturally institutionalized after the 1973 Yom
  Kippur War. We already have a `tikur` skill (`.claude/skills/tikur/SKILL.md`).
- **Roles.** Flat by design — no ranks during the tikur. Everyone present is
  an equal participant; the *system* is what's under examination, not any
  person.
- **Interaction shape.** Sequential, ritualized: timeline-of-facts → five-whys
  → root cause → three fixes (immediate / system / tripwire) → distill to
  zettel.
- **Best-for.** Anything that went wrong with a recurrence vector. Not for
  typos or one-time mistakes.
- **Failure mode.** Slips into blame; or stops at "we'll be more careful";
  or has only an immediate fix (no system change).
- **Translatability.** Already in. The team-composition variant we should add:
  *named team-of-three* (timekeeper, fact-collector, system-fix-proposer)
  spawnable as sub-Gins for a rich tikur where one head isn't enough.

### 8. Andon Cord / Jidoka (Toyota Production System)

- **Origin.** Toyota / Taiichi Ohno (~1950s). Jidoka = "automation with a human
  touch". Andon = the cord/button anyone on the line can pull to stop production.
- **Roles.**
  - **Operator** — empowered to pull the cord whenever they spot a defect or
    anomaly. No permission needed.
  - **Team leader** — first responder; has a fixed time-window to resolve
    before the line actually stops.
  - **Quality circle / kaizen team** — analyzes pulls over time, drives
    continuous improvement.
- **Interaction shape.** Empowered-tripwire. Stop-the-line is the *default
  permitted action*, not an escalation. The system rewards *more* andon pulls
  early, fewer over time as defects get designed out.
- **Best-for.** Long-running production work where defects compound (e.g. our
  multi-slice implementation, multi-day refactors). Any worker noticing a
  problem can halt and force resolution.
- **Failure mode.** Cultural — if pulling is socially punished, the cord goes
  unused. Or — the team-leader window is too long and defects ship anyway.
- **Translatability.** Excellent and we *don't have it as a named team
  composition*. Closest analogue: our `companion` skill (long-running observer).
  Worth promoting to a named team-shape: `andon.md` — a sub-Gin that watches
  ongoing work with the *single permission to halt the orchestrator*.

### 9. Crit (Art-school public defense)

- **Origin.** Bauhaus, then RISD/Cooper Union/MIT-Media-Lab tradition. The
  artist/student presents work; a panel of peers + faculty critique it openly,
  in front of the room.
- **Roles.**
  - **Maker** — presents, then is mostly silent during critique.
  - **Critics** (panel of 3–7) — speak in turn, building on each other's
    observations. Mix of peers and senior practitioners.
  - **Audience** — present, can ask questions but secondary.
- **Interaction shape.** Public, sequential critique. Maker doesn't defend
  in real-time; takes it in, responds in writing or next iteration.
- **Best-for.** Work where the *taste-level* is the unit of quality and only
  exposure to many trained eyes can refine it (UI design, UX writing, naming).
- **Failure mode.** Performative critique (critics performing for each other,
  not for the maker); or maker's defensiveness short-circuits the listening.
- **Translatability.** Useful but *partial overlap* with code-review. The
  distinguishing feature: **maker doesn't argue back during the session**.
  This is novel for us — our reviews are bidirectional. Worth experimenting
  with a `crit.md` team for design/UX work.

### 10. OODA loop applied to teams (Boyd)

- **Origin.** John Boyd, US Air Force, 1970s. Originally fighter pilot
  decision-making, then generalized.
- **Roles.** When distributed across a team, the four phases become roles:
  - **Observer** — gathers raw data, no interpretation.
  - **Orienter** — fits data into model, frames the situation.
  - **Decider** — picks the action.
  - **Actor** — executes.
- **Interaction shape.** Loop, fast cycle. The competitive edge is *cycle
  speed* — getting through OODA faster than the adversary.
- **Best-for.** Adversarial / fast-changing environments. Less applicable to
  our work in personas-and-teams (we don't usually have a competing adversary).
- **Failure mode.** Over-rotates Observe at the expense of Decide; or Decide
  outpaces Orient (ungrounded action).
- **Translatability.** Limited — most of our work is contemplative, not
  competitive. **Skip as a primary team composition**, but the *cycle-speed*
  insight informs the iteration cadence of other teams.

### 11. Wisdom of Teams (Katzenbach & Smith, 1993)

- **Origin.** *The Wisdom of Teams* — distinguishes *team* (mutual
  accountability, shared work products, complementary skills) from *working
  group* (individuals coordinating their own outputs).
- **Roles.** Not roles per se — a meta-criterion. The book argues a real team
  has: small size (≤12), complementary skills, common purpose, common
  performance goals, common approach, mutual accountability.
- **Interaction shape.** N/A — it's a quality test, not a shape.
- **Best-for.** Diagnosing whether what we're calling a "team" is one. Useful
  for *evaluating* shapes 1–10 but not itself a shape.
- **Translatability.** **Skip as a team composition; keep as a quality bar**
  in `usegin/teams/README.md` — every named team should pass the K&S six tests.

### 12. Single-Author-with-Critic / Editor-pair (Tufte, et al)

- **Origin.** Tufte's writing/design tradition; also editor-author in publishing;
  also the Buddy System in engineering review.
- **Roles.**
  - **Author** — owns the artifact.
  - **Critic/Editor** — reads, comments, never writes the production text.
- **Interaction shape.** Dyad, async, multi-round. Author drafts → editor
  critiques → author revises → repeat.
- **Best-for.** Most *small* artifacts. The minimum viable team is 2.
- **Failure mode.** Editor over-reaches into author's voice; or author treats
  edits as line-veto.
- **Translatability.** Already in via `companion` and `liaison` patterns.
  Distinguishable from surgical-team because here the editor is *peer-not-junior*.
  Worth an `author-editor.md` thin team for routine artifact review.

### 13. AutoGen GroupChat / CrewAI Crew / LangGraph Supervisor (multi-agent frameworks)

- **Origin.** AutoGen (Microsoft, 2023+); CrewAI (2024+); LangGraph (LangChain,
  2024+). Three flavors of multi-agent orchestration that have converged on
  shared patterns.
- **Roles.** Each framework has its own primitives but they map:
  - **AutoGen GroupChat:** N agents in a shared conversation; a *selector*
    decides who speaks next.
  - **CrewAI Crew:** role-based (Researcher, Writer, etc.) with sequential or
    hierarchical task delegation.
  - **LangGraph Supervisor:** explicit graph; supervisor node routes to
    workers; conditional edges control flow.
- **Interaction shape.** All three converge on **supervisor + workers +
  shared state**. Anthropic's own multi-agent research blog post is a
  LangGraph-supervisor-style: lead Opus + 3–5 Sonnet subagents in parallel.
- **Best-for.** Tasks with clear sub-tasks that can be delegated and rejoined.
  Most production multi-agent systems land here.
- **Failure mode (per Anthropic's post):** spawning too many subagents for
  simple queries; subagent duplication; vague instructions; SEO content over
  authoritative sources.
- **Translatability.** This is essentially **what `rnd` and `liaison` already
  are**. The contribution is *naming* it — our orchestrator-with-workers shape
  has industry validation. No new team to instantiate; reinforces what we have.

### 14. Reflexion / ReAct / Tree-of-Thoughts (single-agent reasoning shapes — but as team analogs)

- **Origin.** ReAct (Yao et al, 2022); Reflexion (Shinn et al, 2023); ToT
  (Yao et al, 2023).
- **Translatability as team shapes:**
  - **ReAct → "single agent with tools"** — already our default. Not a team.
  - **Reflexion → "agent + memory-of-past-failures"** — the team analog is
    a tikur-style retrospective baked into the agent's loop. Worth folding
    into long-running agents (like ralph-loop), not a standalone team.
  - **Tree-of-Thoughts → "parallel branching + evaluator"** — this is the
    team analog: N parallel attempts, each evaluated, only best continues.
    Maps to our prioritize skill but at the *generation* step, not the
    *idea-pool* step. Worth experimenting as `tot-team.md` for problems
    where one approach might dead-end and we want to keep multiple in flight.
- **Failure mode.** ToT-as-team can blow token budget if branching factor
  is uncapped.
- **Translatability.** Partial — ToT-as-team is the most translatable; the
  others are mostly single-agent constructs.

### 15. Mixture of Experts (MoE) — as agent orchestration, not transformer arch

- **Origin.** Originally Jacobs et al (1991) for neural nets; reborn as
  agent-orchestration pattern (specialized expert agents + a gating router).
- **Roles.**
  - **Router/Gate** — classifies the incoming question, dispatches to
    expert(s).
  - **Experts** (N) — each specialized in a domain (security expert, db
    expert, perf expert, etc.).
  - **Aggregator** — combines expert outputs (often the router again).
- **Interaction shape.** Conditional routing. Most queries hit only 1–2
  experts; the rest stay dormant.
- **Best-for.** A long-tail of question types where each domain has a
  trained-up persona. Our `security`, `effi-session-audit`, `dogfooding-effi`
  skills are de-facto experts.
- **Failure mode.** Router misroutes; or experts can't talk to each other
  when the question crosses domains.
- **Translatability.** Strong — and we already have the experts; what we
  lack is a *named MoE team* with a router persona. Worth `moe.md` —
  router (Gin/UseGin) + N expert sub-Gins.

---

## Bottom — open ends, gaps, dilemmas

### Shapes I considered and rejected for this catalogue

- **Squads / Pods / Crews (Spotify model)** — value is mostly social/HR; doesn't
  translate to one-shot agent teams.
- **Holacracy / Sociocracy circles** — value is governance over time; we have
  no "over time" axis (sub-Gins are one-shot per z023).
- **War room / SWAT team** — too situational; collapses to "spawn ad-hoc team
  with a charter", which is what we do anyway.
- **Mob programming** — single-driver-many-navigators; one-shot agent teams
  don't have the rotation dynamic that makes mobbing valuable.

### Dilemma I want Lihu's call on

**Should `usegin/teams/` files be one-shot recipes, or persistent like
`usegin/consultant/`?** Two coherent designs:

- **A. One-shot recipes** (cheap, lots of them, like skills). Each `<name>.md`
  is a charter template + persona-slot table. Spawn fresh every time.
- **B. Persistent named teams** (a few, each with accumulating memory and a
  resumable session). Like `usegin/consultant/` is today. The "post-mortem
  team" remembers what it learned from past tikurs.
- **Lean.** A. One-shot recipes scale; persistence we already have via
  per-persona memory (the consultant pattern). Teams compose personas;
  persistence lives at the persona layer, not the team layer.
- **Price.** No accumulating team-level memory.
- **Risk.** We end up duplicating across team files. Mitigation: shared
  persona library (Mark/Poll/Din/Johan/John).

---

## The shapes most worth instantiating in `usegin/teams/`

Picking 8 of the 15. Rationale per pick:

| # | Shape | File | Why this one |
|---|---|---|---|
| 1 | Six Thinking Hats | `six-hats.md` | Forces full-spectrum framing on a decision; cleanly N-parallel. We routinely converge too fast (pattern in our retros). |
| 2 | Red/Blue/Purple | `red-blue-purple.md` | Adversarial-defensive on artifacts (specs, security, agent prompts). z090 is precedent. |
| 3 | Devil's Advocate | `devils-advocate.md` | High-stakes decision with consensus-bias risk. *Distinct from R/B/P*: this is about a proposal, not a system. |
| 4 | Pre-mortem | `pre-mortem.md` | Before committing to a plan. The 30% prospective-hindsight uplift is real; we're chronically optimistic at decision-time. |
| 5 | Surgical Crew | `surgical-crew.md` | Conceptual-integrity work (specs, naming, API design). Names what `liaison` is *almost* doing. |
| 6 | Multi-Agent Debate | `debate.md` | High-stakes factual/reasoning questions. Different convergence than `prioritize`. |
| 7 | Andon | `andon.md` | Long-running work with halt-permission. Generalizes `companion`. |
| 8 | MoE | `moe.md` | Cross-domain questions hitting our existing expert personas. Names the routing layer. |

Skipping crit (overlaps code-review), tikur (already in as a skill), author-editor
(too thin), OODA (not our domain), wisdom-of-teams (a bar, not a shape), supervisor-
worker (already in as `rnd`/`liaison`), reflexion/ReAct/ToT (mostly single-agent or
already-in-pattern).

---

## The shape-personas matrix

Mapping our planned cast (Mark=manager, Poll=professor, Din=designer, plus
sketched Johan / John) to the eight shapes. This is a *first cut*; Lihu's
persona-design angle (sibling whiteboard) will sharpen it.

Persona shorthand for this matrix:
- **Mark** — manager: scope, deadlines, coordination
- **Poll** — professor: depth research, citations, structure
- **Din** — designer: taste, UX, naming, conceptual integrity
- **Johan** — hacker/adversary: red-team mindset, breaks things (proposed)
- **John** — engineer: builds, ships, owns conceptual integrity in code
- **Critic** — fresh-eyes consultant (z025 already exists)
- **Facilitator** — process owner; runs the ritual

| Shape | Slot 1 | Slot 2 | Slot 3 | Slot 4 | Slot 5 | Slot 6 |
|---|---|---|---|---|---|---|
| six-hats | **Blue=Mark** (facilitator) | **White=Poll** (facts) | **Red=Din** (gut/taste) | **Black=Johan** (risks) | **Yellow=John** (benefits) | **Green=Critic** (creative) |
| red-blue-purple | **Red=Johan** | **Blue=John** | **Purple=Mark** (synthesizer) | — | — | — |
| devils-advocate | **Pro=John** (advocatus Dei) | **Con=Johan** (advocatus Diaboli) | **Jury=Mark+Lihu** | — | — | — |
| pre-mortem | **Facilitator=Mark** | N×**Pessimist=Johan-clones** (each imagines a different failure mode) | **Synthesizer=Poll** | — | — | — |
| surgical-crew | **Surgeon=John** | **Co-pilot=Critic** | **Toolsmith=Gin-default** | **Tester=Johan** | **Lang-lawyer=Poll** | — |
| debate | N=3 **symmetric agents** (any persona, primed to debate-revise) | **Convergence judge=Mark** | — | — | — | — |
| andon | **Worker=John** (the doing-agent) | **Watcher=Critic** (cord-puller) | **Responder=Mark** (decides whether to halt) | — | — | — |
| moe | **Router=Mark** | N **Experts** (existing skill-personas: security, effi-audit, gin-dx, etc.) | **Aggregator=Mark** | — | — | — |

Notes:
- **Mark recurs in 6/8 shapes** as facilitator/router/synthesizer. Suggests Mark
  is the *coordination persona* in our cast — worth designing him for that
  primary role.
- **Johan (the proposed hacker/adversary)** recurs in 5/8 in critique slots.
  Strong signal Johan is real — a named adversarial persona we don't yet have.
- **Din (designer)** appears mostly in shapes that involve taste (six-hats Red,
  surgical-crew implicitly). Din is shape-light in this catalogue — his strength
  is at the *artifact* layer, not the *team* layer.
- **Critic** is our *external-internal* (z025); appears wherever fresh-eyes
  is the slot. Already partially implemented as the `consult` skill.

---

## Recommended `usegin/teams/<name>.md` file shape

Every team file should contain these sections, in this order. Using `pre-mortem`
as the worked example.

```markdown
---
name: pre-mortem
shape: failure-imagination
cardinality: N-parallel-pessimists + 1-facilitator + 1-synthesizer
convergence: synthesis-by-facilitator
time: one-shot, ~20-30 min wall, before commitment
---

# Pre-mortem team

> Klein 2007 (HBR). Used right before committing to a plan. Each pessimist
> imagines a *different* way the project failed badly; synthesizer surfaces
> the dominant failure modes; facilitator drives the ritual.

## When to invoke

| Signal | Why pre-mortem, not red-blue or devils-advocate |
|---|---|
| About to commit to a multi-day plan | Catches optimism-filtered failure modes |
| A spec is "done" but feels too smooth | Smoothness is suspect; force a pessimist pass |
| Past projects in this area failed in non-obvious ways | Prospective hindsight uplifts ~30% |

## Personas

- **Facilitator (Mark).** Opens with the framing: "imagine it's <date>, the
  project failed badly." Sets the timer. Runs the silent-individual phase.
- **Pessimists (N=4–6 Johan-clones, each primed differently).** Each gets a
  different failure-axis priming: *technical*, *human*, *integration*,
  *scope-creep*, *external-dependency*, *adoption*.
- **Synthesizer (Poll).** Reads all pessimist outputs, dedupes, ranks by
  (likelihood × blast-radius), surfaces top 3 failure modes.

## Charter slots

(N pessimist charters, one facilitator charter, one synthesizer charter.
Templates inline.)

## Lifecycle

1. Facilitator writes `<root>/pre-mortem/framing.md` (the imagined-failure scene).
2. Spawn N pessimists in parallel; each writes
   `<root>/pre-mortem/pessimists/<NN>-<axis>.md`.
3. Synthesizer writes `<root>/pre-mortem/findings.md` ranking failure modes.
4. Facilitator + Lihu decide: which mitigations land in the plan, which we
   accept-with-tripwire, which we ignore.

## Deliverables

- `framing.md` — the imagined-failure setup.
- `pessimists/<NN>-<axis>.md` — each pessimist's reasons.
- `findings.md` — synthesizer's ranked top failure modes.
- z020-shape decision in the plan doc / Linear issue / zettel.

## Failure modes (of the team itself)

- Pessimists hedge ("this *could* go wrong") instead of committing to the
  imagined-failure framing.
- Synthesizer over-aggregates; the surprising failure mode gets averaged out.
- Run too late (after commitment) — becomes blame rehearsal.

## Friction-capture

Every charter ends with the standard friction-zettel pointer.

## At the end

- Closing zettel: pre-mortem of `<topic>` surfaced `<top failure mode>`;
  mitigations: `<list>`.
```

This shape generalizes — for the other 7 teams, the differences are: which
personas fill the slots, what the lifecycle's phases are, and what the
deliverables are. The skeleton is constant.

---

## Sources

### Books / canonical texts
- de Bono, *Six Thinking Hats* (1985, rev. 1999)
- Brooks, *The Mythical Man-Month* (1975), Ch. 3 "The Surgical Team"
- Katzenbach & Smith, *The Wisdom of Teams* (1993)
- Klein, "Performing a Project Premortem" (HBR Sept 2007)

### Web (fetched 2026-04-27)
- [Anthropic — Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Six Thinking Hats — De Bono Group](https://www.debonogroup.com/services/core-programs/six-thinking-hats/)
- [Six Thinking Hats — Wikipedia](https://en.wikipedia.org/wiki/Six_Thinking_Hats)
- [Devil's advocate — Wikipedia](https://en.wikipedia.org/wiki/Devil's_advocate)
- [Advocatus Diaboli — Catholic Encyclopedia](https://www.newadvent.org/cathen/01168b.htm)
- [Pre-mortem — Klein](https://www.gary-klein.com/premortem)
- [Performing a Project Premortem — HBR](https://hbr.org/2007/09/performing-a-project-premortem)
- [The Mythical Man-Month — Wikipedia](https://en.wikipedia.org/wiki/The_Mythical_Man-Month)
- [The Surgical Team — Herberto Graça](https://herbertograca.com/2018/09/10/3-the-surgical-team/)
- [Red/Blue/Purple Teams — TechTarget](https://www.techtarget.com/searchsecurity/tip/Red-team-vs-blue-team-vs-purple-team-Whats-the-difference)
- [Andon — Toyota UK Magazine](https://mag.toyota.co.uk/andon-toyota-production-system/)
- [Jidoka — Kaizen Institute](https://kaizen.com/insights/jidoka-automation-human-touch/)
- [Andon Cord & Psychological Safety](https://psychsafety.com/psychological-safety-79-the-andon-cord/)
- [Multi-Agent Debate — Du et al, arXiv:2305.14325](https://arxiv.org/abs/2305.14325)
- [Multi-AI collaboration — MIT News](https://news.mit.edu/2023/multi-ai-collaboration-helps-reasoning-factual-accuracy-language-models-0918)
- [ReAct vs ToT — Coforge](https://www.coforge.com/what-we-know/blog/react-tree-of-thought-and-beyond-the-reasoning-frameworks-behind-autonomous-ai-agents)
- [Tree of Thoughts — Prompt Engineering Guide](https://www.promptingguide.ai/techniques/tot)
- [CrewAI vs LangGraph vs AutoGen — DataCamp](https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen)
- [LangGraph vs CrewAI vs AutoGen 2026 — Medium](https://medium.com/data-science-collective/langgraph-vs-crewai-vs-autogen-which-agent-framework-should-you-actually-use-in-2026-b8b2c84f1229)

### Internal
- `.claude/skills/tikur/SKILL.md` — our existing blameless-post-mortem skill
- `.claude/skills/rnd/SKILL.md` — supervisor + N-parallel-independent
- `.claude/skills/brainstorm/SKILL.md` — N-parallel + no-convergence
- `.claude/skills/refine/SKILL.md` — N-parallel + per-slice convergence
- `.claude/skills/prioritize/SKILL.md` — N-parallel + Borda aggregation
- `.claude/skills/consult/SKILL.md` — single fresh-eyes (z025)
- `.claude/skills/companion/SKILL.md` — long-running observer (proto-andon)
- `.claude/skills/cell/SKILL.md`, `liaison/SKILL.md`, `teamwork/SKILL.md` —
  existing supervisor-worker variants
- z025 (consultant: external in role, internal in team)
- z075 (war-management R&D) — precedent for doctrine-as-source R&D
- z086 (process over outcome) — frames why we want named teams
- z090 (cold-read sub-agent unrigged wispr-corrector) — red-team precedent
