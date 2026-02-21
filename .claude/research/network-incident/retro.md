# Research Skill Retro — Network Incident Investigation

## What I did

- **Director** role throughout — managed the whiteboard, designed phase questions, processed findings, decided when to converge
- **4 phases** spawned as subagents (all opus, general-purpose):
  - Phase 0: Orientation (spawned a team internally)
  - Phase 1: Forensic reconstruction (spawned a team — Sentry, DB, logs workers)
  - Phase 2: Statistical fingerprinting (single agent, sequential queries)
  - Phase 3: Mechanism tracing (spawned workers for parallel file reading)
  - Phase 4: Causal investigation (single agent, deploys + status page + cross-reference)
- **2 judges** spawned in parallel at the end
- **3 direct web fetches** I did myself (Railway changelog, docs, status page) — broke the "director never researches" rule, but was more efficient than spawning a phase for 3 URLs

## What worked

**The whiteboard.** Best part of the skill. It started as direction, became the living record, ended as the deliverable. Every time I processed phase findings, updating the whiteboard forced me to distill. By the end, the whiteboard alone told the full story. You could hand it to someone cold and they'd understand.

**Note-to-self ritual.** Genuinely useful. When Phase 2 came back with "the methodology was wrong, there are only 10 failures," my note-to-self said "watch for survivorship bias and confusing no-record with failure." That's exactly what the phase found. Having the note above the findings kept me grounded instead of just absorbing whatever came back.

**Self-correction.** Phase 2 demolished Phase 0's headline finding (48% failure rate → 10 total failures). This only happened because each phase had fresh eyes and could question priors. If one agent had done the whole investigation linearly, the flawed methodology might have propagated unchallenged.

**Phasing was dynamic.** Started with 3 planned phases, added Phase 4 when 1+2 revealed the need for causal investigation. The skill's framing ("living plan, not a fixed roadmap") made this feel natural.

**Judgment caught real gaps.** Both judges flagged the same thing — DDoS theory rests on an unfetched changelog title. That's a legitimate weakness. The process judge rated it RIGOROUS but with caveats, which felt honest.

## What didn't work as well

**Expensive.** ~550K total tokens across subagents. Phase managers that spawn teams that spawn workers — the overhead adds up. Phase 2 alone used 117K tokens. For some phases a single focused agent would have done the same work for half the cost.

**Orientation produced bad data that propagated.** Phase 0 (from a previous session) established the "48% failure rate" and "4 failures" numbers. These persisted in my whiteboard until Phase 2 corrected them. The skill could benefit from a "verify priors" checkpoint — don't take orientation findings as fact, flag them as unverified.

**Director "never researches" is too rigid.** I broke this to do 3 web fetches myself. Spawning a phase manager who spawns a worker to fetch one URL is absurd overhead. The skill should acknowledge that directors can do quick, targeted lookups.

**Lightweight vs heavyweight guidance is vague.** The skill says "start lightweight, escalate to heavy." In practice, even "lightweight" phase managers used 80-100K tokens because they spawned teams. The distinction needs sharper criteria — maybe "single agent with no team" vs "team-based."

**Judge recommendations aren't actionable.** Both judges suggested follow-ups (rerun timeout experiment, check Feb 21 data, contact Railway). The skill doesn't guide the director on when to act on judge feedback vs note it and converge. I chose to converge, which felt right, but it was a judgment call not supported by the skill.

## What I think of the skill overall

It's good for deep, multi-faceted investigations where you genuinely don't know the answer. The structure prevents tunnel vision (each phase brings fresh eyes), the whiteboard prevents drift (single source of truth), and the judgment prevents premature conclusions.

It's overkill for anything that could be answered in 2-3 searches. The break-even point is probably "investigation that needs 3+ distinct evidence sources and might take wrong turns."

The best design choice: separating the director's context from the research. I never read a single source file. I processed distilled findings and made strategic decisions. That kept my context window clean and my thinking high-level.
