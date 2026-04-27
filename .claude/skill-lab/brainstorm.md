# brainstorm — Skill Lab

## Intent

Make divergent idea-generation a repeatable team move, the same way `rnd` made parallel investigation repeatable.

The skill exists because we have done brainstorming-by-the-seat-of-our-pants in this repo at least three times (the slice-2 8-agent queue had brainstorm-shaped angles mixed with study-shaped ones; the war-management round mixed doctrine-extraction with creative-application; this very session asked "what could enhance Gin" without a structured way to canvas options). Without a named lifecycle, brainstorm collapses into either R&D (over-structured) or "let me think of three things off the top of my head" (under-structured). Codifying the divergent-team shape unlocks signal-via-convergence — when 3 of 8 independent ideators produce the same idea, that's evidence the idea is robust across framings.

The skill sits between `R&D` (learn the domain) and `refine` / `prioritize` (converge on what to do). It is the divergent step in the pipeline.

Success means: a brainstorm round runs end-to-end (frame → prime → fan out → flat-merge → hand off) without the orchestrator re-deriving the lifecycle, with idea volume high enough that convergence is detectable, and with the merged `ideas.md` parseable by the refine skill downstream.

## Success Signals

When retroing a session that used this skill, a good session looks like:

### Framing (the seed)
- [ ] One-sentence topic + explicit constraints + explicit out-of-scope
- [ ] ≤10 lines total — not a spec, just a frame
- [ ] All ideators read the same frame; no per-ideator scope drift

### Priming (the variation engine)
- [ ] 5–10 ideators (below 5 → not enough overlap; above 10 → dedup cost)
- [ ] Each ideator got a *different* priming axis — persona, constraint, time horizon, scale, provocation, adjacent-field
- [ ] No ideator was primed with the topic alone (would collapse to "obvious ideas")
- [ ] Primings leaned in — no hedging like "you might consider being a hacker"

### Spawning + independence
- [ ] All ideators fired in **one** batched response (parallel; no serial waterfall)
- [ ] No ideator read other ideators' files mid-run (independence preserved)
- [ ] Each charter included: read-first list, priming, working rules, deliverable shape, friction-capture pointer
- [ ] Charters explicitly forbade filtering, ranking, and committing

### Per-ideator output
- [ ] 10–30 ideas per ideator, each ≤2 lines (terse — compression is discipline)
- [ ] No ideator filtered or ranked silently
- [ ] Each ideator returned a ≤5-line chat summary

### Merge
- [ ] `ideas.md` produced with the load-bearing format (title / one-line / why / from / refined / rank / rationale)
- [ ] Convergence tracked in `From:` field (multi-ideator origin = signal)
- [ ] Superficial duplicates deduped; semantic overlap preserved
- [ ] No editorializing in the merge — flat list, not a synthesis

### Commit cadence
- [ ] Two-stage commits: ideators-raw, then merged-pool
- [ ] No per-ideator commit storm (autosync race risk)
- [ ] Push after each stage

### Friction capture
- [ ] Every charter pointed at `zettel-capture` skill
- [ ] If any ideator hit unclear priming or harness friction, a zettel landed (live, not retrofitted)

### Hand-off
- [ ] Closing zettel naming the round + the strongest convergent ideas
- [ ] Explicit hand-off to refine OR explicit human-pick decision (not "we'll see")

## Known Limitations

- **Convergence-as-signal is fragile under small N.** With 5 ideators, a 2-of-5 convergence is noisy. The signal sharpens at 8+. The skill's "5–10 sweet spot" is a compromise; rounds where the signal *really* matters should lean toward 8–10.

- **Priming axis selection is unguided.** The skill lists axes (persona, constraint, time horizon, scale, provocation, adjacent-field) but doesn't help the orchestrator pick *which* axes to vary. In practice, mixing axes (3 personas + 2 constraints + 2 provocations) seems to produce more divergent ideas than varying one axis (8 personas), but this is unverified. Track in retros.

- **Flat-pool merge is manual.** No tool yet de-duplicates or detects semantic overlap. The orchestrator does it by reading. After ~5 rounds, look for a `dx brainstorm merge` primitive that reads `ideators/*.md` and produces a draft `ideas.md`.

- **No retrieval across rounds.** Brainstormed ideas that didn't make it into a spec disappear into the corpus. A 2nd brainstorm on a related topic has no way to surface "we already explored this last month." Same gap as R&D rounds — closes when search/embeddings land.

- **Convergence ≠ correctness.** Three ideators agreeing on an idea means it's robust across primings, not that it's right. The prioritize skill is responsible for the correctness call. Brainstorm should not be trusted to filter.

- **Charters that name a persona too literally produce parody.** "You are a hacker who hates ceremony" yields good ideas; "You are John Carmack" yields parody-Carmack ideas. Persona-by-archetype > persona-by-name.

- **Sub-Gin can't fan out (z029 inherited).** Same as R&D — all spawning at the orchestrator.

- **Friction-capture is honor-system.** Same as R&D.

## Retro Guide

When `skill-retro` triggers a retro for `brainstorm`, follow this evaluation:

**1. Check framing tightness**
Was the topic.md one sentence + constraints + out-of-scope, ≤10 lines? Or did it bloat into a spec? Bloated framing collapses divergence — ideators try to satisfy the spec instead of opening the space.

**2. Check priming variation**
Sample 3 charters. Are the primings genuinely different axes, or is it 8 different personas? Mono-axis priming under-explores the space.

**3. Check parallelism**
All ideators fired in one batched response? Serial waterfall is a velocity loss; the model layer can run them in parallel.

**4. Check independence**
Did any charter say "read what ideator-3 wrote first"? That kills the convergence signal. Independence is non-negotiable.

**5. Check terseness**
Sample an ideator file. 10–30 ideas, each ≤2 lines? Or is it 5 ideas with paragraphs? Long-form output means the ideator under-generated.

**6. Check the merge**
Is `ideas.md` flat, with no editorializing? Or did the merge become a synthesis? Synthesis is the prioritize skill's job, not brainstorm's.

**7. Check convergence tracking**
Does the `From:` field name multiple ideators when the idea was convergent? If every idea has one source, either the round had no convergence (dilute priming) or the merge dropped it.

**8. Check the closing zettel**
Did one land? Did it name the strongest convergent ideas?

## Retros

| Date | Round | What happened | What the round taught us |
|---|---|---|---|
| *(pending — first round will land here)* | | | |

## Ideas / Notes

- **Priming auto-generation.** Could a meta-ideator generate the priming list from the topic? Worth trying once. Risk: meta-ideator's priming style limits the team's diversity.

- **Cross-round convergence.** When two brainstorms touch the same domain (e.g. "enhance Gin" today, "enhance Gin" three months from now), do the same ideas surface? If yes, that's high-confidence signal. Track via closing zettels.

- **Brainstorm-of-brainstorm-strategies.** Meta-application: brainstorm "what priming axes should we vary" before brainstorming the actual topic. Probably overkill, but worth trying once on a high-stakes round.

- **Persona library.** A small registered set of high-yielding personas (the hacker, the researcher, the UX-skeptic, the historian, the constraint-removalist, the systems-thinker) curated over time. Risk: institutionalization (z023 says spawn-as-instantiation is one-shot — a static persona library erodes that).

- **Brainstorm-then-immediate-vote.** A lightweight "did this brainstorm produce anything new?" gut-check from the human after the merge, before refine. Cheap; might catch dud rounds early.

- **Time-boxed pour mode.** A variant where the human pours ideas live (Wispr stream-of-consciousness) instead of spawning ideators. Useful for high-context topics where Lihu/Oria already has the angles in their head. Captures via the brainstorm format anyway, just with single-source convergence.

- **Friction-mining brainstorm.** Run brainstorm on "what's friction-y in Gin right now?" — every ideator produces friction observations. The convergence map *is* the friction-cluster map. Probably the highest-yield first round to run after this skill ships.

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-04-27 | Skill created. Lab seeded with intent, success signals, known limitations, retro guide. Sits in pipeline: R&D → BRAINSTORM → refine → prioritize → spec → implement. | Lihu / Oria asked for the four team-skills (brainstorm, refine, prioritize, consult) modeled on the existing `rnd` skill. Process-over-outcome (z086) — the goal is the pipeline, not any single brainstorm round. |
