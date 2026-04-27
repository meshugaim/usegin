# Mishima (משימה) — what the IDF means by "mission" and what UseGin should adopt

**Professor:** mishima — first M of *חמשת המ"מים* (the five Ms of pre-action planning).
**Charter parent:** `usegin/research/hameshet-hamemim/README.md`.
**Sister whiteboards in this round (open-to-empty):** `matara/`, `ma'amatz/`, `ma'arach/`, `mo'ed/` (not yet authored).
**Doctrinal nearest sibling:** `usegin/research/war-management/idf-tol/whiteboard.md` and `usegin/research/war-management/mission-command/whiteboard.md` — this whiteboard sharpens the *mishima* slice they treat in passing.

---

## TOP — distilled IDF mission doctrine (≤500 words)

The IDF inherits its mission concept from Auftragstaktik via the British 5-paragraph order and then reshapes it under the Israeli command climate (rosh-gadol, aharai, rank-light). The doctrinal *mishima* — the mission statement written into a `pkudat krav` (פקודת קרב — combat order) — is a constrained sentence with five required elements and one bright-line prohibition.

**The required five (canonical "subject — verb — object — time/place — purpose"):**

1. **Subject (מי)** — *which* unit. Named in full. Mission belongs to the unit, not the commander.
2. **Verb of completion (מה לעשות)** — a single action verb in the imperative/future ("יתקוף", "יבודד", "יאחז ב־", "יכבוש"). One verb. Not two. Multi-verb missions are *forbidden* — they're flagged as "divergent missions" and split into separate orders down the chain (*Less is Better*, CALL).
3. **Object (על מה / את מי)** — the named geographic objective or named enemy formation. Generic objects ("the area," "enemy forces") fail review.
4. **Time/place anchor (מתי / היכן)** — H-hour and grid. Without it the order is a wish.
5. **Purpose clause (לשם מה / על־מנת ש־)** — the *because*. Mandatory. The Hebrew form is `על־מנת ש־` / `במטרה ש־` ("in order that…") and it points one echelon up — at the *parent*'s end state, not this unit's. This is what makes the mission *self-supervising*: a sub-unit that sees the literal verb stop serving the purpose-clause is *obligated* to deviate (*Selbständigkeit* / rosh-gadol). Cut the purpose clause and you've issued a *mitala* (מטלה — task), not a *mishima*.

**Mishima vs. mitala — the bright line.** *Mitala* = a task with no purpose clause; the executor owes the action, not the goal. Cleaning a rifle is a mitala. Holding hill 89 *so the brigade can break out east* is a mishima. The IDF's grade-down move on a unit-commander candidate who writes a mission as if it were a task is sharp and explicit. (`idf-tol` whiteboard, principle 1; Shamir, *Transforming Command*.)

**What is forbidden inside a mishima:**
- **Method (איך).** No route, no fire-plan, no scheme of maneuver. The *how* is the subordinate's territory; specifying it forfeits their judgment and converts the order to *Befehlstaktik* (`mission-command`/14, /23).
- **Multiple verbs of completion.** "Attack and hold and screen" → three missions, three orders, three subordinates.
- **Vague purpose.** "In order to advance the campaign" fails. The purpose must name the parent unit's end state in concrete terms ("…so 401st Brigade can cross the wadi by 0600").
- **Doctrinal vocabulary the executor can't ground.** The 2006 Lebanon failure was exactly this — Halutz's "system-wide, integrated, timed strike to undermine operational performance of Hezbollah" is a mishima-shaped sentence with no executable verb (`idf-tol`/§Second-Lebanon-War). The fresh-Haiku test (principle 3) is the post-2006 institutional response.

**The vague-mishima signature.** When IDF after-action reviews flag a mishima as vague, the failure mode is almost always one of three: (a) verb of motion masquerading as verb of completion ("examine the sector" instead of "seize"), (b) missing or generic purpose clause ("…in support of operations"), (c) compound verb hiding two missions. All three are visible to the *reader* before the operation; the tikkur catches them institutionally if pre-action review missed them.

(Sources: see Bottom.)

---

## MIDDLE — three UseGin charters scored against the mishima bar

I score three real charters from this repo against the five required elements + the forbidden list. Score = ✅ present and well-formed / ⚠️ present but weak / ❌ missing or violates.

### Charter A — this whiteboard's own spawn (the *mishima* charter you're reading)

Source: the prompt text I was instantiated with. Excerpt:
> *"Bring back what UseGin should adopt from the IDF concept of משימה … Distill the IDF doctrinal definition … Map our current charter §1 and §2 against that bar … Propose specific edits to `.claude/skills/charter/SKILL.md`."*

| Element | Score | Notes |
|---|---|---|
| Subject | ✅ | "the *mishima* professor" — named role, named unit-of-one |
| Verb of completion | ⚠️ | §2 mixes verbs: *distill*, *map*, *propose*. Three verbs. Doctrine says one — the IDF would split this into three sub-missions. UseGin's pattern of putting multiple "key tasks" softens this rule deliberately (it suits research charters). Worth naming. |
| Object | ✅ | "IDF doctrinal definition of mishima," "our current charter §1+§2," "`.claude/skills/charter/SKILL.md`" — all named concretely |
| Time/place anchor | ❌ | No deadline, no commit window. UseGin charters routinely omit this. Defensible inside the permissive zone, but it's a real gap vs. doctrine — it shifts coordination cost to autosync collisions and to the orchestrator's commit-as-it-lands pattern (`rnd-team`/common-failure-modes). |
| Purpose clause | ✅ | Strong: *"The eventual goal is sharper sub-Gin charters; right now we know mission is roughly our charter §1 but we don't know what the IDF doctrine actually requires."* Names the parent end-state, lets me deviate when literal §2 stops serving it. |
| Forbidden: method | ✅ | Charter explicitly says "you decide structure of the whiteboard, which 3 charters to evaluate, citation style." |
| Forbidden: vocabulary | ⚠️ | Uses *aharai*, *Schwerpunkt*, *Auftragstaktik*, z023, z029 — all reachable from doctrinal pointers + the fresh-Haiku check is *itself* enforced in the charter. Survives the bar by reflex; would fail without the explicit check. |

**Verdict:** the mishima charter is well-formed *because the charter skill (§5 Selbständigkeit + §7 Fresh-Haiku) compensates for the missing time-anchor and the multi-verb*. Without those compensating clauses it would fail the IDF bar.

### Charter B — `rnd-team`'s per-Poll spawn shape (`usegin/teams/rnd-team.md` §Charter shape)

Excerpt of the template:
> *"You are Poll, professor of <angle>. ## Mandate <one sentence: produce one whiteboard on this angle>. ## Deliverable <exact path>/whiteboard.md with: ## Top — the click ## Middle — the body ## Bottom — the open ends."*

| Element | Score | Notes |
|---|---|---|
| Subject | ✅ | "Poll, professor of <angle>" — instantiation as named role (z023). |
| Verb of completion | ✅ | "produce one whiteboard." Single verb. *The cleanest mishima of the three.* |
| Object | ✅ | exact path → whiteboard.md, with named structure. |
| Time/place | ❌ | No anchor. Same gap as A. |
| Purpose clause | ❌ | The template carries `## Mandate` (the *what*) but **no `## Why`** — no purpose clause at all. The purpose lives in the spawning `rnd` skill's framing, not in the charter the Poll receives. **This is a real doctrinal gap.** A Poll who finishes its literal mandate has no in-charter signal that the literal mandate has stopped serving the parent's intent — rosh-gadol degrades to rosh-katan by default. |
| Forbidden: method | ✅ | Working rules constrain *substrate* (don't commit, capture friction as zettels) without prescribing investigative method. |
| Forbidden: vocabulary | ⚠️ | "z029," "zettel-capture skill," "autosync collision risk" — internal slang, no glossary, no fresh-Haiku check in the template. Polls survive only because they tend to be Opus-class with full corpus access. |

**Verdict:** Poll-charter has a *clean mishima skeleton* but **no purpose clause**. This is the single most actionable gap surfaced by the doctrine.

### Charter C — `tikur-team`'s Ivan (`usegin/teams/tikur-team.md` §Charter shape)

Excerpt:
> *"You are Ivan. Read <log paths / commits / transcripts>. Reconstruct the timeline. No blame language. No speculation — only facts you can cite. Output a strict timeline at <path>."*

| Element | Score | Notes |
|---|---|---|
| Subject | ✅ | "Ivan" — instantiation. |
| Verb of completion | ✅ | "reconstruct the timeline." Single verb. |
| Object | ✅ | "the timeline" anchored to logs/commits/transcripts → `<path>`. |
| Time/place | ❌ | None. |
| Purpose clause | ❌ | Same gap as B — **no purpose clause**. Why is the timeline being built? (To enable Cal's root-cause pass, ultimately to land a mandatory-fix.) Ivan can't see this from the charter. If Ivan finds a fact that doesn't fit "timeline" but is load-bearing for root-cause, doctrine says she should surface it; in the charter as written, she has no warrant to. |
| Forbidden: method | ✅ | Strong negative constraints ("no blame language, no speculation") without specifying *how* to read the logs. |
| Forbidden: vocabulary | ✅ | Plain. Zero internal slang. Highest fresh-Haiku score of the three. |

**Verdict:** Ivan-charter is the cleanest *form* but shares Charter B's missing purpose clause. The pattern is consistent: UseGin's charter templates routinely omit the *because*.

### Cross-cut on the three

| | Subject | Verb | Object | Time | Purpose | No-method | No-slang |
|---|---|---|---|---|---|---|---|
| A (mishima) | ✅ | ⚠️ | ✅ | ❌ | ✅ | ✅ | ⚠️ |
| B (Poll) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ⚠️ |
| C (Ivan) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |

**The pattern:** UseGin charters are sharp on *what* (subject/verb/object) and *forbidden how*, weak on *time* and **inconsistent on purpose**. Charter A carries purpose because the *spawner* (Lihu) hand-wrote it; Charters B and C are *templates* and the templates omit purpose. Templates compound — every Poll in every R&D round inherits the gap.

---

## BOTTOM — proposed edits to `.claude/skills/charter/SKILL.md`

**Headline finding:** `.claude/skills/charter/SKILL.md` §1 (Purpose) and §2 (Key tasks) already meet the IDF bar *for the meta-skill*. The skill says "Purpose = the *because*; not the task — the *reason*" and gives the example "*so that next time we hit the autosync race, we recognize the cluster*" — that example is a textbook mishima purpose clause, and §5 (Selbständigkeit) is already in the verbatim form the IDF would write.

**Where the bar tightens what we have: the team templates, not the meta-skill.** Charters B and C (and by the cluster pattern, every team template under `usegin/teams/`) ship missing the purpose clause. The meta-skill correctly demands it; the templates that *use* the meta-skill silently drop it.

### Edit 1 (proposed — to `.claude/skills/charter/SKILL.md` §2 "Key tasks")

Current text says key tasks should be "*outcomes*, not steps. Verbs of completion ("produce X", "decide between Y and Z"), not verbs of motion ("look at", "explore")." The IDF doctrine adds: **single verb is preferred; multi-verb tasks should be flagged as a tell that the charter is actually multiple charters in disguise**. Add (proposed verbatim, ≤2 lines):

> *Single verb of completion is the IDF mishima form. When you find yourself writing 2-3 verbs in §2, check whether you have one mission or several — if several, split. Compound missions degrade to mitala (task-execution) under fog (CALL Less is Better, IDF mishima vs. mitala distinction).*

### Edit 2 (proposed — to `.claude/skills/charter/SKILL.md`, new sub-section under §1 or as a separate §1.5)

Add an explicit *purpose clause* requirement that propagates to **team templates**, not just meta-skill examples. Templates in `usegin/teams/*.md` currently omit the purpose clause and the cluster shows it (Charters B and C above). Proposed addition:

> *§1.5 — Purpose clause propagates to spawn templates. When a team-shape file under `usegin/teams/<team>.md` defines a charter template, the template must carry a `## Purpose` (or equivalent labeled) slot — not only the orchestrator's framing. A template without a purpose slot guarantees that every spawn instantiated from it inherits the omission. (See `usegin/research/hameshet-hamemim/mishima/whiteboard.md` for the cluster.)*

### Edit 3 (deferred — to coordination, not edited)

A real **time-anchor** ("by H-hour") would be the third IDF demand and is currently the universal gap (all three charters scored ❌). I'm not proposing an edit because UseGin's mode (research, exploration, autonomous between slices per memory) deliberately decouples spawn from clock — and the autosync model handles convergence post-hoc. Adopting H-hour wholesale would conflict with that. **I flag it as a known divergence from doctrine, not a defect.** A future iteration could explore conditional time-anchoring for time-sensitive spawns (deploys, tikurs of live incidents).

### Coordination section (per charter §6 — must coordinate before acting)

I am claiming Charter B (`rnd-team` Poll template) and Charter C (`tikur-team` Ivan/Cal/John/Sam template) are **wrong-shape** vs. IDF doctrine — they ship without a purpose clause. This is a stronger claim than "incomplete" and per the charter envelope I must coordinate it, not act. Flagging here:

- **Claim:** team templates in `usegin/teams/*.md` are doctrinally wrong-shape on the purpose-clause dimension. Not a stylistic gap — a structural one. The mitala-vs-mishima bright line is the point.
- **Counter-claim worth steelmanning:** team templates intentionally *delegate* the purpose clause up to the spawning skill (rnd/tikur), trusting the orchestrator to inject it at instantiation. If that always happens in practice, the templates are fine and the gap is a documentation gap, not a doctrinal one.
- **Resolution path:** sample 5–10 *actual* spawn prompts (from `~/agent-records/` or session JSONLs) emitted by `rnd` and `tikur` skills, count how many carried a purpose clause vs. omitted it. If ≥80% carry it, edit 2 above is a documentation tightening; if <80%, edit 2 is a real doctrinal correction. I did not run that sample — it's the next move and Lihu/Sam should authorize it.

### Escalation section (per charter §6)

I am NOT editing `.claude/skills/charter/SKILL.md` — only proposing. Per the spawn charter's decision-rights envelope, that file is in production-edit territory. The two edits above are framed as proposals; Lihu/Sam decide whether to land them.

---

## FRICTION

What got in the way of this whiteboard:

1. **Hebrew-language IDF doctrine is mostly behind paywalls or in classified manuals.** ResearchGate 403'd the Shamir paper; the INSS *IDF Strategy* PDF rendered as garbled binary via WebFetch. I extracted the *mishima* shape from English secondary sources (CALL *Less is Better*, FM 6-0 references, Shamir summaries in `mission-command/whiteboard.md`) plus the existing IDF-TO"L professor's notes. **A future iteration with a Hebrew-reading professor (or with direct access to a redacted IDF *pkudat krav* template) would tighten the verb-form claim.** I'm confident on the *mishima vs. mitala* bright line and the purpose-clause requirement; less confident on whether the IDF formally specifies "single verb" or whether that's a CALL/US doctrine I'm projecting onto the Israeli form.

2. **No data on how *actual* spawn prompts look.** I scored two team *templates* (B and C) and one live charter (A, my own). The cluster claim ("templates omit purpose, this propagates") rests on the templates as authored. I did not pull 5–10 real spawn prompts from `~/agent-records/` to verify the propagation empirically. That's the resolution path I named in Coordination — and the right next step before any actual edit lands.

3. **The fresh-Haiku check is recursive.** This whiteboard uses *mishima*, *mitala*, *rosh-gadol*, *Selbständigkeit*, *Befehlstaktik*, *konseptsia*, *aharai* — all defined inline or one click away in the doctrinal pointers. A truly fresh Haiku would still need the pointers section. The check survives, but it's tight; if a sub-Gin reads only the TOP section and skips the pointers, they'd struggle. **I considered stripping the Hebrew terms and decided against it** — *mishima* is the whole point of the whiteboard, and the click of "mishima ≠ mitala" requires both words. (Memory: `reference_team_languages` — foreign words are signal, don't English-correct.)

4. **One recursive amusement.** The charter that spawned me to evaluate charter doctrine has a multi-verb §2 (distill / map / propose). By the rule I'm proposing, it would be flagged. It still produced this whiteboard correctly because §5 Selbständigkeit + §7 Fresh-Haiku compensate. **That's actually evidence for the load-bearing claim**: the meta-skill compensates for soft individual charters, but the team *templates* (B, C) don't have those compensators wired in, and that's where the doctrine bites.

---

## Bottom — sources

### English-language doctrine (the load-bearing English sources for the *mishima* shape)

- CALL, *Commander's Intent: Less is Better* — globalsecurity.org/military/library/report/call/call_98-24_ch1.htm — the "if we do nothing else…" form, the prohibition on multi-mission compound statements, the "concise" requirement.
- FM 6-0, *Commander and Staff Organization and Operations* — armypubs.army.mil/epubs/DR_pubs/DR_a/ARN35404-FM_6-0-000-WEB-1.pdf — task and purpose with "in order to" infinitive form. (Render via webfetch failed; relying on the secondary summaries in our mission-command whiteboard, which cite this directly.)
- ADP 6-0, *Mission Command* — irp.fas.org/doddir/army/adp6_0.pdf — the six FM 6-0 principles.
- Eitan Shamir, *Mission Command in the Israel Defense Forces* (UNG Press) — ung.edu/university-press/.../mission-command-in-the-idf-sample-chapter.pdf — the IDF interpretation of Auftragstaktik, Shamir's praxis-gap framework.
- Wikipedia, *Mission-type tactics* — en.wikipedia.org/wiki/Mission-type_tactics
- "Pavilion DINFOS, *The Elements of Commander's Intent*" — pavilion.dinfos.edu/Article/Article/2163950
- Avi Kober, "The IDF in the Second Lebanon War: Why the Poor Performance?" — *Journal of Strategic Studies* — the 2006 vague-mission failure mode.

### Cross-references inside our corpus (loaded directly, load-bearing)

- `usegin/Gin.md` (umbrella + 3 load-bearing principles)
- `usegin/zettel/principles/05-the-twelve-from-war-research.md` — principles 1 (intent before method), 2 (mission not task), 3 (fresh-Haiku), 4 (Truppenführung), 7 (dialectic), 10 (aharai)
- `usegin/research/war-management/idf-tol/whiteboard.md` — the prior IDF-TO"L professor's notes, my nearest sibling; especially principles 1–2 (mission/intent) and the rosh-gadol axis
- `usegin/research/war-management/mission-command/whiteboard.md` — three-piece commander's intent (purpose / key tasks / end state), the praxis-gap framework, the Verantwortungsfreudigkeit obligation
- `usegin/zettel/zettels/z023-spawn-as-instantiation.md` — charter is the instantiation
- `.claude/skills/charter/SKILL.md` — the artifact under evaluation
- `usegin/teams/rnd-team.md` §Charter shape — Charter B
- `usegin/teams/tikur-team.md` §Charter shape — Charter C
- `usegin/research/hameshet-hamemim/README.md` — round framing

### Hebrew-language anchor terms (load-bearing where the Hebrew *is* the right word)

- **משימה** (*mishima*) — mission. The action with a purpose clause. *This whiteboard's subject.*
- **מטלה** (*mitala*) — task. The action without a purpose clause. The bright-line *not-mishima*.
- **פקודת קרב** (*pkudat krav*) — combat order. The artifact a mishima lives inside.
- **על־מנת ש־** / **במטרה ש־** — Hebrew infinitival forms equivalent to English "in order that…" — the purpose-clause connector.
- **ראש גדול** (*rosh gadol*) — see `idf-tol/`. The behavioral expectation a purpose clause enables.
- **אחריי** (*aharai*) — see `idf-tol/`. The doctrinal companion to mishima at the leader-position level.
- **הקונצפציה** (*ha-konseptsia*) — see `idf-tol/`. The 1973-failure-mode that vague mission statements feed into.
