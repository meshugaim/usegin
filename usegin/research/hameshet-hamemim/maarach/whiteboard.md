# Ma'arach (מערך) — what the IDF means by "formation/array" and what UseGin should adopt

**Professor:** ma'arach — fourth M of *חמשת המ"מים* (the five Ms of pre-action planning).
**Charter parent:** `usegin/research/hameshet-hamemim/README.md`.
**Sister whiteboards in this round:** `mishima/whiteboard.md` (authored), `matara/whiteboard.md` (authored), `ma'amatz/`, `mo'ed/` (open-to-empty).
**Doctrinal nearest siblings:** `usegin/research/war-management/idf-tol/whiteboard.md`, `usegin/research/war-management/mission-command/whiteboard.md`, the existing `usegin/teams/` library (the lived practice this whiteboard scores against).

---

## TOP — distilled IDF *ma'arach* doctrine (≤500 words)

*Ma'arach* (lit. "array" / "formation" / "the structure of forces in their assigned positions") is the fourth M of *חמשת המ"מים*. Three terms triangulate it; the click is in the contrast.

**The triad — *ma'arach* vs. *seder kochot* vs. *tamrun*.**

- **סדר כוחות** (*seder kochot* — order-of-battle / force-composition): the *list* of units available — "1 ugda, 3 chativot, 2 gdudei tankim." A static inventory, mission-blind. The English "order of battle" / "task organization" line in a 5-paragraph order maps here.
- **מערך** (*ma'arach* — formation/array): the *positioning* of those units **for this mission** — who is the *me'ametz ha-rashi* (main effort), who screens, who reserves, who supports, what the seams between them are, who reports to whom. *Ma'arach* is *seder kochot* turned through the mission's purpose — composition × posture × command relationships, evaluated against the *mishima* and the *matara*. (US doctrinal cousin: the Execution paragraph's "Task Organization + Scheme of Maneuver" pair.)
- **תמרון** (*tamrun* — maneuver): the *movement* of the *ma'arach* over time. Maneuver presupposes formation; you can't maneuver what you haven't first arrayed.

So: *seder kochot* = what we have. *Ma'arach* = how it's standing right now, for this mission. *Tamrun* = how it moves from there. A common IDF after-action error is collapsing the three — declaring a *ma'arach* problem when the issue is actually *seder kochot* (we lacked the unit), or labeling a *tamrun* failure as a *ma'arach* failure (the formation was right, the movement was wrong).

**What makes a *ma'arach* well-suited.** Doctrinally three tests: (1) **Schwerpunkt-honoring** — the *me'amatz* (main effort, third M) gets the heaviest formation weight; auxiliary efforts get visibly lighter forces. A *ma'arach* that arrays equal weight everywhere has no main effort. (2) **Seam-aware** — the boundaries between sub-formations are explicitly named, with command authority for each seam (who owns the wadi between Brigade A and Brigade B). 2006 Lebanon's repeated failure was unowned seams. (3) **Coupling fits the mission** — independent missions get independent formations (parallel); sequenced missions get nested formations (one feeds the next); contested missions get debate/reserve formations.

**What formation-mistakes look like in IDF after-action literature.**

- **Ad-hoc task force, no doctrinal home** (*כוח משימה*). 2006 Lebanon: ground forces assembled ad-hoc, the Northern Command coordinated only the ground combat, ill-prepared reserves. Symptom of treating *ma'arach* as a runtime improvisation rather than a pre-action design. (Kober; INSS *IDF Strategy*.)
- **Konseptsia formation.** 1973: forces arrayed against the *expected* enemy posture, not the actual one — the formation was internally coherent but mission-mismatched.
- **Compound formation hiding compound mission.** A single formation tasked with two missions — analogous to multi-verb *mishima*; degrades to neither under fog.
- **Formation without seam ownership.** Two adjacent units, no named owner for the gap between them. Hizballah exploited this in 2006.
- **Formation copied from a different mission.** Reusing yesterday's *ma'arach* because it worked yesterday — the *seder kochot* is the same, but the mission isn't.

**The pre-action review test.** A well-formed combat order names the *ma'arach* explicitly: *who* (named units), *where* (positions/sectors), *what role* (main effort / supporting / screening / reserve / liaison), *what seams* (named boundaries with named owners). If a reader can't draw the formation diagram from the order, the *ma'arach* paragraph failed.

(Sources: see Bottom.)

---

## MIDDLE — inventory of UseGin's current formations

UseGin already has a strong, *named* formations library (`usegin/teams/`). Twelve teams are codified. This is unusual — most agent frameworks ship anonymous, ad-hoc compositions. We are not implicit on *ma'arach*; we are **explicit but uneven**. The unevenness is what the doctrine surfaces.

### The twelve formations, scored against the IDF *ma'arach* tests

| # | Formation | Spawner shape | Sub-Gin role(s) | Coordination pattern | Mission-fit (when it fits) | Anti-fit (when it mismatches) |
|---|---|---|---|---|---|---|
| 1 | `rnd-team` | Mark (orchestrator) decomposes; spawns batch | Poll × N (one per angle) + Sam (synthesizer) | Parallel-independent + cross-cut synthesis, commit-as-it-lands | Multi-angle "what can we learn" with ≥3 genuinely independent angles | Single-angle question (use Explore); shipping work (use cell+liaison) |
| 2 | `brainstorm-team` | Mark, one batched response | Poll, Din, Johan, John, Cal (5 distinct primings) | Parallel-independent, no peer-reading, mechanical merge | Volume-of-ideas, convergence is premature | Decision-needed-now (use prioritize); single-priming pool |
| 3 | `refine-team` | Mark assigns slice ownership | Sam (dedup), Mark (context), Ron (conflicts) — slice-owners | Parallel-edit-in-place, each reads whole pool but edits own slice | 15–40-idea pool that's noisy/contradictory | <15 ideas (solo refiner); ≥40 (split team) |
| 4 | `prioritize-team` | Mark, one batched response | Mark (pragmatic), Johan (strategist), John (risk), Sam (evidence) ± Cal | Parallel-independent rank → Borda + convergence-buckets | Refined pool needing decision support | Solo ranking ("I can rank these"); mono-priming |
| 5 | `cell-team` | Mark (sequential director) | Wes × N (sequential workers) + Ron (per-step reviewer) ± Tim (verifier), Yohai (watcher) | Spawner-led, sequential, per-step review | Multi-step single-track implementation | Multi-track build (use teamwork); pure exploration (use rnd) |
| 6 | `red-blue-purple` | Sequential or parallel-then-debate | John/Cal (red), Johan (blue), Sam (purple synthesis) | Adversarial-then-synthesis | High-stakes spec/PR adversarial review | Low-stakes single-pass review |
| 7 | `pre-mortem-team` | Mark, parallel imagination | Cal (direction-fail) + John × 2-3 (mode-fail) + Sam (synthesis) | Parallel-imagination + synthesis, no peer-reading | Pre-commitment risk surface for multi-week build | Post-incident analysis (use tikur) |
| 8 | `debate-team` | Mark moderates rounds | Johan (advocate), John (skeptic), Cal (orthogonal), ± Poll (evidence) | Dialogic — N rounds revise-after-reading, capped at 3 | Direction-level decisions with stable conflicting views | Idea generation (use brainstorm); >3 rounds |
| 9 | `andon-team` | Mark routes when halted | Wes (worker) + Yohai (watcher with halt-permission) | Live observer, halt-permission, fix-or-pause-or-acknowledge | Long autonomous runs, drift risk | Short single-shot tasks |
| 10 | `tikur-team` | Mark moderates blameless room | Ivan (facts), Cal (root-cause), John (next-modes), Sam (verdict) | Sequential-with-Q&A, fact-first | Post-incident systemic root-cause | Live incident (use cell+andon); pure error-no-recurrence-risk |
| 11 | `consult-team` | Mark spawns or resumes | Consultant (single voice — persistent or one-shot) | Single-voice, depth-not-breadth | Second opinion, fresh-eyes, lateral perspective | Want N perspectives (use brainstorm/debate) |
| 12 | `six-hats-team` | Mark (Blue) opens and closes | Ivan (White), Johan (Red+Yellow), John (Black), Din (Green), Mark (Blue) | Sequential, single-framing-at-a-time | Multi-axis decision, no clear ranking | Status: open-to-empty — never run yet |

### Three formations not yet in `usegin/teams/` (skill-internal, anonymous)

| Formation | Where | Spawner / sub-Gin shape | Why it's not yet a team file |
|---|---|---|---|
| `tdd-execute` trio | `.claude/skills/tdd-execute/` | Director (Opus) + Haiku RedTweaker + Haiku GreenTweaker + Opus DisciplineReviewer; phase-gated by hook | Domain-specific (TDD-only), tightly coupled to phase-state machine + skill-scoped hook. Generalizing risks losing the load-bearing hook. |
| `liaison` formation | `.claude/skills/liaison/` | Liaison (main thread, never executes) + Opus sub-agents (do all work) + Companion (accountability) | Stance-shaped (not composition-shaped) — "main thread is liaison" is a *role* claim, not a fixed cast. |
| `build-orchestrate` phases | `.claude/skills/build-orchestrate/` | Director + per-phase sub-orchestrators (research → design → spec → implement → QA), each invoking other teams | Meta-formation — it *composes* the formations above by phase, doesn't have its own cast. |

### Convergence patterns (the *ma'arach* signature across the inventory)

1. **Mark is the universal orchestrator.** 11 of 12 formations have Mark as spawner/moderator. The orchestrator role is heavily centralized — *seder kochot* says we have many spawners, *ma'arach* says we keep deploying one. Worth naming: this is a deliberate convergence (consistency tax for new formations is low), not an oversight.
2. **Sam is the universal synthesizer.** 6 of 12 formations end with Sam doing cross-cut/synthesis (rnd, refine, red-blue-purple, pre-mortem, tikur, debate-via-Mark). Synthesis is the second-most-stable role.
3. **Coordination patterns cluster into 4 buckets.** *Parallel-independent* (brainstorm, prioritize, pre-mortem, rnd-Polls), *Parallel-edit-in-place* (refine), *Sequential-with-review* (cell, tikur, red-blue-purple Pattern A), *Dialogic* (debate, six-hats). Every formation in the library is one of these four shapes plus optional observer (andon).
4. **Schwerpunkt-honoring is mostly explicit.** rnd's "main effort = the cross-cut", cell's "main effort = the per-step worker, Ron is supporting", red-blue-purple's "purple is the integrator" — main efforts are named, not implicit. *This is doctrinally strong.*
5. **Seam-ownership is mostly explicit.** Every team file's "Common failure modes" section names seam failures: "ideators reading peer files" (brainstorm), "refiners editing other slices" (refine), "spawner stops verifying mid-loop" (cell), "Mark voting in the verdict" (debate). Seams are named at the failure-mode level — doctrinally clean.

### Three real gaps the doctrine surfaces

1. **No charter slot for "which *ma'arach* is this?"** Spawners pick a formation by reading skill triggers ("brainstorm X" → brainstorm-team). But the *charter itself* — the artifact §4 in `.claude/skills/charter/SKILL.md` — has no slot for "the formation chosen for this mission and why." So when a future Gin reads a past spawn's charter, they can't reconstruct *why this formation*. The doctrinal answer ("ma'arach is mission-shaped") implies this should be visible.
2. **`build-orchestrate` is doing *operational art* without naming it.** It composes formations across phases (rnd → debate → spec → cell → red-blue-purple) — that *is* operational art (the level above tactical *ma'arach*). But its own SKILL.md treats this as "phase management," not as "the formation-of-formations problem." The doctrine says: at the operational level, the *ma'arach* isn't the team — it's the *sequence of teams* and the seams between them.
3. **No formation-mismatch tikur lekach.** We have 12 named formations and clear "when to use" guidance per team, but no recorded incident where we picked the *wrong* formation and the post-mortem named *that* as the root cause. Either we pick correctly (possible — the named library is a strong filter), or we mis-pick and tikur the *content* failure instead of the *formation* failure (likelier, per the IDF cluster pattern). This is the next data we'd want.

---

## BOTTOM — proposal

**Headline finding: `usegin/teams/` is already the strongest piece of UseGin's *ma'arach* practice.** It is doctrinally clean on three of the four tests (Schwerpunkt-honoring, seam-ownership, coordination-pattern variety). Most agent frameworks ship implicit formations; we ship a named library with stable casts and per-formation failure modes. The team library is *the right shape* — extending it is the right move; replacing it is wrong.

The gap surfaced is **not in the team files**. The team files name the formation; what's missing is **a charter-level pointer to which formation this spawn is using, and why**.

### Recommendation: charter-block (b) — add a "Ma'arach" line to the canonical charter shape. **Do not** open `usegin/teams/maarach-team.md` (that would be a category error — *ma'arach* is the meta-property of a formation, not itself a formation). **Do not** rename `usegin/teams/` (the current convention is load-bearing).

#### Edit (proposed — to `.claude/skills/charter/SKILL.md`)

Add a new block §3.5 "Formation" (between End State and Doctrinal pointers), one line, mandatory for any spawn that instantiates more than one sub-Gin. Single-spawn charters (a single Explore, a single Consultant) skip it.

Proposed verbatim text:

> **§3.5 — Formation (*ma'arach*).** When the spawn instantiates >1 sub-Gin, name the formation chosen and one line of why it fits this mission. Reference the team file (`usegin/teams/<name>.md`) when one applies; if no team file fits, name the ad-hoc shape ("parallel-independent", "sequential-with-review", "dialogic-2-rounds") and flag the gap (this may be a candidate new team — z015 / pre-game-manual). The *ma'arach* is mission-shaped; recording it makes mismatch visible to future Gins reading the spawn record.
>
> Example: *"Formation — `rnd-team` (parallel-independent + cross-cut). Fits because the question has 4 genuinely independent angles and the deliverable is a synthesis ranking patterns, not a single answer."*

#### Why charter-block, not new team file

- *Ma'arach* is a *property* of a mission/formation pairing, not a formation itself. A `maarach-team` would be a category error — like writing a `mishima-team`.
- The existing `usegin/teams/` library is the formations library. It's well-named (each team's *what it does*, not *who's in it*) and the README is doctrinally clean.
- The missing piece is the *runtime declaration* — at spawn time, the orchestrator picks a formation; that pick should be in the charter, visible to the sub-Gin and to future readers.
- This is a 1-line addition. Per *be laconic* (z032), the cheapest intervention that closes the gap is the right one.

#### Why not extend `usegin/teams/`

The team library is already extensive (12 teams) and the README's "new teams earn their place by being instantiated by hand at least once first" rule (z015) is correct discipline. Adding teams speculatively would dilute the convention. The proposal goes the other way: make existing-team-selection visible at the charter level, so when a *new* shape is needed (no existing team fits), the charter's `Formation` line surfaces it ("ad-hoc shape — flag for team-library candidate").

#### Coordination (per charter §6)

This proposal touches `.claude/skills/charter/SKILL.md` — production-tree edit territory per the charter envelope. **I am proposing only**, not editing. Lihu/Sam decide.

I am also claiming the team library is the load-bearing piece of UseGin's *ma'arach* practice. That claim is non-trivial — it implies the next round of formation work belongs in the charter skill and the spawning skills, not in new team files. Worth pushback if Sam or another professor reads the inventory differently.

#### What I am NOT proposing

- A `maarach-team` file (category error, see above).
- A rename of `usegin/teams/` to `usegin/maarach/` (the English "teams" works; renaming is churn for Hebrew-purity, low value).
- Removing any existing team (per charter §6 — Sam-level call only).
- A "formation-mismatch tikur" lekach (no incident on file yet — premature codification, z015).

### Operational-art note (deferred)

The `build-orchestrate` skill is doing *operational art* — composing formations across phases — without the doctrinal vocabulary. The IDF distinction is *taktika* (tactical *ma'arach* = one team for one mission) vs. *omanut ha-mivtsa* (operational art = sequence of formations across a campaign). This is a worthwhile second iteration: rename `build-orchestrate`'s phases section to make formation-per-phase explicit ("phase 1: rnd-team for research; phase 2: debate-team for direction; phase 3: cell-team for build; seam = phase-1 synthesis feeds phase-2 proposition"). I'm flagging it, not proposing it — it's a separate edit that wants its own round.

---

## FRICTION

What got in the way of this whiteboard:

1. **English-language IDF doctrine on *ma'arach* specifically is thin.** *Mishima* (mission) and *aharai* (lead) are well-covered in Shamir, Kober, the CALL/FM doctrine. *Ma'arach* shows up as a *background* term in 2006 Lebanon analyses (Kober, INSS, INSS *IDF Strategy* PDF) but rarely as a primary subject. The triad I distilled (*ma'arach* / *seder kochot* / *tamrun*) is reconstructed from how the term is used contrastively in those secondary sources, plus the US doctrinal cousin (Task Organization + Scheme of Maneuver in the 5-paragraph order). **Confidence is high on the triad and the three formation-mismatch patterns; medium on whether the IDF formally codifies a "formation diagram readability" pre-action review test or whether that's projection.** A Hebrew-reading professor with `Maarachot` (the IDF professional journal — note the same root) access would tighten this.
2. **The hameshet-hamemim README's hypothesis was already half-resolved in our practice.** It says "we are *implicit* on 4 (team shapes exist but per-skill, no canonical pattern)." But `usegin/teams/` exists, dated 2026-04-27 (today's date) with twelve files. So the hypothesis is *stale at the moment I'm reading it* — the canonical pattern *did* land. I almost charged ahead writing the proposal as if the README were live; caught it on second read. **Lekach: when a parent README's hypothesis predates the substrate it predicts about, verify the substrate before honoring the hypothesis.** (Memory: `feedback_dont_jump_to_conclusions`.)
3. **The Selbständigkeit clause did real work.** The literal §2 said "propose (a) a teams library; OR (b) a charter block; OR (c) both." The library already exists at strength, so option (a) is not "propose" but "endorse + extend by 1 line in a different file." That's a deviation from the literal three-options framing — the option I picked is closest to (b) but with an explicit "do not extend (a)" rationale, which the menu didn't anticipate. Per the Selbständigkeit obligation I took the better-fit shape and named it.
4. **One recursive amusement (the round itself is a *ma'arach*).** *Hameshet hamemim*'s R&D round is itself an `rnd-team` formation: 5 Polls (one per M) + Sam (synthesis after the five land). The README says so explicitly: "Five professors, one per M. Sam cross-cuts in `SYNTHESIS.md` after the five land." So this whiteboard is the output of one Poll inside an rnd formation, *writing about the formations library*. The fresh-Haiku check survived only because the README spelled out the round's own *ma'arach* — itself a small piece of evidence for the proposal (recording the formation makes it legible).
5. **Empirical gap I didn't close.** I scored the inventory on doctrinal tests but didn't pull session data from `~/agent-records/` to check *which formations are most-used vs. least-used* or *which spawns named their formation in the charter vs. omitted*. That's the equivalent of mishima/whiteboard.md's friction #2 — the empirical resolution path. Worth a follow-up Poll: "audit 30 recent spawns; how many named their formation; did any tikur trace failure to formation choice."

---

## Bottom — sources

### English-language doctrine (load-bearing for the *ma'arach* shape)

- Kober, Avi — *The IDF in the Second Lebanon War: Why the Poor Performance?* — *Journal of Strategic Studies* — formation-mismatch + ad-hoc task force pattern. tandfonline.com/doi/pdf/10.1080/01402390701785211
- INSS — *IDF Strategy* (Eizenkot, 2015 doctrine, Hebrew with English summary) — inss.org.il/he/wp-content/uploads/sites/2/2017/04/IDF-Strategy.pdf — "force-operating and force-building entities: wing, arm, command; corps, arrays, managers" (the 2015 use of *ma'arach* in published doctrine).
- Belfer Center — *Israel Defense Forces Strategy Document* English translation — belfercenter.org/research-analysis/israel-defense-forces-strategy-document
- US Marine Corps, *Five-Paragraph Order* (FMST 209, FGHT 1004) — trngcmd.marines.mil — Task Organization + Scheme of Maneuver (the US doctrinal cousin to *ma'arach*).
- USAWC Press, *The 2006 Lebanon Campaign and the Future of Warfare* — press.armywarcollege.edu — formation/coordination failures.
- BESA, *The IDF and the Lessons of the Second Lebanon War* — besacenter.org/wp-content/uploads/2010/07/MSPS85En.pdf — ad-hoc forces, coordination gaps.
- Naval War College Review, *"Change Direction" 2006: Israeli Operations in Lebanon* — digital-commons.usnwc.edu — operational doctrine integration failures.
- Globalsecurity, *Israel — Army Order of Battle — Echelons* — globalsecurity.org/military/world/israel/army-orbat.htm — *seder kochot* as published.
- Steven's Balagan, *Israeli/Hebrew Terms for Military Formations* — balagan.info/israeli-hebrew-terms-for-military-formations — the Hebrew taxonomy.

### Cross-references inside our corpus (loaded directly, load-bearing)

- `usegin/Gin.md` (umbrella + 3 load-bearing principles)
- `usegin/zettel/principles/05-the-twelve-from-war-research.md` — principles 1 (intent before method), 4 (Truppenführung), 6 (COG = Lihu's attention), 7 (dialectic), 10 (aharai)
- `usegin/research/hameshet-hamemim/README.md` — round framing, the load-bearing hypothesis I tested
- `usegin/research/hameshet-hamemim/mishima/whiteboard.md` — sister-whiteboard, the *mishima* counterpart and the structural template I reused
- `usegin/research/hameshet-hamemim/matara/whiteboard.md` — sister-whiteboard
- `usegin/teams/README.md` — the formations library's own self-description (the substrate this whiteboard endorses)
- All 12 team files in `usegin/teams/*.md` — the inventory subject
- `.claude/skills/charter/SKILL.md` — the proposed-edit target
- `.claude/skills/{rnd,cell,liaison,tdd-execute,brainstorm,refine,prioritize,build-orchestrate,teamwork}/SKILL.md` — the spawning skills that drive the formations
- `usegin/research/war-management/idf-tol/whiteboard.md` — IDF TO"L doctrine, especially rosh-gadol + aharai
- `usegin/research/war-management/mission-command/whiteboard.md` — Auftragstaktik / commander's intent

### Hebrew-language anchor terms (load-bearing where the Hebrew *is* the right word)

- **מערך** (*ma'arach*) — formation/array. *This whiteboard's subject.* The *positioning* of forces for this mission.
- **סדר כוחות** (*seder kochot*) — order-of-battle / force-composition. The *list* of available units. The not-*ma'arach*.
- **תמרון** (*tamrun*) — maneuver. The *movement* of the *ma'arach* over time.
- **כוח משימה** (*koach mishima*) — task force. An ad-hoc formation assembled for one mission. The doctrinal warning: *koach mishima* without a doctrinal home is the 2006-Lebanon failure pattern.
- **מאמץ ראשי** (*me'amatz ha-rashi*) — main effort. The piece of the formation that gets weighted (Schwerpunkt). Connects *ma'arach* to *ma'amatz* (third M).
- **תפר** (*tefer*) — seam. The boundary between two formations. Doctrinally a named entity with a named owner.
- **מערכות** (*Maarachot*) — same root: the IDF professional journal where doctrine is debated. The recursive evidence that *ma'arach* is doctrinally central.
