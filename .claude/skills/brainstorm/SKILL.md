---
name: brainstorm
description: Spawn a parallel team of ideators to generate a flat pool of ideas on a topic — no decomposition into independent angles, no filtering, no convergence. Each ideator gets a different priming (persona, constraint, "what if X") and produces a terse idea-list; outputs land as a flat deduplicated pool in a shared `ideas.md`. Use when the question is "what could we try" rather than "what should we do." Triggered by phrases like "brainstorm X", "let's brainstorm ideas for Y", "spawn ideators for Z", "/brainstorm", or by your own judgment when a problem opens up and convergence is premature.
---

# brainstorm — parallel idea-generation team

## Team

This skill drives the **`brainstorm-team`** (see
`usegin/teams/brainstorm-team.md` for composition + operating mode).

Cast: **Poll** (creative priming), **Din** (subtraction priming),
**Johan** (provocation priming), **John** (failure-imagination
priming), **Cal** (direction priming). Persona definitions:
`usegin/personas/<name>.md`. The skill owns *when* and *with what
topic*; the team file owns *who's in it and how they coordinate*.

When authoring the per-ideator charter (step 4 below), pull each
ideator's persona biases + voice from their persona file. Don't
re-write the persona inline.

---

**You can — and should — spawn a team of ideators whenever the goal is volume of ideas, not yet a decision.** This skill sits at the head of the idea pipeline:

```
R&D (learn the domain) → BRAINSTORM (generate ideas) → refine (sharpen) → prioritize (pick) → spec → implement
```

Each ideator is a Gin (z023 — the priming *is* the ideator). The team is one-shot; ideators are instantiated for this question, not kept on a roster. Per z027 — burn tokens on volume, the cost is amortized across the rest of the pipeline.

## When to invoke

| Signal | Why brainstorm, not R&D / Explore / Spec |
|---|---|
| Lihu / Oria says "brainstorm X" / "let's get ideas for Y" / "spawn ideators for Z" | Direct trigger |
| You catch yourself converging too early — picking *the* approach before enumerating options | Convergence is the prioritize skill, not this one. Open the space first. |
| A problem is genuinely open (no obvious right answer, no spec yet, no domain constraint that pre-filters) | Brainstorm thrives on openness. |
| You're tempted to write "we should do X" without naming alternatives | Stop. Run brainstorm first. The alternative space *is* the value. |
| The conversation is in divergent mode (z032 — "let's explore", "what are our options?") | Brainstorm = the parallelized form of divergent mode |

When *not* to invoke:
- The domain is unfamiliar — run **R&D** first to learn it, *then* brainstorm.
- The ideas already exist — run **refine** or **prioritize** instead.
- The question has a known answer — just answer it.
- The deliverable is a spec → use **spec** skill (after prioritize lands a winner).

## Distinction from neighboring skills

| Skill | Output | Convergence |
|---|---|---|
| **R&D** | Learnings, threaded synthesis | Independent angles, synthesis converges |
| **brainstorm** | Flat idea pool | None — overlap is signal, not noise |
| **refine** | Sharpened idea pool | Per-idea convergence (each idea gets clearer) |
| **prioritize** | Ranked list | Full convergence — pick winners |
| **consult** | A memo from a fresh-eyes voice | One agent, not N — different shape entirely |

The convergence happens *across* the pipeline, not inside any single skill. Brainstorm's job is divergence.

## Lifecycle

```
frame → pre-prime ideators → fan out parallel → flat-pool merge → hand off to refine
```

### 1. Frame the brainstorm question

One sentence + the constraints. Tight enough that ideators don't drift; open enough that ideas can be wild.

> **Topic.** What could we add to / change about Gin to make pour-and-process less lossy?
>
> **Constraints.** Lives in `usegin/` or `tools/dx/`. Doesn't break shipping product. Compatible with z086 (process-over-outcome) and z027 (unlimited resources).
>
> **Out of scope.** Anything requiring infra outside this repo. Anything that changes Anthropic harness behavior we don't control.

The framing is the seed — every ideator reads the same frame. Keep it ≤10 lines.

### 2. Pre-prime ideators with different angles

Don't decompose (that's R&D). **Vary the priming**, not the topic.

Common priming axes:

| Axis | Examples |
|---|---|
| Persona | "You are a UX designer" / "You are a hacker who hates ceremony" / "You are a researcher who lives in the corpus" |
| Constraint | "Solve it with zero new tools" / "Solve it with one new dx subcommand" / "Solve it by removing something" |
| Time horizon | "What could we do today" / "What would we do if we had a year" |
| Scale | "What's the smallest possible move" / "What's the biggest possible move" |
| Provocation | "What if the corpus were 10x bigger" / "What if Lihu typed 100x slower" |
| Adjacent-field | "How would a chess coach approach this" / "How would an editor approach this" |

5–10 ideators is the empirical sweet spot. Below 5 → not enough overlap to detect signal-via-convergence. Above 10 → diminishing returns + dedup cost dominates.

### 3. Pre-create the folder structure

```
<root>/brainstorm/
  topic.md          ← the framing (step 1)
  ideators/
    01-<persona-or-angle>.md   ← each ideator's raw output
    02-<...>.md
    ...
  ideas.md          ← the merged flat pool (step 5; the load-bearing artifact)
```

`ideas.md` is the *forward-versionable* artifact that refine + prioritize edit in place (z039 — never delete, bump). Format below.

### 4. Spawn all ideators in parallel

Fire all charters in **one** batched response (multiple Agent tool calls in a single message). Per z029 — sub-Gins can't fan out further, so all spawning happens at the orchestrator (you).

Each ideator returns: 10–30 ideas, terse, no filtering, no ranking. Just bullets.

### Charter template

```
You are <persona / angle>. You are an ideator on a brainstorm team. The team will collectively
generate a flat idea pool; you do NOT need to be exhaustive — the team is.

## Read first
- <root>/brainstorm/topic.md   ← the framing; do not deviate
- <up to 3 zettels / docs that anchor the domain>

## Your priming
<the persona / constraint / provocation, 2-3 sentences. Lean into it. Don't hedge.>

## Working rules
- Generate 10–30 ideas. Each idea = one bullet, ≤2 lines.
- Do NOT filter. Bad ideas go in too — they're calibration data and they cost nothing.
- Do NOT rank. Convergence is downstream.
- Do NOT read other ideators' files. Independence per ideator is what makes overlap meaningful (signal-via-convergence).
- Capture friction as zettels via the `zettel-capture` skill — if a charter constraint is uninterpretable from your priming, name the fork (z009).
- Do NOT commit. The orchestrator commits.
- Do NOT write outside <root>/brainstorm/ideators/.

## Deliverable
Write <root>/brainstorm/ideators/<NN>-<short-slug>.md with this shape:

  # Ideator <NN> — <persona / angle>

  ## Priming (one sentence)
  ...

  ## Ideas

  - **<short title>**: <1-line description>. Why: <1-2 sentences>.
  - **<short title>**: ...

Return a ≤5-line summary in chat: how many ideas, the angle's three highest-energy ones, path to your file.
```

### 5. Merge to flat pool — `ideas.md`

After all ideators return, you (the orchestrator) collect into `ideas.md`. The merge is structured but minimal: preserve every idea, dedupe only **superficial** duplicates (same words, same idea), keep semantic overlap (it's signal — three ideators saying the same thing means the idea is convergent across primings).

Format (load-bearing — refine + prioritize parse this):

```markdown
# Ideas — <topic>

> Source: brainstorm round, <date>, <N> ideators.
> Frame: <root>/brainstorm/topic.md

## Pool

- **<title — atomic claim>**
  - **One-line**: <description>
  - **Why**: <reason>
  - **From**: ideator-<NN> (<persona / angle>) [+ ideator-NN if convergent]
  - **Refined**: *(refine skill fills this in)*
  - **Rank**: *(prioritize skill fills this in)*
  - **Rationale**: *(prioritize skill fills this in)*

- **<next idea>**
  - ...
```

The ✱**convergence count**✱ (how many ideators independently produced the same idea) is the most important field for downstream prioritization — track it in the `From:` line.

### 6. Commit per stage, not per ideator

Unlike R&D (commit per whiteboard), brainstorm commits in *two* stages — both small enough to be safe:

1. After all ideators land + before merge: `brainstorm(<topic>): N ideators raw` — commits the per-ideator files.
2. After merge: `brainstorm(<topic>): merged ideas.md (M ideas, K convergent)` — commits the merged pool.

Each stage is one logical change. Push after each (autosync handles it).

### 7. Hand off to refine

The merged `ideas.md` is the input to the **refine** skill. Don't refine in this skill — that's a different mode (per-idea sharpening, dedup of semantic-not-just-syntactic overlap, gap-filling). The handoff is just: "ideas.md is ready, run refine."

If the human says "skip refine, just prioritize" — fine, but flag that semantic overlap won't be cleaned up; prioritize will inherit some noise.

## Where things land

| Use case | Home |
|---|---|
| Gin-internal brainstorm (DX, conventions, agent design) | `usegin/research/<topic>/brainstorm/` (next to any R&D output on the same topic) |
| Shipping-product brainstorm | Linear parent issue + sub-issues per ideator + the merged `ideas.md` as a parent-issue comment |

When in doubt, `usegin/research/`.

## Common mistakes

- **Filtering during brainstorm.** Bad ideas serve as calibration; cutting them mid-stream collapses signal. Keep them all to refine.
- **Pre-decomposing the topic.** That's R&D. Brainstorm wants overlap.
- **Skipping the priming.** Without priming, all ideators produce the same handful of obvious ideas. Variation in priming is the engine.
- **Committing per ideator.** Too granular; the per-ideator commits will collide if 8 land within seconds of each other (autosync race). Two-stage commit instead.
- **Reading other ideators' files mid-run.** Breaks independence — once an ideator sees another's output, the convergence signal is lost.
- **Writing thick, narrative ideas.** Each idea is ≤2 lines. The compression *is* the discipline. Refine adds depth later.
- **Long-prose merge.** The merge is mechanical — a flat list, not a synthesis. Don't editorialize during merge.

## Friction-capture pointer for charters

Every charter must include this line in working rules:

> Capture friction as zettels via the `zettel-capture` skill (`dx zettel add --as=usegin`). If your priming is uninterpretable, if the topic file is missing, if the harness blocks the deliverable — name the fork (z009 friction loop). Do not push through silently.

Same non-negotiable as R&D. Brainstorm under-pressure is the most common failure mode where ideators silently dilute their priming to "play it safe" — friction zettels catch this.

## At the end

When the merged `ideas.md` is ready:

- Write a closing zettel: `<topic>` brainstorm produced `<M>` ideas, `<K>` convergent (≥3 independent ideators). Note the strongest convergent ones — they survive the prior to refinement.
- Hand off to refine (next skill) or to the human for picking.
- If the round produced a recurring pattern (e.g. "every brainstorm on Gin's DX produces ideas about the corpus"), capture that as a meta-zettel.

## Lab

See `.claude/skill-lab/brainstorm.md` for intent, success signals, known limitations, retro guide, and the running list of brainstorm rounds.
