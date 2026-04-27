# Mo'ed (מועד) — what the IDF means by "timing" and what UseGin should adopt

**Professor:** mo'ed — fifth M of *חמשת המ"מים* (the five Ms of pre-action planning).
**Charter parent:** `usegin/research/hameshet-hamemim/README.md`.
**Sister whiteboards in this round:** `mishima/` (landed), `matara/` (landed), `ma'amatz/`, `ma'arach/` (open-to-empty).
**Doctrinal nearest siblings:** `usegin/research/war-management/posh-c2/whiteboard.md` (battle-rhythm), `usegin/research/war-management/iaf-tikkur/whiteboard.md` (daily ritual), `usegin/research/war-management/modern-application/whiteboard.md` (Pitfalls 2 & 5), `usegin/research/war-management/SYNTHESIS.md` §C5 + §DL1.

---

## TOP — distilled IDF mo'ed doctrine (≤500 words)

The IDF inherits its timing concept from the British/NATO 5-paragraph order shape — *Situation / Mission / Execution / Service & Support / Command & Signal* — and reshapes it under the Israeli command climate (PO"SH, rosh-gadol, *initiative within reporting*). Inside a *pkudat krav* (פקודת קרב — combat order), *mo'ed* is the temporal block: when the operation begins, what must be in place by when, and which actions in *parallel units* must be synchronized to which actions here.

**The four required temporal elements** (canonical, derived from the 5-paragraph "Execution" paragraph + METT-T's *T*; the IDF formulation collapses these into the *mo'ed* block):

1. **שעת ש (Sh'at-Shin) — H-hour / start trigger.** The moment the operation begins. May be a clock time ("0600"), an event-trigger ("on the brigade's signal"), or a condition ("when the wadi is crossable"). One of these is mandatory; "as soon as possible" is *forbidden* — it's the temporal equivalent of a missing verb of completion.
2. **לוחות זמנים (luchot z'manim) — milestones / deadlines.** The intermediate "by H+N" anchors that let the unit self-check whether it is on or off plan, *and* let parallel units predict when the supporting action will be available to them. ("Hill 89 in our hands by H+90" is what tells the brigade reserve when to commit east.)
3. **תיאום זמנים (te'um z'manim) — synchronization with parallel actions.** The *cross-unit* timing — what is happening *elsewhere* that this unit's tempo must align with. Without this block, *mishima* (mission) is well-formed but the *campaign* desynchronizes. (FM 6-0 places this in the Execution paragraph's "Coordinating Instructions" sub-paragraph; AJP-5 is more emphatic — synchronization is the *central* function of the execution-timing block.)
4. **תרחישי זמן (tarchishei z'man) — time-conditioned contingencies.** What the unit does if H-hour slips, if a milestone is missed, if the synchronization partner is delayed. The "no plan survives contact" doctrine handled at the timing layer rather than the action layer.

**Well-specified vs. over-specified — the bright line.** The IDF (following Moltke) holds the same mishima-vs-mitala discipline at the timing layer: name the *anchors that other units depend on*; do **not** specify the internal tempo of the executing unit. "Hill 89 in our hands by H+90" is well-specified mo'ed; "advance 200m every 10min, fire team A bounding while fire team B suppresses" is over-specified — it has crossed into the *how*, which belongs to the subordinate (Auftragstaktik §4 "the *how* is the subordinate's territory"). This is the timing-layer expression of *Modern Application Pitfall 5* (Taylor in McChrystal-land): planning-heavy doctrine in a complex domain produces brittle timelines that contact shreds, then a doubling-down on more planning. The IDF answer is the same as for *mishima*: name what other units must rely on, refuse to name more.

**The 1/3–2/3 rule.** US doctrine (FM 6-0 / TLP) and IDF practice converge: a commander spends *at most* 1/3 of available time on their own planning; 2/3 must be reserved for subordinates' parallel planning. A timing block that consumes its parent's planning budget *into* the subordinate's planning budget has already failed.

**No-mo'ed-needed is itself a doctrinal posture.** Some operations carry no synchronization need (deep recon, garrison routine, training rotations) — and the IDF practice is to write that explicitly: a *pkudat krav* with no time anchor is *grounds for review*; a *pkudat krav* whose mo'ed block reads "אין תיאום נדרש" ("no coordination required") is doctrinally clean.

(Sources: see Bottom.)

---

## MIDDLE — gap mapping: where our doctrine on timing is, and isn't

I map *mo'ed*'s four temporal elements onto five UseGin artifacts and score each ✅ present / ⚠️ partial / ❌ missing.

| Artifact | Sh'at-Shin (start) | Milestones | Synchronization | Contingencies |
|---|---|---|---|---|
| `.claude/skills/charter/SKILL.md` (the meta-skill) | ❌ | ❌ | ❌ | ❌ |
| War-research SYNTHESIS C5 (battle rhythm absent) | named gap | named gap | named gap | n/a |
| `.claude/skills/morning-brief/SKILL.md` (DL1 lean B) | ⚠️ pull-on-demand | n/a | partial (cross-Gin COP read-only) | n/a |
| `feedback_autonomous_between_slices` (memory) | implicit (slice ready = go) | implicit (slice closed) | **deliberately rejected** | implicit (failed test → pause) |
| `usegin/teams/rnd-team.md` Poll-charter template | ❌ | ❌ | ❌ (parallel Polls don't see each other) | ❌ |

### Where we are correctly silent on timing

The `autonomous-between-slices` memory is the load-bearing counter-pressure to enforced *mo'ed*. It says: between slices of a multi-slice refactor, **don't ask, don't sync, just go**. The parent-issue carries intent + sequencing; inter-slice coordination would be friction without safety. Read literally, this is "no *te'um z'manim* between sub-charters." Read doctrinally, it is *the IDF answer at our scale*: the mishima sequence is itself the synchronization, and any timing block layered on top is theater (Modern Application Pitfall 2, ceremony-as-substitute-for-action).

This is consistent with the synthesis's DL1 lean B: build the *artifact* (`morning-brief`), skip the *cadence*. McChrystal's O&I worked because it killed silos in a 7,500-person network. UseGin is 1 human + 1 main Gin + N stateless sub-Gins. **At our scale, the cross-unit synchronization element of mo'ed is largely vestigial** — sub-Gins do not have peer state to synchronize, and the parent re-merges at deliverable time. The PO"SH "open architectural gap" (peer channel between concurrent sub-Gins, *Net-Centric Warfare* tenet 3 — self-synchronization) is the only place where real *te'um z'manim* would pay rent, and it stays a future-track gap that no mo'ed block in any current charter could solve by itself.

### Where we are incorrectly silent on timing

Two real gaps.

**Gap 1 — Sh'at-Shin (start trigger) inside charter §1–§3.** Every UseGin charter scored in the *mishima* whiteboard failed the time-anchor element (Charters A, B, C all ❌). For *most* of our work this is correctly defensible — research/exploration mode is async by design. But there is a sub-class of charters where the start-trigger genuinely is load-bearing and the absence bites:

- *Tikur of a live incident.* The IAF tikkur's load-bearing principle is **immediacy** — "we'll do it tomorrow" is the failure mode that kills the whole tikkur culture (`iaf-tikkur` whiteboard, principle 5). A tikur charter without an explicit "now, before next commit" trigger is doctrinally wrong-shape. Our `tikur` skill carries this in spirit (z002 — never-later) but the *charter template* doesn't enforce it.
- *Tier-1 deploy preflight.* When pushing to staging/prod the start trigger is "before the push, not after," and the contingency is "if checks fail, the push is forbidden." Currently implicit in `preflight` skill behavior; not in the charter shape that spawns it.
- *Companion check-in cadence.* The companion skill spawns a watcher with implicit "every transition" (`feedback_companion_every_transition`), but the timing isn't in the spawn charter — it's in the spawner skill's logic. A future companion variant that needs "every N minutes regardless of phase" has nowhere to put that.

**Gap 2 — Synchronization between parallel sub-Gins inside a single round.** The R&D pattern (rnd skill, `usegin/teams/rnd-team.md`) fan-outs N professors who are *blind to each other* mid-flight. PO"SH names this exactly (Alberts/Garstka tenet 3, self-synchronization). The mo'ed-shaped fix inside the existing scale would be: each Poll charter declares "I am studying angle X; my whiteboard lands at path P; my expected completion window is N tokens / M minutes" — not as a deadline, but as a *predictability anchor* for a sibling who might reshape mid-flight on noticing overlap. Today no Poll knows this about its siblings; the parent re-merges at synthesis time and the overlap shows up as duplicate work in the synthesis cost.

### How the IDF distinguishes well-specified from over-specified mo'ed — applied to us

Doctrinal test: a mo'ed block is well-specified if (a) parallel units can plan against it, and (b) it does not trespass on the executing unit's *how*. Applied to UseGin:

- *Well-specified* — "Tikur lands a zettel + skill-edit + hook same commit, before next push" (anchors what the parent depends on; doesn't dictate the order of investigation).
- *Over-specified* — "Spend 5 minutes on timeline, 5 on five-whys, 5 on three-fixes" (Taylor in McChrystal-land — internal tempo is the sub-Gin's territory).
- *Under-specified* — "Tikur eventually" (no anchor at all; the synthesis problem becomes "did we tikur or not?").

The mishima-vs-mitala bright line, applied here, is **anchor-vs-script**: a mo'ed block names *anchors* (events other units key on); it does not script *internal tempo*.

---

## BOTTOM — one specific proposal

I evaluated three proposal shapes from the charter:

- **(a) charter block "Mo'ed"** — every charter carries a temporal block. Pros: complete doctrine. Cons: most charters genuinely don't need it; the ceremony risk (Pitfall 2) is high; the autonomous-between-slices memory deliberately rejects it.
- **(b) hook-driven cadence** — session-start auto-fires `morning-brief` after >24h idle. Pros: closes C5 directly. Cons: contradicts DL1 lean B explicitly; ceremony-collapse risk at our scale is exactly what DL1 already adjudicated.
- **(c) "no-mo'ed-needed" default + opt-in `## Mo'ed` block + named exceptions list** — charters carry no timing block by default and explicitly say so when reviewed; a small named class of charters is required to carry one.

**Lean: (c).**

### The proposal — verbatim shape

Add a new sub-section to `.claude/skills/charter/SKILL.md` between current §6 (Decision-rights envelope) and §7 (Fresh-Haiku test):

> **§6.5 — Mo'ed (timing) block: opt-in, default-empty, named exceptions.**
>
> Most UseGin charters are async by design (`feedback_autonomous_between_slices`, DL1 lean B). They carry no time block, and that is correct — adding one would be ceremony (Pitfall 2). The default for the Mo'ed block is therefore *empty + explicit*: emit the line `**Mo'ed.** None — async; sub-Gin returns when deliverable lands.` This makes the silence *deliberate and defensible*, not accidental (mishima's missing-purpose-clause failure mode at the timing layer).
>
> **Required-mo'ed exceptions** — these charter classes MUST carry a non-empty Mo'ed block:
>
> - *Tikur of a live incident* (start trigger: "before next push/commit"; immediacy is load-bearing per `iaf-tikkur`/principle 5 + z002).
> - *Preflight / deploy gate* (start trigger: "before the push"; contingency: "if checks fail, push is forbidden").
> - *Multi-Gin parallel rounds where overlap is plausible* (rnd Polls, brainstorm ideators) — each Poll/ideator declares its expected-window as a *predictability anchor* for siblings (PO"SH self-synchronization tenet 3, partial mitigation).
> - *Charters spawned by hook-driven cadence skills* (e.g., morning-brief upgrade path per DL1 option C, if ever taken).
>
> **Well-specified Mo'ed shape (when present):**
>
> - **Sh'at-Shin (start trigger):** event/condition/clock — never "ASAP".
> - **Milestones (if any):** anchor events other units/charters key on; not internal tempo.
> - **Synchronization (if any):** which parallel charter or hook the timing aligns with.
> - **Contingency (if any):** what to do if the start trigger slips or a milestone is missed.
>
> **Forbidden inside Mo'ed:** internal tempo specification ("spend N minutes on step X"). Internal tempo is the sub-Gin's territory (Auftragstaktik; CALL *Less is Better*; Modern Application Pitfall 5).

Land sites:
- `.claude/skills/charter/SKILL.md` — the §6.5 block above.
- `.claude/skills/charter/SKILL.md` §"Anti-patterns" — add: *"Mo'ed silence by accident. The block is omitted entirely; nobody can tell whether the silence was deliberate (async-by-design) or an oversight."*
- `usegin/teams/rnd-team.md` and `usegin/teams/tikur-team.md` charter templates — propagate per the *mishima* whiteboard's edit 2 (templates inherit meta-skill's required blocks, including the Mo'ed line).

### Why (c) and not (a) or (b)

(a) is over-correction — mo'ed at every charter would walk straight into Pitfall 2 (ceremony) and Pitfall 5 (Taylor in McChrystal-land). The autonomous-between-slices memory is *signal*, not hostility-to-doctrine: at our scale, async-by-default is the correct equilibrium and the timing block must respect it.

(b) directly contradicts DL1 lean B, which was already adjudicated by the synthesis with three independent professors converging on "build the artifact, skip the cadence, upgrade only if organic use proves the cadence pays rent." Hook-driven cadence at our 1+1+N scale collapses to ceremony within ~3 sessions (Modern Application Pitfall 2 + IAF tikkur cadence-collapse failure mode #3, applied below the daily-ritual scale). I do not adopt (b); explicit defended position.

(c) carries the doctrine where it pays rent (the named exceptions are exactly the charter classes where IDF/IAF doctrine sharpens around timing — tikur immediacy, preflight gates, parallel-unit synchronization) and refuses to carry it where it doesn't (everything else). The default-empty-but-explicit form is the timing-layer analog of mishima's purpose-clause discipline: silence is defensible *only when named as deliberate*.

### Coordination + escalation

- **Coordinate (per charter §6 must-coordinate-before-acting):** I am claiming DL1 lean B is *correct and load-bearing* at the timing layer — and that (c) is the right operationalization of the synthesis's "build the artifact, skip the cadence" decision. If Lihu/Sam want to revisit DL1 lean B (e.g., upgrade path B → C is now warranted), the proposal shape changes.
- **Escalate (per charter §6 must-escalate):** I am NOT editing `.claude/skills/charter/SKILL.md`, `usegin/teams/*.md`, or any production-tree file. Proposals only.
- **Decide alone:** the verdict that (a) and (b) are wrong-shape; the citation depth; the exceptions list (tikur / preflight / parallel rounds / hook-cadence) which I derive from existing convergent doctrine in the corpus.

---

## FRICTION

What got in the way of this whiteboard:

1. **No direct Hebrew-source on the IDF mo'ed block.** Web searches for "חמשת המ\"מים מועד" returned nothing usable on the timing element specifically; the *mishima* whiteboard hit the same wall. I extracted the four-element shape from convergent sources: NATO 5-paragraph "Execution" paragraph (FM 6-0, AJP-5, STANAG 2014), METT-T's *T*, and the existing IDF-TO"L + mission-command professor notes. **Confidence:** high on the *anchors-not-script* doctrine (it's a direct corollary of Auftragstaktik §4 and CALL *Less is Better*); medium on the four-element decomposition I named (Sh'at-Shin / milestones / synchronization / contingencies) — it's well-attested in NATO and MDMP; whether the IDF formalism uses *exactly* those four blocks is something a Hebrew-reading professor or *Maarachot* (מערכות) pass would verify. The doctrinal *load-bearing* claims survive the gap; the schema labels might tighten.

2. **The autonomous-between-slices memory is 6 days old (system-reminder noted).** I treated it as still-canonical because (a) it's load-bearing for the proposal shape, (b) the synthesis's DL1 lean B independently converges on the same posture, (c) the more recent zettel z032 ("be laconic") and Gin.md's three load-bearing principles are consistent with async-by-default. The risk is that Lihu has shifted on this in the last week and the proposal is built on stale priors. Resolution path: name the assumption, let Lihu push back if it's wrong.

3. **The PO"SH self-synchronization gap is named but not solved.** Tenet 3 (sub-Gin-to-sub-Gin signaling without parent in the middle) is real architecture work, not a charter-block work. Proposal (c)'s "predictability anchors" in parallel-round charters is a *partial* mitigation — siblings can read each other's *charters* (which exist before the round runs) but still can't observe each other's *progress* mid-flight. I flag this honestly as not-solved; the open architectural gap stays open.

4. **One recursive amusement.** The charter that spawned me to evaluate timing doctrine has *no* time block — it just says "write to disk, do not commit, report back." By proposal (c), it should carry `**Mo'ed.** None — async; sub-Gin returns when deliverable lands.` It doesn't. This is *not* a defect — it's the silence-by-accident anti-pattern that proposal (c) names. **The whiteboard you're reading is its own evidence.** Charter A in the *mishima* whiteboard had the same quality (multi-verb §2 that the rule I was proposing would flag). The pattern across both whiteboards: meta-skill compensators (Selbständigkeit, Fresh-Haiku) carry today's charters; the templates and the timing-block silence are where the doctrine bites.

5. **The "no-mo'ed-needed default" is itself a research finding.** Going in, the charter hypothesis was "this is our weakest M; *mo'ed* might close C5." After the work: the *artifact* (morning-brief) closes the part of C5 that pays rent; the *cadence* (battle rhythm) does NOT close it at our scale, and adding it would actively harm via Pitfall 2. The Selbständigkeit clause was load-bearing here — the literal task ("propose charter block / hook / no-adoption — pick one") permitted "no adoption with defended position", and that turned out to be the right answer for most charters and the wrong answer for a small named class. Hence (c), not (a) or "no adoption period."

---

## Bottom — sources

### English-language doctrine (the load-bearing English sources for the *mo'ed* shape)

- FM 6-0, *Commander and Staff Organization and Operations* — Execution paragraph 3 structure (Concept of Operations, Scheme of Movement and Maneuver, Tasks to Subordinate Units, Coordinating Instructions). Coordinating Instructions sub-paragraph is the canonical home for cross-unit synchronization. `armypubs.army.mil/epubs/DR_pubs/DR_a/ARN35404-FM_6-0-000-WEB-1.pdf`
- NATO STANAG 2014 Edition 9 — *Formats for Orders (OPORD)* — H-hour designation rules, "hour(s) and minutes(s) must always be used." `trngcmd.marines.mil/Portals/207/Docs/TBS/STANAG%202014%20Edition%2009-%20FORMATS%20FOR%20ORDERS%20(OPORD).pdf`
- AJP-5, *Allied Joint Doctrine for the Planning of Operations* (NATO Standard) — synchronization-and-coordination as the central function of execution timing. `coemed.org/files/stanags/01_AJP/AJP-5_EDA_V2_E_2526.pdf`
- USMC FGHT 1004 — *Introduction to the Operations Order* — "Coordinating instructions should always appear as the final sub-paragraph of the execution paragraph." `trngcmd.marines.mil/Portals/207/FGHT%201004%20Introduction%20to%20the%20Operations%20Order%20SO%20Excerpt.pdf`
- METT-T / METT-TC (Mission, Enemy, Terrain, Troops, Time, Civil) — the *T* (Time-Available) element + the **1/3–2/3 rule** (commander spends ≤1/3 of available time on own planning; ≥2/3 reserved for subordinates' parallel planning). ATP 3-21.8, Step 3 (Make a Tentative Plan). `benning.army.mil/Infantry/DoctrineSupplement/ATP3-21.8/appendix_a/StepsofTroopLeadingProcedures/Step3/`
- Wikipedia, *Five paragraph order* — Situation/Mission/Execution/Service&Support/Command&Signal. `en.wikipedia.org/wiki/Five_paragraph_order`
- McChrystal et al., *Team of Teams* (2015) — O&I daily 90-minute video conference, 7,000 participants, never canceled. The modern parallel and the cadence-as-load-bearing finding. `inc.com/ilan-mochari/genearl-mcchrystal-meetings.html` + `mcchrystalgroup.com/insights/detail/2025/07/08/from-detractor-to-advocate--a-leadership-journey-through-team-of-teams`
- Moltke (the Elder), via Widder, *Origins of Auftragstaktik* — "an order should contain only what the subordinate cannot determine for themselves and not one word more." Cited via `mission-command/whiteboard.md`. The timing-layer corollary: a Mo'ed block contains only the temporal anchors other units depend on; not internal tempo.
- CALL, *Commander's Intent: Less is Better* — over-specified intent fails. Same rule applies at the timing layer. `globalsecurity.org/military/library/report/call/call_98-24_ch1.htm`

### Cross-references inside our corpus (load-bearing)

- `usegin/Gin.md` — three load-bearing principles (process over outcome; unlimited resources; laconic). The "laconic at the timing layer" is the under-specified vs. over-specified bar.
- `usegin/zettel/principles/05-the-twelve-from-war-research.md` — principles 1 (intent before method), 2 (mission not task), 5 (orient don't accelerate — Mo'ed lives in Orient when it pays rent), 7 (dialectic — async-by-default vs. cadence-pays-rent), 11 (blameless lives in the room).
- `usegin/research/war-management/SYNTHESIS.md` §C5 (battle rhythm absent) + §DL1 (lean B — pull-on-demand artifact, skip enforced cadence). The synthesis pre-decided the cadence question; this whiteboard operationalizes the timing layer of charters consistent with that decision.
- `usegin/research/war-management/posh-c2/whiteboard.md` — battle rhythm (principle 7), self-synchronization gap (Alberts/Garstka tenet 3), span-of-control under fan-out.
- `usegin/research/war-management/iaf-tikkur/whiteboard.md` — daily-ritual cadence (principle 5: "ritual beats inspiration"; the "we'll do it tomorrow" failure mode); cadence-collapse failure mode #3.
- `usegin/research/war-management/mission-command/whiteboard.md` — principles 4 (the *how* is the subordinate's territory), 5 (disciplined initiative as obligation), 8 (shared mental model precondition).
- `usegin/research/war-management/modern-application/whiteboard.md` — Pitfall 2 (ritual without meaning), Pitfall 5 (Taylor in McChrystal-land — reductionist planning in a complex domain).
- `usegin/research/hameshet-hamemim/mishima/whiteboard.md` — sister whiteboard; mishima-vs-mitala bright line + "templates inherit meta-skill omissions" finding (proposes purpose-clause propagation; this whiteboard proposes Mo'ed-line propagation by the same mechanism).
- `usegin/zettel/zettels/z023-spawn-as-instantiation.md` — charter is the instantiation.
- `usegin/zettel/zettels/z032-be-laconic.md` — investigate without limit, output the click. Mo'ed-at-every-charter would violate this.
- Memory: `feedback_autonomous_between_slices` — the load-bearing counter-pressure. Async-by-default at the slice transition is the timing-layer analog; the proposal preserves it as the default.
- `.claude/skills/charter/SKILL.md` — the artifact under evaluation. Proposal lands as new §6.5 + an anti-patterns line.
- `.claude/skills/morning-brief/SKILL.md` — the C5/DL1 lean B operationalization; mo'ed proposal is consistent with its pull-on-demand stance.

### Hebrew-language anchor terms (load-bearing where the Hebrew *is* the right word)

- **מועד** (*mo'ed*) — appointed time / timing. The fifth M of *חמשת המ"מים*; this whiteboard's subject.
- **שעת ש** (*Sh'at-Shin*) — H-hour. The IDF/IAF abbreviation for the operation's start time/condition.
- **לוחות זמנים** (*luchot z'manim*) — schedules / milestones.
- **תיאום זמנים** (*te'um z'manim*) — synchronization (lit. "coordination of times").
- **תרחישי זמן** (*tarchishei z'man*) — time-conditioned contingencies.
- **פקודת קרב** (*pkudat krav*) — combat order. The artifact a mo'ed block lives inside.
- **חמשת המ"מים** (*chameshet ha-memim*) — "the five M-words" — the IDF's pre-action checklist (mishima / matara / ma'amatz / ma'arach / mo'ed).
