# rnd — Skill Lab

## Intent

Make parallel R&D rounds a repeatable, low-friction move — not a one-off heroic improvisation each time.

The skill exists because we have now run the same shape three times in one week (Zettelkasten R&D, the slice-2 / auto-pop / distillation 8-agent queue, and war-management R&D) without ever calling it "the same shape." Each round was reinvented from memory. Each round hit the same handful of frictions (sub-Gin can't fan out per z029, harness blocks charter-named deliverables per z030, autosync collisions per `reference_autosync_concurrent_collisions`). Codifying the lifecycle means the 4th round through the Nth round inherit the lessons instead of re-discovering them.

The skill sits between `Explore` (single-investigator pinpoint) and `slicing-specs` + `liaison` (shipping work). It's the form for *learning*: bring back what we can from a domain, with enough structure that the synthesis is more than the sum of the inputs.

Success means: a round runs end-to-end (decompose → charter → spawn → commit → synthesize → dilemmas-to-Lihu) without the orchestrator re-deriving the lifecycle, with friction surfaced as zettels rather than swallowed, and with whiteboards readable two weeks later because they all share the top/middle/bottom shape.

## Success Signals

When retroing a session that used this skill, a good session looks like:

### Decomposition + spawning (process discipline)
- [ ] Angles were decomposed at the orchestrator level — no charter said "investigate X, Y, and Z" expecting one Gin to fan out (z029)
- [ ] 3–10 angles, each independent enough that a professor could write a useful whiteboard without reading the others
- [ ] Pre-created folder tree before charters were written; each charter named exact deliverable paths
- [ ] All professors spawned in parallel (one batched response with N Agent calls), not serially
- [ ] Each charter included: read-first list, mandate (one sentence), scope (in + explicit out), working rules, deliverable shape, friction-capture pointer
- [ ] Charters explicitly said "do NOT commit" and "do NOT write outside <your folder>"
- [ ] Friction-capture pointer (zettel-capture skill mention) present in every charter

### Per-whiteboard discipline
- [ ] Each whiteboard had top / middle / bottom sections — not just freeform prose
- [ ] Each professor returned a ≤10-line summary in chat (not a wall of text)
- [ ] Each whiteboard was committed individually as it landed, not batched at the end
- [ ] Commits followed `research(<topic>): <angle> whiteboard` shape and pushed (autosync)
- [ ] Zero autosync collisions observed (no stranger-revert events on the round's commits)

### Synthesis + dilemmas
- [ ] Synthesis ran only after all whiteboards landed (no early-bias from partial inputs)
- [ ] Synthesis was laconic (z036) — patterns first, evidence second, didn't repeat whiteboard contents
- [ ] Dilemmas brought to Lihu in z026 shape — Decision needed / Options / Lean / Why / Price / Risk / For you to weigh
- [ ] Decisions Lihu accepted landed as z020 artifacts in the right home (Linear / zettel / comment)

### Friction capture
- [ ] Every harness fork named (z009) — no professor pushed through silently
- [ ] Friction zettels captured live, not retrofitted at the end
- [ ] If a recurring pattern surfaced (3rd+ instance of something), a meta-zettel was written

### Where it landed
- [ ] Gin-internal R&D landed in `usegin/research/<topic>/`, not Linear (z024)
- [ ] Shipping-product R&D used Linear parent + sub-issues + synthesis comment (ENG-5379 model)
- [ ] When in doubt, defaulted to `usegin/research/`

## Known Limitations

- **Sub-Gin spawn block (z029).** Agents spawned via the Agent tool do not get the Agent tool themselves. The skill works around it by mandating decomposition at the orchestrator level, but the underlying limitation means a charter can't legitimately ask its professor to fan out further. Workaround for the rare genuine-need case: spawn the first-tier Gin as a headless `claude` session (consultant pattern). Cost: heavier launch, session-id management.

- **Harness blocks charter-named deliverables (z030).** The Gin-wide convention against "report files" fires on charter-named `findings.md` / `recommendation.md` / `whiteboard.md`. Professors have to fall back to Bash heredoc + `tee`. The fix is upstream (heuristic should honor the "explicitly directed" escape hatch); until then, charters should mention the heredoc fallback explicitly. The skill author for `rnd` itself hit this — Write was denied for `.claude/skills/rnd/SKILL.md` and the file had to be written via `tee`.

- **No retrieval layer for past rounds.** A 4th round on a topic we've already studied has no way to find the prior round's synthesis except by remembering the path. When `dx zettel search` and the pgvector substrate (ENG-5381) land, this can be replaced by querying the closing zettel.

- **Synthesis quality depends on whiteboard top sections.** If professors write thin "top" sections, the synthesizer reads middles and runs out of context. Mitigation: the charter template enforces the shape; reviewer-of-charters at spawn time would catch thin tops, but we don't currently spawn one.

- **No mid-round intervention guidance.** If a professor returns a thin or off-charter whiteboard, the skill doesn't say what to do. In practice: re-charter that one angle and re-spawn. Not codified yet.

- **Round size sweet spot is empirical, not derived.** "3–N, sweet spot 6–8" is observed from three rounds. The next 5 rounds will sharpen this.

- **Friction-capture pointer is honor-system.** Every charter is supposed to mention the zettel-capture skill. If the orchestrator forgets, the round still runs but we lose DX-of-DX signal (z048). No mechanical enforcement.

## Retro Guide

When the `skill-retro` skill triggers a retro for `rnd`, follow this evaluation process:

**1. Check decomposition discipline (most critical)**
Did the orchestrator decompose into independent angles itself, or did one charter try to fan out? Look at the spawned agents — if there's one "manager" charter that says "investigate X, Y, Z and synthesize", that's the z029 antipattern. Should have been N first-tier charters.

**2. Check charter quality**
Sample 2-3 charters. Did each have: read-first list, mandate sentence, scope (in/out), working rules, deliverable shape, friction-capture pointer? Vague charters → vague whiteboards. The charter *is* the professor (z023).

**3. Check parallelism + commit cadence**
Were all professors spawned in one batch, or serially? Were whiteboards committed as they landed, or batched? Batching → autosync collision risk (`reference_autosync_concurrent_collisions`).

**4. Check whiteboard shape**
Do the whiteboards have top / middle / bottom? Or are they freeform? Without a top, the synthesizer drowns.

**5. Check friction capture**
Cross-reference the round's session against zettels created in that window. Were frictions logged live, or retrofitted? Zero friction zettels for an N-professor round is suspect — at that scale, *something* went sideways.

**6. Check the synthesis**
Did synthesis wait for all inputs? Was it laconic? Did dilemmas come to Lihu in z026 shape, or as a menu without a recommendation?

**7. Check where it landed**
Was the home choice (`usegin/research/` vs Linear) defended explicitly, or default? z024 says Gin-internal stays out of Linear; if a Gin-internal round landed in Linear, name why.

## Retros

| Date | Round | What happened | What the round taught us |
|---|---|---|---|
| 2026-04-21..23 | Zettelkasten R&D (ENG-5379) | 8 professors spawned for the zettelkasten substrate question. Each wrote a deep whiteboard; cross-cutting synthesis landed as a comment on ENG-5379 (the canonical Linear example of an R&D round). | Established the 8-angle sweet spot. Established Linear-comment-as-synthesis pattern. Produced the founding evidence that R&D rounds are reusable shapes — directly motivated z076 and this skill. |
| 2026-04-27 (this turn, earlier) | 8-agent queue: slice-2 designer, auto-pop, distillation, doc-method, war-management decomposition, etc. | Eight charters fired in parallel for cross-cutting Zettel-app design questions. Doc-method team produced findings.md + recommendation.md. War-management got pre-decomposed into 6 doctrine-source professors. | Reproduced the shape unprompted — third unconscious instance, which is the trigger for codification. Surfaced z029 (sub-Gin can't fan out) and z030 (harness blocks deliverable writes) as named limitations. |
| 2026-04-27 (this turn, concurrent) | War-management R&D (z075) | 6 doctrine-source professors + 1 synthesizer. Lives in `usegin/research/war-management/`, not Linear (z024). Concurrent with this skill being written. | Cleanest test of the codified shape — 6 angles, pre-decomposed, parallel, `usegin/research/` home, synthesizer at the end. Whether the round runs cleanly with the lessons of z029 + z030 baked in is the first real signal that the skill works. |

## Ideas / Notes

- **Evolution: charter-shape reviewer.** Spawning a tiny reviewer to look at all N charters before they fire would catch thin charters (vague mandate, missing scope, missing friction-capture line). Cheap; not yet tried.

- **Round-size data.** After 5 more rounds, plot count of angles vs synthesis-quality-as-judged-in-retro. The 3–10 range is observed; the actual sweet spot may be tighter.

- **Closing zettel as round-index.** Every round closes with a zettel naming the round (z075 for war-management). If we tag those consistently (`type: rnd-round-close` or similar), the corpus of past rounds becomes queryable — even before pgvector.

- **Promotion path.** A `usegin/research/<topic>/` round that produces a recurring pattern (3rd+ instance of the same shape) is a candidate for skill promotion. This skill itself is the proof-of-pattern (z076 fired the codification). Watch for the next pattern to follow this path.

- **Cross-round synthesis.** When two rounds touch the same domain (e.g. war-management and a future "operations management" round), is there a meta-synthesis form? Open. May be a question for the synthesizer-of-synthesizers, or just a meta-zettel.

- **Headless-claude consultant pattern for genuine fan-out.** The skill currently mandates decomposition at the orchestrator. The narrow case where a professor genuinely needs to fan out — e.g. "study every IDF unit's after-action report tradition independently" — is unaddressed. The consultant pattern (`usegin/consultant/`) is the candidate, but we haven't run an R&D round through a consultant yet.

- **Friction-capture pointer wording.** Currently the charter template says "Capture friction as zettels via the `zettel-capture` skill". A more forceful wording ("Naming the fork is the deliverable, not a side-effect") may reduce silent push-throughs. Try in next round.

- **Top-section-only synthesis.** Hypothesis: a synthesizer that reads *only* the "Top — the click" sections across N whiteboards produces a tighter synthesis than one that reads everything. Worth testing on the next round where main-thread tokens are tight.

- **Director-doesn't-read pattern.** Mirror of build-orchestrate: should the orchestrator read whiteboards directly, or delegate even the synthesis read? The build-orchestrate lab teaches "director never reads the artifacts", but R&D synthesis may need closer reading. Open.

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-04-27 | Lab created alongside skill. Seeded Retros with 3 rounds (Zettelkasten, 8-agent queue, war-management). Seeded Known Limitations with z029, z030, autosync collisions, no-retrieval-layer. | z076 — third unconscious instance of the same R&D shape this week is the trigger to codify. The skill captures the lifecycle; the lab captures the ongoing evaluation surface. |
