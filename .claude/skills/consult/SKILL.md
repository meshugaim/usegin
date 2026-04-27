---
name: consult
description: Bring in an external-but-internal voice for fresh-eyes feedback on a specific question — different shape from rnd / brainstorm / refine / prioritize (which are parallel teams). Consult is single-agent, persona-driven, depth-not-breadth. Two modes — persistent consultant (resume `usegin/consultant/` session, his findings accrue across topics) and one-shot fresh-eyes (spawn a new Gin with a strong consultant priming for this question only). Use when you want a second opinion, a sanity check, or a perspective you don't have. Triggered by phrases like "consult on X", "second opinion on Y", "let's ask the consultant", "spawn a fresh-eyes for Z", "/consult", or by your own judgment when the team's read on something feels too inside-baseball.
---

# consult — external-but-internal voice for fresh-eyes feedback

**You can — and should — bring in a consultant when the team's read on something feels too inside-baseball, or when the question genuinely needs a perspective the team doesn't have.** This is the lateral skill — different shape from R&D / brainstorm / refine / prioritize, which are all parallel teams. Consult is single-agent, depth-driven.

```
                ┌────────────┐
                │   CONSULT  │  ← lateral; reachable from any phase
                └─────┬──────┘
                      │
R&D → brainstorm → refine → prioritize → spec → implement
```

The consultant is a Gin (z023). Per z025 — *external in role, internal in team*: his stance is consultant, his charter is to ask hard questions, but his findings are ours and the friction he hits is our friction. Per z027 — burn tokens on the consultation when it earns its keep; a single-agent depth-pass on a tough question is cheap relative to its leverage.

## When to invoke

| Signal | Why consult, not the team-form |
|---|---|
| "Get a second opinion on X" / "Let's run this past the consultant" / "Sanity check Y" | Direct trigger |
| You and the team are converging too easily — the answer feels obvious-in-context but you suspect context is the problem | Consult breaks the contextual lock |
| A decision is high-stakes and you want a fresh-eyes pass before committing | Consult is the cheap insurance |
| The question is "what would someone outside this thread see" | Single-agent fresh-eyes is the literal shape |
| You've finished a brainstorm/refine/prioritize cycle and want a pre-spec sanity check | Consult is the lightweight QA between phases |
| The persistent consultant (`usegin/consultant/`) has accumulated findings on this topic — resume him for continuity | Persistent mode |

When *not* to invoke:
- Need volume of ideas → use **brainstorm**.
- Need breadth across angles → use **R&D**.
- Need a ranked decision → use **prioritize**.
- Need a structured spec → use **spec**.
- Question has a known answer in the codebase → use **Explore**.

## Modes

### Mode A — Persistent consultant (z025 pattern)

The Consultant lives at `usegin/consultant/`. He has a charter (`usegin/consultant/charter.md`), a session id (`usegin/consultant/session-id.txt`), and accumulating findings (`usegin/consultant/findings/`). Across topics, his read of our DX deepens.

Use this mode when:
- The question is in a domain the persistent consultant has touched before.
- You want the consultation to *contribute to* his accumulating view of our work.
- The question is open-ended ("what should we change about X") rather than narrow.

```bash
# Resume his session in your CLI
claude --resume "$(cat usegin/consultant/session-id.txt)"
# or
bun run c -r "$(cat usegin/consultant/session-id.txt)"
```

Bring him the question. He works in `usegin/consultant/` per his charter. You read his findings later via `session <session-id>` or directly under `usegin/consultant/findings/`.

### Mode B — One-shot fresh-eyes consultant (this skill's primary form)

Spawn a *new* Gin with a strong consultant priming, for *this question only*. No persistent session, no `usegin/consultant/` write access — write under `<topic-root>/consult/`.

Use this mode when:
- The question is narrow and self-contained.
- You don't want to perturb the persistent consultant's accumulating context.
- You want N independent fresh-eyes (rare but possible — spawn 2-3, treat as a tiny consult-team).

This is the mode the rest of this skill documents in detail. If you wanted Mode A, just resume the session and skip the rest of this skill.

## Lifecycle (Mode B — one-shot fresh-eyes)

```
frame → pre-create → charter → spawn → read his memo → bring back to team
```

### 1. Frame the consultation question

One sentence + the context the consultant needs + what you want from him. Tight enough that he doesn't drift; open enough that he can push back on the framing itself.

> **Question.** Does our brainstorm / refine / prioritize pipeline have a structural flaw we're missing?
>
> **Context to read.** `.claude/skills/brainstorm/SKILL.md`, `.claude/skills/refine/SKILL.md`, `.claude/skills/prioritize/SKILL.md`, `usegin/zettel/zettels/z086-process-over-outcome*.md`.
>
> **What I want from you.** A consultant memo: 1 page, naming the *one structural flaw* you'd flag if you were dropped in cold. Concrete examples from the actual skill files. If you don't see a flaw, say so — that's also valuable.

### 2. Pre-create the structure

```
<topic-root>/consult/
  question.md       ← the framing (step 1)
  memo.md           ← the consultant's deliverable (step 4)
  reply.md          ← the orchestrator's response / actions taken (step 5)
```

For shipping-product topics, this lives next to brainstorm/refine/prioritize/ if those exist. For Gin-internal, `usegin/research/<topic>/consult/`.

### 3. Charter the consultant

The charter is the priming. Lean into the *external-in-role, internal-in-team* stance:

```
You are an external consultant brought in by the Gin team to give fresh-eyes
feedback on one specific question. You are external in role — you are willing to
say things that the team's internal consensus might not surface. You are internal
in team — your findings belong to us, and the friction you hit while doing this
is our friction (z025).

## Read first
- <topic-root>/consult/question.md   ← what we want from you
- <2-5 files / zettels / docs that ground the question>

## Charter
<single sentence — what is the deliverable, for whom, why does it matter>

## Working rules
- Push back on the framing if the framing itself is the problem. "I'm declining to
  answer the question as posed because X" is a valid first move.
- Be specific. "This pipeline has a flaw" is useless. "Step 4 of refine assumes
  X but ideas.md doesn't have X — concrete: ideator-3's idea about Y has no
  cost-to-try field" is useful.
- Don't perform. We don't need a long memo to feel like we got value. A
  half-page that names the click is better than three pages that hedge.
- If you don't see what we asked for, say so — that's signal too.
- Capture friction as zettels via the `zettel-capture` skill — `dx zettel add
  --as=consultant`. Consultant friction is recorded under his name (z025).
- Do NOT commit. The orchestrator commits.
- Write your memo to <topic-root>/consult/memo.md.

## Deliverable
Write <topic-root>/consult/memo.md with this shape:

  # Consultant memo — <question, one line>

  ## The click
  <One paragraph. The single most-load-bearing finding. What you'd say if you
   had 30 seconds with the team in the hallway.>

  ## Evidence
  <Concrete pointers — file paths, line numbers, zettel ids, quoted snippets
   from the docs you read.>

  ## What I'd push back on
  <Anything in the framing itself you'd reframe. Optional but valued.>

  ## What I won't claim
  <Anything you noticed but can't responsibly assess from this slice.>

Return a ≤6-line summary in chat: the click + path to memo.
```

### 4. Spawn (single Agent call)

One Agent invocation with the charter as the prompt. Background or foreground depending on how long you expect — if the question is wide enough that the consultant needs to read 5+ files, run in background and continue with other work.

If you want N consultants (rare — for high-stakes questions or when you suspect one consultant's prior will dominate), spawn 2-3 with the same charter. The team-of-one becomes a team-of-three. Don't aggregate algorithmically — read all memos, look for convergence and divergence yourself. This is *not* prioritize; it's "what fresh perspectives say."

### 5. Read the memo and reply

The memo is the artifact. Read the click first; descend into evidence only if the click hooks. Then write `<topic-root>/consult/reply.md` — the orchestrator's response to the consultant's findings. Shape:

```markdown
# Reply to consultant memo

## What we accept
<The consultant's findings we agree with, named explicitly.>

## What we push back on
<Anything we disagree with, with reasoning. Honor the consultant's pushback if
he reframed the question — don't dismiss it.>

## What we'll do
<Concrete actions, ideally tagged to ideas in `ideas.md` or sub-issues. If the
consultation triggers a new brainstorm/refine/prioritize round, name it.>
```

The reply closes the loop and gives the consultant feedback for his next call.

### 6. Bring back to the team / pipeline

Three common downstream paths:

| Outcome | Path |
|---|---|
| Consultant validates the team's direction | Continue. Note the validation in the closing zettel. |
| Consultant flags a structural flaw | Re-open the affected pipeline phase (brainstorm if pool is wrong, refine if framing is wrong, prioritize if criteria are wrong). |
| Consultant reframes the question | The original question dies; a new one starts. May trigger a fresh R&D round. |

In all three, capture a closing zettel naming the consultation + outcome.

### 7. Commit + push

One commit per artifact: `consult(<topic>): question + memo + reply`. Single commit OK because the artifacts are tightly coupled (unlike brainstorm where ideators-raw and merged-pool are two distinct stages).

## Distinction from neighboring skills

| Skill | Shape | Output |
|---|---|---|
| **R&D** | N professors, parallel, decomposed | Synthesis of what we learned |
| **brainstorm** | N ideators, parallel, divergent | Flat idea pool |
| **refine** | N refiners, parallel, per-slice convergent | Sharpened pool |
| **prioritize** | N prioritizers, parallel, ranking-convergent | Ranked top-K |
| **consult** | 1 consultant (Mode B) or persistent (Mode A) | Memo + reply |
| **Explore (built-in)** | 1 agent, lookup | Pinpoint answer |

Consult overlaps Explore in cardinality but differs in stance: consult is *opinionated* fresh-eyes feedback, Explore is *fact-finding*. If your question starts with "how" or "where", Explore. If it starts with "should" or "is X right", consult.

## Common mistakes

- **Treating consult as Explore.** Asking a consultant "where is this implemented" wastes the persona. Use Explore for lookups.
- **Charter that dictates the answer.** "Tell me the brainstorm skill is missing X" — bad. Let the consultant find his own click.
- **Skipping the reply.** Without a reply, the consultant's memo is unowned. Write a reply even if it's "we accept all of this, here's what we'll do."
- **Mode confusion.** Persistent consultant (Mode A) is for accumulating context across topics. One-shot (Mode B) is for narrow questions. Don't muddy them — Mode A consultations should write to `usegin/consultant/`; Mode B writes to `<topic-root>/consult/`.
- **Performative memos.** Three pages of hedging is worse than half a page of click. Charter explicitly forbids it; check the deliverable.
- **No friction capture.** Consultant friction is high-signal (z025). Without zettel capture, the value is privately consumed by the consultant alone.

## Friction-capture pointer for charter

> Capture friction as zettels via the `zettel-capture` skill — use `dx zettel add --as=consultant`. Consultant friction is recorded under his name (z025); the zettelkasten author field tracks who hit the wall. If the framing in question.md is uninterpretable, if the read-first list is missing context — name the fork (z009).

## At the end

- Closing zettel: `<topic>` consultation produced `<the click in one line>`. Outcome: `<accept / pushback / reframe>`.
- Reply written.
- If the consultation triggered a new pipeline round, name it.
- If the consultation surfaced a recurring pattern (e.g. "every consult finds we under-spec the framing"), capture a meta-zettel.

## Lab

See `.claude/skill-lab/consult.md`.
