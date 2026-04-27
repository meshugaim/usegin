# Proposed enhancements to `.claude/skills/tikur/SKILL.md`

Source: `usegin/research/war-management/iaf-tikkur/whiteboard.md` — see for the full doctrinal grounding.

The `tikur` skill is *not* a pale imitation of IAF tarbut ha-tikkur. It carries blamelessness (rule 1), facts-before-interpretation (rule 2), root cause + leverage (rule 3), three fixes (rule 4 — richer than the IAF's three questions), zettel propagation (rule 5), and rank suspension (closing paragraph).

Six enhancements close the remaining gaps. Listed in priority order. Each one names: the gap, the proposed text, and where it inserts in the existing skill.

The orchestrator (Lihu) gates the actual edit. This file is the proposal; the live skill stays untouched until reviewed.

---

## Enhancement #1 (HIGHEST PRIORITY) — Error vs. Negligence

**Gap.** The skill treats every incident the same way. The IAF treats *error* (in-procedure mistake) and *negligence* (procedure bypass) as categorically different — same in-room blamelessness, different fix shape, different ownership. Without this split, our zettels record friction without naming whether the system permitted it (autosync collisions, slice-1 bugs) or someone bypassed an existing safeguard. The fix shape is genuinely different.

**Insertion point.** New section between "When to run" and "The five rules". Also new field in the record format.

**Proposed text:**

```markdown
## Error vs. Negligence — name the category before fixing

Before the five rules apply, classify the incident:

- **Error (שגיאה).** A mistake made in good faith, inside the procedure. The
  system permitted the wrong outcome. Examples in our world: autosync race
  interleaved two commits; CLI accepted an input shape it shouldn't have;
  hook fired in an order that surprised us; a sub-agent did the obvious
  thing for the obvious reason and it was wrong.
  → **The fix is to the system.** No social/process consequence.

- **Negligence (רשלנות).** A safeguard existed and was bypassed. The rule
  was there; someone (Lihu, UseGin, a sub-agent, a hook) didn't follow it.
  Examples: pushing without checking origin contents *after* the autosync
  fix landed; force-pushing main without explicit approval; resolving a
  git conflict silently when the rule says stop and show.
  → **The fix is to the system AND a hook/lint/CI assertion that makes the
  bypass impossible next time.** Per the `update-config` skill — the
  harness enforces, not the human.

Both categories are blameless *in the room*. Neither pilot is judged.
The asymmetry is in the fix shape, not the social treatment.

If you can't tell which, default to error and look for the missing
safeguard. "We should have known better" is not negligence — it's an
absent guardrail, which is an error condition for the *system that
should have had the guardrail.*
```

In the record format, add:

```markdown
**Category:** error | negligence
```

---

## Enhancement #2 — Speaking order: junior first, senior last

**Gap.** Our skill says "There are none [no ranks]" (line 115), which is the *spirit*. The IAF makes it *procedural*: the lowest-authority voice frames the timeline first; the commander speaks last. Without this, even a "blameless" room anchors on whoever spoke first — which, in our setup, is usually Lihu or main-thread UseGin.

**Insertion point.** Replace/expand the closing "Ranks" paragraph (line 113–115).

**Proposed text:**

```markdown
## Ranks — equal in evidence, ordered in speech

There are no ranks in a tikur when reasoning about the system. Lihu,
UseGin, sub-agents, the autosync hook — all equal participants when the
incident is being reconstructed. The thing under examination is the
system, and everyone in it (humans included) provides evidence and
proposes fixes. Defer to facts, not roles.

But speaking order matters. Anchoring is the silent killer of honesty.
The lowest-authority voice frames first; the highest-authority voice
frames last. In our setup that means:

1. Sub-agents and tool outputs (logs, hook traces, git reflog) — first.
2. UseGin's reconstruction of the timeline — second.
3. Lihu's framing — last.

Reverse this and the lower-authority voices will re-tune to whatever
Lihu/UseGin said first. The IAF's brigadier-base-commander gets debriefed
by the lieutenant flight-leader; in our world, Lihu's prompt and Lihu's
framing are inputs to the timeline, not its conclusion.

When Lihu's role is itself part of the incident — under-specified prompt,
ambiguous direction, missing context — that's a leverable why and goes
in the chain. The skill that owns the fix is usually `zettel-capture` or
the relevant skill's first-response shape, not a personal correction.
```

---

## Enhancement #3 — Reword "Blameless" to separate room from consequences

**Gap.** Rule 1 currently reads as "no consequences anywhere," which is a weaker (and less defensible) claim than the IAF's. The IAF runs blameless *in the room* — consequences (procedural enforcement, hook installation) are decided *separately*, *after* root cause is settled.

**Insertion point.** Replace rule 1 of "The five rules" (line 29).

**Proposed text:**

```markdown
1. **Blameless in the room — consequences live elsewhere.** While the
   timeline is being reconstructed and the root cause is being chased,
   no participant is on trial. "Claude is not careful" / "the user
   should have specified" / "the agent should have known" — none of
   these are root causes; they are not actionable, and the next session
   will reproduce the same failure for the same systemic reason.
   The system permitted the failure; the system gets fixed.

   Consequences exist — but they target the system, not the person who
   tripped it. For an *error* (see Error vs. Negligence above), the
   consequence is a system change. For *negligence*, the consequence is
   a system change *plus* a hook/lint/CI assertion that makes the bypass
   impossible. Both are decided after root cause, not during the
   reconstruction.
```

---

## Enhancement #4 — Mandatory propagation of the lekach

**Gap.** Step 6 ("Zettel and thread") covers the corpus landing. The IAF's documentation officer routes the lekach further: same-airframe squadrons, IAF-wide where relevant, into doctrine. Our skill stops at the zettel. If a tikur teaches a lesson that should change a *skill* or a *hook*, the skill doesn't currently require those edits in the same turn.

**Insertion point.** Replace step 6 ("Zettel and thread", line 65–66) with a richer step.

**Proposed text:**

```markdown
### 6. Route the lekach (לקח)

A tikur produces a lesson. The lesson dies the moment it stays in the
room. Route it — same turn, no "later" (z002):

- **Zettel.** `dx zettel add --as=usegin` with the lesson as the
  complete-claim title. Place it (`--placement`) and thread it
  (`--thread`) per z040.
- **Skill.** If the lesson touches an existing skill's behavior
  (e.g., "the X skill should have caught this earlier"), edit the
  skill in this same commit. Don't trust future-grep — the skill is
  the system, and the system gets fixed (rule 4).
- **Hook / config.** If the system change is enforceable
  (`update-config` skill territory — settings.json, a hook, a lint
  rule, a CI assertion), land the change in this commit too. The IAF
  installs procedure; we install hooks.
- **Cluster.** Search the corpus (`rg`, `dx zettel list`) for the same
  area. If 2+ prior tikurs/zettels touch it, write a meta-zettel
  naming the cluster (z057) — the cluster is a finding, not just a
  data point.

Cite the immediate-fix commit and the system-change commit by SHA in
the zettel body.
```

---

## Enhancement #5 — Cluster check before declaring root cause

**Gap.** Each tikur today is treated as standalone. The IAF documentation officer routes patterns. Three errors in the same area is a different finding than three independent incidents.

**Insertion point.** New step 4.5, between "Pick the root cause" and "Three fixes".

**Proposed text:**

```markdown
### 4.5. Cluster check

Before locking in the root cause, search the corpus for the same area:

```bash
dx zettel list | rg <area-keyword>
rg <area-keyword> usegin/zettel/zettels/ .claude/tikur-records/
```

If 2+ prior tikurs or zettels touch this area, the root cause is the
*cluster*, not this incident. Re-state the root cause at the cluster
level (e.g., "our autosync mechanism has 4 distinct failure modes —
this is the 4th"), and the system change targets the cluster (e.g.,
"replace optimistic-concurrency push with fence-and-verify").

Don't skip this step because the incident "feels obvious." Three of
the slice-1 friction zettels (z058, z059, z060) were each filed as
standalone and only later recognized as a cluster about CLI-input
validation. The cluster was the finding.
```

---

## Enhancement #6 — Prerequisites: when *not* to run a tikur

**Gap.** The "When to run" section names *which incidents* warrant a tikur. It doesn't name the *cultural prerequisites* that have to be true for the tikur to produce truth. Without them, the form runs and the bedrock isn't there — same failure mode that hospitals and airlines hit when they imported CRM/AAR.

**Insertion point.** New section after "When to run", before "The five rules".

**Proposed text:**

```markdown
## Prerequisites — when *not* to run a tikur

A tikur only works if the room is honest. The room is honest only if:

1. **The highest-authority participant has, recently and visibly,
   debriefed their own mistake.** In our setup that's Lihu. If the
   pattern this session has been "Lihu prompts, UseGin executes,
   incidents are framed as UseGin's", the floor isn't actually zero.
   The IAF version of this: the squadron commander opens with "today
   I failed because of *my* mistake" — said in front of the squadron,
   first, before anyone else has framed. If Lihu hasn't done this
   recently, the tikur should start by asking "what was the prompt
   shape that produced this?" and treating Lihu's framing as part of
   the timeline, not above it.

2. **No participant fears reputational/career cost from in-procedure
   error.** UseGin can't be fired, so this is automatic on the agent
   side. For sub-agents and the consultant, ditto. For Lihu, the
   relevant question is whether his framing of the incident leaks
   blame onto a person — if so, the tikur is theater (per rule 1
   reword). Stop and reset.

3. **The tape exists.** The IAF can't run a tikur without HUD video.
   We can't run one without git log/reflog, hook logs, agent JSONLs,
   Sentry, autosync logs, transcripts. If the evidence isn't gatherable,
   say so explicitly and either (a) gather it now (z029 — pre-decompose
   the gathering) or (b) record the incident as a near-tikur with the
   evidence-gap named, so future sessions can complete it.

If any prerequisite fails, the tikur produces noise, not learning. Name
which one is failing and either fix it before continuing, or downgrade
to a friction-zettel via `zettel-capture` and don't pretend a tikur
happened.
```

---

## Cross-cutting wording tweaks (smaller)

- **Step 2 ("Write the timeline")**: add a sentence — "Evidence in the room before opinion in the room. Cite tape sources: git log, reflog, hook logs, agent JSONLs, Sentry, Playwright traces, autosync log."
- **The record-format template (line 76–103)**: add `Category: error | negligence` field and a `Tape sources:` line under Timeline.
- **Anti-patterns (line 105–111)**: add — "*Treating one tikur as standalone when 3+ neighbors exist.* The cluster is the finding. (Enhancement #5.)"
- **Anti-patterns**: add — "*Running a tikur with the senior voice framing first.* Anchoring kills the data. (Enhancement #2.)"

---

## What the enhanced `tikur` skill carries that the original didn't

| IAF principle | Original skill | Enhanced skill |
|---|---|---|
| Tape, not memory | partial (timeline) | sharpened (tape sources checklist) |
| Junior speaks first | implicit ("no ranks") | procedural (#2) |
| Error vs. negligence bright line | absent | explicit (#1, #3) |
| Mandatory documentation propagation | partial (zettel only) | full (zettel + skill + hook + cluster) (#4) |
| Time-bounded immediacy | carried (rule 4 + z002) | carried |
| Three-question backbone | richer (timeline + 5 whys + 3 fixes) | carried |
| Blameless ≠ accountability-less | conflated | separated (#3) |
| No exceptions for rank | spirit | operational (#2 + Lihu's role in timeline) |
| Cluster is a finding | absent | explicit (#5) |
| Cultural prerequisites | absent | explicit (#6) |

Net: 6 substantive enhancements, all mapped to specific IAF doctrine, all already supported by our existing substrate (zettels, `zettel-capture`, `update-config`, `dx zettel add`). Nothing in the proposal requires new tooling — the substrate is in place; what's missing is the skill text that names the discipline.
