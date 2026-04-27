# Modern Application — War-management bridges into business / agent-management practice

**Professor**: Modern Application (the bridges out of doctrine into civilian / Gin-augmented dev work).
**Companion profs**: Clausewitz, IDF TO"L, PO"SH C2, IAF tikkur, Mission Command. This whiteboard does **not** restate them — it crosses *into* corporate and agent-management practice and synthesizes from sources outside their core (Boyd, McChrystal, Liddell Hart, Sun Tzu, Principles of War, Operational Art, MDMP, common adoption pitfalls).

Date: 2026-04-27. Session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93.

---

## TOP — Distilled reading: 10 principles for Gin-augmented dev management

These are what survive after running every doctrine below through the question *"so what does this change about how we run Gin-augmented dev work tomorrow?"*. Ordered by leverage (highest first), not by source.

### 1. Orientation is the load-bearing step. Optimize cycle *quality*, not cycle *speed*.

The popular reading of OODA — "go round the loop faster than the enemy" — is the misreading. Boyd's actual claim (Patterns of Conflict, his late drawings): every feedback loop in the system flows through **Orient**. Orient is where culture, prior experience, mental models, and incoming observations collide to produce the working picture of the world. Decide and Act are downstream consequences. A wrong orientation executed quickly is just being wrong faster.

For us: most "let's go faster" pushes on agent workflows are pushes on Decide/Act. The actual leverage is on Orient — making sure the agent (and Lihu) is operating from the right model of the codebase, the user, the prior decisions. Investments in things that improve orientation (zettel capture, code-history, session resume, the `use-gin` skill, the `dx his` telemetry) compound; investments that just shorten the act loop don't.

**Operational consequence**: when a session goes sideways, ask "where did we mis-orient?" before "why did we act slowly?" That's the difference between a tikur (which is an Orient-fix) and a productivity hack (which usually isn't).

### 2. Intent travels; method doesn't. Write commander's-intent style charters, not task lists.

Mission Command (Auftragstaktik) and McChrystal both converge on the same point: in any environment with friction and uncertainty, the lowest level able to act is the level that should decide. The way you make that work without chaos is **commander's intent** — the *why* travels with the order, the *how* stays local.

We already do this when we spawn sub-Gins (z023 — "the charter is the instantiation"). The unmet bar is: most charters under-specify intent and over-specify method. Good charter = "what are we trying to achieve, what's off-limits, what are you authorized to decide vs escalate" + minimal method.

**Operational consequence**: when writing a sub-Gin charter, name the intent in one sentence the agent could quote back, name the off-limits in three lines, and let the rest emerge. Charter quality is downstream of intent clarity, not method completeness.

### 3. Shared consciousness over hierarchical reporting. The O&I brief is the lever.

McChrystal's JSOC reform: 4 raids/month → 300 raids/month. The mechanism wasn't a better C2 hierarchy; it was breaking the hierarchy and replacing it with **radical transparency** — a 90-minute daily Operations & Intelligence brief open to all 7,500 people in the network. Every team saw what every other team saw. Decisions could land at the edge because the edge had the picture.

For Gin-augmented work: the analog is a single corpus all sub-Gins (and Lihu) can read — zettels, session JSONLs, code-history, agent records, Effi project canon. The *value of those tools is shared consciousness*, not archival. When one sub-Gin captures friction, the next sub-Gin orients on it.

**Operational consequence**: a finding lives in a shared, queryable place (zettel, agent-record, Effi canon) the same turn it surfaces. Findings in main-thread chat-only are findings that don't exist for the next agent.

### 4. Empowered execution requires shared consciousness. You can't have one without the other.

This is McChrystal's other half and the most-violated half. "Push decisions to the edge" without the radical-transparency substrate produces **abdication**, not empowerment — the edge is making decisions blind. Conversely, transparency without delegation produces analysis-paralysis — everyone sees, no one acts.

For us: when a sub-Gin is given autonomy ("you have all day, all tokens" — z027), that autonomy only pays off if the sub-Gin has access to the corpus the orientation requires. An autonomous sub-Gin without the zettel corpus, without code-history, without Effi canon, is *abdication*, not empowerment.

**Operational consequence**: before delegating deeper, check that the delegate has the orient-substrate. If not, the delegation is fake.

### 5. Indirect approach: the strong point is rarely worth attacking head-on.

Liddell Hart, distilled: decisive results come from moving along the line of least resistance / least expectation, dislocating the opponent before any blow lands. Direct frontal attack on a fortified position is the most expensive way to win and usually loses. Sun Tzu converges: the supreme excellence is to win without fighting; deceive, flank, exhaust.

For our scope/prioritization decisions: the "strong point" is whatever every team in the space is currently fighting head-on. Effi competing on raw-LLM quality with OpenAI is a frontal attack on a fortified position. Effi competing on grounding in *your team's actual data* is the indirect approach — different terrain, different resistance, our advantage.

**Operational consequence**: when a roadmap item lands on the table, ask "what's the strong point we're attacking, and is there a flanking line?" The flanking line is usually in adjacent terrain (data, integrations, workflow) where competitors aren't fortified.

### 6. Economy of force. Most things should get nothing.

Principle of war common to every doctrine (US, UK, IDF, Sun Tzu, Liddell Hart). It's *not* "be efficient" — it's "deliberately under-resource the secondary so you can over-resource the decisive". Fan out everywhere = decisive nowhere.

For Gin work: the temptation under "unlimited resources" (z027) is to spawn a sub-Gin for every angle. Economy of force says: name the decisive angle, over-resource it, accept that the secondary angles get a thin pass or none. The whole point of having unlimited tokens is that it lets you concentrate them, not spread them.

**Operational consequence**: every multi-Gin spawn should name the *decisive* sub-Gin. The others are economy-of-force allocations. If they're all "decisive" you haven't decided.

### 7. Maintenance of the aim. The single most-violated principle.

Universal across every Principles-of-War list. "Selection and maintenance of the aim" / "Objective" — pick the one thing, maintain it across the noise, don't drift.

In dev work, drift looks like: a session that started on bug-fix turns into a refactor turns into a tooling improvement turns into a new feature, and the bug is still open at the end. We have explicit countermeasures already (companion skill, single-iteration review feedback) — they exist because aim-drift is the dominant failure mode.

**Operational consequence**: every session and every sub-Gin charter names the aim in one sentence at the top. End-of-session question: "did we maintain the aim?" If not, capture *why* we drifted (zettel) — drift is signal about whether the aim was right, or whether we lacked discipline, or both.

### 8. Operational art is the missing layer in most dev teams.

Strategy = vision (what business are we in, who do we serve). Tactics = day-to-day work (this PR, this bug, this slice). The middle layer — **Operational Art** — is the deliberate arrangement of tactical actions in time, space, and purpose to achieve strategy. Most dev teams have a vision deck and a sprint board and *nothing in between*, and that's where execution fails: tactics don't compose into strategy because there's no operational doctrine telling them how.

For us: the layer between "Effi exists to ground LLM answers in your team's data" (strategy) and "fix this Sentry bug" (tactic) is *operational doctrine* — slicing approach (vertical slices, walking skeleton), TDD discipline, review tiers, autosync norms, two-tier review discipline, the rnd skill, the build-orchestrate skill. Each is an operational pattern — a repeatable shape that converts tactics into strategic progress. The accumulating skill library *is* our operational doctrine. The job of `things-we-grow` and `usegin/zettel/` is to make that doctrine inspectable.

**Operational consequence**: when a new pattern repeats 3 times, codify it (z076 — rnd as the 3rd instance). The skill+lab pair is the operational-doctrine artifact. Treat skill creation as an act of operational-art, not infrastructure.

### 9. The blameless tikur is non-negotiable. It's how Orient updates.

Connecting the IAF tikkur tradition (handled by another prof) to the modern-application layer: the OODA loop only works if Orient gets corrected by experience. The tikur is the mechanism by which yesterday's surprise becomes tomorrow's orientation. Without it, you keep running into the same wall.

We already have a `tikur` skill. The bridge into business: this is McChrystal's "after-action review" and Boyd's "feedback into Orient" and the Toyota "five whys", all the same instrument. The discipline that distinguishes serious organizations from ceremonial ones: **mandatory fix lands**. A tikur that ends in a finding without a corrective action committed-to-code is theater.

**Operational consequence**: every tikur ends with a committed change to code, doctrine, or skill — not a "we should be more careful" line. If the corrective is "add a hook", add the hook. If it's "update the skill", update the skill. The tikur is incomplete until the orient-update is in the substrate.

### 10. Distinguish the *complex* from the *complicated*. Don't apply Taylor to Cynefin's complex domain.

McChrystal's central frame: **complicated** systems (a watch, a 1955 assembly line) have many parts in deterministic relationships and yield to reductionist planning. **Complex** systems (markets, insurgencies, distributed software, agent fleets) have so many interacting parts that emergence dominates and prediction collapses. Taylorist management — break into smallest tasks, optimize each, plan the one best way — works for complicated and *fails* for complex.

Most agent-management work is complex, not complicated. Pre-decomposition into rigid task graphs (the temptation when you see "I have 10 sub-Gins") is the Taylorist move. The right move is set the intent, set the substrate, let teams interact, observe what emerges. Charters define *boundaries*, not *recipes*.

**Operational consequence**: when a workflow keeps producing surprises despite the plan, that's signal it's complex. Stop adding plan-detail; add transparency and feedback (shared consciousness, faster Orient) instead.

---

## MIDDLE — The bridges, source by source

### Bridge 1 — Boyd's OODA loop (Observe → Orient → Decide → Act)

**Canonical claim**: Boyd developed OODA in fighter combat (Korea-era F-86 vs MiG-15), generalized it through *Patterns of Conflict* (1976, 196 slides over 6 hours) into a theory of conflict as feedback-loop competition. Common reading: "loop faster than the enemy = win." **Boyd's actual claim (per Chet Richards, who worked with Boyd directly): Orient is the central node — every feedback path flows through it. Orientation is shaped by culture, genetic heritage, prior experience, new information. The decisive advantage is having a *better* Orient, not a *faster* loop.**

**Modern adaptation**: business literature (especially in agile, lean startup, infosec) borrowed OODA and almost universally took the wrong half — "speed kills." This produced "ship fast" cargo-cult without the orient-discipline that made Boyd's pilots win.

**Maps to us**:
- Our entire DX investment (zettels, code-history, `use-gin` handbook, Effi canon, agent records, session JSONLs, `dx his` telemetry) is *Orient infrastructure*. It is more important than any tool that just speeds Act.
- The "fighting vs asking" self-check (principle 04) is a Boyd-style orient-check: *am I in a tight low-orient loop, or am I oriented?*
- When a session is failing, the failure is almost always a mis-orient (wrong file, wrong assumption about the codebase, missed prior decision in zettels). It is rarely a too-slow-Act.
- The `companion` skill is structurally an Orient-corrector running alongside the Act stream.

### Bridge 2 — MDMP (Military Decision-Making Process — FM 5-0)

**Canonical claim**: 7-step staff process for the US Army: (1) Receipt of mission, (2) Mission analysis, (3) COA development, (4) COA analysis (wargaming), (5) COA comparison, (6) COA approval, (7) Orders production. Originated in 1968 (FM 101-5), formalized in FM 5-0 (2005), evolved into ADP 5-0 (2012/2019) under mission-command emphasis.

**Acknowledged criticisms** (from US Army's own retrospectives): rigid, inflexible, slow, resource-intensive, eats subordinates' planning time, adapts poorly to rapidly-changing conditions. Iraq/Afghanistan exposed it. The 2019 update tried to soften it with running estimates and continuous assessment.

**Maps cleanly to us**:
- Step 1 (Receipt of mission) ≈ Linear issue assignment / `/spec` skill input.
- Step 2 (Mission analysis) ≈ baseline/research phase in `build-orchestrate`.
- Step 3 (COA development) ≈ `divergent-before-convergent` skill — produce multiple candidate approaches.
- Step 4 (COA analysis / wargaming) ≈ test-architecture + tdd-impl-plan skill pair (ENG-5365).
- Step 5-6 (Comparison / approval) ≈ Lihu-side decision via z020 decision shape.
- Step 7 (Orders production) ≈ spec issue + slice decomposition.

**Where it breaks**:
- MDMP assumes a complicated environment with stable adversary; agent-augmented dev is complex (McChrystal). Doing the full 7-step ceremony for a small slice is the same anti-pattern that broke MDMP in counterinsurgency.
- The value isn't running all 7 every time. The value is *knowing which step you're skipping and why*. We do `divergent-before-convergent` only when the COA isn't obvious; we skip wargaming for low-risk slices. Conscious skipping ≠ never doing.

**Lift**: the *staff* concept. MDMP is fundamentally a staff-distributed process, not a single-commander process. The reason `liaison` and `build-liaison` and `cell` work is that they instantiate a staff (workers, reviewers, verifiers) around a commander (Lihu / main thread). The professor pattern in this very R&D round is a staff for a research mission.

### Bridge 3 — Stanley McChrystal — Team of Teams (JSOC reform, 2003-2008)

**Canonical claim**: Industrial-age C2 hierarchies are *complicated-system tools applied to complex-system problems* and they fail. JSOC's transformation against AQI (Al-Qaeda in Iraq) required dismantling silos and replacing them with: (1) **shared consciousness** — radical information transparency; (2) **empowered execution** — decision authority pushed to the edge.

**The mechanism — the O&I brief**: 90-minute daily Operations & Intelligence video conference, open to all 7,500 personnel in the JSOC network worldwide. Every team's data was visible to every other team. Commander's intent was reinforced. Decisions could land at the edge because the edge had the picture. Result: 4 raids/month → 300 raids/month over ~3 years.

**The intellectual foundation — complex vs complicated**: McChrystal explicitly attacks Taylorism. Frederick Taylor's "one best way" / scientific management produced a "clockwork universe" assumption. Works for complicated systems (assembly lines). Fails catastrophically in complex systems (insurgencies, software, distributed teams). The interactions between components, not the components themselves, produce outcomes.

**Maps to multi-Gin operations**:
- Our zettel corpus + agent-records + Effi canon + session JSONLs + code-history = the substrate for **shared consciousness** across sub-Gins. Their existence is a McChrystal move, even if we didn't name it that.
- z023 (spawn-as-instantiation, sub-Gins are also Gins) and z027 (autonomy under unlimited resources) are **empowered execution**.
- Open question / risk: do we have an O&I-equivalent? Not really — there's no daily synthesis ritual where all in-flight Gin work is visible to all other Gins. The companion skill, the periodic Effi canon updates, the autosync of agent-records *approximate* it. But we have not built the deliberate ritual.
- **Friction signal worth a zettel**: the absence of a deliberate cross-Gin O&I ritual. We have the substrate, we lack the rite that activates it.

### Bridge 4 — B.H. Liddell Hart — Strategy / The Indirect Approach

**Canonical claim**: After WWI's Western-Front catastrophe, Liddell Hart spent decades cataloguing decisive battles and concluded: **decisive results almost never come from frontal application of strength against strength**. They come from moving along the *line of least resistance* (physical) which is also the *line of least expectation* (psychological), dislocating the opponent before any direct blow.

**Eight Maxims** (Strategy, 2nd ed., Ch. XX): six positive, two cautionary. The unifying theme: concentrate strength against weakness. Selected:
- "Adjust your end to your means." Don't bite off more than you can chew.
- "Keep your object always in mind, while adapting your plan to circumstances."
- "Choose the line (or course) of least expectation."
- "Exploit the line of least resistance."
- "Take a line of operation which offers alternative objectives."
- "Ensure that both plan and dispositions are flexible."
- (Negative) "Do not throw your weight into a stroke whilst your opponent is on guard."
- (Negative) "Do not renew an attack along the same line after it has once failed."

**Common misread**: Liddell Hart is not anti-combat — he's anti-frontal-attrition. The indirect approach still ends in combat; it just sets up the combat to be decisive rather than grinding.

**Maps to scope/prioritization**:
- "Don't renew an attack along the same line after it has once failed" → if a feature has been re-tried 3 times the same way, the next attempt should not be the same shape. Capture as zettel, change the line.
- "Adjust your end to your means" → the spec skill's emphasis on acceptance criteria over feature wishlist; the slicing-specs discipline. Vertical slices are an indirect approach: instead of attacking the full feature head-on, advance along the thinnest end-to-end line.
- "Line of operation that offers alternative objectives" → walking-skeleton design. Build the spine that lets you pivot between several end-states without a full rewrite.
- "Choose the line of least expectation" → competitive: where competitors aren't looking. Strategic: AskEffi grounding-in-team-data is exactly this vs. raw-LLM frontal attack.
- "Plan and dispositions flexible" → why we prefer rebase over merge, why we ship in slices, why feature toggles exist. Flexibility is a strategic posture, not a tactical convenience.

### Bridge 5 — Sun Tzu — The Art of War (the Clausewitz convergences and divergences)

The Clausewitz prof handles On War. Here I cover Sun Tzu specifically and where they meet/part.

**Canonical claim** (Sun Tzu, ~5th c. BCE): the supreme art is to subdue the enemy without fighting; know your enemy and know yourself; deception is the foundation of war; strike where the enemy is unprepared, appear where you are not expected; victory is shaped before battle by superior position, intelligence, and timing.

**Convergences with Clausewitz**: both treat war as the continuation of policy by other means; both emphasize friction and the gap between plan and reality; both center the role of the commander's judgment ("genius" in Clausewitz, "skilled general" in Sun Tzu); both know that war is fundamentally psychological as much as material.

**Divergences**:
| | Sun Tzu | Clausewitz |
|---|---|---|
| Approach | Indirect; psychological dislocation | Direct; destruction of enemy force |
| Body or mind? | Mind, will to fight | Material means and casualties |
| Deception/intel | Foundational, central | Auxiliary; primary is direct combat |
| Symmetry assumption | Asymmetric — exploit asymmetry | Symmetric — meet strength with strength |
| Clarity vs friction | Clarity through preparation pre-war | Friction is irreducible during war |

**Maps to us**: Sun Tzu is our doctrine more than Clausewitz is. We are a small team competing in a complex space against larger players. Symmetric attrition (Clausewitz) is suicide. Asymmetric, indirect, intelligence-rich, dislocate-before-confronting (Sun Tzu) is the only viable game.

Specific bridges:
- "Know yourself and know your enemy" → our Effi canon of *our own team's data* is exactly self-knowledge. The Effi-session-audit skill is enemy-knowledge (knowing our users' actual experience).
- "Strike where the enemy is unprepared" → the indirect-approach product strategy.
- "Victory is shaped before battle" → our spec / test-architecture / tdd-impl-plan discipline. The work that wins is done before the keystrokes, not during.

### Bridge 6 — The 10 Principles of War (UK list; US has 9, IDF has its own)

UK list, with mapping to product / engineering / agent-management:

| Principle | Doctrinal meaning | Bridge to dev/agent practice |
|---|---|---|
| **Selection and Maintenance of the Aim** | Pick one objective, keep it through the noise | Single-aim per session/charter; explicit aim at top of every spec; companion skill catches drift |
| **Maintenance of Morale** | Sustain the will to fight | Sustainable pace; celebrate landed slices; honest retros; don't ship blame culture (tikur is blameless) |
| **Offensive Spirit / Action** | Seize and hold initiative | Ship to main aggressively (z075 area); push not just commit; default to act, not ask (CLAUDE.md "start directly") |
| **Surprise** | Strike where unexpected | Indirect approach in product; release strategy that gets ahead of the conversation |
| **Security** | Protect own forces, deny enemy intel | Security review skill; secrets management; RLS by default; defense-in-depth (handled by Lihu's docs/security/) |
| **Concentration of Force** | Decisive mass at the decisive point | One slice end-to-end before fanning out; decisive-Gin discipline (principle 6 above) |
| **Economy of Effort** | Deliberately under-resource the secondary | Don't fan out evenly; the rnd skill explicitly names the decisive angle |
| **Flexibility** | Adapt plan to changing situation | Vertical slicing; walking skeleton; toggles; rebase-friendly history |
| **Cooperation** | Forces work as one | Liaison/cell/teamwork patterns; companion-watched sessions; shared zettel corpus |
| **Sustainability** | Logistics, replenishment, endurance | Devcontainer reproducibility; "fixes must persist" CLAUDE.md rule; autosync; bus-factor on skills |

**Note on usage**: the principles are not a checklist. They are a *vocabulary* for diagnosing why a thing failed. "We violated economy of effort" is a more precise post-mortem than "we tried to do too much." The IDF prof handles morale and offensive spirit in their own register; this list shows the cross-doctrine convergence.

### Bridge 7 — Operational Art (the bridge between strategy and tactics)

**Canonical claim**: Soviet thinkers (Triandafillov, Tukhachevsky) named it in the 1920s-30s; entered US/UK doctrine in 1980-81. Operational art is "the pursuit of strategic objectives through the arrangement of tactical actions in time, space, and purpose." It is the deliberate composition of tactical wins into strategic effect. The four elements: **time, space, means, purpose**.

**Why most dev teams fail here**: they have a vision (strategy) and a sprint board (tactics) and *nothing in between*. The tactical work is real but it doesn't compose into strategic progress because there's no operational doctrine telling it how. This is exactly the layer where most teams lose.

**What operational art looks like in agent-augmented dev**:
- **Vertical slicing** — a slice is an operational unit: it composes tactical work (Red, Green, Refactor) into strategic progress (a deployable end-to-end thin path).
- **Walking skeleton** — operational pattern: thin spine first, flesh later. Maps perfectly to the Soviet "deep operations" idea of penetrate-then-exploit.
- **Skill library** — the accumulating set of skills (`tdd-execute`, `liaison`, `build-orchestrate`, `companion`, `tikur`, `rnd`) IS our operational doctrine. Each skill is a repeatable operational pattern that converts tactics into strategic effect. **The library is the doctrine.**
- **Two-tier review discipline** (memory: `feedback_two_tier_discipline`) — operational rule about which tactical actions get the full review treatment vs the light one. This is exactly an operational-art call: how to allocate the scarce resource (review attention) across tactical work for strategic effect.
- **The rnd skill (z076)** — codified after 3rd instance, which is the operational-art rule: when a pattern repeats, it becomes doctrine.

**Operational consequence for us**: treat the skill+lab library as our operational doctrine. Tend it. The lab files (per `feedback_phase_separation`, `feedback_companion_every_transition`, etc.) are doctrinal updates the way FM 5-0 is doctrinal. They're not just notes.

---

## COMMON PITFALLS — Adopting military hierarchy in civilian / agent-management orgs

Lihu explicitly asked for this. It is the most-load-bearing section of the deliverable because misapplied military doctrine in civilian orgs is *worse* than no doctrine. Five pitfall families, each with the failure mode, the symptom, and the countermeasure for our specific context.

### Pitfall 1 — Authority without accountability (cosplay rank)

**Failure mode**: civilian org adopts military titles, hierarchies, or rituals (chief-of-staff, war room, commander's intent) without the accountability structure that makes them work in the military. In real military: rank carries lawful authority *and* lawful liability — you can be relieved, court-martialed, demoted. In civilian: rank is mostly upside, accountability is diffuse, "the buck stops here" is rhetorical.

**Symptom**: someone gets to issue orders; nobody actually owns failure. The "commander" makes a bad call; the team takes the hit; the commander pivots and re-narrates. (Common in agile-with-military-flavor cargo cults.)

**For us**: doesn't fully apply (we're 2 humans and a horde of Gins, no rank to cosplay). But the agent-shaped version: a sub-Gin issues a confident-sounding plan; if it's wrong, there's no consequence to the sub-Gin, just to the next session. **Countermeasure**: tikur applies to agent failures too. The tikur output is committed code/skill/doctrine — that's how accountability lands in our setup.

### Pitfall 2 — Ritual without meaning (ceremony as substitute for action)

**Failure mode**: the form of a military practice gets adopted; the *function* doesn't. Daily standups become status-recital ceremonies because the underlying O&I purpose (build shared consciousness, surface friction across teams) was never internalized. Retros become checkbox events.

**Symptom**: the practice happens on schedule; outcomes don't change; nobody can name what the practice produced last quarter; people privately resent the time.

**For us**: high risk in our setup. We have a tikur skill, a session-retro skill, a /end ritual, a companion skill, a his-self-rating skill. Each is a ceremony. Each is *only* useful if the output lands in the substrate (zettel, code, skill update). The pre-commit hook on `/end` (memory: `feedback_companion_every_transition`) is exactly an anti-ritual-without-meaning enforcement: physically block stop until the rating lands.

**Countermeasure**: every ritual must have an *artifact* it produces. If `/end` produces only a self-rating with no zettel-or-code change, it's drifting toward ceremony. Audit: when did this ritual last cause us to change something?

### Pitfall 3 — Jargon as insider-marker (vocabulary as gatekeeping)

**Failure mode**: military vocabulary (OODA, COA, kinetic, force-multiplier, asymmetric, OPORD) gets adopted because it sounds rigorous. It excludes anyone who hasn't memorized the lexicon and produces in-group/out-group dynamics. The substance is not improved; the access is restricted.

**Symptom**: meetings where junior members can't follow because of the acronym density; outsiders read the docs and bounce; the jargon becomes a shibboleth, not a tool.

**For us**: real risk in this very R&D track. We use Hebrew acronyms (PO"SH, TO"L), Prussian (Auftragstaktik), German-flavored corporate (Cynefin), and military English (OODA, MDMP, COA). **All of it is fine if it has cash-value as concept; all of it is harmful if it becomes a marker.**

**Countermeasure (this is a rule, not a guideline)**: every doctrinal term we adopt gets a one-line plain-English gloss in the zettel that introduces it, and it earns its keep by being *used* to make decisions, not just to reference. The wispr corrector dictionary (z078) is doing the right thing — names get stable, not mystified. If we catch ourselves saying "OODA" without anyone improving an Orient step that turn, we're in pitfall-3 territory.

### Pitfall 4 — Command climate that suppresses dissent

**Failure mode**: the "commander speaks, subordinates execute" image of military command is the *worst* version of military command. Real high-functioning military command is built on the discipline of dissent — the staff is *expected* to push back during planning (wargaming, COA comparison), the airline-cockpit Crew Resource Management literature came from military aviation specifically because the silent-junior-officer pattern killed people. Civilian orgs that adopt the *image* of military command often build the silent-junior-officer pattern by accident.

**Symptom**: nobody challenges the leader's plan in the room; problems surface after the fact; "we were all thinking it but nobody said it"; reviews come back with no real friction.

**For us**: our agent setup is structurally vulnerable to this. Sub-Gins are sycophantic by training; reviewers under-push; main-thread overrules without engaging. The `feedback_dont_jump_to_conclusions`, `feedback_hold_against_discipline`, `feedback_red_reviews`, `feedback_multi_reviewer_convergence`, `feedback_liaison_fix_everything` — all of them are countermeasures Lihu has accumulated against this specific pitfall.

**Countermeasure**: dissent is structural, not personal. The companion skill, independent reviewers, multi-reviewer convergence as a signal, "fix every suggestion" — these are command-climate engineering. We should explicitly name "challenge this plan" as part of charters. A reviewer charter that doesn't explicitly invite dissent will produce silent reviews. The IAF tikkur tradition is the *gold standard* of this — blameless, fact-first, no rank in the room. We adopt that posture into agent reviews by default.

### Pitfall 5 — Reductionist planning in a complex domain (Taylor in McChrystal-land)

**Failure mode**: military planning evolved in environments with stable adversaries, identifiable centers of gravity, and bounded operations. Modern civilian + agent-management work is closer to McChrystal's complex-domain world: emergent, interdependent, surprise-rich. Importing the *planning-heavy* parts of military doctrine (full MDMP, exhaustive COA wargaming, OPORD-style detail) into a complex domain produces brittle plans that the environment shreds, then a doubling-down on more planning.

**Symptom**: ever-more-elaborate plans; more time planning than executing; the plan is never wrong because reality is blamed; "we just need to plan better next time".

**For us**: real and present. The temptation under "unlimited resources" (z027) is to plan every angle, decompose every charter, wargame every approach. McChrystal would say: the work isn't *complicated* (which yields to planning), it's *complex* (which yields to interaction + transparency + fast Orient updates). The countermeasure is *less planning, more substrate*. Build the corpus, set the intent, let interaction produce the answer.

**Countermeasure**: when planning starts producing diminishing returns (3rd round of decomposition, 5th round of refinement), that's signal we're in complex-domain territory and over-planning. Switch modes: ship a thin slice, observe what happens, adjust. The walking-skeleton/vertical-slice discipline is *the* operational countermeasure to this pitfall. The `divergent-before-convergent` skill is sized to recognize when divergence is producing options worth converging on vs when it's producing infinite options because the domain is complex.

### A 6th, less-discussed pitfall — Importing the wrong half of the analogy

**Failure mode**: civilian organizations import military doctrine selectively. They take the parts that flatter the leader (commander's intent, decisive action, moral authority) and skip the parts that constrain the leader (mandatory blameless after-action review, formal staff dissent, limits on lawful orders, civilian oversight). The half-import is *worse* than no import: it gives the leader the rhetoric of military command without any of the military's institutional brakes on bad command.

**For us**: the version we have to watch for: importing "spawn many agents under unified intent" without importing "blameless tikur with mandatory fix" and "dissent built into review" and "decisive concentration not fan-out." We don't import the brakes, we get authoritarian-flavored chaos. We *do* import the brakes — that's what the entire feedback-zettel cluster is about — and we should be explicit that this is non-negotiable when we systematize the rnd / build-orchestrate / liaison patterns.

---

## BOTTOM — Sources

### Primary doctrinal texts referenced
- John Boyd, *Patterns of Conflict* (briefing slides, 1976-1995). Discussed below via Chet Richards's authoritative analysis.
- B.H. Liddell Hart, *Strategy* (1954, 2nd revised ed.; the Indirect Approach + Eight Maxims, Ch. XX).
- Stanley McChrystal, Tantum Collins, David Silverman, Chris Fussell, *Team of Teams: New Rules of Engagement for a Complex World* (2015).
- Sun Tzu, *The Art of War* (~5th c. BCE).
- Carl von Clausewitz, *On War* (1832, posth.) — referenced for convergences only; primary handling by the Clausewitz professor.
- US Army FM 5-0 / ADP 5-0, *The Operations Process* (2005, 2012, 2019).
- US Army FM 6-22, *Developing Leaders*.

### Web sources consulted this turn
- [John Boyd and The OODA Loop — Psych Safety](https://psychsafety.com/john-boyd-and-the-ooda-loop/)
- [Boyd's OODA Loop (It's Not What You Think) — Chet Richards](https://slightlyeastofnew.com/wp-content/uploads/2018/05/boyds-real-ooda-loopx.pdf)
- [Chet Richards — peer-reviewed article on Boyd's OODA Loop](https://ooda.de/media/chet_richards_-_boyds_ooda_loop.pdf)
- [Coming Full Circle with Boyd's OODA Loop Ideas](https://teamonenetwork.com/wp-content/uploads/2019/03/COMING-FULL-CIRCLE-WITH-BOYD%E2%80%99S-OODA-LOOP-IDEAS.pdf)
- [John Boyd on Patterns of Conflict and the OODA Loop — OODAloop](https://oodaloop.com/analysis/decision-intelligence/john-boyd-on-patterns-of-conflict-and-the-ooda-loop/)
- [Team of Teams book notes — Graham Mann](https://grahammann.net/book-notes/team-of-teams-general-stanley-mcchrystal)
- [Team of Teams — McChrystal Group](https://www.mcchrystalgroup.com/insights/detail/2025/07/08/from-detractor-to-advocate--a-leadership-journey-through-team-of-teams)
- [Stanley McChrystal: Adapt to Win in the 21st Century — Stanford GSB](https://www.gsb.stanford.edu/insights/gen-stanley-mcchrystal-adapt-win-21st-century)
- [Lessons from the Battlefield Part 2: Shared Consciousness — Rhumbix](https://www.rhumbix.com/blog/lessons-from-the-battlefield-part-2-shared-consciousness)
- [McChrystal: Focus on Empowering Frontline Decision-Makers — ASIS](https://www.asisonline.org/security-management-magazine/articles/2020/gsx-show-daily-2020/McChrystal-focus-on-Empowering-Frontline-Decision-Makers/)
- [Team of Teams summary — Next Level Coaching](https://www.nextlevel.coach/blog/team-of-teams-book-summary)
- [Team of Teams summary — Admired Leadership](https://admiredleadership.com/book-summaries/team-of-teams/)
- [Indirect Approach — Wikipedia](https://en.wikipedia.org/wiki/Indirect_approach)
- [Liddell Hart, Strategy (1954) — Classics of Strategy and Diplomacy](https://classicsofstrategy.com/2016/01/19/liddell-hart-strategy-1954/)
- [Eight Maxims of Strategy from Sir Basil H. Liddell-Hart — Fred Nickols](https://www.nickols.us/strategy_maxims.htm)
- [Fred Nickols — Eight Maxims (PDF)](https://www.nickols.us/maxims.pdf)
- [Liddell Hart's 8 Maxims of Strategy — Flevy](https://flevy.com/blog/liddell-harts-8-maxims-of-strategy/)
- [Liddell Hart and the Indirect Approach — ithron.co](https://www.ithron.co/post/liddell-hart-and-the-indirect-approach-why-the-best-competitive-moves-avoid-direct-confrontation)
- [MDMP — Wikipedia](https://en.wikipedia.org/wiki/Military_Decision_Making_Process)
- [About the Military Decision-Making Process (MDMP) — Lightning Press SMARTbooks](https://www.thelightningpress.com/about-the-military-decisionmaking-process-mdmp/)
- [The Military Decision-Making Process: Time for a Change — DTIC monograph](https://apps.dtic.mil/sti/pdfs/ADA381816.pdf)
- [It's Time to Update the MDMP — From the Green Notebook](https://fromthegreennotebook.com/2020/10/12/its-time-to-update-the-military-decision-making-process/)
- [Principles of War — Wikipedia](https://en.wikipedia.org/wiki/Principles_of_war)
- [Ten Principles of War — incommand.co.uk](https://www.incommand.co.uk/ten-principles-of-war)
- [No More Principles of War? — USAWC Press](https://press.armywarcollege.edu/cgi/viewcontent.cgi?article=1863&context=parameters)
- [Principles of War and Air Power — RAAF](https://airpower.airforce.gov.au/sites/default/files/2021-03/WP31-Principles-of-War-and-Air-Power.pdf)
- [Operational Level of War — Wikipedia](https://en.wikipedia.org/wiki/Operational_level_of_war)
- [Strategy and the Intervening Concept of Operational Art — Military Strategy Magazine](https://www.militarystrategymagazine.com/article/strategy-and-the-intervening-concept-of-operational-art/)
- [Operational Art Links Strategy, Tactics — AUSA](https://ausa.org/articles/operational-art-links-strategy-tactics)
- [War Has Changed — Modern War Institute](https://mwi.westpoint.edu/war-has-changed-and-the-armys-conceptualization-of-operational-art-must-follow-suit/)
- [What Is Operational Art? — DTIC monograph by Maj. Walter E. Piatt](https://apps.dtic.mil/sti/tr/pdf/ADA370243.pdf)
- [Clausewitz and Sun Tzu — Militaire Spectator](https://militairespectator.nl/artikelen/clausewitz-and-sun-tzu)
- [Clausewitz and Sun Tzu: Paradigms of Warfare in the 21st Century — The Peninsula Foundation](https://thepeninsula.org.in/blog/clausewitz-and-sun-tzu-paradigms-of-warfare-in-the-21st-century)
- [Sun Tzu and Clausewitz: The Art of War and On War Compared — DTIC](https://apps.dtic.mil/sti/citations/ADA239084)
- [On the Art of War: A Contrast of Clausewitz and Sun Tzu — DTIC](https://apps.dtic.mil/sti/tr/pdf/ADA208137.pdf)
- [Empowering Leadership in the Military: Pros and Cons — MDPI](https://www.mdpi.com/2673-8104/4/4/26)
- [Is the "Chain of Command" Still Meaningful? — US Army War College War Room](https://warroom.armywarcollege.edu/articles/chain-of-command/)
- [Breaking Ranks: Dissent and the Military Professional — US Army](https://www.army.mil/article/47175/breaking_ranks_dissent_and_the_military_professional)
- [Beyond Huntington: US Military Professionalism Today — USAWC Parameters](https://press.armywarcollege.edu/cgi/viewcontent.cgi?article=3036&context=parameters)
- [FM 6-22, Developing Leaders — fas.org IRP archive](https://irp.fas.org/doddir/army/fm6-22.pdf)

### Internal cross-references
- `usegin/zettel/principles/01-04` — the four UseGin principles
- `usegin/zettel/zettels/z023` — spawn-as-instantiation (charter is the instantiation)
- `usegin/zettel/zettels/z027` — unlimited resources: how Gin CAN, not how Gin SHOULD
- `usegin/zettel/zettels/z075` — war-management R&D track origin
- `usegin/zettel/zettels/z076` — R&D as recurring pattern → rnd skill (3rd instance)
- `usegin/zettel/zettels/z077` — UserPromptSubmit hook for skill→lab existence check
- `usegin/zettel/zettels/z078` — wispr corrector dictionary additions for this domain
- Memory cluster on review discipline: `feedback_two_tier_discipline`, `feedback_red_reviews`, `feedback_phase_separation`, `feedback_multi_reviewer_convergence`, `feedback_companion_every_transition`, `feedback_liaison_fix_everything`
- `.claude/skills/tikur/SKILL.md` — the IAF-tradition blameless post-mortem; doctrinal home of pitfall-2 and pitfall-4 countermeasures
- `.claude/skills/companion/SKILL.md` — the Orient-corrector running alongside Act
- `.claude/skills/build-orchestrate/SKILL.md` and `.claude/skills/liaison/SKILL.md` — operational-art artifacts (per Bridge 7)
