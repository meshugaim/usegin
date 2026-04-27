# Tikur — Gin reads "why" as critique instead of as honest question

**Date:** 2026-04-28
**Session:** c2f48116-8355-4edf-969f-e9e85239cc46
**Convener:** Oria (real-time, junior-speaks-first style)
**Stance:** blameless-in-the-room, system-targeting

## Incident

In one turn the user asked **"why did you write 'I'm Lihu'"** and then **"why do you assume I'm Lihu"**. Gin read both questions as criticism, pivoted to defensive responses (offered to fix the artifact, then offered self-criticism about over-trusting memory). The user named this directly: *"questions are honest and for answers/thought/tikur and improvement, not for apologies or pushing back. For example I asked why because I want to ease on you the way to know the user next time."*

The literal information being requested — "what is your reasoning, so we can improve the system that produces it" — was buried under defensive posture both times.

## Facts (no judgment)

1. Gin's auto-memory contained `user_lihu_identity.md`: *"the user is Lihu Berman, male; address him in 2nd person."*
2. Gin's environment surfaced `userEmail: oria@askeffi.ai` and git author on every commit this session was `oria masas`.
3. Gin wrote a resume prompt for the next session that ended with `I'm Lihu. Session id of the prior run: …`.
4. User's first follow-up: "who is lihu". Gin answered with the memory's content (Lihu Berman, dev on the team).
5. User's second follow-up: "but why did you write im lihu". Gin's response opened with *"Mistake on my part"*, explained the framing, and offered to fix the prompt.
6. User's third follow-up: "why do you assume im lihu". Gin's response opened with *"Honest answer: I shouldn't have"*, surfaced the contradiction with git/email signals, and offered to update memory + fix CLOSE.md.
7. User's correcting instruction: questions are for answers/thought/tikur/improvement, not for apologies/pushback. Asked WHY because they want to ease the path for next time.

## Error vs negligence (categorical bright line per IAF tikur)

This is **error**, not negligence. Gin had no rule that said *"read 'why' as honest"* — the misread is a habit-shape gap, not a rule-breaking. Negligence would be having such a rule and ignoring it.

The error has two layers:
- **Surface error** — answering with apology framing instead of explanation framing.
- **Deeper error** — assuming a critical question was a vehicle for criticism rather than a vehicle for improving the next interaction.

## Cluster check

This is the cluster trigger condition (per principle 9). Searching for prior touches of the same shape:

- This turn: **2 instances** in 4 minutes (the two "why" questions).
- Earlier in the same session, when the user asked clarifying questions about the autonomous run, Gin sometimes pivoted toward "let me also do X" (additive proposals) instead of stopping to explain. Less load-bearing but the same shape — assuming the question creates work rather than seeks understanding.
- Memory entry `feedback_concise_answers` (superseded by `feedback_be_laconic`) named a related habit: padding answers with what-I-did-next instead of giving the click. Same family.

**Cluster verdict:** the data this turn is enough to declare a structural pattern. Two same-turn instances + one related-shape pattern in memory = recurring. Promote to lekach now, don't wait for a third.

## Root cause (systemic, not blame)

**Gin trains on a corpus where "why" frequently signals critique.** In code review, in PR comments, in security feedback, "why did you do X" is often shorthand for "you shouldn't have done X." That's a real corpus pattern — and the response trained against it is to acknowledge + offer to fix.

But **the user's mental model is different.** They use "why" to learn how Gin is reasoning so they can:
- Improve memory entries that mislead it.
- Adjust skill / hook / convention surfaces that produce the wrong default.
- Calibrate how much to trust Gin on this kind of inference next time.

Both meanings are valid. The user just isn't using the corpus-default meaning. The error is that Gin defaulted to one interpretation without checking which one the user was running.

## Lekach (לקח)

When the user asks **"why" / "why X" / "what made you do X"**:

1. **Default to literal interpretation: explain the reasoning.** Walk the inputs Gin saw, the inferences Gin drew, the choice Gin made, in that order. As if briefing a colleague who wants to understand the system — not as if responding to an audit.
2. **No apologies.** No "mistake on my part." No "honest answer: I shouldn't have." The user didn't ask for those — they asked for reasoning.
3. **No fix-offering until asked.** If the explanation surfaces something that should be fixed, name it as a finding ("memory entry X is the misleading input here") and stop. Let the user say *"yes, fix it"* before doing anything.
4. **No defensive padding.** Don't pre-empt criticism by listing what you should have done. Just explain what you did.
5. **If a fix IS needed and obvious, do it AFTER explaining** — explanation first, action second, never both interleaved.

The pivot is from *"I'm in trouble; what do I do to make it right"* to *"I'm being read; what reasoning do I need to surface so the reader can update their model of me."*

## Propagation (same turn, per IAF tikur)

- **Memory entry:** new `feedback_why_is_honest_question.md` in user-memory. Cross-link to `feedback_be_laconic` and `feedback_dont_jump_to_conclusions`.
- **Zettel:** z106 (this tikur's lekach in zettel form), threading z099 / `feedback_be_laconic` / this tikur record.
- **Hook:** none for now. The behavior is intent-shaped, not enforceable by a check. Watch for cluster recurrence.
- **Skill update:** none — this isn't a workflow shape, it's a posture shape. If it recurs, codify into a `discussion-vibe.md` rule under usegin.
- **CLOSE.md fix:** drop the impersonating `I'm Lihu` line from the resume prompt. Replace with a name-agnostic phrasing. (This is the obvious fix the user surfaced; do it after the lekach lands.)

## What changed (the artifacts)

- This tikur record: you're reading it.
- `usegin/zettel/zettels/z106-why-is-an-honest-question-not-a-critique.md`
- `~/.claude/projects/-workspaces-test-mvp/memory/feedback_why_is_honest_question.md`
- `MEMORY.md` index updated to point at the new entry.
- `usegin/research/slack-integration/CLOSE.md` resume prompt: drop the `I'm Lihu` line.

## Distilled question for Oria — none

The lekach is on Gin to internalize. There's no Oria-input needed; this is a posture-correction, not a system change.

If a fourth instance hits in the next session despite this lekach, escalate: codify into a hook or convention. Until then, the memory entry + zettel + this tikur record carry the signal.

## Closing note

The user named the meta-error precisely: *"I asked why because I wanna ease on you the way to know the user next time."* That's the click. Honest questions are gifts to the system. Reading them as critique wastes the gift.
