# War-Management Synthesis

Cross-cuts the six professor whiteboards (Clausewitz, IDF TO"L, PO"SH C2, IAF
tikkur, Mission Command, Modern Application) into one consolidated reading
the team can act on. Source whiteboards live alongside this file; this
synthesis preserves their disagreements rather than averaging them away.

Audience: Lihu, plus future Gins re-orienting on this track. Read top-down —
the convergent rules are the click; the divergences and proposed changes are
the proof chain; the dilemmas at the bottom are what needs Lihu before any
of this lands.

---

## 1. TOP — Convergent rules

Each rule is asserted by ≥2 professors, ordered by load-bearing weight for
the day-to-day. Tag in brackets = professors who land on it; ties to our
existing principles/zettels follow the explanation.

### C1. Harness denials are Befehlstaktik creep, not bugs — fix the institution, not the symptom
[Mission Command + Clausewitz + Modern Application + PO"SH]

The strongest single finding of the round. When the harness blocks a
charter-mandated write (z030), strips a sub-Gin's spawn tool (z029), or
walls off the consultant's surface (z025-shaped friction), our **declared**
doctrine (z023, z014, z027 — agents are spawned with intent and own the
how) is being silently overridden by **practiced** doctrine (the institution
keeps decision-rights it claimed it delegated). Mission Command names this
exactly via Shamir's praxis gap. Clausewitz's "iron will that crushes the
machine" (R2) is the same warning from the other side: when we route
*around* the institutional denial instead of fixing it, we crush the
agent/session along with the obstacle. The fix shape is **institutional**:
make the harness honor the charter (settings.json, hook adjustment, explicit
permission grant) and capture the denial as a tikur-class event, not as
"weird quirk, work around it."

→ Ties to: principle 03, principle 04, z023, z027, z030, z029.

### C2. Charters must carry purpose / key tasks / end state — three lines each, intent before method
[Mission Command + IDF TO"L + Modern Application + Clausewitz]

All four converge on the same template — and our current z023 ("the charter
is the instantiation") under-specifies it. Mission Command supplies the
canonical three-piece structure (FM 6-0 + CALL "Less is Better"). IDF TO"L
sharpens it: *mission, not task* (משימה ולא מטלה) — the charter must invite
*rosh-gadol* completion and forbid *rosh-katan* literal-execution. Modern
Application's intent-travels-method-doesn't is the same point in business
register. Clausewitz (R6) supplies the deepest *why*: every Gin action is a
continuation of strategic intent — a charter without a "political object"
(the *because*) produces well-executed irrelevance. Operational test (per
PO"SH, sister to this rule): can a *fresh Haiku* read the charter and act?
If it needs a glossary, it's in 2006-Lebanon shape — rewrite it in
1967-Sinai shape ("take that hill").

→ Ties to: z023, z014, z020, principle 03, z036.

### C3. Our DX layer IS Boyd's Orient infrastructure — invest there, not in faster Act
[Modern Application + PO"SH + Clausewitz]

Zettels, code-history, agent-records, session JSONLs, Effi canon, the
`use-gin` handbook, `dx his` telemetry — these are not productivity tools,
they are **orientation infrastructure**. Modern Application surfaces this
as the deepest bridge: every feedback loop in OODA flows through Orient,
and the popular "loop faster" reading is the misreading. PO"SH names the
same gap from C2 doctrine: orient is the bottleneck, observation is fine.
Clausewitz (R3, R7) supplies the underpinning: ¾ of what matters is in fog,
the only durable answer is z018 — investigate without limit *inside*,
output the click *outside* — and the trinity demands that human emotion +
agent stochasticity + strategic intent all stay first-class signals into
Orient. **Operational consequence**: when a session fails, ask "where did
we mis-orient?" before "why did we act slowly?" Improvements that compound
are orient-side; speed-of-act improvements rarely do.

→ Ties to: z018, z028, principle 04, z012, z048.

### C4. Shared training corpus IS our Truppenführung — every charter must point sub-Gins at it
[Mission Command + IDF TO"L + Modern Application + PO"SH]

Auftragstaktik works for the Prussians because of the *Generalstab* +
*Truppenführung* — decades of cross-posted officers and a single field
manual that meant any two officers could complete each other's sentences.
Without shared training, decentralized initiative produces *divergent*
action, not coherent action. **Our `usegin/zettel/`, the four principles,
the skill library, the CLAUDE.md cascade — that IS our Truppenführung.** A
sub-Gin without explicit pointers to it is a Prussian officer pulled off
the street. IDF TO"L supplies the reservist-model variant: a sub-Gin is a
miluim reservist — no context across calls, but the *charter* is the unit
identity and the *zettelkasten + skills + CLAUDE.md* are the equipment
cache. Heavier the cache investment (zettels indexed, skills reachable,
charter sharp), faster the reservist re-enters as cohesive, not ad-hoc.
PO"SH supplies the gap: McChrystal-style shared consciousness *requires*
the substrate to be reachable, not just present. **Charters must include a
doctrinal-pointer block.** Modern Application's "abdication ≠ empowerment"
is the price of skipping it.

→ Ties to: z023, z028, principle 02, z077.

### C5. Battle rhythm — we have none, and the absence is why context resets feel painful
[PO"SH + IAF tikkur + Modern Application]

Strongest single concrete recommendation from PO"SH. Military command posts
run a fixed cadence: morning brief → ops sync → evening rollup. The cadence
is what keeps the COP fresh and what makes ad-hoc escalations affordable.
**UseGin currently has no battle rhythm.** `/end` and `/handoff` capture
session-level; nothing captures day-level. IAF tikkur converges from a
different direction: tikur is *daily ritual*, not opt-in — "we'll do it
tomorrow" is the failure mode. Modern Application's O&I-brief insight
(McChrystal's 90-minute daily) is the same mechanism: the rite is what
*activates* the substrate. The absence of a deliberate cross-Gin synthesis
ritual is itself a friction signal worth a zettel. **Concrete proposed
artifact**: a `dx morning-brief` (see proposed change #3 below).

→ Ties to: z028, z032, z048, z075.

### C6. Error vs. Negligence is a categorical bright line, not a gradient — fix shape differs
[IAF tikkur + Mission Command + Clausewitz]

IAF tikkur supplies the canonical split: **error** (in-procedure mistake,
system permitted it → fix is to the system, no social/process consequence)
vs. **negligence** (rule existed, was bypassed → fix is system change PLUS
hook/lint/CI assertion making the bypass impossible). Mission Command
converges from the prudent-risk principle: zero-defect culture treats every
incident the same and produces Befehlstaktik creep; the bright line is what
keeps prudent risk distinguishable from negligence. Clausewitz (R10, R1)
supplies the substrate: friction is the work, and the friction-zettel
cluster IS the doctrine update — but only if categorized. Maps cleanly onto
our existing friction zettels: autosync collisions, slice-1 bugs, harness
denials are all **errors**; the hypothetical "knew the autosync race was
open and pushed without verifying origin" is **negligence**. The fix
*ownership* differs.

→ Ties to: z058–z074 cluster, z030, z029, principle 02, `tikur` skill.

### C7. Blameless ≠ accountability-less; speaking order is procedural, not vibes
[IAF tikkur + IDF TO"L + Mission Command + Modern Application]

Two coupled findings. **Blamelessness lives in the room** — consequences
exist but they target the system, not the person who tripped it (IAF
tikkur enhancement #3). The IDF/IAF tradition is unanimous: "no
consequences anywhere" is a weaker claim than the institution actually
makes, and weaker than is defensible. **Speaking order is procedural** —
junior speaks first, senior speaks last, because anchoring is the silent
killer of honesty. In our setup: sub-agents and tool outputs first,
UseGin's reconstruction second, Lihu's framing last. Modern Application's
Pitfall 4 (command climate that suppresses dissent) is the same finding
from the civilian-org failure-mode side. IDF TO"L's *rosh-gadol* requires
this: subordinates that re-tune to the senior's first frame can't reach
past the literal task.

→ Ties to: `tikur` skill rule 1, z023, z020, principle 04.

### C8. The cluster is a finding — three of anything in the same area is the actual signal
[IAF tikkur + Clausewitz + IDF TO"L + Modern Application]

Cross-prof convergence on a discipline we already practice but don't
enforce. IAF tikkur's documentation officer routes *patterns*, not events.
Clausewitz's friction (R1, R10) is "infinity of petty circumstances" — the
count *is* the slice's real cost, and the cluster is where the doctrine
update lives. IDF TO"L's *konseptsia* trap is the inverse: a cluster that
looks coherent because the same wrong frame is filtering the data. Modern
Application's pattern-codification rule ("when a new pattern repeats 3
times, codify it" — z076 as the 3rd instance) is the operational form. We
already have z057 (frustration cluster), z040 (clusters emerge from
threading), z048 (DX-of-DX is the signal). What's missing is the *step* in
the tikur procedure that searches for the cluster *before* declaring root
cause (IAF enhancement #5).

→ Ties to: z040, z048, z057, z076, principle 04.

### C9. Lihu's attention is the dominant Center of Gravity — rank improvements by COG protected
[Clausewitz + Modern Application + PO"SH]

The most actionable single rule from Clausewitz (R5). Tokens are unbounded
(z027); Lihu's attention is the bound. Every protocol — z018's "give me the
click", z036 (be laconic), z024 (not everything in Linear), z026 (only
surface real dilemmas), z020 (decision shape) — exists to protect *this*
COG. Modern Application's economy-of-force converges (most things should
get nothing; concentrate on the decisive). PO"SH's span-of-control finding
converges from the C2 side: parent-as-bottleneck is the failure mode of
fan-out without a COP. **Operational rule**: when prioritizing among
improvements, rank by COG protected. A 5-minute fix that prevents Lihu
re-verifying Gin (z018) outranks a 2-day refactor of internal Gin tooling.
Secondary COGs (the shared-brain corpus; the friction signal itself) get
their own protection rules but stay below Lihu's attention.

→ Ties to: z018, z027, z028, principle 03, z020.

### C10. Hold the dialectic — every principle has a counter-principle; collapsing either pole is the failure mode
[Clausewitz + IDF TO"L + Mission Command + IAF tikkur]

Clausewitz's deepest cross-cutting move (R9, 2.8) — every concept in *On
War* has its counter-concept; collapsing to one pole produces brittle
doctrine. IDF TO"L's "command climate is a system, not a policy" is the
same finding (rank-light *requires* tikkur; mission-command *requires*
rosh-gadol; aharai *requires* senior-takes-tip — removing one and keeping
the rest is unstable). Mission Command's two preconditions (intent + shared
training; missing either gives "the worst of all possible worlds"). IAF
tikkur's blameless-but-accountable, junior-first-but-senior-anchors. Our
existing dialectics that should never collapse: investigate-without-limit /
output-the-click (z018+z036); fight-Claude / ask-Claude (principle 04);
spawn-freely / charter-tightly (z023+z027); two-faces / one-suffices (z022);
preserve / move-forward (principle 02); empowered execution / shared
consciousness (Modern Application). When a principle is being applied as if
it has no counter-principle, it has gone wrong — re-read the dialectic.

→ Ties to: principle 04, z022, z023, z027, z028, z076.

---

## 2. MIDDLE — Productive divergences worth keeping

These are not synthesis errors — they are *signal*. Two professors looking
at the same situation and arriving at different prescriptions. Preserve the
tension; do not collapse.

### D1. Sun Tzu vs. Clausewitz — which is our doctrine?

**Modern Application** argues explicitly: "Sun Tzu is our doctrine more than
Clausewitz is. We are a small team competing in a complex space against
larger players. Symmetric attrition (Clausewitz) is suicide. Asymmetric,
indirect, intelligence-rich, dislocate-before-confronting (Sun Tzu) is the
only viable game." Effi-grounds-in-team-data is exactly the indirect
approach — a flanking line on terrain where the giants aren't fortified.

**Clausewitz prof** argues the opposite: friction, fog, the trinity, COG,
the political-object dominance, dialectic-holding — these are the
constitutive concepts. Sun Tzu offers strategic posture (where to fight);
Clausewitz offers the *physics of the fight itself* (what happens once
contact is made, regardless of the strategy that put us there).

**Why preserve the tension**: both are right at different layers. Sun Tzu
governs **product/competitive strategy** (where we attack, what terrain we
choose, when we deceive vs. confront). Clausewitz governs **execution
under uncertainty** (what happens once a sub-Gin is in motion, how friction
accumulates, why the trinity must stay alive). The trap is forcing one
doctrine to do both jobs. Decision rule: when the question is "what do we
build / where do we compete," reach for Sun Tzu. When the question is "how
do we manage the work that's in flight," reach for Clausewitz.

### D2. Charter discipline — staged enhancements vs. single template overhaul?

**Mission Command** wants a single charter template carrying purpose / key
tasks / end state / doctrinal-pointer block / explicit Selbständigkeit
clause / explicit prudent-risk stance — landed as one methodology zettel,
referenced from the rnd skill (z076). The doctrine demands all five
together.

**IDF TO"L** wants the charter to additionally invite *rosh-gadol* and
forbid *rosh-katan*, and to test against a fresh Haiku (the 2006-Lebanon
vocabulary check). Different additions, same artifact.

**PO"SH** wants the charter to include an **explicit decision-rights
envelope** ("can decide / must coordinate / must escalate") — currently
implicit per-skill, should be explicit per-charter.

**The tension**: each professor independently proposes an addition that's
load-bearing in their frame. Mission Command's three pieces *are* the
minimum; the others are layered on top. The risk is a charter template that
becomes the heavy thing it was supposed to replace (Pitfall 5 — Taylor in
McChrystal-land). **Why preserve**: the divergence forces the question of
*how much template is too much*, which is itself a charter-design call.

### D3. Real-time observability of sub-Gin streams — diagnostic tool or forbidden temptation?

**Mission Command** (rule 10): "Real-time observation is a tool for
diagnosis when something is *off*, not a default mode." Watching a sub-Gin
stream is the same temptation that broke US Army Mission Command in
network-centric C2. Doctrine: charter, release, read the deliverable.

**PO"SH** wants the *opposite*: a Common Operating Picture (`dx agents
status`) that surfaces what every sub-Gin is doing right now. The C2 gap
is precisely the absence of a single surface for in-flight agent state.
Without it, the parent becomes the bottleneck.

**Why preserve**: both are right about a different thing. PO"SH wants a
**queryable status surface** (pull, not push, low-cognitive-cost). Mission
Command warns against the **default-on stream-watching mode** (push, high
attention burn, micromanagement temptation). The synthesis: build the COP
as a pull-on-demand surface; don't make the stream the default view.

### D4. McChrystal's O&I cadence — adopt or skip?

**Modern Application** flags as the most important missing ritual: a daily
cross-Gin O&I-equivalent where all in-flight Gin work is visible to all
other Gins.

**PO"SH** converges (the missing morning-brief is the strongest concrete
recommendation from C2 doctrine).

**Mission Command** is more ambivalent: the cadence has to *not* become
ritual-without-meaning (Pitfall 2). McChrystal's O&I worked because it
killed silos in a 7,500-person network; UseGin is 1 human + 1 Gin + N
sub-Gins. The cadence might be solving a problem we don't have at our
scale.

**IDF TO"L** sides with adoption (daily debrief is non-negotiable in IAF;
weekly drift is the failure mode).

**Why preserve**: the tension *is* the dilemma — see Bottom section. The
fact that 3 of 4 want some version of cadence and 1 warns about ceremony
collapse means the design has to address both.

### D5. The "click vs cluster" reading of friction zettels

**Clausewitz** (R10 / 2.1): friction zettels are the slice's real cost, and
the *count* is the metric. Each one matters in its own right.

**IAF tikkur** (enhancement #5): the *cluster* is the finding. Three errors
in the same area is qualitatively different from three independent errors.
Treating each tikur as standalone is the failure mode.

**Why preserve**: both are right at different times. Per-zettel discipline
is what makes the cluster *visible* (without z058, z059, z060 being filed
individually, the cluster about CLI-input validation never forms). Cluster
discipline is what *promotes* the data to a finding (without it, we
re-encounter the same friction). The synthesis: capture per-event, *but
search for cluster before declaring root cause* (IAF enhancement #5 is the
right operational rule).

---

## 3. Concrete proposed changes

Numbered list of *specific edits* to skills / zettels / hooks / charters
that follow from §1 + §2. Each cites the originating professor(s) and the
principle/zettel/skill it lands against. None of these are landed by this
synthesis — they require Lihu's gate (per the bottom dilemmas).

1. **Charter template zettel** — methodology zettel under `usegin/zettel/zettels/`,
   carrying the **purpose / key tasks / end state** three-piece (3 lines
   each), the **doctrinal-pointer block** (point sub-Gin at
   `usegin/zettel/`, principles 01–04, relevant skills), the explicit
   **Selbständigkeit clause** ("you are obligated to deviate from the
   literal task if it stops serving the purpose"), the explicit **accept
   prudent risk** stance, the **rosh-gadol invitation / rosh-katan
   forbid**, and the **fresh-Haiku test** (can a fresh sub-Gin read this
   without a glossary?). Referenced from the rnd skill (z076). 
   [Sources: Mission Command #1–5, IDF TO"L #1–2 #5, Clausewitz R6, Modern Application #2.]
   [Lands against: z023, z014, z020, principle 03.]

2. **The 6 tikur skill enhancements** (already drafted in
   `iaf-tikkur/proposed-tikur-skill-enhancements.md`) — promote as a
   **single batch**, in priority order 1→6. Enhancement #1 (error vs.
   negligence) is the keystone — it's what makes the rest carry weight.
   The whole batch is internally coherent and was designed as a unit; we
   would lose the cross-references if staged. (See dilemma DL2 below for
   the staged-vs-batch tradeoff.)
   [Sources: IAF tikkur #1–10, also lands against C6, C7, C8 above.]
   [Lands against: `.claude/skills/tikur/SKILL.md`, principle 02, z058–z074 cluster.]

3. **`dx morning-brief` slash command + cadence** — synthesizes overnight
   commits + open zettels (especially open-to-empty / decisions-pending) +
   Sentry deltas + Linear changes + active sub-Gin state into a single
   morning artifact. Pull-on-demand (per D3 — not default-on stream
   watching). The cadence is the load-bearing piece, not the artifact. The
   ritual is *only* useful if it produces a delta-zettel ("today we will
   X because of Y from overnight"); per Pitfall 2, audit every quarter
   whether it's still causing decisions to change. (See dilemma DL1 below
   for cadence shape.)
   [Sources: PO"SH battle-rhythm finding, Modern Application O&I, IAF tikkur daily-ritual.]
   [Lands against: z028, z032, z048, principle 01.]

4. **Doctrinal-pointer block in every charter** — when UseGin spawns a
   sub-Gin (rnd, build-orchestrate, liaison, cell, teamwork, anything that
   delegates), the charter must include explicit pointers to:
   `usegin/zettel/principles/01..04`, the relevant zettels for the work
   class, the relevant skills, and any relevant CLAUDE.md. This is the
   "shared training corpus IS our Truppenführung" implication operationalized.
   [Sources: Mission Command #8, IDF TO"L #6 (reservist), PO"SH C4 finding.]
   [Lands against: z023, z028, z077.]

5. **Decision-rights envelope per skill** — every skill that spawns
   sub-agents (tdd-execute, liaison, cell, build-orchestrate, etc.) ships
   with an explicit "this agent can decide / must coordinate / must
   escalate" stanza. Currently implicit per-skill; making it explicit
   catches a class of friction Lihu currently absorbs as "the agent did
   something it shouldn't have."
   [Sources: PO"SH C2 decision-rights matrix, Mission Command #6.]
   [Lands against: skill-lab files, z023, z020.]

6. **Reframe harness denials as institutional Befehlstaktik in zettels** —
   when z029-style or z030-style denials surface, capture them with the
   explicit framing "this is institutional doctrine countermanding declared
   doctrine; the fix is institutional, not a workaround." Update the
   `tikur` skill's anti-patterns list to name this explicitly: "*Routing
   around a harness denial instead of fixing it.*"
   [Sources: Mission Command praxis-gap, Clausewitz R2 (don't crush the machine), Modern Application Pitfall 6.]
   [Lands against: z029, z030, principle 04, `tikur` skill.]

7. **Error/negligence categorization on existing friction zettels** — the
   z058–z074 cluster, autosync collision references, harness-denial zettels
   should each get a `Category: error | negligence` field added (or a
   threaded meta-zettel naming the categorization). Most will be **error**;
   the categorization itself is the lesson. Maps directly onto IAF
   enhancement #1.
   [Sources: IAF tikkur #1, Clausewitz R10.]
   [Lands against: z058–z074 cluster, principle 02 (append, don't rewrite).]

8. **Speaking-order procedure for any multi-participant tikur** — junior
   first (sub-agent + tool outputs), middle (UseGin reconstruction), Lihu
   last. When Lihu's role is part of the incident, his prompt and framing
   are *inputs to the timeline*, not its conclusion. Lands as IAF
   enhancement #2.
   [Sources: IAF tikkur #2, IDF TO"L #3 (rank-light), Mission Command #7.]
   [Lands against: `tikur` skill, principle 04.]

9. **Cluster-search step in tikur procedure** — before declaring root
   cause, search the corpus (`rg`, `dx zettel list`) for the same area; if
   2+ prior tikurs/zettels touch it, the root cause is the *cluster*. Lands
   as IAF enhancement #5.
   [Sources: IAF tikkur #9, IDF TO"L (konseptsia trap), Modern Application
   pattern-codification, Clausewitz R10.]
   [Lands against: `tikur` skill, z040, z057, z048.]

10. **"Aharai" rule for senior-model deployment** — when a turn is
    risky/novel/load-bearing, the strongest agent (Lihu, or Opus-class Gin)
    goes first into the unknown; routine execution is delegated *after* the
    unknown is mapped. Don't send Haiku to scout a load-bearing decision
    and then "promote" to Opus. Codify in the charter template (#1 above)
    and in z023.
    [Sources: IDF TO"L #4, Clausewitz R4 (coup d'œil is terrain-specific).]
    [Lands against: z023, z029.]

11. **COG-rank improvements rule** — when prioritizing among DX/skill/hook
    improvements, rank by Center of Gravity protected: (1) Lihu's
    attention/judgment, (2) the shared-brain corpus, (3) the friction
    signal itself, (4) trust between Lihu and Gin. A fix that protects (1)
    outranks one that just makes Gin's life easier. Lands as a methodology
    zettel + reference from the rnd skill and from any skill that proposes
    DX changes.
    [Sources: Clausewitz R5, Modern Application #6 (economy of force), PO"SH span-of-control.]
    [Lands against: principles 01 + 03, z027.]

12. **Hold-the-dialectic check in skill reviews** — when reviewing a skill
    or proposed change, explicitly ask "what's the counter-principle this
    might be collapsing?" The existing two-tier discipline already gestures
    at this; making it an explicit checkpoint catches Befehlstaktik creep
    early.
    [Sources: Clausewitz R9, IDF TO"L cross-cutting, Mission Command zero-defect warning.]
    [Lands against: skill-lab review notes, principle 04, `feedback_two_tier_discipline`.]

---

## 4. BOTTOM — Dilemmas to bring Lihu

Two cross-cutting decisions surface from the synthesis. Both in z026 shape
(options + lean + manager-relevant considerations only).

### DL1. Should we adopt a McChrystal O&I cadence — and what shape?

**Decision needed:** Whether to introduce a daily/cross-Gin synthesis
ritual (battle rhythm), and if so, what cadence and what artifact.

**Options:**
- **A.** Skip — adding a ritual at our scale (1 human + N Gins) risks Pitfall 2 (ceremony as substitute for action). Rely on existing `/end`, `/handoff`, `dx zettel list`, agent-records.
- **B.** Adopt `dx morning-brief` only — pull-on-demand, no enforced cadence. Lihu reaches for it when he opens a session. Lowest commitment, lowest risk of ceremony.
- **C.** Adopt `dx morning-brief` *plus* a fixed-cadence enforcement (hook fires at session-start if no brief in last 24h, or at first command of the day). Closest to McChrystal. Highest risk of becoming theater if unused.

**UseGin's lean:** **B**.

**Why:** PO"SH + Modern Application + IAF all want *some* battle rhythm —
the absence is real friction (C5 above) and the "context resets feel
painful" symptom is downstream of it. But Mission Command's Pitfall 2
warning is sharpest at our scale — we are not a 7,500-person JSOC, and
enforced cadence at 2-person scale will collapse to ceremony within a
month. Pull-on-demand keeps the *artifact* (which solves the substrate
problem) while not committing to the *cadence* (which is where ceremony
risk lives). Upgrade B → C only after the artifact has been used 3+ times
and Lihu is reaching for it naturally (the IDF TO"L "field-up doctrine"
discipline — z015 in micro).

**Price:** B doesn't fully solve the cross-Gin shared-consciousness gap
(PO"SH's COP). Multiple in-flight sub-Gins still won't see each other's
state — only Lihu will, when he reads the brief. Self-synchronization
between sub-agents (Alberts/Garstka tenet 3) stays unsolved. We accept
that; it's a real architectural gap and worth its own track later.

**Risk:** B becomes a tool no one uses, and the absence-of-cadence symptom
keeps biting. Mitigation: build the brief, use it for 2 weeks, decide at
that point whether to upgrade to C or kill it.

**For you to weigh:**
- Whether the "context resets feel painful" symptom is severe enough that
  pull-on-demand won't fix it.
- Whether you want to commit to *running* the brief daily even if the
  harness doesn't enforce it (the IDF TO"L answer is "yes — discipline is
  the cadence; tools just remind").
- Whether the brief should include sub-Gin in-flight state (PO"SH COP) or
  stay as overnight delta only (simpler artifact).
- Whether the artifact lives at top-level `dx morning-brief` or under the
  `use-gin` skill (skill-discoverability vs. CLI-discoverability).

### DL2. Should we promote the 6 proposed tikur enhancements as a single batch, or stage them?

**Decision needed:** How to land the IAF tikur enhancement set
(`iaf-tikkur/proposed-tikur-skill-enhancements.md`).

**Options:**
- **A.** Single batch — land all 6 in one PR, as a coherent doctrinal update. The IAF tikur professor designed them as a system.
- **B.** Stage — start with #1 (error/negligence — the keystone), use it for 2–4 tikurs, then layer on #2–#6 as needed. Lower-risk introduction.
- **C.** Stage but commit-to-all — land #1 now, schedule #2–#6 explicitly (with dates / triggers), so staging doesn't drift into permanent partial adoption.

**UseGin's lean:** **A** (single batch).

**Why:** The enhancements are internally coherent and were *designed as a
unit*. #1 (error/negligence) is the keystone, but #3 (reword "blameless"
to separate room from consequences) is what makes #1 land — without #3, #1
lands against the existing rule 1 wording, and the contradiction surfaces.
#4 (mandatory propagation) is what makes the lekach actually move — without
it, the new categorization just sits in the zettel. #6 (prerequisites)
prevents the form-without-bedrock failure mode (Pitfall 2) that would
swallow the whole batch. Staging risks Pitfall 6 — importing the wrong
half — and IDF TO"L's command-climate-as-system warning (cross-cutting:
"removing one and keeping the rest is unstable") applies directly.

The Modern Application Pitfall 5 counterargument (don't over-plan the
adoption — ship a thin slice) is real; the response is that the
*proposed-changes file already IS the thin slice* — we've designed it,
sized it, and the substrate (zettel-capture, update-config, dx zettel) is
ready. The cost of batching is one extra session of skill editing; the
cost of staging is the doctrinal-coherence loss across 4–6 weeks.

**Price:** A larger single PR to review. The skill grows in length (the 6
enhancements are substantive). Lihu carries more attention burden in
review.

**Risk:** If A introduces a bug or framing we want to revise, we revise the
whole batch. Mitigation: the enhancements are append-mostly to the existing
skill structure (per principle 02) — none of them rewrite the existing
rules wholesale; they extend, sharpen, and add new sections.

**For you to weigh:**
- Whether you want to read the full proposed file in one sitting (A) or
  in pieces (B/C).
- Whether the next 2–4 tikurs are likely to be high-stakes (favors A —
  doctrine should be in place) or low-stakes (B is fine — we can layer in
  as needed).
- Whether you want the doctrine *defended* against the next imported-form
  failure mode (Pitfall 2 risk) — A is more defended; B leaves the gaps
  open longer.
- Whether C is worth the explicit calendar overhead (it's a hedge that
  costs a planning step).

---

## Notes for the next reader

- Per the synthesizer mandate: this file does not modify any source
  whiteboard, skill, hook, or zettel. The proposed changes in §3 land via
  separate decisions, gated by Lihu (DL1, DL2 are the immediate ones).
- Where a finding cites a specific zettel range (e.g., z058–z074), the
  range is the friction-zettel cluster from this dogfood session; it's the
  *substrate* the convergent rules are reading.
- The professor whiteboards remain the deeper proof chain. This synthesis
  is the click; the whiteboards are z018's "investigate without limit"
  inside.
- Open architectural gap not addressed by any proposed change: peer
  channel between concurrent sub-Gins (PO"SH self-synchronization tenet).
  Surfaced by PO"SH and Modern Application; flagged as future track.
