---
name: close
description: Close an autonomous (or any long) Gin run cleanly so the next agent can pick up from this exact point. Distill open inputs into management-language decisions (what / why / lean+cost+risk), point the next reader at the front-door doc, hand off cleanly. Use when ending a session or autonomous run that has open decisions waiting on a human. Triggered by "close the run", "close correctly", "close session", "/close", "wrap up cleanly", or by your own judgment when stopping an autonomous run.
---

# close — hand off so the next Gin starts where this one stopped

A Gin run ends in one of three shapes: it's done, it's blocked-on-human, or someone interrupts. The first is rare. The other two leave decisions hanging. **Close** is the discipline that turns a hanging run into a continuable one — the next Gin (or human) reads one page and starts work.

## When to invoke

- An autonomous run has reached a natural stopping point (every remaining slice needs human input).
- The session is wrapping up and there are open decisions that need a human call before the next slice fires.
- A handoff to another agent / a future session / a vacationing human is happening and the substrate has moved.
- Lihu (or anyone) says "close the run", "close correctly", "wrap up cleanly".

## When NOT to invoke

- Mid-flight when you're stopping for a single tactical reason (use `handoff` for short-lived state-pass).
- When the run is genuinely done and there's nothing for a human to decide (just commit + summarize).
- For a one-off task that doesn't span phases.

## What close produces

Two artifacts:

1. **A close doc** — `<work-folder>/CLOSE.md` (e.g. `usegin/research/<topic>/CLOSE.md`). The single page the next Gin/human reads to know exactly where they are.
2. **An updated front-door doc** — point the existing FOR-X / DEMO / RESUME / handoff at CLOSE.md so cold readers don't miss it.

Both committed + pushed before the run truly ends.

## CLOSE.md shape

Keep it laconic. Patterns first, evidence second, decisions in the canonical shape.

```markdown
# Close — <topic>

**Run:** <what was the goal>
**Closed at:** <date> by Gin session `<id>` (or "<my session-id>")
**Status:** <one sentence — done / blocked-on-human / paused-for-X>

## What landed

<≤10 lines naming the slices that shipped. Pointers to the bigger artifacts (DEMO.md, SYNTHESIS.md, etc.). No re-summary of what's already documented elsewhere.>

## What's blocked on you

The decisions below are in management language, not code/architecture
language. Each in z026 shape: WHAT we need to decide on / WHY it
matters / RECOMMENDATION (lean + cost + risk + what to worry about).

### D1 — <name>

**What:** <one sentence — what choice are you being asked to make>
**Why:** <one paragraph — what becomes possible / impossible based on this call. The business-shaped consequence, not the code-shaped one.>
**Recommendation:** <Gin's lean in plain English>
**Cost:** <what we pay if we go with the lean — time, money, lock-in, scope>
**Risk:** <what could go wrong with the lean — and what we'd watch for>
**What to worry about:** <the thing that would re-open this decision>

### D2 — …

(repeat for each open decision)

## How to continue

1. Read this file cold.
2. Make the calls on D1, D2, … (no order required unless dependencies are explicit).
3. Tell the next Gin: `claude --resume <session-id>` OR start fresh with this CLOSE.md as the orientation read.
4. The next Gin's first move: ack the decisions you made, update FOR-TOM/DEMO/RESUME if anything you decided changes them, then continue from the next-action below.

## Next action (if all decisions go to recommendation)

<one paragraph — the slice that would fire next if every D-X gets the recommended answer. The "if you greenlight the lean across the board, here's what I'd do tomorrow" path.>

## Pointers (front-door legibility)

- Front door / cold-reader entry: <path>
- Resume pointer: <path>
- Linear parent: <ENG-XXXX>
- Closing zettel(s): <z-id list, if any pattern was promoted out of this run>
- Audits ledger: <path, e.g. usegin/comptroller/audits/>
```

## The decisions language

The single most important thing in CLOSE.md is **the decisions are in management language, not code language.**

| ❌ Don't write | ✅ Write |
|---|---|
| "Decide whether to use AES-GCM with random nonce per row vs. envelope-encrypted DEK" | "Decide whether token encryption is good enough for pilot or needs the strongest version we can buy" |
| "Pick the migration shape for slack_channel_bindings" | "Decide whether one customer can connect Slack to multiple Effi projects, or one-and-only-one" |
| "Should `dx slack post` default to #usegin or be channel-arg-required" | (leave it out — that's a tactical default Gin owns; not a Lihu call) |

**Use the war-research register: tol-and-posh, not implementation-and-spec.** *Should we hold this position or fall back* / *what does each path cost in soldiers and time* — not *line 47 of route.ts has a TODO*. The human walking back into the run is making business + product calls; the code-shaped detail belongs in the code, not in the CLOSE doc.

When in doubt: ask whether the human's read of the decision changes if you swap the technology. If yes, you're at the right altitude. If no, you've gone too detailed — pull up.

## Process

1. **Survey what's blocked.** Walk every running thread: what slice got deferred, what env-var got named for Lihu, what posture-decision is hanging. Each becomes a candidate D-X.
2. **Cluster + de-noise.** If two D-X items are really one decision (e.g. "pick encryption strategy" + "decide rotation cadence"), merge them. Aim for ≤7 decisions in CLOSE.md. Lihu's attention is the limit (z027).
3. **Translate up.** Rewrite each in management language per the table above.
4. **Lean per item.** Every D-X has a recommendation. No menu without a lean (z026). The recommendation may be "wait, do nothing" — that's still a lean.
5. **Cost / risk / worry.** Each lean's downside is named, not implied.
6. **Sequencing.** End with the "if all greens, here's what fires next" paragraph so the next Gin doesn't have to re-derive it.
7. **Pointers.** Front-door, resume, Linear, zettels, audits — every cold-reader-relevant path linked once at the bottom.
8. **Update the front door.** Add a one-line link from FOR-TOM / DEMO / RESUME to CLOSE.md. The cold reader follows ONE link, not three.
9. **Commit + push.** Both the CLOSE doc and the front-door update in one commit. Reference the run's parent issue.
10. **Final report in chat.** ≤8 lines: link to CLOSE.md, list the D-X count + topics, name what fires when greenlit. Stop.

## Working rules

- **No new code in the close.** Closing is documentation. If there's tactical code to land, do it BEFORE invoking close.
- **No new R&D.** Same reason. Decisions in CLOSE.md are about choices the human owns, not new investigations.
- **Don't pad.** A two-decision close is fine. Don't manufacture decisions to look complete.
- **Decision count is signal.** ≤3 = healthy. 4-7 = manageable. 8+ = the run probably should have closed earlier.
- **The Gin owns its leans.** Recommendations are not "options for Lihu to consider" — they're "this is what Gin would do; tell me to do otherwise." Plus side-channels: cost, risk, worry-about. Lihu can override; he doesn't have to think from zero.
- **Never delete the in-progress artifacts** (whiteboards, RESUME, FOR-TOM). CLOSE points at them; doesn't replace them.

## Common mistakes

- **Code-language decisions.** "Pick the helper signature." Pull up — at this altitude it's "is the encryption strong enough or do we want to upgrade." (See decisions-language table above.)
- **Decisions without leans.** Lihu has to choose-from-zero. Z026 says you owe a lean — even on close.
- **CLOSE-as-summary.** It's not a wrap-up of what shipped (FOR-TOM has that). It's specifically "what's blocked + what to decide + what fires next." Stay narrow.
- **Forgetting the front-door update.** Cold readers find DEMO.md / FOR-TOM.md first; if those don't link to CLOSE, the close was invisible.
- **Over-decisioning.** Three real decisions beats seven inflated ones. Tactical defaults Gin owns stay out of the doc.

## After close

The Gin's job is done. The next move is the human's. When the human comes back:

- They read CLOSE.md cold.
- They make the D-X calls (write them in chat or directly into the doc as a "decided: …" line).
- The next Gin (this same session resumed, or a fresh session pointed at CLOSE.md) reads the human's decisions and continues from "next action."

Close is the protocol that makes "I'll come back to this tomorrow" actually work.
