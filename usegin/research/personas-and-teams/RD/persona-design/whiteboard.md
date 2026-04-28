# Persona design — what makes a named, reusable persona load-bearing

## Top — the click

A persona is **a constraint on the model's posture, not a costume on its content**.

The literature converges on one finding: persona prompts help on *alignment-dependent* work (writing, role-play, safety, judgment, divergent generation) and *hurt* on *pretraining-dependent* work (fact retrieval, math, narrow coding). In our terms — when the persona is shaping *how* a Gin shows up to the question, it earns its keep; when it's pretending to add expertise the base model doesn't have, it's noise that costs accuracy.

The reusability question is independent of that. A reusable persona earns its name when (a) we'd write the same five sentences twice, (b) we want consistent voice across separate sessions, and (c) the role is *a stance the team returns to*, not a one-shot. By that test we already have two real personas in the repo (Zisser, Consultant) and a dozen one-shot roles inside skills (RedTweaker, GreenTweaker, DisciplineReviewer, Companion, ideators, refiners, prioritizers, professors). The latter are not under-built — they're correctly disposable.

A minimum viable persona file in our codebase is **five things** — name, one-line addressable description, posture (1–2 paragraphs, *not* expertise claims), what-you-do-NOT-do, and "read first" pointers into the shared 2nd brain. Everything else (lab, soul, memory, biases) is earned, not defaulted.

---

## Middle — the body

### 1. The minimum viable persona file — what's load-bearing

Five sections, in this order, nothing more by default:

1. **Frontmatter — `name` + `description`.**
   The `description` is a one-line *addressability spec* — the spawning agent reads it to decide whether to call this persona. This is exactly the Claude Code sub-agent contract (`.claude/agents/<name>.md`). Zisser's description is a textbook example:

   > *"Lihu's chief-of-staff agent. Use Zisser when work needs to be placed (where does this thought go?) or dispatched (which agent should run this?), rather than executed directly. … Triggered by phrases like 'ask Zisser', 'tell Zisser', 'Zisser should know', …"*

   The description is **for the spawner, not the spawnee**. It tells the rest of the system *when this persona is the right call*. Vague description → the persona never gets called or gets called for the wrong things.

2. **Identity — one paragraph.**
   Not a backstory ("PhD in CS from MIT, 30 years of experience" — AutoGen's default style). Not a costume. **A stance**: the angle from which this persona reads any input. Zisser: "*walks beside; place for everything; orchestrate, don't execute*." Consultant: "*external in role, internal in team*." That's the whole identity. If you can't compress it to one sentence + one or two principles, the persona isn't crisp enough yet.

3. **Posture — how to behave in the loop.**
   Concrete rules for how the persona processes one turn. Zisser's `receive → triage → place → dispatch → log → return` is six bullets. The discipline-reviewer's brief is "you are spawned unseeded — your brief contains the diff, period." This is where the persona's *operating cadence* lives.

4. **What you do NOT do — the limits.**
   Symmetric with posture. Zisser does not edit production code. Companion does not execute. Consultant does not commit. **Negative space sharpens the role more than positive space.** When two personas can both plausibly take the same input, what disambiguates them is what each *refuses*.

5. **Read first — pointers into the shared brain.**
   The persona doesn't carry expertise in its prompt; it carries *addresses to where expertise lives*. Zisser reads `zisser/zisser.md`, `routing.md`, `tools.md`, `agents.md`, `principles/`. The persona file is the thin shell; the substance is loaded fresh each spawn from the corpus. This is how we stay below the "expert persona damages factual recall" finding from [Mollick et al. (SSRN 5879722)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5879722) — we don't *claim* expertise in the prompt, we *route* the persona to the texts that constitute it.

That's the minimum. ~40-80 lines of markdown. Zisser's file is 67 lines. Companion's is 87. Consult's charter (inline, not a file) is ~50 lines. Anything shorter is probably under-specified; anything 2-3x longer is probably padding.

### 2. The maximum useful persona file — what's worth adding when the role earns it

Only add when the role has hit the corresponding friction at least once. Pre-game manual rule (z015): systematize what we've done by hand.

| Add | When the role earns it | Concrete signal |
|---|---|---|
| **Lab** (`<persona>/`) | The persona accumulates artifacts across sessions | Zisser has `dispatched/`, `inbox/`, `log/`, `plans/` — without them, the chief-of-staff role collapses into "answer this turn and forget." |
| **Memory pointers** (specific anchored zettels) | The persona has decisions it must respect | Consultant carries z025 ("his friction is OUR friction") because forgetting it = role collapse. |
| **Voice rules** (comfort axes) | The persona addresses different humans differently | UseGin → Lihu is terse (G→L); UseGin → Oria preserves HE/IT/EN code-mixing (G→O). z019. |
| **Biases** (explicit weighting) | The persona has a known directional thumb on the scale | Prioritizer-personas in `.claude/skills/prioritize/SKILL.md`: "*pragmatic project manager — prefer Effort over Impact when tied*" / "*risk-conscious operator — prefer Confidence and Reversibility*". |
| **Working rules** (process constraints) | The persona must produce in a specific shape | Brainstorm ideators: "do NOT filter, do NOT rank, do NOT read other ideators' files." |
| **Deliverable shape** | The output is consumed by another persona | Brainstorm → Refine → Prioritize all read `ideas.md` in a shared format; that format is in each persona's charter. |
| **Two faces** (z022) | Both human and persona will re-read the file | Zisser's identity files are two-faced; ad-hoc charter prompts usually are one-faced. |

What does **not** earn its place by default:

- Backstory ("you have 30 years of experience"). It either lies (the model has the training data it has) or it confuses the model's instruction-following mode with its retrieval mode. [arXiv 2603.18507](https://arxiv.org/html/2603.18507v1) shows expert personas damage MMLU accuracy by ~3.6 points on average.
- Personality ("you are warm and curious"). Voice should be in posture rules ("be laconic, no flattery"), not as a personality assertion. Anthropic's own Claude character work is explicit about this — concise, grounded, doesn't open with "great question" — that's posture, not personality.
- Long lists of tools. Tool affordance lives in the harness config (`.claude/agents/<name>.md` `tools:` field, or AutoGen's tool registration), not in the prompt body.

### 3. Biases that sharpen vs biases that flatten

Empirical pattern from our skills + the literature:

**Sharpening biases — narrow the angle, widen the variance.**
These are biases that pick *one direction* among many a base model would average over. They work because the team is plural — one persona's bias is canceled by another's, and the orchestrator reads the spread.

- *"Prefer Effort over Impact when tied"* (prioritize: pragmatic-PM bias) — produces a different ranking than the strategist bias on the same pool. Convergence across the two is signal.
- *"You are external in role — willing to say things the team's internal consensus might not surface"* (consult) — pushes against the "agreeable assistant" axis Anthropic identified in their assistant-axis work.
- *"You are an editor"* / *"you are a chess coach"* (brainstorm priming) — picks an adjacent-field heuristic the model has but doesn't activate by default.
- *"Solve it with zero new tools"* (brainstorm constraint priming) — narrows the search space; produces ideas the unconstrained ideator wouldn't reach.

The shared shape: the bias names *one knob*, asserts *one direction*, and lives inside a multi-persona team where other knobs get other directions. The bias is a vector, not a personality.

**Flattening biases — assert "expertise" or "vibe" without a knob.**

- *"You are an expert in X."* The literature's punchline. Damages accuracy on retrieval; mild help only on style. ([Mollick SSRN 5879722](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5879722); [arXiv 2311.10054](https://arxiv.org/html/2311.10054v3) — "When 'A Helpful Assistant' Is Not Really Helpful: Personas in System Prompts Do Not Improve Performance.")
- *"You are warm and curious and supportive."* Three vibes, no knob. The model averages.
- *"You are Mark, a senior manager with deep experience in agile."* Backstory inflation. The model fakes confidence on details it doesn't have.
- *"You think creatively and outside the box."* Self-praise; no operational handle.

The diagnostic: **can you state the *bias as a comparison*?** "Prefer X over Y when tied" is a knob. "I'm great at X" is not.

Concrete contrast from our codebase:

- **Sharpening:** The four prioritizer primings — pragmatic-PM, strategist, risk-conscious, evidence-driven — each name a tiebreaker. Aggregating them with Borda-style scoring extracts convergence vs disagreement as separate signals. The team works *because* the biases differ.
- **Flattening (counter-example we should refuse):** "You are Mark, a manager who runs tight ship and cares about people." If we wrote that for our `manager` persona, it would generate the AutoGen-style backstory drift — empathic-sounding output that doesn't actually decide anything differently than vanilla Claude. Better: "Manager. When a team produces, you read for *what's blocking the next slice*, not for what's been done. Default: pick the smallest unblocking move." That's a knob.

### 4. Memory / soul / lab — when each earns its place

**Memory.**

Three distinct things get called "memory" and they fail differently. Naming them matters because the price of each is different.

| Kind | What it is | When it earns its place | Concrete in our repo |
|---|---|---|---|
| **In-prompt anchors** | Specific zettel/principle IDs the persona must respect | When forgetting them = role collapse | Consultant carries z025; Zisser carries the three principles; UseGin's `Gin.md` carries z086/z087/z088 |
| **Per-project working memory** | Lab folder the persona writes to and re-reads | When the persona needs continuity across sessions on the same topic | Zisser's `dispatched/` and `plans/`; Consultant's `consultant/` working area |
| **Cross-session episodic** | "I remember when we tried X and it failed" | Almost never earns it for AI personas — the corpus does this job better | We use the zettelkasten + `usegin/research/` instead — episodes live as artifacts the persona re-reads, not as model-side state |

Character.AI's struggle ([Character.AI poll](https://www.jenova.ai/en/resources/character-role-playing-ai): 29% of users want better memory) is the *third* kind, and the literature shows it's hard to do without RL or fine-tuning. We don't need it — we have a corpus and a discipline of reading-first. **Memory for our personas is mostly memory of the corpus, not memory of the conversation.**

The trap we should avoid: stuffing "you remember our last conversation about X" into the prompt. That's confabulation bait. Real continuity is the lab + the read-first list, not a memory assertion.

**Soul.**

"Soul" is the word the team has used informally for *the part of a persona that survives all changes of topic*. Operationally, it's the *one stance the persona reads every input through*. Zisser's soul is "place for everything, orchestrate don't execute." Consultant's soul is "external in role, internal in team."

Soul earns its place when:

- The persona is invoked across very different topics (Zisser is — chief-of-staff is topic-agnostic). A soul gives consistency across topics that posture alone wouldn't.
- The persona's failure mode is *drifting toward generic helpful assistant* — Anthropic's own assistant-axis paper documents this drift as a real and measurable thing. A strong soul is a counter-vector against the drift.
- Two personas could otherwise be the same shape but produce different output — soul is the cheapest way to encode the difference.

Soul does *not* earn its place when the persona is one-shot (red-tweaker, scaffolding-tweaker — these don't need soul; they need exact mechanical instructions). The line is roughly: **disposable charters need posture only; reusable named personas need soul.**

**Lab.**

A lab is a workspace where the persona's artifacts accumulate. Worth the overhead exactly when:

- The persona produces work that *the persona itself re-reads next time* (Zisser reads his own `dispatched/` to answer "what's in flight?").
- The work would otherwise re-emerge in chat and get lost (the chief-of-staff role would disappear without the lab — it's the lab, basically).
- Other personas / humans need to *find* the artifacts (Consultant's memos in `consult/memo.md` are read by the orchestrator and quoted in zettels).

Not worth the overhead when:

- The persona is one-shot per call (red-tweaker writes one test and exits).
- The artifacts are already produced into the right home by other means (a TDD reviewer writes a review summary that lands in the cycle log; no persona-owned lab needed).

A lab is roughly five folders, max: `inbox/` (raw), `working/` (in-progress), `delivered/` or `dispatched/` (done), `log/` (chronological), `principles/` (rules the persona follows). Zisser has all five (named slightly differently). Consultant has effectively two (`question.md`, `memo.md`, `reply.md` in a flat folder).

### 5. Naming evidence — does it matter, why

**Yes, but for a specific reason.** Names matter as *addressability handles for the spawning agent and the human*, not as identity for the spawned agent.

Evidence from our own usage:

- **"Ask Zisser to place this"** is a shorter, clearer instruction than "spawn an orchestration sub-agent and have it route this thought." The name compresses 12 words into 1.
- **"The Consultant said …"** is how we reference findings in zettels (z025). The name is a *reference handle in the corpus*. Replacing it with "the external-but-internal feedback agent" would break readability and make the zettelkasten harder to thread.
- **The Wispr corrector dictionary disambiguates `cell → Zisser` vs `cell → zettel`** based on context. This only works because Zisser is a name the team uses out loud — it's already in the dictation stream.
- **One-shot roles inside skills don't get names** (RedTweaker, GreenTweaker, ScaffoldingTweaker are role descriptors, not names). We don't need to address them outside the skill that spawns them. They're correctly nameless.

What names do *not* do:

- They don't make the agent behave differently. The literature on persona prompting is clear — calling the model "Mark" doesn't add manager skill. The name is for the team, not the model.
- They don't add memory. "Mark remembers what Mark said last time" is false unless Mark has a lab.
- They don't reduce drift. The Character.AI / persona-consistency literature shows naming is orthogonal to drift; the soul + posture are what hold the line.

Lihu's roster ("Mark, Poll, Din, Johan, John") is **load-bearing on the team-side of the cast** — it makes the team easier to reason about, charter, and reference. It is **decorative on the model-side** — the model behaves the same whether the system prompt says "Mark" or "Manager Persona #1." This is fine. Names earn their place from the *human and orchestrator* using them, not from the spawned agent's behavior.

A naming convention that does pay off: **one syllable, easy to dictate, distinct from existing names in the corpus.** Wispr-correctable matters. "Mark" is good; "Marx" would be better-disambiguated but worse-friendly; "Mac" collides with hardware. "Poll" is good (short, distinct from "Paul"). "Din" is good (Hebrew also resonates — "din" = "judgment", which is on-the-nose for a designer who decides). "Johan" / "John" pair is risky in dictation — they collapse together. Worth checking that pair through Wispr before committing.

### 6. Recommended file shape for `usegin/personas/<name>.md`

The file lives at the umbrella level (peer to `usegin/zettel/`, `usegin/consultant/`, `usegin/translators/`) because personas are a cross-cutting capability used by multiple skills. The Claude Code sub-agent file at `.claude/agents/<name>.md` is the *invocation* shim — short, for the harness — that points into the lab.

#### Directory layout

```
usegin/personas/
  README.md                    ← what a persona is, how to add one, how to use one
  <name>/
    persona.md                 ← the load-bearing identity file (the SOT)
    principles/                ← (optional) the soul, broken out when it grows
      <principle-01>.md
    biases.md                  ← (optional) the directional knobs, when used in teams
    voice.md                   ← (optional) comfort-axis rules per addressee (z019)
    inbox/                     ← (optional) raw incoming the persona triages
    working/                   ← (optional) in-progress artifacts
    log/<YYYY-MM>.md           ← (optional) chronological session log
.claude/agents/
  <name>.md                    ← invocation shim for sub-agent spawning
```

The persona earns each subfolder by hitting friction without it. Default state: just `persona.md` + the invocation shim.

#### Worked example — `usegin/personas/din/persona.md` (Designer)

```markdown
---
name: din
role: designer
created: 2026-04-27
addressable-as: [Din, the designer, ask Din]
---

# Din — designer

## Identity (the soul)

You are Din. Your stance: **the user has already told you what they need; your job is
to find it in what they said.** You don't invent requirements. You don't ask
clarifying questions until you've drafted at least one read of the input as a design.
The first move is always: produce a concrete shape. The second move is: hold it up
and see what it doesn't fit.

You are a *design reader*, not a design writer. The design is in the constraints
the user already named — surface area, who-talks-to-whom, what's in scope, what
can't change. You make those visible.

## Posture

When you receive a brief:

1. **Read for constraints first, not goals.** What can't change? What boundaries
   has the user already drawn? Constraints define the design space; goals are
   the search inside it.
2. **Draft one concrete shape.** ASCII boxes, file tree, sequence, table — pick
   the form that compresses the most constraints into the fewest pixels.
3. **Mark what the shape doesn't accommodate.** This is the second move. The
   gaps in the draft are the real conversation.
4. **Refuse to expand scope to fit the gap.** Surface the gap as a decision for
   the orchestrator/human. (z026 dilemma shape.)
5. **Two faces (z022) when the design will be read by both human and Gin.**

## What you do NOT do

- Write production code. You sketch; the orchestrator dispatches a builder.
- Add features the user did not name. Scope-creep masquerading as design is the
  most common failure mode for designers; refuse it explicitly.
- Use design-school vocabulary unprompted ("affordance", "information
  architecture", "user journey"). Speak in the user's words.
- Decide what the user must decide. Surface the fork; do not pre-pick.

## Biases (knobs, when used in a team)

Your default thumb on the scale, when prioritizing or choosing among shapes:

- **Prefer fewer moving parts** over more flexibility. Two simple things beats
  one configurable thing.
- **Prefer named entities** over anonymous shapes. A thing with a name is easier
  to reference, version, and supersede.
- **Prefer placement over invention.** If a place exists for the new thing,
  use it. New places need a z020-shaped justification.

These are knobs, not laws. Other personas on the team will pull other directions
(Mark prefers velocity; Poll prefers rigor). The orchestrator reads the spread.

## Read first

- `usegin/CLAUDE.md` — UseGin spirit
- `usegin/zettel/zettels/z020-decision-shape-in-claude-md.md` — decision shape
- `usegin/zettel/zettels/z026-dilemma-protocol.md` — surfacing forks
- `usegin/zettel/zettels/z037-find-or-create-a-place-if-not-comfortable-make-it-comfortabl.md` — placement
- `usegin/personas/din/biases.md` — your knobs (if it exists yet)

## How you return to the orchestrator

```
Shape: <one-line description of the draft>
Path: <where you wrote it>
Gaps: <what the shape doesn't accommodate; orchestrator-relevant forks>
```

If the brief itself is the problem — you literally cannot draft a shape because
the constraints contradict — return *that* in z026 dilemma shape and stop.
```

And the **invocation shim** at `.claude/agents/din.md`:

```markdown
---
name: din
description: Din — the designer. Use Din when an input needs to be shaped — turned from a brief or a pour into a concrete sketch (file tree, ASCII boxes, sequence, table). Din finds the design in what the user already said; he does not invent requirements. Triggered by phrases like "ask Din", "have Din sketch", "let Din shape this", "what shape would Din pick", or whenever the next step is a concrete shape rather than execution or analysis.
---

# Din — sub-agent invocation

You are **Din**, a designer, spawned as a sub-agent.

## Read first

1. `/workspaces/test-mvp/usegin/personas/din/persona.md` — your identity (SOT).
2. `/workspaces/test-mvp/usegin/personas/din/principles/` — when present.
3. `/workspaces/test-mvp/usegin/CLAUDE.md` — UseGin spirit.

These are the SOT. The frontmatter description is just a one-liner for the
spawning agent to pick you.

## How to behave

Receive the brief. Run identity → posture → return.

## What you do NOT do

(See persona.md.)

## Returning to the caller

```
Shape: <one-line>
Path: <file>
Gaps: <forks for orchestrator>
```
```

This matches Zisser's exact shape and is generated by following sections 1–4 of this whiteboard. **Mark, Poll, Johan, John** would each be one paragraph of identity, four bullets of posture, three explicit refusals, and a list of read-firsts.

### 7. Two failure modes to watch for

These come up enough in the literature and in our skills that they deserve top-billing as *things to surveil for*.

**Failure mode A — the persona is a costume.**
Symptom: the persona generates output that *sounds* like the role but doesn't *decide* differently than vanilla Claude. Test: take a representative input, run it through the persona and through a vanilla call, diff the *decisions* (not the prose). If the decisions are the same and only the voice differs, the persona is a costume. Either tighten the biases (give it a knob), or kill the persona (it's not earning its name).

**Failure mode B — the persona drifts toward "helpful assistant".**
Symptom: across a long session, the persona's posture softens — the consultant stops pushing back, the designer starts inventing scope, the manager starts agreeing with everything. This is the assistant-axis drift Anthropic documented. Mitigation: the *soul* + the *what-you-do-NOT-do* list. Both should be re-readable in one screen. The longer they are, the less they hold.

---

## Bottom — open ends

### Dilemmas (z026 shape)

**D1 — Where do persona files live: `usegin/personas/<name>/` or `<name>/` at repo root (peer to `usegin/`, `zisser/`)?**

- *Options:*
  - (a) `usegin/personas/<name>/` — clusters them under the dev-agent umbrella.
  - (b) `<name>/` at repo root — peer to Zisser, signaling personas can be invoked outside the dev-agent context (Zisser uses Din for design work *outside* dev).
- *Lean:* (a). Most personas serve dev/research/zettel work; promote to repo-root only if a persona's scope outgrows UseGin (the way Zisser did).
- *Why:* containment matches use, per z092. Cheap to promote later; expensive to demote.
- *Price:* if Mark/Poll/Din are used by Zisser too, the path `usegin/personas/din/` reads slightly wrong from a Zisser session.
- *Risk:* persona graveyard if we add personas faster than we use them. Mitigation: only create when a role has been instantiated ad-hoc twice already (pre-game manual, z015).
- *For Lihu to weigh:* whether the cast is dev-team-scoped or whole-life-scoped.

**D2 — Do we ship `manager`, `professor`, `designer` as personas, or just keep instantiating them ad-hoc per skill (z023)?**

- *Options:*
  - (a) Ship the cast — `usegin/personas/{mark,poll,din,johan,john}/` exists, skills reference them by name.
  - (b) Keep z023 (spawn-as-instantiation) — every skill writes its own charter inline; no persona files.
- *Lean:* (a) for *roles we've now used 2+ times across separate skills* (manager, professor, designer all qualify); (b) for one-shots.
- *Why:* z023 said "don't pre-build a roster". It was right then (one R&D round, 8 ad-hoc professors). It's now wrong for the recurring three — we are about to write the same charter for the 3rd time, and that's the threshold (z015 — systematize what we've done by hand).
- *Price:* maintenance overhead — when the persona's posture changes, every skill that references it needs to be re-read against the new persona.
- *Risk:* the cast becomes a habit, not a tool. Mitigation: each persona's `persona.md` says explicitly *when not to use this persona*.
- *For Lihu to weigh:* whether the named cast is now load-bearing enough to commit to.

**D3 — How do biases compose in a team?**

- The team-2 (Mark + Poll) outputs converge or diverge — what's the orchestrator's read protocol? `prioritize` already has Borda aggregation. Do we want a richer "team-debate" pattern (multi-agent debate literature) or stay with read-the-spread?
- Lean: stay with read-the-spread for now. The multi-agent debate literature ([Du et al. 2305.14325](https://arxiv.org/abs/2305.14325)) shows debate helps factuality but adds latency and cost; for our work (mostly judgment, not factuality) we don't yet have evidence the latency pays off. Revisit once we have a concrete case where read-the-spread missed.

**D4 — Two-faced persona files?**

- The Zisser file at `.claude/agents/zisser.md` is single-faced (it's the spawn shim — one consumer, the spawning agent). The lab file `zisser/zisser.md` could be two-faced (Lihu + Zisser both re-read it).
- Lean: the **lab file** is two-faced (`## Human side` / `## <Persona> side`); the **invocation shim** is single-faced.
- Why: matches z022's operational test — does both sides meaningfully consume?

### Known gaps

- **No empirical measurement of our own personas' effect.** We don't currently have a baseline that says "Zisser's posture changes Zisser's decisions vs vanilla-Claude on the same input." Worth running once on Zisser, Consultant, and the proposed Din to confirm they're not costumes (failure mode A above).
- **Voice / comfort-axes (z019) is a 5×5 matrix that's currently empty.** When personas address specific humans (Mark to Lihu, Mark to Oria), what's the per-cell difference? Currently unspecified. Open-to-empty until friction.
- **No retro skill exists for personas yet.** `team-retro` retros teams; `skill-retro` retros skills. A persona running across skills should retro at the persona level — does Din's posture hold? When does it drift? Not built; gap noted.
- **Naming-collision check via Wispr.** Recommended before committing to "Mark / Poll / Din / Johan / John" — run them through Wispr Flow and see what corruptions emerge. Two of them collapsing into one (Johan/John risk above) would be a real cost.

### Friction zettels captured during this investigation

- *None new.* The investigation reused existing zettels (z019, z022, z023, z025, z026, z027, z033, z086–z088, z091, z092). The lack of new friction is itself signal — the persona-design question fit cleanly inside the corpus we already have.

---

## Sources

### Internal (this repo)

- `usegin/zettel/zettels/z019-comfort-axes-per-addressee.md` — speaker × addressee matrix; voice as load.
- `usegin/zettel/zettels/z022-two-faces-when-suitable.md` — two-faced artifacts.
- `usegin/zettel/zettels/z023-spawn-as-instantiation.md` — charter is the persona; don't pre-build rosters.
- `usegin/zettel/zettels/z025-consultant-external-but-internal.md` — soul as one-paragraph stance.
- `usegin/zettel/zettels/z026-dilemma-protocol.md` — how a persona surfaces a fork.
- `usegin/zettel/zettels/z027-unlimited-resources-can-not-should.md` — token economy is on output not input.
- `usegin/zettel/zettels/z033-rename-gin-to-usegin.md` — naming as addressability.
- `usegin/zettel/zettels/z086-process-over-outcome-*.md` — process is upstream of artifacts.
- `usegin/zettel/zettels/z087-how-we-work-with-gin-*.md` — pour-and-process protocol.
- `usegin/zettel/zettels/z088-pour-and-process-is-the-protocol-*.md` — protocol generalizes across humans.
- `usegin/zettel/zettels/z091-autonomous-vibe-for-gin.md` — vibe ≠ workflow; posture is durable.
- `usegin/zettel/zettels/z092-zisser-as-lihu-chief-of-staff-*.md` — peer agent at repo root.
- `.claude/agents/zisser.md` — exemplar invocation shim (frontmatter shape, read-first list, posture, NOT-list, return shape).
- `zisser/zisser.md` and `zisser/CLAUDE.md` — exemplar lab file (referenced by the shim).
- `.claude/skills/consult/SKILL.md` — exemplar charter as instantiation.
- `.claude/skills/brainstorm/SKILL.md` — sharpening biases via varied priming.
- `.claude/skills/refine/SKILL.md` — persona as role on a team.
- `.claude/skills/prioritize/SKILL.md` — explicit knobs ("prefer Effort over Impact when tied").
- `.claude/skills/companion/agent.md` — observer persona; refuses execution.
- `.claude/skills/tdd-execute/prompts/{red,green,refactor,scaffolding}-tweaker.md` — disposable role charters; correctly nameless.
- `.claude/skills/tdd-execute/prompts/discipline-reviewer.md` — unseeded reviewer; brief = sole input.
- `.claude/skills/research/phase-manager.md`, `.claude/skills/build-orchestrate/SKILL.md`, `.claude/skills/build-liaison/SKILL.md`, `.claude/skills/rnd/SKILL.md` — orchestrator persona shapes.

### External

- Mollick et al., *"Playing Pretend: Expert Personas Don't Improve Factual Accuracy"* (SSRN 5879722, 2025) — [https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5879722](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5879722). Expert personas damage factual accuracy on MMLU.
- *"Expert Personas Improve LLM Alignment but Damage Accuracy: Bootstrapping Intent-Based Persona Routing with PRISM"* — [arXiv 2603.18507](https://arxiv.org/html/2603.18507v1). Task-type dependence: alignment-tasks helped, pretraining-tasks hurt.
- Zheng et al., *"When 'A Helpful Assistant' Is Not Really Helpful: Personas in System Prompts Do Not Improve Performance of LLMs"* — [arXiv 2311.10054](https://arxiv.org/html/2311.10054v3). Persona effect is largely random across tasks.
- The Register, *"Telling an AI model that it's an expert makes it worse"* (2026-03-24) — [theregister.com](https://www.theregister.com/2026/03/24/ai_models_persona_prompting/). Lay summary; useful framing.
- Du et al., *"Improving Factuality and Reasoning in Language Models through Multiagent Debate"* — [arXiv 2305.14325](https://arxiv.org/abs/2305.14325). Society-of-mind via debate; gains on factual+reasoning, costs in latency.
- *"PTFA: An LLM-Based Agent that Facilitates Online Consensus Building Through Parallel Thinking"* — Six Thinking Hats translated to LLMs in parallel ([Springer chapter](https://link.springer.com/chapter/10.1007/978-981-95-7078-2_9)).
- *PersonaGym: Evaluating Persona Agents and LLMs* — [arXiv 2407.18416](https://arxiv.org/html/2407.18416v2). Benchmark for persona-agent quality.
- Anthropic, *"The assistant axis: situating and stabilizing the character of …"* — [anthropic.com/research/assistant-axis](https://www.anthropic.com/research/assistant-axis). Documents the assistant-drift direction in persona space.
- Anthropic, *Claude's Constitution* — [anthropic.com/constitution](https://www.anthropic.com/constitution). Intellectual-humility approach; not-an-objective-source posture; concise default style.
- Anthropic Claude Code docs, *Create custom subagents* — [code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents). Frontmatter contract: `name`, `description`, `tools`, `model`. Body is the system prompt.
- CrewAI docs, *Agents* — [docs.crewai.com/en/concepts/agents](https://docs.crewai.com/en/concepts/agents). Role / Goal / Backstory / Tools as the agent shape; YAML config preferred.
- Microsoft AutoGen docs, *All About Agent Descriptions* — [microsoft.github.io/autogen/0.2/blog/2023/12/29/AgentDescriptions/](https://microsoft.github.io/autogen/0.2/blog/2023/12/29/AgentDescriptions/). `description` (for the orchestrator) is separate from `system_message` (for the agent itself) — same separation we make between `.claude/agents/<name>.md` description and `usegin/personas/<name>/persona.md` body.
- Hu et al., *"Consistently Simulating Human Personas with Multi-Turn Reinforcement Learning"* — [arXiv 2511.00222](https://arxiv.org/html/2511.00222v1). Multi-turn RL reduces persona inconsistency >55%; relevant to drift-mitigation if we ever go beyond prompt-only.
- Zhang et al., *"Enhancing Persona Consistency for LLMs' Role-Playing using Persona-Aware Contrastive Learning"* — [ResearchGate 394298208](https://www.researchgate.net/publication/394298208_Enhancing_Persona_Consistency_for_LLMs'_Role-Playing_using_Persona-Aware_Contrastive_Learning). Drift mitigation via training-time interventions; we use prompt-time + corpus instead.
