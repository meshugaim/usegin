---
name: tikur
description: Run a post-mortem in the Israeli-Air-Force tarbut-ha-tikkur (תחקור) tradition — blameless in the room with consequences targeting the system, fact-first, error-vs-negligence categorical bright line, junior-speaks-first procedure, mandatory cluster check before declaring root cause, lekach (לקח) propagated to zettel + skill + hook + cluster the same turn. Use when something went wrong in a way that could recur — bad commit, lost work, broken push, agent collision, wrong-target deploy, anything we want never to happen again. Triggered by "tikur this", "post-mortem", "let's tichkur", "what went wrong", "root-cause this".
---

# Tikur (תחקור)

> **Speaker convention:** "Lihu" in this file is the *primary* speaker; the
> actual live user may be Oria, Lihu, or Nitsan. Check the LIVE USER banner /
> userEmail / in-chat signals before binding to a name (root `CLAUDE.md`
> "Live user — who's in the chat" precedence rule).

Israeli-Air-Force-style post-mortem. Lifted because their culture is the operational state-of-the-art for *learning from mistakes without punishing people*. The point is to change the system, not the person.

## When to run

Any incident with a recurrence vector. If "this could happen again to someone (or you) tomorrow," tikur it.

Examples that warrant a tikur:
- A commit landed with the wrong scope (other people's work under your message).
- A push went to the wrong branch.
- An agent overwrote another agent's work.
- A hook fired in a way that surprised us.
- A test passed when it shouldn't have / a check missed something it was supposed to catch.
- A rollback was needed and wasn't trivial.

Examples that do **not** warrant a tikur (just fix and move on):
- A typo, found before commit.
- A failing test you wrote and immediately corrected.
- A first-time investigation of new territory that didn't yield.

## Prerequisites — when *not* to run a tikur

A tikur only works if the room is honest. The room is honest only if:

1. **The highest-authority participant has, recently and visibly, debriefed their own mistake.** In our setup that's Lihu. If the recent pattern has been "Lihu prompts, UseGin executes, incidents are framed as UseGin's", the floor isn't actually zero. The IAF version: the squadron commander opens with *"today I failed because of my mistake"* — said in front of the squadron, first, before anyone else has framed. If Lihu hasn't done this recently, the tikur should *start* by asking "what was the prompt shape that produced this?" and treat Lihu's framing as part of the timeline, not above it.

2. **No participant fears reputational/career cost from in-procedure error.** UseGin can't be fired, so this is automatic on the agent side. For sub-agents and the consultant, ditto. For Lihu, the relevant question is whether his framing of the incident leaks blame onto a person — if so, the tikur is theater (per rule 1 reword). Stop and reset.

3. **The tape exists.** The IAF can't run a tikur without HUD video. We can't run one without git log/reflog, hook logs, agent JSONLs, Sentry, autosync logs, transcripts. If the evidence isn't gatherable, say so explicitly and either (a) gather it now or (b) record the incident as a near-tikur with the evidence-gap named, so future sessions can complete it.

If any prerequisite fails, the tikur produces noise, not learning. Name which one is failing and either fix it before continuing, or downgrade to a friction-zettel via `zettel-capture` and don't pretend a tikur happened.

## Error vs. Negligence — name the category before fixing

Before the five rules apply, classify the incident:

- **Error (שגיאה).** A mistake made in good faith, inside the procedure. The system permitted the wrong outcome. Examples in our world: autosync race interleaved two commits; CLI accepted an input shape it shouldn't have; hook fired in an order that surprised us; a sub-agent did the obvious thing for the obvious reason and it was wrong.
  → **The fix is to the system.** No social/process consequence.

- **Negligence (רשלנות).** A safeguard existed and was bypassed. The rule was there; someone (Lihu, UseGin, a sub-agent, a hook) didn't follow it. Examples: pushing without checking origin contents *after* the autosync fix landed; force-pushing main without explicit approval; resolving a git conflict silently when the rule says stop and show.
  → **The fix is to the system AND a hook/lint/CI assertion that makes the bypass impossible next time.** Per the `update-config` skill — the harness enforces, not the human.

Both categories are blameless *in the room*. Neither pilot is judged. The asymmetry is in the fix shape, not the social treatment.

If you can't tell which, default to error and look for the missing safeguard. *"We should have known better"* is not negligence — it's an absent guardrail, which is an error condition for the *system that should have had the guardrail.*

## The five rules

1. **Blameless in the room — consequences live elsewhere.** While the timeline is being reconstructed and the root cause is being chased, no participant is on trial. *"Claude is not careful"* / *"the user should have specified"* / *"the agent should have known"* — none of these are root causes; they are not actionable, and the next session will reproduce the same failure for the same systemic reason. The system permitted the failure; the system gets fixed.

   Consequences exist — but they target the system, not the person who tripped it. For an *error* (above), the consequence is a system change. For *negligence*, the consequence is a system change *plus* a hook/lint/CI assertion that makes the bypass impossible. Both are decided after root cause, not during the reconstruction.

2. **Facts before interpretations.** Reconstruct the timeline before reasoning about it. Evidence in the room before opinion in the room. Cite tape sources: git log, reflog, hook logs, agent JSONLs, Sentry, Playwright traces, autosync log. Interpretations come *after* the timeline is written.

3. **Five whys, but stop at the first one that gives you a lever.** "Why?" until the answer points at something you can change in code, config, or process. Beyond that, you are philosophizing.

4. **Output ≥ root cause + fix + system change + tripwire.** Every tikur produces:
   - Root cause: one sentence, systemic, at the *cluster* level if the cluster check (4.5) revealed one.
   - Immediate fix: what we do *right now* to undo the damage.
   - System change: the procedural/code/config update that prevents recurrence — committed the same turn.
   - Tripwire: how we'd notice if recurrence happened anyway.

5. **Distill to a zettel and route the lekach (לקח).** The lesson dies the moment it stays in the room. See step 6 below.

## Procedure

### 1. Stop digging

If the incident is still in motion (e.g., a bad push that hasn't propagated), pause first. Don't compound by improvising.

### 2. Write the timeline

Bulleted, timestamped where possible, present-tense. Each line is a fact you can point at evidence for. Keep it terse — the value is in completeness, not prose. Evidence in the room before opinion in the room. Cite tape sources: git log, reflog, hook logs, agent JSONLs, Sentry, Playwright traces, autosync log.

### 3. Five whys

Indent each "why" under the previous answer. Stop when the answer is a lever (a file you can edit, a setting you can change, a process you can introduce).

### 4. Pick the root cause

The deepest *leverable* answer in the chain. Phrase it as a systemic statement — "we lacked X" / "Y tool surface had property Z" — not "I forgot to."

### 4.5. Cluster check

Before locking in the root cause, search the corpus for the same area:

```bash
dx zettel list | rg <area-keyword>
rg <area-keyword> usegin/zettel/zettels/ .claude/tikur-records/
```

If 2+ prior tikurs or zettels touch this area, the root cause is the *cluster*, not this incident. Re-state the root cause at the cluster level (e.g., *"our autosync mechanism has 4 distinct failure modes — this is the 4th"*), and the system change targets the cluster (e.g., *"replace optimistic-concurrency push with fence-and-verify"*).

Don't skip this step because the incident "feels obvious." Three of the slice-1 friction zettels (z058, z059, z060) were each filed as standalone and only later recognized as a cluster about CLI-input validation. The cluster *was* the finding.

The standalone `cluster-search` skill packages this step for reuse outside of tikur.

### 5. Three fixes

- **Immediate:** what makes the user whole *now*. (revert, recommit, file the missing data, etc.)
- **System:** the change that prevents recurrence. Code, hook, doc, default. Land it the same turn.
- **Tripwire:** how we'd notice if recurrence happened anyway. Test, assertion, log line, manual check.

If "system" and "tripwire" feel skipped, the tikur isn't done.

### 6. Route the lekach (לקח)

A tikur produces a lesson. The lesson dies the moment it stays in the room. Route it — same turn, no "later" (z002):

- **Zettel.** `dx zettel add --as=usegin` with the lesson as the complete-claim title. Place it (`--placement`) and thread it (`--thread`) per z040.
- **Skill.** If the lesson touches an existing skill's behavior (e.g., *"the X skill should have caught this earlier"*), edit the skill in this same commit. Don't trust future-grep — the skill is the system, and the system gets fixed (rule 4).
- **Hook / config.** If the system change is enforceable (`update-config` skill territory — settings.json, a hook, a lint rule, a CI assertion), land the change in this commit too. The IAF installs procedure; we install hooks.
- **Cluster.** If step 4.5 found a cluster, write the meta-zettel naming it (z057 shape) — the cluster is a finding, not just a data point.

Cite the immediate-fix commit and the system-change commit by SHA in the zettel body.

### 7. Apply the immediate fix

Now — not later. (z002.) For destructive fixes (revert, force-push, dropping commits), confirm with Lihu first per CLAUDE.md.

## Format of a tikur record

Live at `.claude/tikur-records/YYYY-MM-DD-<slug>.md`. Append-only — never edit a record after it lands; if you learn more later, write a follow-up record threaded to the original.

```markdown
# Tikur: <one-line incident>

**Date:** YYYY-MM-DD
**Severity:** low | medium | high  (recurrence × blast-radius)
**Status:** open | fixed | system-fix-deferred
**Category:** error | negligence

## Timeline
**Tape sources:** git log/reflog, hook logs, agent JSONLs, Sentry, autosync log, …
- HH:MM — fact (cite source)
- HH:MM — fact (cite source)
- ...

## Five whys
- Why X? — A
  - Why A? — B
    - Why B? — C  ← root cause (this is leverable)

## Cluster check
Searched: <keyword>. Touches: <count>. <Standalone | Cluster — re-state>.

## Root cause
One sentence, systemic. At cluster level if cluster found.

## Fixes
- **Immediate:** what was done, commit SHA.
- **System:** what landed, commit SHA.   ← MUST be a real SHA OR Status flips to system-fix-deferred (see self-tripwire below).
- **Tripwire:** how recurrence is detected.

## Zettel
zNNN — title
```

## Self-tripwire — every record's `System:` field carries a commit SHA, or `Status: system-fix-deferred` with the named gap

Added 2026-04-28 after the multi-Gin-checkout-collisions tikur (see record of that date) found that the prior 2026-04-27 tikur identified the right fixes and *neither landed* before recurrence. Six follow-on incidents in 24h. The lesson: the tikur skill names same-turn propagation (rule 5 / step 6) but does not enforce it; the next prompt arrives, the discipline gets bypassed, the lekach dies in the room.

Enforcement lives in the record format itself. Two valid shapes only:

1. **`Status: fixed`** — the `System:` field cites a real commit SHA (`git rev-parse HEAD`-shaped). Future readers can verify the fix actually landed by `git show <sha>`.
2. **`Status: system-fix-deferred`** — the `System:` field names the gap explicitly: *what would have landed, what blocks it, who owns the unblock*. This is the honest alternative when the system fix is bigger than this turn (Lihu posture call, architectural decision, ≥ half-day work). It is **not** "I'll do it later" (z002 violation); it is "this is open, and here is the tracking artifact."

The status `open` is reserved for tikkurs still being authored *in this turn*. Any record left at `open` after the turn ends is itself a tikur trigger — the skill's failure mode being the next failure.

When you write a tikur:

- If you can land the system fix this turn, do it; cite the SHA.
- If you can't, name the gap and route to a distilled-question in the relevant CLOSE.md / Linear ticket / charter; cite that route in the `System:` line.
- Do not leave the `System:` field empty or hand-waved. Past tikurs that did this produced cluster recurrence; the cluster is the finding (rule 4.5).

The self-tripwire is verifiable manually today (read the record's `System:` line; check the SHA exists); a `dx tikur verify` primitive is a candidate skill-lab follow-up if recurrence persists.

## Anti-patterns

- *"Claude / I / oria forgot to X."* — name a system that doesn't rely on remembering.
- *"We'll be more careful next time."* — not a fix.
- *"Discussed in chat, will write up later."* — z002 violation, not a tikur.
- A tikur with only an immediate fix and no system change — half-done.
- Skipping the timeline because *"I remember what happened."* — interpretations contaminate evidence.
- *Treating one tikur as standalone when 3+ neighbors exist.* The cluster is the finding. (Step 4.5.)
- *Running a tikur with the senior voice framing first.* Anchoring kills the data. (See "Ranks" below.)
- *Routing around a harness denial instead of fixing it.* Per principle 12 — that's the institutional Befehlstaktik you came to fix. Tikur the denial; don't sneak past it.
- *Tikur whose system fix never lands becomes the next tikur's root cause.* Observed 2026-04-28 — six follow-on incidents inside 24h after a tikkur whose `System:` field said "lands this turn" and didn't. The fix is the self-tripwire above, not "be more disciplined."

## Ranks — equal in evidence, ordered in speech

There are no ranks in a tikur when reasoning about the system. Lihu, UseGin, sub-agents, the autosync hook — all equal participants when the incident is being reconstructed. The thing under examination is the system, and everyone in it (humans included) provides evidence and proposes fixes. Defer to facts, not roles.

But speaking order matters. Anchoring is the silent killer of honesty. The lowest-authority voice frames first; the highest-authority voice frames last. In our setup that means:

1. **Sub-agents and tool outputs** (logs, hook traces, git reflog) — first.
2. **UseGin's reconstruction** of the timeline — second.
3. **Lihu's framing** — last.

Reverse this and the lower-authority voices will re-tune to whatever Lihu/UseGin said first. The IAF's brigadier-base-commander gets debriefed by the lieutenant flight-leader; in our world, Lihu's prompt and Lihu's framing are inputs to the timeline, not its conclusion.

When Lihu's role is itself part of the incident — under-specified prompt, ambiguous direction, missing context — that's a leverable why and goes in the chain. The skill that owns the fix is usually `zettel-capture` or the relevant skill's first-response shape, not a personal correction.

## Threading
↑principle 05 (#8 error/negligence, #9 cluster, #11 blameless+ordered) · ~z023 · ~z029 · ~z030 · ~z040 · ~z057 · ~`update-config` skill · ~`cluster-search` skill · ~`zettel-capture` skill.
