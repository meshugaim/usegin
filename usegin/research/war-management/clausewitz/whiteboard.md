# Clausewitz — applied to managing UseGin and our dev team

Whiteboard for the Clausewitz professor in the war-management R&D track (z075).
Audience: Lihu plus future synthesizer agent. Other professors (IDF/TO"L, PO"SH,
IAF tikkur, Mission Command, Modern Application) will cross-reference this.

Ground rule, by Lihu's own framing (z018, z036): investigation is unbounded,
output is the click. The top section IS the click. The middle is the proof
chain. The bottom is the trail.

---

## 1. TOP — distilled reading: 10 actionable Clausewitzian rules for managing a Gin-augmented dev team

These are opinionated. Each ties back to a UseGin principle or numbered zettel.
Read these alone if you read nothing else.

### R1. Plans are theory; the gap to execution is the work — instrument the friction, don't pretend it isn't there

Clausewitz: "Everything in war is very simple, but the simplest thing is
difficult." Friction is the *only* concept that distinguishes "war on paper"
from real war (Book 1, Ch 7). Our analog: the spec is paper; the gap between
the spec and what Gin actually ships is friction. We already named this loop
(z009) but Clausewitz adds the discipline of **measuring** it. Every spec
should have a "where did the friction land?" zettel attached after the slice
ships, and re-reading the slice's friction-zettels (z058, z059, z060, z062, z063)
is the actual debrief — not the green CI checkmarks.

→ Ties to: **principle 04 (fighting vs asking)**, **z009**, **z058–z064**.

### R2. Friction is everywhere and tiny — the "iron will that crushes the machine along with the obstacles" is the failure mode, not the success

Clausewitz's warning: a powerful will *does* overcome friction, but it
"crushes the machine along with them." Mapped: when a session enters
"fighting" mode (principle 04), the temptation is to grind harder. Clausewitz
says: that grinding crushes the developer's *or the agent's* working state
along with the obstacle. **The fork in z009 is the Clausewitzian reading**:
lower the friction (find the better path) or stop and raise it loudly. Don't
break the machine — the human, the session, the codebase, or the agent — to
get past one obstacle.

→ Ties to: **principle 04**, **z009**, **z012 (anger/annoyance temperature)**.

### R3. War is the realm of uncertainty — three quarters of what Gin acts on is in fog. Plan for it; don't pretend to dispel it.

Clausewitz, Book 1 Ch 3: "War is the realm of uncertainty; three quarters of
the factors on which action in war is based are wrapped in a fog of greater
or lesser uncertainty." Our analog: when Gin starts a slice, three quarters
of what matters — what the user *actually* needs, what the codebase actually
does in the corner he hasn't read, what the next session will need from the
zettels he writes today — is fog. The response is **not** more upfront
investigation to dispel the fog (that's the Mahdi-of-precision failure). The
response is z018: **investigate without limit on the inside, output the click
on the outside, and accept that the click is provisional until friction
proves otherwise.**

→ Ties to: **z018**, **z036 (be laconic)**, **principle 03 (pull Claude into our world)**.

### R4. Coup d'œil: Gin earns judgment when his "inner light in the dark" has been calibrated against our specific terrain — until then, ask.

Clausewitz on military genius (Book 1 Ch 3): the commander's two indispensable
qualities under uncertainty are *coup d'œil* (the inner light that picks the
right move in the obscurity) and *resolution* (the courage to follow that
light). **But coup d'œil is terrain-specific** — a brilliant general dropped
into an unfamiliar theater is a novice. Our rule: Gin earns coup d'œil — the
right to *act* without surfacing the dilemma — only on terrain we've already
walked together (a sub-app he's built, a codebase area he's modified before, a
class of decision we've made the same way three times). On novel terrain
(new sub-app, unfamiliar service, new class of decision), Gin owes the dilemma
to Lihu in z026 shape, even if he is "sure." The asymmetry: false coup
d'œil is much more expensive than one extra dilemma surfacing.

→ Ties to: **z026 (dilemma protocol)**, **principle 03**, **z020 (decision shape)**.

### R5. Center of gravity: identify the one thing whose collapse collapses everything — and protect it accordingly

Clausewitz, Book 8 Ch 4: "Out of [the dominant characteristics] a certain
centre of gravity develops, the hub of all power and movement, on which
everything depends." Modern reading (Echevarria): the COG is a *focal point*,
not a strength or weakness — the thing that holds the system together.

For UseGin, the candidate COGs are not equal:
- **Lihu's attention/judgment is the dominant COG.** Tokens are unbounded
  (z027); Lihu's attention is the bound. Every protocol — z018's "give me the
  click", z036 (be laconic), z024 (not everything in Linear), z026 (only
  surface real dilemmas) — exists to protect *this* COG.
- **The shared-brain corpus (zettels + memory) is the secondary COG.**
  Principle 02 (preserve, don't delete) is its protection rule. Corruption
  here (z058's silent-blank-line strip) is COG damage even when no test fails.
- **The friction signal itself is the tertiary COG.** Without honest friction
  capture, principle 04 has nothing to read. Suppressing a frustration zettel
  to "look productive" is COG damage.

The rule: when prioritizing among improvements, **rank by COG protected**.
A 5-minute fix that prevents Lihu having to re-verify Gin (z018) outranks a
2-day refactor of internal Gin tooling.

→ Ties to: **z027**, **z018**, **z028 (one shared brain)**, **principle 02**.

### R6. The political object dominates: every Gin action is a continuation of the team's strategic intent by other means

Clausewitz, Book 1 Ch 1: "War is simply the continuation of political
intercourse with the addition of other means... the main lines along which
military events progress, and to which they are restricted, are political
lines that continue throughout the war into the subsequent peace."

Mapped: every line of code Gin writes is a continuation of the team's product
intent. When the "military" (the implementation) drifts from the "political"
(what Lihu actually wants the product to *be* in 6 months), Gin has lost the
plot regardless of how clean the code is. **Principle 03 names this exactly**
— pull Claude into our (decision-making) world; the code is downstream. The
discipline: every charter (z023) should name the political object — *why
this slice now, in service of what end-state* — not just the deliverable. A
charter without a political object produces well-executed irrelevance.

→ Ties to: **principle 03**, **z023 (spawn-as-instantiation)**, **z020 (decision shape)**.

### R7. The remarkable trinity, our version: human emotion / agent stochasticity / strategic intent — manage all three, don't collapse any

Clausewitz: war is a "remarkable trinity" of (a) primordial passion/hatred
(the people), (b) chance and probability (the commander/army), (c) reason
subordinated to policy (the government). The trinity floats — different wars
weight the three differently — and a theory that ignores any one of them
collapses in practice.

Our analog (proposed; this is the most generative mapping):
- **Passion** = the human side: Lihu's frustration, excitement, fatigue, the
  emotional temperature of the session (z012). Our z012 + principle 04 already
  read this; Clausewitz says it must be a *first-class input to strategy*, not
  a footnote. A session run while Lihu is fighting (principle 04) produces
  decisions that need to be revisited later — the passion was driving, not the
  reason.
- **Chance** = agent stochasticity + the codebase's own surprises: the harness
  blocking a deliverable (z030), an effi timeout (z031), the autosync
  collision (reference_autosync_concurrent_collisions), the test that fails
  in CI but not local (reference_fake_timer_cleanup_order). These are the
  Clausewitzian "infinity of petty circumstances." Our friction-zettel
  discipline (z058–z074) is how we instrument this leg.
- **Reason / strategic intent** = the political object (R6): Lihu's
  half-year intent, the four principles, the COG protection rules.

The Clausewitzian discipline: **do not let one leg dominate.** A session that
is all reason (pure plan execution, ignoring frustration signals) is brittle.
A session that is all chance (chasing every flake, every harness quirk) is
incoherent. A session that is all passion (fighting through frustration to
"win") crushes the machine (R2). Health = the three in tension, none silent.

→ Ties to: **principle 04**, **z012**, **z028**, **friction-zettel cluster**.

### R8. Moral forces are the noble metal; physical forces are the wooden handle. Manage the moral side first.

Clausewitz, Book 3 Ch 3: physical and moral forces are "completely fused...
not to be decomposed like a metal alloy by a chemical process. ...The physical
are almost no more than the wooden handle, whilst the moral are the noble
metal, the real bright-polished weapon."

Mapped: tooling, CLIs, build systems, test harnesses — these are the wooden
handle. The moral forces are: Lihu's trust in Gin, Gin's trust that his
zettels will be read, the team's shared belief that the principles actually
govern, the felt sense that "we're doing this together" rather than "I'm
fighting the agent." **Every tooling decision should be evaluated for its
effect on the moral side, not just the physical.** A "10x faster" CLI that
makes Lihu feel surveilled or makes Gin feel rule-bound has lost the trade.
This is why principle 01 (intuitive workflows) and z009 (friction is a fork,
not a brake) read more important than any specific tool — they are moral-side
disciplines.

→ Ties to: **principle 01**, **z001 (Gin also intuitive)**, **z009**, **principle 04**.

### R9. War is paradoxical at its limits — pure offense and pure defense both fail. Hold the dialectic.

Clausewitz's pattern (across the whole work): every concept has its
counter-concept built in. Attack/defense, theory/practice, ends/means,
absolute war/real war. The discipline is to **hold the tension**, not
collapse it. A doctrine that "always attacks" or "always defends" has lost
the plot.

Our analog dialectics that should never collapse:
- **Investigate without limit / output the click** (z018, z036) — neither
  pole alone works.
- **Fight Claude / ask Claude** (principle 04) — sometimes you do have to
  push back; the discipline is *noticing* which mode you're in.
- **Build from scratch / lift what works** (z028) — both, not either.
- **Spawn freely / charter tightly** (z023, z027) — unlimited resources
  needs disciplined charters or it produces noise.
- **Two faces / one suffices** (z022) — don't force two-facedness; don't
  miss it where it lives.

The Clausewitzian rule: when a principle is being applied as if it has no
counter-principle, it has gone wrong. Re-read the dialectic.

→ Ties to: **z022**, **z023**, **z027**, **z028**, **principle 04**.

### R10. Debrief the friction (תחקור / tikkur), don't just ship the slice

Clausewitz did not name the IDF tikkur tradition (the IAF professor will), but
he prepared the ground: **friction is everywhere, plans always diverge, and
the only way to convert friction into knowledge is to study it after the
fact.** Our `tikur` skill exists; principle 02 (preserve, don't delete) is
the substrate; the friction-zettel cluster from this session (z058–z074) is
the proof that the practice works *when we do it*. The discipline:
**every shipped slice gets a 15-minute "what was the friction?" pass that
produces a zettel cluster**, even when nothing went catastrophically wrong.
The friction zettels are the doctrine update, slice by slice. Without them,
the next slice re-encounters the same friction.

→ Ties to: **principle 02**, **`tikur` skill**, **z058–z074 cluster**, **z076 (R&D as recurring pattern)**.

---

## 2. MIDDLE — the conceptual model: each Clausewitzian concept in its own terms, then mapped

Each subsection: **Clausewitz first** (real concept, real quote, real source),
**then us** (analog, with the explicit limit of the analogy named).

### 2.1 Friction (Book 1, Chapter 7)

**Clausewitz**: Friction is the gap between war on paper and real war. It is
not one big obstacle — it is "an infinity of petty circumstances" (weather,
exhaustion, missing horses, miscommunication, fatigue) that accumulate and
make even simple things hard. "Everything in war is very simple, but the
simplest thing is difficult." Friction is *constitutive* of war, not a defect
to be engineered away — only the experienced commander has even an intuitive
sense of how much friction will appear. Iron will overcomes friction "but
crushes the machine along with them" — i.e., grinding through friction has a
cost paid in the instrument.

**Quote (Howard/Paret in spirit, 1873 translation directly)**: "Friction is
the only conception which, in a general way, corresponds to that which
distinguishes real war from war on paper."

**Us**: The gap between the spec and what Gin ships, between the CLAUDE.md
rules and what actually happens in the session, between "we agreed to X" and
the artifact in git. Examples from this very dogfood session: z058 (link
strips blank line), z059 (target-id not validated → ghost link), z060
(short-id not normalized in stored threads), z030 (harness blocks
charter-mandated deliverable), z038 (concurrent `dx zettel add` race), z031
(effi timeout), z029 (sub-Gin can't spawn). None of these are catastrophic;
all of them accumulate. The Clausewitzian move is to **name them, count them,
and treat the count as the slice's real cost** — not the lines-of-code
metric.

**Limit of the analogy**: Clausewitz's friction is *physical and human*
(weather, exhaustion, miscommunication). Ours is *also* digital (harness
quirks, race conditions). But the core insight — friction is the work, not
the noise — transfers cleanly. Where it doesn't transfer: Clausewitzian
friction can never be eliminated; some of ours genuinely can be (z058 has a
fix). The discipline is distinguishing *the kind we can lower* (z009 yes-fork)
from *the kind we just have to navigate* (z009 no-fork).

### 2.2 Fog of war (Book 1, Chapter 3)

**Clausewitz**: "War is the realm of uncertainty; three quarters of the
factors on which action in war is based are wrapped in a fog of greater or
lesser uncertainty." Note: Clausewitz never wrote "fog of war" — that's a
later coinage. He wrote *Nebel* (fog) describing the obscuring effect of
incomplete information on the commander. Crucially, the fog is not just
"not enough intel" — it is *active misinformation*: reports that exaggerate,
maps that mislead, weather that hides, enemies whose intent is unknowable
in principle.

**Us**: When Gin starts work, the fog covers: (a) what the user *actually*
needs vs what they asked for (z018's "give me the click" is the response to
this fog); (b) the codebase's true behavior in corners not yet read; (c) what
the next session will want from the zettels he writes today (z040 — clusters
emerge from threading); (d) the harness's actual rules in this turn (z030);
(e) the team's not-yet-articulated future direction (z032's deferred
decisions are fog made explicit).

The mistake is *trying to fully dispel the fog before acting*. Clausewitz
explicitly rejects this — three-quarters is the steady-state, not a
solvable problem. The right response: **act on the click, instrument the
friction, debrief the surprises** (R3 + R10). Our z018 already names this:
investigate without limit, then output the click — the unbounded
investigation reduces fog where it can be reduced; the click is the action
taken under residual fog.

**Limit of the analogy**: Clausewitz's fog covers an adversary with hostile
intent. Ours rarely does — the codebase isn't trying to deceive Gin. But the
*structure* is the same: incomplete information, time pressure, and the
need to commit to action before certainty arrives.

### 2.3 The remarkable trinity (Book 1, Chapter 1, §28)

**Clausewitz**: War is a *wunderliche Dreifaltigkeit* — Howard/Paret's first
edition rendered this "paradoxical trinity"; the 1989 revision corrected to
"remarkable." The three legs:
1. **Primordial violence, hatred, and enmity** — a blind natural force.
2. **The play of chance and probability** — within which the creative spirit
   roams.
3. **Subordination as an instrument of policy** — subject to reason alone.

A *secondary* trinity links these to social institutions: people (passion),
army/commander (chance), government (reason). Bassford and others have
warned: Harry Summers's reduction of "the trinity" to *just*
people/army/government is a misreading; the primary trinity is the
emotional/probabilistic/rational dynamics, with the social trinity as their
anchoring institutions. Both matter.

The crucial insight: the trinity is **a floating balance, not a fixed
weighting**. Different wars sit at different points among the three. A theory
that fixates on any one leg fails when reality moves to a different
weighting. War is "a true chameleon" because of this floating balance.

**Us (our analog trinity)**:
1. **Human emotion** — Lihu's vibe, frustration, energy, attention. Read by
   z012, principle 04, the `his` skill, the `rate` mechanism.
2. **Agent + environment stochasticity** — model behavior, harness rules,
   codebase quirks, network flakes, race conditions. Read by the
   friction-zettel cluster, the `tikur` skill, autosync collision rules.
3. **Strategic intent** — what we're actually trying to *be* as a product/
   team/codebase in 6 months. Read by principle 03 (pull Claude into our
   world), z020 (decision shape), z032 (deferred decisions still tracked).

The Clausewitzian rule (R7): **don't let one leg silence the others**. A
session that ignores Lihu's frustration leg ships work that has to be
re-done. A session that ignores agent-stochasticity ships work that breaks
in CI. A session that ignores strategic intent ships clean code that
doesn't matter.

**Limit of the analogy**: Clausewitz's "passion" is collective —
nationalist hatred. Ours is individual — Lihu's mood. But the structural
move (the leg can dominate and distort) holds. The "chance" leg maps
unusually well — Clausewitz's "infinity of petty circumstances" reads like
a description of distributed-systems debugging.

### 2.4 Center of gravity / Schwerpunkt (Book 8, Chapter 4)

**Clausewitz**: "Out of [the dominant characteristics of both belligerents] a
certain centre of gravity develops, the hub of all power and movement, on
which everything depends." The German word is *Schwerpunkt* — "weight of
effort" or "focal point", appearing 53+ times across *On War*. Crucially
(per Echevarria's "It's Not What We Thought"), Clausewitz did **not** mean
"the enemy's strongest point" or "the enemy's weakest point." He meant **the
focal point that holds the enemy's system together** — collapse it, and
everything else falls.

The COG can be: an army (Napoleon's Grande Armée), a capital (Paris in some
configurations), an alliance (the bond between coalition partners), or a
leader's personal authority. Different wars, different COGs.

**Us**: See R5 above for the application. The candidate COGs in our system,
ranked:
- **Lihu's attention/judgment** (primary). Tokens are unbounded; his attention
  is the bound. Protected by: z018, z036, z024, z026, z027.
- **The shared-brain corpus** (secondary). Protected by: principle 02,
  z028's "no privacy" decision, z058-style integrity fixes.
- **The friction signal itself** (tertiary). Protected by: principle 04,
  z009, z012.
- **Trust between Lihu and Gin** (load-bearing across all three). Protected
  by: z018 (don't make him re-verify), principle 03 (don't drag him into the
  mess), z020 (always emit decision shape).

The discipline: **rank improvements by which COG they protect.** A friction
fix that protects Lihu's attention outranks one that just makes Gin's life
easier. A zettel-corpus integrity fix outranks a CLI ergonomic win.

**Limit of the analogy**: Clausewitz's COG is what you attack. Ours is what
we defend. But the structural insight — find the one thing whose collapse
collapses everything, and rank actions by their effect on it — is the same
move.

### 2.5 The political object / war as continuation of policy (Book 1, Chapter 1, §24)

**Clausewitz**: "War is simply the continuation of political intercourse
with the addition of other means. ...The main lines along which military
events progress, and to which they are restricted, are political lines that
continue throughout the war into the subsequent peace." The political
object dominates the military object — the war exists *for* the political
end, not the other way around. When generals forget this and pursue military
victory as an end in itself, they win battles and lose wars.

**Us**: Every Gin action is a continuation of the team's strategic intent by
other means. Code that is technically excellent but doesn't serve the
team's actual product/management intent has lost the plot. **Principle 03
names this directly**: don't dive into Claude's world, pull Claude into ours.
The "political" world is Lihu's decision-making world — what to build, why,
when, and whether what came back is good. The "military" world is the
implementation churn. They are continuous, not separate.

The discipline (R6):
- Every charter (z023) should name the **political object**, not just the
  deliverable. "Build the zettel CLI" is a deliverable. "Build the zettel CLI
  *because* the team needs a low-friction capture surface so the shared 2nd
  brain accumulates content before pgvector lands" is a political object.
  Without the latter, the charter is incomplete and the spawned Gin will
  optimize for the wrong thing.
- When Gin notices the slice has drifted from the political object — even
  though the deliverable is on track — that drift is a **dilemma to surface**
  (z026), not a quiet course-correction. The political object change is
  Lihu's call.
- Decisions in z020 shape always include "because" — that's where the
  political object lives. A z020 decision without a clear "because" is a
  decision that has already drifted.

**Limit of the analogy**: Clausewitz's "policy" is statecraft — interests,
treaties, the post-war balance of power. Ours is product strategy plus team
intent. The structure is identical (means subordinate to ends; ends drive
means selection); the content is wholly different.

### 2.6 Military genius and coup d'œil (Book 1, Chapter 3)

**Clausewitz**: Genius is when "peculiar qualifications of understanding and
soul" reach a high order. Two indispensable qualities for the commander
under fog and friction:
- **Coup d'œil** — literally "stroke of the eye"; figuratively, the inner
  light that perceives the right move in obscurity. Originally narrow (a
  cavalry commander reading terrain at a glance), Clausewitz broadens it to
  *all* able decisions made in the moment of action, including the mental
  eye.
- **Resolution** — the courage to follow the faint light of coup d'œil
  through the fog without paralysis.

Crucially, coup d'œil is not innate magic — it is *trained intuition*, built
on enormous experience of similar situations. The novice general has no
coup d'œil; the experienced one does. From these two flow "presence of mind"
— the great conquest over the unexpected.

**Us (R4)**: Gin earns coup d'œil — the right to act without surfacing the
dilemma — only on terrain we've walked together. The asymmetry: false coup
d'œil (Gin acts on bad intuition) is much costlier than one extra dilemma
(Gin asks when he could have acted).

Calibration heuristic for Gin:
- **Acts without asking** when: same class of decision made the same way ≥3
  times in our codebase, the action is reversible (git, append-mostly), and
  it touches no COG.
- **Surfaces the dilemma** when: novel terrain, the action is hard to revert,
  it touches a COG, OR the friction signal is rising (principle 04 — entering
  fighting mode).
- **Investigates further before either** when: the dilemma surfaces and Gin
  notices he doesn't yet have the click (z018) — investigate, *then* surface
  with the click already in hand.

Resolution maps onto: when Gin has surfaced the click and Lihu approves,
Gin executes without re-asking. Re-asking mid-execution is failure of
resolution and burns Lihu's attention COG.

**Limit of the analogy**: Clausewitz's genius is rare and individual. Gin's
"genius" is a function we are building incrementally — every shipped slice
that worked is a vote for coup d'œil on that terrain; every slice that needed
re-work is a vote against. The corpus (zettels + memory) *is* the trained
intuition substrate.

### 2.7 Moral and physical forces (Book 3, Chapter 3)

**Clausewitz**: "The effects of the physical forces and the moral are
completely fused, and are not to be decomposed like a metal alloy by a
chemical process. ...The physical are almost no more than the wooden handle,
whilst the moral are the noble metal, the real bright-polished weapon."
Examples of moral forces: the spirit and qualities of an army, of a general,
of a government; public opinion in the theater; the moral effect of victory
or defeat. They "escape from all book-knowledge" — they cannot be reduced to
numbers.

**Us (R8)**: Tooling (CLIs, harnesses, test infra) is the wooden handle.
The moral side is: trust between Lihu and Gin, Lihu's felt sense that "Gin
gets it", Gin's felt sense that his zettels will be read, the team's belief
that the principles actually govern. **Every tooling decision should be
evaluated for moral-side effect, not just physical.** Principle 01 (intuitive
workflows) is the moral-side discipline — the workflow exists to be reached
for naturally, which is a *moral* property even though it's measured in the
physical (latency, keystrokes).

This explains why a workflow that is technically optimal but feels wrong
gets abandoned: the moral side has voted no. It also explains why a slightly
clunky workflow that *feels right* (e.g., `dx zettel add` despite its
frontmatter friction) gets used — the moral side has voted yes.

**Limit of the analogy**: Clausewitz's moral forces are about armies under
combat stress. Ours are about a small team and an agent under deadline
pressure. Different intensity, same structure.

### 2.8 The dialectic (cross-cutting through *On War*)

**Clausewitz**: Every concept in *On War* has its counter-concept built in —
attack/defense, theory/practice, absolute war/real war, ends/means,
moral/physical. The discipline is to hold the tension; collapsing to one
pole produces brittle doctrine. (This is also why Liddell Hart's critique of
Clausewitz as "Mahdi of mass" / pure-offensive doctrine misreads him —
Clausewitz explicitly held the dialectic; his disciples collapsed it.)

**Us (R9)**: Our existing dialectics that should never collapse:
investigate-without-limit / output-the-click (z018+z036), fight-Claude /
ask-Claude (principle 04), build-from-scratch / lift-what-helps (z028),
spawn-freely / charter-tightly (z023+z027), two-faces / one-suffices (z022),
preserve / move-forward (principle 02). When a principle is being applied
without its counter-principle in view, it has gone wrong.

---

## 3. BOTTOM — sources

### Primary

- **Clausewitz, *On War*** (Vom Kriege, 1832 posthumous). Two English
  translations matter:
  - Howard & Paret (Princeton, 1976; revised 1984/1989). The standard modern
    scholarly translation. The 1989 revision corrected "paradoxical trinity"
    → "remarkable trinity" (wunderliche Dreifaltigkeit).
  - Graham (1873). Public domain, the version freely available via
    clausewitzstudies.org and marxists.org. Older but useful when Howard/Paret
    is paywalled.

- Key passages cited above:
  - Book 1, Ch 1 — war as continuation of policy; the remarkable trinity
    (§§24–28).
  - Book 1, Ch 3 — military genius; coup d'œil; resolution; "war is the
    realm of uncertainty; three quarters... wrapped in a fog."
  - Book 1, Ch 7 — friction; "everything is very simple in war but the
    simplest thing is difficult"; the iron will that crushes the machine.
  - Book 3, Ch 3 — moral forces ("the noble metal, the real bright-polished
    weapon").
  - Book 8, Ch 4 — center of gravity (Schwerpunkt); "the hub of all power
    and movement, on which everything depends."

### Authoritative scholarship and commentary

- **Christopher Bassford**, *Reclaiming the Clausewitzian Trinity* (with
  Edward J. Villacres). The corrective on Harry Summers's people/army/
  government reduction; restores the primary trinity (passion/chance/reason).
  https://clausewitzstudies.org/readings/Bassford/Trinity/TRININTR.htm
- **Antulio J. Echevarria II**, *Clausewitz's Center of Gravity: It's Not
  What We Thought* (Naval War College Review). The reading that COG = focal
  point that holds the system together, not strength/weakness. Reshaped US
  doctrine on COG.
  https://apps.dtic.mil/sti/tr/pdf/ADA523742.pdf
- **Michael Howard**, multiple essays including the introduction to the
  Howard/Paret edition. Howard's reading is the modern Anglophone baseline.
- **Eugenia Kiesling**, *On Fog* — clarifies that "fog of war" is a
  paraphrase, not Clausewitz's phrase, and tracks how the metaphor evolved.
  https://www.clausewitz.com/bibl/Kiesling-OnFog.pdf
- **Peter Paret**, *Clausewitz and the State* (1976). The biographical and
  intellectual context for *On War*.
- **B. H. Liddell Hart**, *Strategy: The Indirect Approach* (1954, multiple
  earlier editions). The major critique — that Clausewitz's emphasis on the
  decisive battle led WWI generals into the bloodbath. Useful as the
  counter-position; less useful as a reading of Clausewitz himself, who held
  the dialectic Liddell Hart accuses him of collapsing.
- **Hew Strachan**, *Clausewitz's On War: A Biography* (2007). Modern
  intellectual history of the text and its reception.

### Aggregator / convenience

- **clausewitzstudies.org** — the major online clearinghouse for Clausewitz
  texts and commentary, maintained by the Clausewitz studies community.
- **clausewitz.com** — Bassford's site, overlapping but with distinct
  curated readings.

### Cross-references in our own corpus

- **Principles**: 01 (intuitive workflows), 02 (preserve don't delete),
  03 (pull Claude into our world), 04 (fighting vs asking).
- **Zettels referenced above**: z009, z012, z018, z020, z022, z023, z024,
  z026, z027, z028, z030, z031, z032, z036, z038, z040, z058, z059, z060,
  z062, z063, z064, z075, z076.
- **Skills**: `tikur` (debrief tradition — IAF professor will go deep here),
  `companion`, `liaison`, `zettel-capture`.
- **Memory**: `feedback_concise_answers`, `feedback_investigate_sooner`,
  `reference_autosync_concurrent_collisions`,
  `reference_fake_timer_cleanup_order`.

### Companion professors in this R&D round (will cross-reference)

- IDF / TO"L professor — torat lehima, Israeli command climate.
- PO"SH (pikud-ve-shlita) professor — C2 architecture.
- IAF tikkur professor — the debrief tradition (R10's home turf).
- Mission Command professor — Auftragstaktik, commander's intent.
- Modern Application professor — Boyd/OODA, McChrystal, Liddell Hart in
  business adaptation.

---

## Open notes for the synthesizer

1. **The trinity mapping (R7 / 2.3) is the most generative finding** of this
   read. It's the place where Clausewitz pays the highest dividend for our
   specific situation, because it forces us to take Lihu's emotional
   temperature as a *first-class strategic input* rather than a side concern.
   The synthesizer should weight this heavily.

2. **Center of gravity (R5 / 2.4) is the most actionable single rule** —
   "rank improvements by which COG they protect" can be applied tomorrow
   with no further setup.

3. **Coup d'œil (R4 / 2.6) is the place where Clausewitz directly answers a
   question Lihu asked**: when does Gin earn the right to act vs ask? The
   "trained intuition is terrain-specific" frame is the substantive answer.

4. **Liddell Hart's critique is real but mostly off-target for our use** —
   he's arguing against the WWI misreading of Clausewitz, not against
   Clausewitz himself. The Modern Application professor will engage Liddell
   Hart on his own terms; for our purposes the dialectic-holding (R9 / 2.8)
   subsumes the indirect-approach insight.

5. **Friction zettels from this dogfood session** (z058–z074) are *already*
   the Clausewitzian doctrine in action — the team has been doing this
   without naming it. R1, R2, R10 just give it the name and the discipline.
   This is principle 03 in microcosm: pull the philosophy *into* our
   already-existing practice rather than imposing it from outside.
