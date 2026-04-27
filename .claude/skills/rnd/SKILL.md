---
name: rnd
description: Spawn a parallel R&D team to study a question — pre-decompose into N independent angles, write a charter per agent, fire them all in parallel, commit each whiteboard as it lands, then cross-cut a synthesis. Use proactively when a topic has multiple angles, the question is genuinely "bring back what we can learn", or scope is bigger than one head can hold. Triggered by phrases like "let's R&D X", "research X — bring back everything we can learn", "do homework on X", "send a team to study X", "spawn N professors for X", or "/rnd". Not for: a single targeted question (use Explore sub-agent), shipping work (use slicing-specs + liaison), or a question one read of a doc would answer.
---

# rnd — parallel R&D team spawning

**You can — and should — spawn a parallel team of professors whenever a question is wide enough that one investigator misses angles.** This skill is the codified shape of an R&D round: decompose, charter, fan out, synthesize.

Each spawned agent is a Gin (z023 — spawn-as-instantiation; the charter prompt *is* the professor). The team is one-shot — professors are instantiated for this question, not kept on a roster. Per z027, the budget is open: spend tokens on depth and parallelism, economize prose to Lihu.

## When to invoke

Reach for this skill — don't wait to be asked — when any of these fire:

| Signal | Why R&D, not Explore |
|---|---|
| Lihu says "let's R&D X" / "send a team to study X" / "do homework on X" / "spawn N professors for X" | Direct trigger |
| The question is "bring back everything we can learn from W" (a domain, a body of practice, a corpus) | Single-investigator coverage will miss angles; parallelism *is* the point |
| You hit a topic with ≥3 genuinely independent angles (e.g. "doctrine + history + modern application") | Each angle deserves its own context window so it gets read deeply, not skimmed |
| You're tempted to write one mega-charter that says "investigate X, Y, and Z" | Stop — that's a fan-out a single agent can't do (z029). Decompose at the orchestrator |
| The output should be a synthesis ranking patterns, not a single answer | Synthesis only earns its keep when the inputs were independently produced |

When *not* to invoke:
- A pinpoint question with a known answer location → Read directly, or spawn one Explore.
- A shipping task with acceptance criteria → use `slicing-specs` + `liaison`.
- "Skim X and tell me the gist" → one Explore, not a team.

## Lifecycle

```
decompose → pre-create folder structure → write charters → spawn parallel
   → commit each as it lands → cross-cutting synthesis → bring dilemmas
```

### 1. Decompose into independent angles

Pick 3–N angles such that each professor can produce a useful whiteboard *without reading the others*. Independence is what unlocks parallelism. If two angles overlap heavily, fold them into one charter.

Empirical sizing from the three rounds we've run:
- Zettelkasten R&D (ENG-5379): 8 angles
- This-turn 8-agent queue (slice-2 designer, auto-pop, distillation, etc.): 8 angles
- War-management R&D: 6 doctrine sources + 1 synthesizer

Below 3 → just spawn one Explore. Above ~10 → you're probably mixing levels (a meta-angle and its sub-angles); regroup.

**Critical: pre-decompose at the orchestrator. Do not write a single "manager" charter that fans out.** Per z029, sub-Gins spawned via the Agent tool do not get the Agent tool themselves — they cannot fan out further. The doc-method-team manager hit this exact wall and had to serialize four investigations inline. Keep fan-out at the orchestrator (you), not inside a charter.

If you genuinely need a sub-fan-out (rare), spawn the first-tier Gin as a headless `claude` session (the consultant pattern) so it inherits a full toolbelt — but most of the time, just decompose more at the top.

### 2. Pre-create the folder structure

Decide where it lands first (see "Where things land" below), then create the folder tree before writing charters. Each professor gets `<root>/<angle-name>/` and writes `whiteboard.md` (or whatever the charter names) into it.

Pre-creating the tree means:
- Charters can name exact deliverable paths.
- The harness convention against "report files" yields to charter-explicit deliverables (z030 is the friction; the workaround until that's fixed is to name the path in the charter and tell the professor to use Bash heredoc + `tee` if Write is denied).
- Each professor's commit is a clean isolated diff.

### 3. Write a charter per agent

Charters are the instantiation (z023). The charter *is* the professor. Vague charter = vague professor. Use this recurring template — every section earns its keep:

```
You are a professor of <angle>. Read the following first, then carry out the mandate.

## Read first
- <file path>
- <file path>
- <zettel id>
- <Linear issue>

## Mandate
<One sentence. What do you produce, for whom, why does it matter.>

## Scope
<What's in. What's explicitly out (so you don't drift).>

## Working rules
- Spawn freely (Read, Grep, Bash, sub-Explore agents) within your charter.
- Capture friction as zettels via the `zettel-capture` skill — don't push through silently. (z009 friction loop.)
- Do NOT commit. The orchestrator commits after you return.
- Do NOT write outside <your folder>.
- If the harness blocks a charter-named deliverable, fall back to Bash heredoc + `tee` (z030).
- If you genuinely cannot lean on a sub-decision, name it in the dilemma section in z026 shape.

## Deliverable
Write `<exact path>/whiteboard.md` with this shape:

  ## Top — the click
  <The single most-load-bearing finding. What every reader needs.>

  ## Middle — the body
  <Evidence, sources, citations, structured findings.>

  ## Bottom — the open ends
  <Dilemmas (z026 shape), known gaps, things you couldn't read,
   friction zettels you captured.>

Return a ≤10-line summary in chat: top finding + path to whiteboard.
```

The "top/middle/bottom" shape is what makes whiteboards readable later. The synthesizer reads only "top" across all whiteboards; deeper readers descend.

### 4. Spawn all in parallel

Fire all charters in one batch (multiple Agent tool calls in a single response). Run them as background agents if the harness supports it; otherwise let the Agent calls block — they still parallelize at the model layer.

Do not babysit. Each professor returns a summary; you read the summaries when they land, not while they're running.

### 5. Commit each whiteboard as it lands

**Do not batch commits at the end.** Per `reference_autosync_concurrent_collisions`, a stranger's stale snapshot can silently revert a batch. Per `feedback_commits_at_every_change`, commit after every meaningful change anyway.

The cadence: each professor returns → you check the diff → commit that one whiteboard → push (autosync handles the push). Repeat per professor. By the time the synthesis runs, every input is already on `origin/main`.

Commit message pattern: `research(<topic>): <angle> whiteboard`.

### 6. Cross-cutting synthesis

After all whiteboards land, run the synthesis. Two shapes — pick by token budget:

- **Spawned synthesizer.** A 7th (or N+1th) Gin whose charter is "read all N whiteboards, distill the cross-cutting findings into `<root>/SYNTHESIS.md` (or `findings.md` if there's a downstream `recommendation.md`)". Use this when the inputs are large and you want main-thread tokens preserved.
- **Main-thread synthesis.** You read the "top" sections, distill in-line, write the synthesis yourself. Use this when you want to bring the synthesis to Lihu in chat directly.

Synthesis shape: laconic (z036). Patterns first, evidence second, open dilemmas in z026 shape last. Don't repeat what's in the whiteboards — point to them.

### 7. Bring dilemmas in z026 shape

Anything the synthesis surfaces that needs Lihu's input lands in the `recommendation.md` (or chat reply) in z026 form: Decision needed → Options → Lean → Why → Price → Risk → For you to weigh. No menu without a recommendation. No hedging.

When Lihu picks, immediately write the z020 decision in the right artifact — Linear issue body if it shapes a spec, Linear comment if it's tactical, zettel if it's meta.

## Where things land

Two homes — Lihu picks per case:

| Use case | Home | Why |
|---|---|---|
| Gin-internal R&D — DX, conventions, sub-app design, agent orchestration | `usegin/research/<topic>/` | Per z024, don't Linear-everything for Gin. Code-adjacent, lighter, no engineering-feed pollution. The war-management round (z075) and the documentation-method round are both here. |
| Shipping-product R&D — feature design, architectural calls that affect humans | Linear parent issue + N sub-issues + cross-cutting synthesis comment on the parent | The Zettelkasten R&D round (ENG-5379, sub-issues ENG-5380..5387) is the canonical example. Linear's parent + children + comment thread maps cleanly to umbrella + execution + synthesis. |

When in doubt, `usegin/research/`. Promote to Linear if/when the topic earns it.

## Common mistakes

- **Batching commits at the end.** Autosync collision risk (`reference_autosync_concurrent_collisions`). Commit per whiteboard.
- **One manager charter that fans out.** Sub-Gins via Agent tool can't spawn further (z029). Decompose at the orchestrator.
- **Forgetting the friction-capture pointer.** Charters that don't tell the professor to use `zettel-capture` produce silent friction; we lose the DX-of-DX signal (z048). Always include the working-rules line about capturing friction as zettels.
- **Vague charters.** "Investigate X" with no read-first list, no scope, no deliverable shape produces vague whiteboards. The charter is the instantiation (z023) — write it like you're naming a person.
- **Synthesizing before all inputs land.** The whole point of parallelism is independent angles — synthesizing partial inputs biases the synthesis toward the early returners. Wait.
- **Skipping the "top/middle/bottom" deliverable shape.** Whiteboards without a top become unreadable two weeks later. The top is what survives.
- **Long prose in the synthesis to Lihu.** Long investigation does not earn long report (z018, z036). Top finding + dilemmas + pointers. Lihu's attention is the limit (z027).
- **Pre-rolling a roster of "professor archetypes".** Each round is one-shot per z023 — instantiate what the moment needs, don't institutionalize.

## Friction-capture pointer for charters

Every charter must include this line in the working rules:

> Capture friction as zettels via the `zettel-capture` skill (`dx zettel add --as=usegin`). If the harness blocks something the charter names — a deliverable path, a write, a tool — name the fork (z009), don't push through silently. The friction is the signal we want.

This is non-negotiable. The R&D rounds we've run produced as much value from friction zettels (z029, z030, z058–z073) as from the whiteboards themselves.

## At the end

When the synthesis lands and the dilemmas are with Lihu:

- Write a closing zettel naming the round and what it produced (e.g. z075 for war-management).
- If the round produced a decision Lihu accepted, write the z020 decision artifact in the right place (Linear / zettel / comment).
- If the round produced a recurring pattern (3rd+ instance of something), capture it as a meta-zettel — that's the trigger for codifying it as a skill (this very skill exists because z076 fired).

## Lab

See `.claude/skill-lab/rnd.md` for intent, success signals, known limitations, retro guide, and the running list of rounds we've used this skill on.
