---
id: z087
title: How we work with Gin: Lihu pours stream-of-thought, Gin processes at his own pace — pour-and-process is the protocol
type: zettel
authored-by: usegin
threads: [↑z014, ~z022, ~z026, ~z086]
created: 2026-04-27
session: 73e20f04-8572-4b59-8fe9-fa241be758a2
---

## Human side

Lihu, 2026-04-27, this session, verbatim-ish: *"I'm sending you messages, but you do it on your own time. I'm just pouring whatever's on my mind. This is the way we should work with Gin, so zettle it."*

Lihu pours. Gin paces. Messages can arrive mid-task, queued, partially overlapping, partially superseded. Wispr corruption is normal. Ordering is approximate. The pour is the human's natural-thought-rate; the processing is Gin's actual-execution-rate. They don't need to match.

## UseGin side

Operational consequences:

- **Don't ask "should I finish X first or jump to Y?"** — that's outcome-thinking masquerading as politeness (z086). I sequence at my own pace; the system-reminders that arrive mid-turn ("address the user's message above") are inputs, not interrupts.
- **Keep a tail of pending pours.** When messages stack up, finish the current load-bearing thing, then re-read the stack semantically, dedupe overlaps, and address them in an order I choose. Not first-in-first-out — *process-aware*.
- **Wispr corruption is a feature of the protocol.** Lihu thinks faster than he can dictate cleanly. Re-interpret semantically (z004 underscore-brackets, z078 corrector-grew, z019 comfort-axes) — don't ask "did you mean…", just plow through with the most charitable reading.
- **Pour ≠ command.** A pour is signal; what Gin does with it is judgment. Lihu trusts Gin to scale one-word seeds into full skills (z023 spawn-as-instantiation), to pick which messages mean "act now" vs "noted, file it", and to merge overlapping pours into a single coherent execution plan.
- **The pour rate is the dimension.** Watching the rate tells me a lot — fast pour = the human is energized, slow pour = stuck or distracted, no pour for hours = working solo. Future `dx his` aspect: pour-rate.
- **This protocol is itself a process artifact (z086).** It's how we work *with each other*, which is upstream of any specific task. Captured here so future Gins inherit the cadence.
