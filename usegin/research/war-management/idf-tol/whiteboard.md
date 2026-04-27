# IDF TO"L (Torat Lehima) — combat doctrine + command climate, mapped to UseGin

**Professor scope.** TO"L = תורת לחימה, "combat doctrine" — how Israelis fight at the
small-unit / tactical-operational seam, plus the command culture that doctrine sits in.
Sister whiteboards cover PO"SH (command-and-control architecture), IAF tikkur (debriefing),
mission command broadly (Auftragstaktik roots), Clausewitz, and modern application. This
whiteboard stays on the *combat-doctrine + command-climate* slice — the distinctly Israeli
flavour of how orders, initiative, and improvisation actually work in the field.

The mapping target: managing UseGin (Lihu + Gin) and the Gin-augmented dev team, where
sub-Gins are the small-unit commanders and Lihu is the senior officer issuing intent.

---

## Top — distilled reading

Eight TO"L-derived principles for the UseGin operating model. Each line claims something
about *us*, then names the IDF concept it comes from, then ties to existing principles or
zettels so it reaches the rest of the corpus.

### 1. Charter the **intent**, not the **route**. Sub-Gins improvise the route.

Israeli mission command treats the order as *what + why*, not *how* (״משימה ולא מטלה״ —
*mission, not task*). The subordinate owns the route. This is the deepest operational
trait the IDF inherited from Auftragstaktik and pushed further than its sources, because
multi-front, resource-thin, time-compressed wars don't survive top-down route-planning.

For us: the charter we hand a sub-Gin (z023 — charter is the instantiation) must commit
to *intent* and the *commander's-intent paragraph* — what success looks like, what the
next echelon up will do with the result — and refuse to micro-spec the route. When we
catch ourselves writing step-by-step prompts, that's a tell we've slid from Israeli
mission-command into US-Army-style detailed-orders. The price of detailed orders is the
price the IDF refuses to pay: brittle execution under fog. Tie: principle 03 (pull Claude
into our world — we own the *why*, Gin owns the *how*), z014 (semantic vs. how).

### 2. **Rosh gadol** is the success criterion for a sub-Gin.

*Rosh gadol* (ראש גדול, "big head") = the soldier who, given a task, reaches past it
toward the *purpose* of the task; *rosh katan* (ראש קטן) = the soldier who fulfills
exactly the letter and stops. Cited in *Start-Up Nation* as the cultural engine of
Israeli initiative.

Operationally for us: a sub-Gin that finishes the literal ask and stops is *rosh katan*
and we should grade it down even if the task is "complete." The bar is: did it surface
the adjacent finding, capture the friction zettel along the way (zettel-capture skill),
notice the cluster forming (z040, z057), name the open dilemma in z026 shape? The
charter should explicitly invite *rosh-gadol* behaviour and explicitly forbid the
*rosh-katan* completion. Tie: feedback memory `feedback_liaison_fix_everything` — don't
dismiss adjacent improvements as out-of-scope.

### 3. **Rank-light by default; rank-heavy at the edges.**

The IDF's first-name culture (a foreign officer calling an Israeli major "sir" gets
corrected) is not informality for its own sake — it lowers the cost of *contradiction
upward*. The famous price: it also lowers the cost of insubordination, slack discipline,
and (Second Lebanon War 2006) commanders failing to make hard calls because the social
cost of a hard order was too high.

For us: Lihu and Gin already operate first-name, no-honorifics, contradiction-cheap.
Keep that — it's load-bearing. *But* introduce rank-heavy moments at the edges:
deploy-to-staging, irreversible deletes, prod migrations, anything that maps to a
combat-loss equivalent. There the Director / human voice is final and not up for
"rosh-gadol"-style reframing. Mapping: this is the same instinct as our existing
"Claude works on `main` only" rule — Lihu carries the rank that Gin doesn't, at the
edge that matters. Tie: principle 04 (fighting vs. asking — first-name keeps it asking;
the edge cases let it become rank-heavy without becoming fighting).

### 4. **Aharai (אחריי, "after me")**: the senior agent goes first into the riskiest
context, not the safest.

IDF officer doctrine: platoon and company commanders lead from the *tip* of the
formation, not from the rear. The rationale is shared danger — a soldier follows an
officer who is demanding of himself what he demands of others. The price is well-known:
disproportionate officer casualties.

Translation: when a turn is risky (gnarly migration, novel SDK behaviour, an
investigation with no obvious bottom), the *strongest* agent in the loop — Lihu, or
Opus-class Gin — goes first into the unknown, not last. Don't send Haiku to scout a
load-bearing decision and then "promote" it to Opus. The corollary is the price: Lihu's
attention is the scarce resource that gets burned at the tip. Compensate by aggressively
*delegating after the tip is taken* — once the unknown is mapped, hand the routine
execution down. Tie: z023 (spawn as instantiation), z029 (sub-Gins can't fan out — so
the first-tier scout *must* be senior).

### 5. **Doctrine flows from the field upward, not from headquarters downward.**

A repeated finding across IDF history: battle doctrine gets settled in the field, *then*
travels up to General Staff to be codified. The famous failure mode (Second Lebanon War,
also captured by the SOD/Naveh OTRI episode) is the inverse — when an opaque doctrine
language ("system-wide, integrated, and timed strike to undermine the operational
performance of...") is invented at HQ and pushed down, mid-rank commanders parrot it
without understanding, orders become incomprehensible, and tactical execution collapses.

For us: this *is* z015 (pre-game manual — only systematize what we've done by hand at
least once). Plus the SOD episode adds the inverse warning: when our skills, charters,
or skill-lab notes start using vocabulary we coined at the management layer that no
sub-Gin can recognise in its own context, that's the SOD anti-pattern. Test:
can a fresh Haiku read the charter and act, or does it need a glossary? Tie: z015,
z036 (be laconic — distill to the semantic center).

### 6. **The reservist model = sub-Gins re-form per task with high context-load on entry.**

The IDF reserve (miluim) keeps a unit's *identity, equipment cache, and training program*
permanent across the year of civilian life — so the reservist re-enters a cohesive unit,
not an ad-hoc assembly. What enables this is heavy front-loaded context (the unit's prior
operations, current AO, this rotation's mission) crammed in fast at call-up.

This is *exactly* our spawning shape. A sub-Gin is a reservist: it doesn't carry context
across calls, but the *charter* is the unit's identity and the *zettelkasten + skills +
CLAUDE.md* are the equipment cache. The harder we invest in the cache (zettels indexed,
skills reachable, charter sharp), the faster a fresh sub-Gin re-enters as a *cohesive
reservist*, not an ad-hoc one. Tie: z023 (charter), z028 (one shared brain), and the
z077 lab-existence-check hook (the equipment cache must be *findable*, not just present).

### 7. **Multi-front improvisation = parallel sub-Gins, not sequential queue.**

IDF doctrine for fighting on multiple fronts with limited resources: don't wait until
front A is decided before opening front B. Decompose the war into fronts that each have
local commanders with mission-command authority, and accept that *coordination quality
will be worse than single-front war* — the trade is that you don't lose the war by losing
tempo on the un-attacked front while you fight the attacked one.

For us: this is the rnd skill (z076 — pre-decompose, spawn parallel professors, accept
weaker cross-cutting and recover it via synthesis at the end). The IDF lesson it adds:
**don't try to tighten cross-front coordination during the operation** — that's where
SOD's vocabulary mess came from. Tighten coordination *before* (decompose well) and
*after* (synthesis), not *during*. Tie: z076 (rnd skill), z029 (parallel spawn — sub-Gins
can't coordinate horizontally anyway, so don't pretend they can).

### 8. **Tikkur (תחקור): the post-action debrief is mandatory, blameless, and produces
binding outputs.**

The Israeli Air Force's tikkur tradition (and the broader IDF version after the Yom
Kippur War, driven by the Agranat Commission and Motta Gur's rebuild) is the institutional
machine that makes everything above survivable: the rank-light culture works *because*
the tikkur surfaces what the rank-light culture costs, and the mission-command autonomy
works *because* the tikkur catches the cases where autonomy went wrong.

We already have the `tikur` skill named exactly for this. The IDF lesson it adds: tikkur
is *mandatory after a class of events*, not opt-in. The class is "anything that could
recur." Our existing skill says this; the IDF discipline is *don't let the blameless
framing turn into the blameless skipping*. If we caught ourselves saying "we'll tikkur it
later" or "this one isn't worth a tikkur," that's z002 (there is no later) and the IDF
would call it the slow institutional rot that produced 1973. Tie: `tikur` skill, z002,
sister whiteboard `iaf-tikkur/`.

### Cross-cutting: command climate is a system, not a policy.

The eight above are not independent levers. The IDF didn't pick "rank-light" as policy —
it co-evolved with mission command, with aharai, with tikkur, with the reservist model,
with multi-front improvisation. Each one is the load-bearing partner of the others.
*Removing one and keeping the rest is unstable.* If we adopt rank-light without tikkur,
we get insubordination. If we adopt mission-command intent-orders without rosh-gadol
hiring, we get sub-Gins that under-execute. If we adopt aharai without senior agents
willing to take the tip, we get charters with no scout. **Treat the eight as a system.**

---

## Middle — the doctrine

### TO"L (תורת לחימה) — what it is

TO"L literally = "doctrine of combat." In IDF usage it covers the small-unit tactical
manual *plus* the operational doctrine that connects tactics to campaign, *plus* the
command-culture conventions that make the manual workable. It is distinguished in IDF
discourse from:

- **PO"SH** (פיקוד ושליטה, *pikud ve-shlita*) — command-and-control: the architecture
  of who reports to whom, what the command post looks like, how orders flow. Sister
  whiteboard `posh-c2/`.
- **תוּרת המבצע** (*torat ha-mivtza*) — operational art / campaign doctrine, the level
  above small-unit TO"L.
- **תפיסת הביטחון** (*tfisat ha-bitachon*) — national security concept, the strategic
  level above operational.

TO"L is the layer where *culture* and *doctrine* fuse — the manual cannot be read without
knowing the command climate it assumes. This is why importing IDF doctrine into other
militaries' staff colleges is famously hard (the US Army can copy mission-command words
but not the rank-light culture they ride on).

### Distinctly Israeli traits — what TO"L is *not* American or British

| Trait | US / British baseline | IDF TO"L variant |
|---|---|---|
| Order shape | Detailed five-paragraph order, route specified | Mission + commander's intent; route owned by subordinate |
| Officer position in formation | Behind, controlling | At the tip ("aharai") |
| Rank distance | Honorifics, formal address, social distance | First-name, contradiction cheap |
| Doctrine flow | HQ writes, units learn, units execute | Field invents, HQ codifies after the fact |
| Improvisation | Permitted within the plan | *Valued above obedience to the plan* (literal — operations exceeding orders are praised, not punished, when successful) |
| Reserve / standing-force ratio | Standing army is the army; reserve is reinforcement | Reserve *is* the army; standing force is the holding action |
| Multi-front response | Sequence: hold one, decide the other | Parallel: local commanders fight their fronts under intent, HQ coordinates after |
| Post-action review | After-Action Review, optional, focused on lessons | Tikkur, mandatory, blameless, produces binding fix-actions |

### The rosh-gadol / rosh-katan axis

Two slang terms, both IDF-coined, both now Israeli-business-coined:

- **רֹאשׁ קָטָן** (*rosh katan*, "small head") — does exactly the literal task, no
  surrounding effort, no initiative beyond the letter. In a combat unit this is the
  soldier who, told to dig a foxhole, digs the foxhole and waits — even if while
  digging he saw the perimeter wire was down. Functional in peacetime garrison, fatal
  in combat.

- **רֹאשׁ גָּדוֹל** (*rosh gadol*, "big head") — reaches past the literal task toward
  its purpose. Same soldier, sees the wire, fixes the wire on the way back from the
  foxhole. The tradition is that *rosh gadol is the default expectation*, not a bonus.

Important nuance Israelis recognise but outsiders miss: *rosh gadol* is not "do extra
work." It is "act as if you understand the purpose and could have written the order
yourself." A rosh-gadol act that *contradicts* the literal order — because the situation
shifted — is praised. This is why rosh gadol pairs structurally with mission command:
mission command requires rosh gadol to function, and rosh gadol requires mission command
to be safe to express.

### The aharai doctrine and its price

*Aharai* (אחריי, "after me") is the formal IDF officer command — the call to follow.
Israeli officers up to battalion commander lead from the tip. The doctrinal claim is
that shared danger maintains moral authority — soldiers will accept any demand from a
commander who demands at least as much from himself.

The price has been visible in every IDF war: officer casualty rates higher than
comparable Western militaries. In Swords of Iron (the post-Oct-7 war), reservists are
~50% of the killed; commanders are over-represented within that. The IDF accepts this
as the cost of the model and considers the alternative (rear-echelon command, hesitant
follow-on by troops) unacceptable.

### The Yom Kippur War as the IDF's institutional original sin

October 1973: Egypt and Syria's surprise attack catches the IDF flat-footed. The
Agranat Commission identifies the root cause not as intelligence failure per se but as
*ha-konseptsia* (הקונצפציה, "the concept") — a unitary, unchallenged analytical
assumption ("Arabs won't attack until they have air parity, and they don't have air
parity, therefore they won't attack"). The intelligence picture was *interpreted*
through the concept until contrary evidence was filtered out.

Reforms after Agranat (Motta Gur era) baked in:
- Multiple analytical centres of gravity (no IDI monopoly on assessment).
- Open lessons-learned culture between commanders and troops (not just up the chain).
- Mandatory tikkur as binding institutional discipline.
- Devil's-advocate / "tenth man" practice — someone whose role is to argue against the
  prevailing assessment.

This is the deepest TO"L lesson for us, because the failure mode is *exactly the failure
mode of a confident agent*. A Gin that develops its own *konseptsia* about a codebase,
or a session, or a user — and filters new evidence through it — is a Yom Kippur waiting
to happen. The defence is institutional: multiple analytical centres (multiple sub-Gins
on the same question), the tenth-man practice (a charter explicitly tasked with
disagreement), mandatory tikkur after surprises.

### The Second Lebanon War (2006) as the IDF's modern reverse-failure

If 1973 was the failure of unitary analytical assumption, 2006 was the failure of
*opaque doctrinal vocabulary*. The OTRI / Naveh SOD project produced sophisticated
operational-design language ("operational shock," "system disruption," "logic of the
campaign") that the senior staff adopted and pushed down. Mid-rank commanders parroted
the vocabulary without grounding it; orders became incomprehensible (Halutz's vague
"system-wide, integrated, and timed strike to undermine the operational performance of
Hezbollah" instead of "take that hill"); execution collapsed.

The lesson: *high-concept doctrinal language at the management layer is poison if it
doesn't survive the trip down to the executing layer*. The defence is to test the
vocabulary against the executor — can a fresh Haiku-equivalent read the order and act?
If not, the order is in 2006-Lebanon shape and we should rewrite it in 1967-Sinai shape
("take that hill").

### Mapping summary — TO"L concept → UseGin construct

| TO"L concept | UseGin construct |
|---|---|
| Mission command order (mission + intent, route owned by subordinate) | Sub-Gin charter (z023) |
| Rosh gadol | Charter explicit invitation to surface adjacent findings, capture friction zettels, name dilemmas |
| Rank-light culture | Lihu↔Gin first-name, contradiction-cheap; carried into Lihu↔sub-Gin |
| Rank-heavy edge cases | "Claude works on main only," irreversible-action gates, prod-migration locks |
| Aharai | Senior model (Opus / Lihu) goes first into novel context; routine execution delegated after |
| Field-up doctrine | z015 (pre-game manual — systematize only what we've done by hand) |
| Reservist model | Sub-Gin spawning + heavy charter context-load + zettelkasten as equipment cache |
| Multi-front improvisation | rnd skill (z076) — parallel professors, synthesis after, no coordination during |
| Konseptsia trap | Multiple sub-Gin spawns on same question; "tenth-man" charter that argues the contrary |
| SOD / 2006 vocabulary trap | Test charters against fresh Haiku — if it needs a glossary, rewrite |
| Tikkur | `tikur` skill, mandatory after recurrence-class events |

---

## Bottom — sources

### English-language

- Eitan Shamir, *Mission Command in the Israel Defense Forces* (UNG Press, sample chapter): https://ung.edu/university-press/_uploads/files/mission-command-in-the-idf-sample-chapter.pdf
- Eitan Shamir, "Mission Command Between Theory and Practice: The Case of the IDF": https://www.researchgate.net/publication/254243565_Mission_Command_Between_Theory_and_Practice_The_Case_of_the_IDF
- Avi Kober, "The Israel Defense Forces in the Second Lebanon War: Why the Poor Performance?", *Journal of Strategic Studies*: https://www.tandfonline.com/doi/full/10.1080/01402390701785211
- Eitan Shamir, "'Pounding Their Feet': Israeli Military Culture as Reflected in Early IDF Combat History", *Journal of Strategic Studies*: https://www.tandfonline.com/doi/abs/10.1080/01402390801940476
- "What Happened to Israeli Military Thought?", *Journal of Strategic Studies* (the SOD / OTRI / 2006 retrospective): https://www.tandfonline.com/doi/abs/10.1080/01402390.2011.561109
- Agranat Commission overview, Center for Israel Education: https://israeled.org/agranat-yom-kippur-war/
- ICGS, "Crisis, Reform, and Strengthening: Learning from the IDF's Recovery After Yom Kippur": https://icgs.org.il/en/publications/post-kippur-reconstruction/
- ICGS, "From Militias to a Multi-Theater Army: The Evolution of IDF Combat Doctrine and Commander Training": https://icgs.org.il/en/publications/idf-combat-doctrine-evolution/
- Brookings, "The Fog of Certainty: Learning from the Intelligence Failures of the 1973 War": https://www.brookings.edu/articles/the-fog-of-certainty-learning-from-the-intelligence-failures-of-the-1973-war/
- "The Perils of Israel's 'Follow Me!' Ethos", Times of Israel: https://www.timesofisrael.com/the-follow-me-ethos-and-its-perils/
- "Fallen IDF Commanders' Legacy: Israeli Officers Lead from the Front", Jerusalem Post: https://www.jpost.com/opinion/article-778083
- HBS / The Case Centre, "Aharai: Leading in Front of the Lines": https://www.thecasecentre.org/products/view?id=127387
- RAND, "Israel's 'People's Army' at War": https://www.rand.org/pubs/commentary/2024/01/israels-peoples-army-at-war.html
- RAND, "All Glory Is Fleeting: Insights from the Second Lebanon War" (monograph): https://www.rand.org/pubs/monographs/MG708-1.html
- Foreign Policy, "The IDF's Command and Control Problem" (2024): https://foreignpolicy.com/2024/07/03/idf-command-control-gaza-hamas/
- Nathan Zeldes, "Rosh Gadol: How You Can Manage for Initiative and Get Away With It": https://www.nathanzeldes.com/blog/2013/03/rosh-gadol-how-you-can-manage-for-initiative-and-get-away-with-it/
- Dan Senor & Saul Singer, *Start-Up Nation* — the popular treatment of rosh-gadol / IDF-as-management-school (book; cited via secondary sources above)

### Hebrew-language (load-bearing where the Hebrew *is* the right word)

- **תורת לחימה** — the term itself; no single canonical IDF manual is public, but the
  framing appears throughout the INSS and Dado Center publications.
- INSS, *אסטרטגיית צה״ל* (IDF Strategy, 2017 unclassified release):
  https://www.inss.org.il/he/wp-content/uploads/sites/2/2017/04/IDF-Strategy.pdf
  — the official strategic-doctrine document; contains the layering of *tfisat
  ha-bitachon → torat ha-mivtza → torat lehima* and the explicit endorsement of
  decentralized command.
- IDF Dado Center, *Going on the Attack: The Theoretical Foundation of the IDF's
  Momentum Plan*: https://www.idf.il/en/mini-sites/dado-center/vol-28-30-military-superiority-and-the-momentum-multi-year-plan/going-on-the-attack-the-theoretical-foundation-of-the-israel-defense-forces-momentum-plan-1
  (English-fronted but quotes the Hebrew strategic vocabulary)
- **רֹאשׁ גָּדוֹל / רֹאשׁ קָטָן** — the slang pair; treated in:
  - Avi Shamir, "Rosh Katan", Times of Israel blog: https://blogs.timesofisrael.com/rosh-katan/
  - Quora translation thread (useful for the nuance Israelis *don't* explain to outsiders): https://www.quora.com/Hebrew-language-What-are-the-English-equivalents-to-the-Israeli-idioms-Rosh-Katan-Rosh-Gadol
- **אחריי** — the aharai command; HBS case (English) at the Case Centre link above.
- **תחקור** — sister whiteboard `iaf-tikkur/` carries the load on this one; named in our
  `tikur` skill.
- **הקונצפציה** — *ha-konseptsia*, the post-1973 term for the unitary-assumption failure
  mode; treated in the Brookings and Tikvah/Mosaic links above.
- **פיקוד ושליטה** (*pikud ve-shlita*) — sister whiteboard `posh-c2/` carries the load.

### Cross-references inside our corpus

- Principles 01–04 (`usegin/zettel/principles/`)
- z015 (pre-game manual), z020 (decision shape), z023 (charter), z026 (dilemma protocol),
  z028 (one shared brain), z029 (sub-Gins can't fan out), z036 (be laconic), z040
  (clusters emerge from threading), z057 (cluster as finding), z076 (rnd skill)
- Skills: `tikur`, `zettel-capture`, the in-flight `rnd` skill (z076)
- Memory: `feedback_liaison_fix_everything` (rosh-gadol completion bar), `feedback_no_speed_language`
  (Israeli combat doctrine actually *does* prize speed — but as decisive-victory tempo,
  not as cutting corners on rigor; the no-speed-language rule survives the IDF lens)
