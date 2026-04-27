# IAF Tikkur — תרבות התחקור

Professor: IAF / debriefing-culture
Charter: z075 (war-management R&D), 6th of 6 professors
Synthesis target: `usegin/research/war-management/SYNTHESIS.md`
Companion deliverable: `proposed-tikur-skill-enhancements.md` (this folder)

---

## TOP — distilled reading: 10 principles, each tied to a zettel or a `tikur`-skill enhancement

Each row: principle → IAF source/anchor → what we already have (zettel / skill) → what's missing in our `tikur` skill (the "enhancement" column says "skip" if our skill already carries it).

| # | Principle | IAF anchor | Our existing carrier | `tikur` skill enhancement |
|---|---|---|---|---|
| 1 | **Tape, not memory.** Reconstruct from objective recording (HUD video, comms) before anyone interprets. "I have yet to meet a pilot who lied in the post-flight review" works *because the tape is in the room.* | Lapidot, F-16 squadron study (DTIC); Kanor on TalentGrow ep. 92 ("8mm cameras… no one could manipulate") | `tikur` step 2 ("Write the timeline" with git log/reflog/hook logs/transcripts) | **Carried.** Make the wording sharper: "evidence in the room before opinion in the room." Add a `tape sources` checklist (git log, reflog, hook logs, agent JSONLs, Sentry, Playwright traces, autosync log) so the tape gets gathered, not assumed. |
| 2 | **Juniors speak first; commander speaks last.** Anchoring is the enemy of honesty. The squadron commander who says "today I failed because of mistakes I did" *after* the lieutenants have spoken — not before. | Paldi, TalentGrow ep. 92; Kanor (lieutenant flight-leader critiques brigadier base-commander) | `tikur` "Ranks: there are none" (line 115) — present in spirit, absent in procedure | **MISSING — proposed enhancement #1.** Add explicit speaking-order rule for multi-participant tikur (Lihu + UseGin + sub-agents + a reviewer agent): the lowest-authority voice frames first, the highest-authority voice frames last. In our setup: sub-agent → UseGin → Lihu, never the reverse. |
| 3 | **Error vs. negligence is a *bright line*, not a gradient.** An error made in good faith while flying the procedure is mandatory-to-surface and *socially safe*. A violation of the procedure (skipping a checklist, lying about altitude) is the only thing that gets you grounded. The two categories have *different social treatment*, and that difference is what makes honesty cheap. | Lapidot study's "Mastery Culture" + "Safety Culture"; Kanor's "$100 fine for going under minimum altitude" (procedure-violation, separate from in-procedure error) | Nothing explicit. Our zettels (z038, z058–z073, autosync collisions, slice-1 bugs in z074) are recorded as friction but never categorized error vs. negligence | **MISSING — proposed enhancement #2.** Add an `error-or-negligence` step to the procedure. Error = within the rules, system permitted it → tikur and fix the system. Negligence = rule existed, was bypassed → tikur PLUS the social/process consequence (e.g., the bypass becomes a hook that physically prevents recurrence, per `update-config` skill). The two outputs differ in *who owns the fix*. |
| 4 | **Mandatory documentation; lessons (לקחים) propagate beyond the room.** Every squadron has an officer whose job is to write the lekach and route it: same-squadron pilots, other squadrons flying the same airframe, IAF-wide where relevant. The lesson dies the moment it stays in the room. | "Each squadron has an officer responsible for documenting all the lessons" (multiple sources); IAF Facebook post on debrief-and-learn | `tikur` step 6 ("Distill into a zettel via `dx zettel add`") + `zettel-capture` skill — the substrate exists | **MISSING — proposed enhancement #3.** The propagation step is implicit. Add an explicit "route the lekach": (a) zettel in the corpus, (b) thread to neighbors per z040, (c) if it touches a skill, edit the skill same-turn (don't trust future grep), (d) if it touches a hook/config, land the change same commit. Today our `tikur` lands a zettel; it doesn't enforce the *propagation up and out*. |
| 5 | **Time-bounded, immediate, ritual.** Debrief happens *as close to the event as possible*, not "we'll write it up later." Squadron daily rhythm: morning briefing → flights → evening debrief, every day, no exceptions. Ritual beats inspiration. | Shamaym debrief guide; multiple ep. 92 transcripts; "every flight starts with a briefing and ends with a debriefing" | z002 (never-later) — the principle is in the corpus | **Carried in spirit.** Sharpen `tikur` step 7 ("Apply the immediate fix — *now*, not later. (z002.)") to extend to the *whole tikur*: the tikur itself is an immediate-fix artifact. Anti-pattern "Discussed in chat, will write up later" already names this — keep it, raise it to the top of the procedure. |
| 6 | **Three-question backbone.** The IAF doesn't fan out into 27 frameworks. It asks three: *What happened? Why did it happen? What do we do differently next time?* Anything that doesn't fit one of those three is preamble. | Shamaym blog; Inbal Arieli; Paldi | `tikur` has timeline + five-whys + three-fixes — richer, but the same backbone | **Carried with one tweak.** Our five-whys is good (rule 3 — "stop at the first lever"); make sure the *three-question scaffold* is visible at the top of the tikur record template, so the artifact reads as IAF, not as Toyota. The five-whys lives *inside* "Why did it happen?", not as its own section. |
| 7 | **Blameless ≠ accountability-less.** "Don't judge the person, judge the situation — it might be you next time" coexists with "if you don't do it, you won't make any mistakes" (Inbal Arieli) and the $100 minimum-altitude fine (Kanor). Blamelessness is about the *room*, not the *consequences*. The pilot who breaks an altitude floor still pays. The pilot who *errored within the floor* is helped. | Shamaym; Paldi; Kanor | `tikur` rule 1 ("Blameless") — present, but reads as "no consequences anywhere", which is a weaker claim than the IAF's | **MISSING — proposed enhancement #4.** Reword rule 1: "Blameless in the room — the timeline is fact-finding, not adjudication. Consequences (procedural, hook-installation, agent-deprecation) are decided *separately* from the tikur, *after* root cause is settled, and they target the *system*, not the person who tripped it." Pair with #3's error/negligence split. |
| 8 | **Shared honesty depends on *no exceptions for rank*.** The base commander's mistake is debriefed by the lieutenant. If even one rank gets a pass, every junior recalibrates and the data dries up. The culture dies on the first protected mistake. | Kanor (brigadier debriefed by lieutenant flight-leader); Paldi (50 pilots, commander says "I failed today") | z023 (spawn-as-instantiation — agents are equal participants); `tikur` "Ranks: there are none" | **Carried — needs an operational hook.** Add to the procedure: when Lihu is in the tikur, his decisions and his prompts are *also* subject to root-cause analysis. ("Why did the user prompt under-specify X?" is a leverable why if the answer is "because UseGin's first-response shape didn't surface the missing context.") The skill currently lets Lihu's role float above the timeline; that's the rank-protection failure mode. |
| 9 | **The cluster is a finding.** Three errors in the same area = a systemic signal, not three independent incidents. The IAF's documentation officer routes patterns, not just events. | Lapidot study's "Mastery Culture"; Shamaym AI-database aggregation | z057 (frustration cluster), z048 (DX-of-DX is the signal), z040 (clusters emerge from threading) | **MISSING — proposed enhancement #5.** Add a tikur step: "Before declaring root cause, search the corpus (`rg`, `dx zettel list`) for the same area. If 2+ prior tikurs/zettels touch it, the root cause is the *cluster*, not this incident." Today our skill treats each tikur as standalone; the IAF's documentation officer doesn't. |
| 10 | **Ground prerequisite: psychological safety is *load-bearing infrastructure*, not a vibe.** Airlines and hospitals copied the *form* (CRM, TeamSTEPPS, AAR) and got partial results because the *cultural bedrock* — leaders publicly debriefing their own mistakes first, no career penalty for in-procedure error, no exceptions for rank — didn't transplant. Form without bedrock is theater. | Wikipedia CRM; PMC TeamSTEPPS systematic review (48% of CRM trainings couldn't even reproduce their own keywords); Weick & Sutcliffe HRO principles ("deference to expertise", "preoccupation with failure") | Implicit across our usegin principles, never named | **MISSING — proposed enhancement #6.** Add a "prerequisites" section to the skill: a tikur is *only* valid if (a) the highest-authority participant has debriefed their own mistake at least once recently, (b) no participant fears career/reputation cost from in-procedure error. If either is false, the tikur is theater — say so and don't run it. For UseGin: (a) maps to Lihu volunteering "I prompted unclearly here" mid-tikur; (b) is automatic since UseGin can't be fired. |

---

## MIDDLE — the doctrine

### What `tarbut ha-tikkur` actually is

תרבות התחקור — *culture of debriefing*. Not a process. A culture. The IAF inherited the *form* of post-flight debriefing from the British RAF in the late 1940s and spent the next ~70 years turning it from a procedure into the operational bedrock of the force. Accident rate fell ~95% over that arc (Shamaym claim, widely cited). Every squadron does it. Every flight. Every day. Every rank. Every time.

The *tikkur* (תחקור) is the unit ritual. *Tarbut ha-tikkur* (תרבות התחקור) is the surrounding cultural envelope that makes the unit ritual produce truth.

### The squadron-level ritual

The standard rhythm:

1. **Morning briefing** — squadron sets the day's goals, assigns the missions, names the success criteria.
2. **The flight / sortie** — recorded. HUD video, comms tape, mission data — everything the aircraft can record, the aircraft records.
3. **Land, hand in the cassette** (historically) / **upload data** (currently). Mission Support Crew prepares the playback.
4. **Debrief** — convened immediately, before the day moves on. Senior pilot facilitates (not "leads" — facilitates). Tape is rolled. The pilots speak in order: junior first, senior last. Each segment of the tape produces three questions:
   - What happened? (Facts only. No interpretation. Tape arbitrates.)
   - Why did it happen? (Causes. Contributing factors. Where the procedure helped or didn't.)
   - What do we do differently next time? (Action items. Specific. Owned by name.)
5. **Lesson capture** — the squadron has an officer whose actual job is documenting the lekachim. The lekach gets routed: pilots who weren't in this debrief but fly the same airframe; other squadrons; IAF-wide if the lesson generalizes.
6. **The next morning's briefing** opens with yesterday's lekachim that touch today's missions. The loop closes.

Time-box: 30 minutes for a routine sortie, hours for a complex operation. **Always immediate.** "We'll do it tomorrow" is not a thing.

### Truth before rank

The institutional protections that make this safe:

- **The tape is the authority.** When a junior officer corrects a senior, they aren't asserting their rank against the senior's — they're pointing at a frame of video. The locus of authority shifts from human-to-human (which is rank-asymmetric) to human-to-evidence (which is rank-symmetric).
- **The senior speaks last.** Anchoring is poison. If the brigadier opens with "I think what went wrong was X", every lieutenant in the room re-tunes their own observation toward X. Reversing the speaking order forces the senior to *hear before judging*. This is procedural; it's not optional.
- **Leaders model first.** The squadron commander who debriefs their own mistake — publicly, first, before any subordinate has done so — establishes that the floor is genuinely zero. Paldi: "Today we failed a mission because of mistakes *I* did." Said by the commander, in front of 50 pilots. That sentence is the entire bedrock in seven words.
- **Career consequences are decoupled from in-room honesty.** A pilot who makes an in-procedure error and surfaces it gets help. A pilot who *hides* an in-procedure error and gets caught (the tape always wins) is on a track that does affect their career. The asymmetry is the incentive structure: honesty is cheap, concealment is expensive.

### Mandatory documentation

The lekach (לקח, "lesson") is not a byproduct. It is the *output*. A tikkur that produces only a corrected-pilot and no lekach has failed. The documentation officer is a real role with real time allocated.

Lekachim propagate via:
- **Squadron archive** — every lekach kept, indexed.
- **Cross-squadron routing** — same-airframe squadrons receive lessons that touch the airframe.
- **IAF-wide** — generalizable lessons (procedure changes, training updates) go to the IAF safety/training apparatus, which folds them into doctrine.
- **Re-surfacing** — the next morning, the relevant prior lekachim show up in the briefing for that day's missions.

In Shamaym (the commercial spinoff that markets the methodology to corporates), this is automated: lessons are stored, AI-tagged, and re-surfaced at the moment a similar mission is being briefed. The form-factor varies; the *function* — lessons resurface at the moment of need — is the load-bearing piece.

### Why airlines and NASA copied it — and where they failed

What they copied:
- Crew Resource Management (CRM) in commercial aviation, started post-Tenerife/United-173 in the late 1970s — explicitly modeled on the IAF/military debrief idea.
- After Action Reviews (AAR) in US Army, which the Army then exported to the corporate world (and which Inc. magazine etc. wrote up endlessly).
- TeamSTEPPS in healthcare — AHRQ's adaptation for hospitals.
- NASA's LOS (Line-Oriented Simulation) debriefing protocol.

What they got: ~30–50% of the safety benefit (CRM in aviation cut accident rate substantially — not as much as IAF's ~95%, but real). In healthcare: a PMC systematic review found 48% of CRM-in-healthcare interventions couldn't even reproduce their own training keywords. The form spread, the bedrock didn't.

What didn't transplant:
- **Leaders modeling first.** Hospital department heads do not, as a rule, open M&M conferences with "today my decision killed a patient." Airline captains' debriefs are run with the captain as authority figure, not as junior-speaks-first reversal.
- **Error/negligence bright line.** Hospital culture treats *all* error as career-adjacent. Airline pilots have ASRS (NASA's anonymous reporting system) precisely because the in-room culture isn't safe enough — they need an out-of-band channel. The IAF doesn't need one because the in-room channel works.
- **Mandatory immediacy.** AAR in corporate settings becomes a quarterly retrospective, not an after-every-sortie ritual. The cadence collapses.
- **Documentation officer.** No one's job. Lessons get written into Confluence pages no one re-reads.

The pattern: the form is cheap to copy; the bedrock requires sustained leadership behavior across years. Most adoptions get the form and stall.

### The mistake economy

The IAF makes a *categorical* distinction:

- **שגיאה (sh'gi'a) / "error"** — a mistake made in good faith, while inside the procedure. The pilot was trying to do the right thing, the system permitted the wrong outcome. *Mandatory to surface. Socially safe. Produces a lekach. The fix is to the system.*
- **רשלנות (reshlanut) / "negligence"** — a violation of the procedure. The rule existed, the pilot bypassed it. *Mandatory to surface. Carries a procedural consequence (Kanor's $100 fine, or grounding, or career impact for repeated violations). Produces a lekach AND an enforcement step.*

Two distinct social treatments. The pilot who errored in good faith is the *resource* — their honesty is what makes the squadron learn. The pilot who was negligent is in a *different conversation*, run on a different track, often by different people.

This is what makes the in-room culture cheap: a pilot weighing "should I admit this?" knows the answer is yes *and* knows the in-room cost is zero. They are not weighing career risk against learning value; they are just talking.

### Failure mode — how the culture dies when transplanted poorly

The culture dies when *one* of the bedrock conditions silently fails:

1. **A protected mistake.** A senior officer's mistake is debriefed without consequence-symmetry, or a senior officer's debrief is run with them speaking first. Every junior in the room recalibrates. The data dries up within ~3 sessions.
2. **Career consequences leak into in-room honesty.** Once a pilot's promotion has been visibly affected by a debrief admission, the asymmetry inverts. The room becomes a courtroom. Pilots start "negotiating with surroundings" about what to share (Lapidot's "Cloaking Culture" finding).
3. **Cadence collapse.** Debrief becomes weekly, then monthly, then "after incidents." Without daily-ritual cadence, the muscle atrophies — pilots stop reflexively assuming the room exists, and the room stops being the room.
4. **Lessons stop propagating.** The lekach lands in a binder no one re-reads. Future pilots re-learn the same lessons by repeating the same mistakes. This is the Yom Kippur 1973 failure mode — pre-war IAF lekachim about SAM threat existed, didn't make it into operational doctrine fast enough.
5. **Form without bedrock.** This is the airline/hospital story: the AAR template is followed, the words are said, but the leader doesn't model first, the speaking order isn't reversed, and consequences leak. The artifact exists; the learning doesn't.

The ground prerequisite — what has to be true *before* the form works:

- A leader willing to publicly debrief their own mistakes, repeatedly, visibly, first.
- An organizational commitment that in-procedure error is a cost of operating, not a personal failing.
- A real role/time-allocation for the documentation officer (or its automated equivalent).
- A cadence enforced by ritual, not by inspiration.
- Tools that produce evidence the room can point at (the tape).

If any one of these is missing, the imported form will produce noise, not learning.

---

## Application to UseGin / our team

Our `tikur` skill is *not* a pale imitation — it carries most of the doctrine. The five rules + procedure + record format already encode: blameless (rule 1), facts-before-interpretation (rule 2), root cause + leverage (rule 3), three fixes (rule 4 — immediate / system / tripwire, which is *richer* than IAF's three questions), zettel propagation (rule 5), and rank suspension (the closing "Ranks" paragraph).

What's missing — six gaps mapped above (#2, #3, #4, #7 reword, #9, #10), all detailed with proposed wording in the companion file `proposed-tikur-skill-enhancements.md`. The biggest is #3: error vs. negligence, because it's what makes everything else work. Without it, we treat the autosync collisions, the slice-1 bugs, the consultant being walled, etc., all the same way — as "friction." The IAF would categorize:

- **Autosync concurrent collisions** (`reference_autosync_concurrent_collisions`): *error.* The system permitted two concurrent commits to interleave. Fix is the system (better fencing in the autosync hook, post-push verification of origin/main contents). No one was negligent.
- **Slice-1 bugs caught in dogfood** (z058–z064, summarized in z074): *error.* The CLI shape didn't validate inputs that turned out to need validation. Fix is the system (validators, normalizers landed in the slice-1 fixes commit). No one was negligent.
- **Consultant walled** (z030 — harness blocked deliverable write): *error.* The harness's permission model didn't anticipate the consultant's writing surface. Fix is the system (settings.local.json grant, or moving the consultant's write surface).
- **A hypothetical case of negligence in our world**: an agent that knew the autosync race was open and committed-then-pushed-without-checking-origin-after-the-fix-landed. That's the bypass. The system change there is to install a hook that physically prevents the bypass (per `update-config` skill).

The framing matters because it changes *who owns the fix*. Errors → the tikur produces a system change, owned by whoever maintains that system. Negligence → the tikur produces a system change AND a hook/lint/CI assertion that makes the bypass impossible next time. Both are "blameless" in the room. The fix shape differs.

The other big enhancement is #4 (mandatory documentation propagation). We have the substrate (`zettel-capture` is excellent for this — it's already a *tikkur substrate*, every friction event is a לקח waiting to be filed, the autonomy clause means UseGin doesn't need permission). What's missing in `tikur` is the *propagation step*: when a tikur produces a lesson, the skill should require that the lesson lands in (a) a zettel, (b) the relevant skill (edited same-turn), (c) the relevant hook/config (committed same-turn), and (d) the relevant cluster (threaded per z040). Today the skill only requires (a).

---

## BOTTOM — sources

Canonical (read these first):
- **Lapidot, Offer (1988).** *Debriefing Process for the Maintenance Sections of the Israeli Air Force fighter squadrons.* DTIC ADA205695 / Internet Archive. The academic paper, written from inside the IAF, that describes the squadron-level ritual end-to-end. Originator academic source. https://apps.dtic.mil/sti/tr/pdf/ADA205695.pdf
- **"Organizational Learning Through Debriefing: The Process of Sharing and Hiding Knowledge"** — Scandinavian Journal of Military Studies. The most rigorous outside-academic look at IAF F-16 squadron debriefs. Sources for "I have yet to meet a pilot who lied" and the four-cultures framework (Mastery / Safety / Performance / Cloaking). https://sjms.nu/articles/10.31374/sjms.54
- **TalentGrow Podcast ep. 92** — Ofir Paldi (former IAF squadron commander, founder of Shamaym) on the culture from inside. Best for the speaking-order-reversal anecdote and the commander-debriefs-self-first ritual. https://www.talentgrow.com/podcast/episode92
- **Shamaym debriefing methodology** — the commercial-export form. Useful for the three-question backbone, the propagation system, and seeing what survives when the IAF method is repackaged for corporate. https://www.shamaym.com/blog/what-is-debriefing/

Useful secondary:
- **Inbal Arieli — "How Debriefing Like the Israeli Air Force Can Help your Business."** Best concise statement of "Don't judge the person — judge the situation, it might be you next time" + "If you don't do it then you won't make any mistakes" + the "resist and obey" rule. https://chutzpahcenter.com/how-debriefing-like-the-israeli-air-force-can-help-your-business/
- **CUFI / Inbal Arieli reprint.** Same content, easier to read. https://cufi.org/issue/debriefing-like-israeli-air-force-can-help-business/
- **Kanor on TalentGrow ep. 92** (same episode as Paldi, second guest) — the "$100 fine for going under minimum altitude" and the "lieutenant flight-leader critiques brigadier base-commander" anecdotes. The clearest extant anecdotes of error/negligence asymmetry and rank suspension.
- **Israeli Air Force Facebook post** — "There's no better way to improve and prepare for the future than to debrief and learn." Official-voice confirmation of the daily ritual cadence. https://www.facebook.com/IsraeliAirForce.EN/posts/4435828026460135/

For the comparative / failure-mode analysis:
- **Weick, Karl E. & Sutcliffe, Kathleen M. — *Managing the Unexpected* (HRO theory).** The five HRO principles (preoccupation with failure, reluctance to simplify, sensitivity to operations, commitment to resilience, deference to expertise) are the academic frame that explains *why* the IAF method works. https://www.high-reliability.org/the-five-principles-of-weick-sutcliffe
- **Crew Resource Management (CRM) — Wikipedia + SKYbrary.** The aviation copy. Useful to see what the airlines kept and what they dropped. https://en.wikipedia.org/wiki/Crew_resource_management
- **TeamSTEPPS in healthcare — PMC systematic review (PMC6410092).** "48% did not explain any keyword of their CRM intervention to a reproducible detail." Best single data point for "form without bedrock." https://pmc.ncbi.nlm.nih.gov/articles/PMC6410092/

Hebrew-source canonical (not retrieved this session — flagging for follow-up):
- **Yotam Yair** — referenced in the charter as canonical Hebrew-language writer on IAF culture. WebSearch did not surface his work in English-indexed sources this session. Flagging as a follow-up: a Hebrew-source pass on Yair's writing would be a high-value second iteration on this whiteboard. Likely lives in IAF Magazine (`Bitaon Heyl Ha-Avir` / ביטאון חיל האוויר) and Maarachot (`מערכות`, the IDF doctrine journal).
- **Maarachot / מערכות** — the IDF's own doctrine journal. Primary source for any future deep-dive.
