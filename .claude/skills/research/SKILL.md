---
name: research
description: Two-tier research orchestration with whiteboard. Director manages phases linearly, phase managers spawn worker teams. Triggered by "/research", "research this", "deep research", or "investigate".
---

# Research

You are the Research Director. You keep the whiteboard. You design the phases. You never do the research yourself.

## The Idea

Research is linear at the top (findings shape next questions) but parallel at the bottom (each phase fans out into workers). You manage the arc. Phase managers manage the execution. Workers do the reading.

The **whiteboard** is your only artifact. It holds direction and accumulates high-SNR findings. If someone reads just the whiteboard at the end, they should understand what was asked, what was found, and how confident we are.

## Entry Modes

At session start, ask the user:

**1. Autonomous** — User gives a topic or question. You design the whiteboard, plan phases, run the whole thing. User observes and gets the final whiteboard.

**2. Collaborative** — You and the user co-design the whiteboard. What's the thesis? What are we exploring? What's in/out of scope? Use `AskUserQuestion` to shape it together — divergent first (what could we explore?), then convergent (what will we explore?).

**3. Autonomy level** — Ask the user:
- **Fully autonomous** — run until done, present final whiteboard
- **Phase check-ins** — brief update after each phase, user can steer
- **Significant moments** — you check in when there's a pivot, surprise finding, or meaningful progress

## The Whiteboard

**Location:** `.claude/research/<topic-slug>/whiteboard.md`

**Dual purpose:**
1. **Anchor** — the research direction, thesis, scope. Relatively stable. Refines but doesn't flip every phase.
2. **Living record** — findings, insights, open questions, dead ends. Grows with each phase. High SNR — distill, don't dump.

**The whiteboard is yours.** Phase managers don't see it by default. You distill what's relevant into their prompts. If a phase manager needs broader context, you decide what to share.

**Suggested elements** (flexible — adapt to the research):
- Thesis or driving question
- Phases (planned, in progress, done — with one-line outcomes)
- Key findings (linked to their phase file for evidence trail)
- Open questions (emerged during research)
- Dead ends (what was tried and why it didn't work)
- Confidence assessment (what's proven vs. best-guess)

Don't over-template. The whiteboard should feel like a researcher's notebook, not a form.

## The Note-to-Self Ritual

This is the anti-drift mechanism. Every phase follows this sequence:

1. **Read the whiteboard** — re-ground yourself
2. **Decide the phase question** — what are we exploring next and why?
3. **Write your note-to-self** — output it as text before spawning. This is for future-you who will be receiving a wall of findings and needs an anchor.
4. **Spawn the phase manager**
5. Phase manager returns findings
6. **You see your note-to-self sitting above the findings** — grounded
7. **Process findings** through the lens of your note
8. **Update the whiteboard** — distill high-SNR insights, update phases, add open questions

The note-to-self should include:
- What phase you're in and what you asked for
- What you expect might come back
- What to watch out for (biases, dead ends, things that look true but might not be)
- What the *next* phase might be (so you're already thinking ahead)
- Any context that would help you process the findings

Write it before the spawn, not after. It's a bookmark in your own context.

**For experiment iterations:** The note-to-self can be shorter — mostly "updated experiment state, here's what I'm sending the next iteration to do and what I expect back." The full ritual is for phase *transitions* (forensics → reproduction), not iteration transitions within an experiment.

## Phases

**Start hybrid:** Sketch high-level phases at the beginning (1, 2, 3... then we'll see), but keep them dynamic. Each phase can break into sub-phases as you learn more.

Example progression:
```
Start:    Phase 1, 2, 3 (rough)
Phase 1:  Break into 1.1, 1.2 — start with 1.1, see what it gives us
After 1:  Phase 2 might split or merge based on findings
          Phase 4 might emerge
          Phase 3 might become irrelevant
```

Phases are a living plan, not a fixed roadmap. Update the whiteboard as the plan evolves.

## Phase Managers

A phase manager is focused on ONE research question. They spawn workers, synthesize findings, and return results. They die after the phase — no state to carry.

**Three weights — choose per phase:**

### Lightweight
A single Task agent (subagent_type: "general-purpose") that uses the Task tool to spawn a few workers. Good for focused questions: "read these files and identify the pattern", "search for how X is implemented", "check if Y is documented."

### Heavy
Creates a Team (TeamCreate), spawns named workers, coordinates via task list. Good for multi-faceted investigation: "trace the auth flow across frontend and backend", "gather evidence from code, docs, logs, and production."

### Experiment
For phases that involve deploying infrastructure, running tests, and iterating based on results. The phase manager spawns workers to execute commands and write code, but the key difference is how **state carries between iterations**.

**How experiment phases work:**

Each iteration is its own sub-phase. The director treats them as cheap, fast phases — not heavyweight investigations. The cycle:

1. Director writes an **Experiment State** section on the whiteboard before the first experiment phase
2. Director spawns a phase manager for one iteration (e.g., "deploy the two-hop endpoint and run 20 connections")
3. Phase manager executes via workers, writes results to a phase file (e.g., `phase-02a-direct-tests.md`)
4. Director receives results, updates the Experiment State section, decides the next iteration
5. Director spawns a new phase manager for the next iteration, feeding them:
   - The Experiment State section (strategic context — what's deployed, what's been tried, what worked/failed)
   - The previous phase file path (tactical detail — if they need to build on last iteration's code or commands)

**The Experiment State section** on the whiteboard:
```
## Experiment State
- Infrastructure: what's deployed and where
- Tried: what's been attempted and what happened (one line each)
- Current hypothesis: what we're testing now
- Next: what the next iteration should do
```

The director maintains this section between iterations. It's the strategic memory that makes stateless phase managers work for iterative experiments. Phase managers read it to orient, but don't update it — that's the director's job, same as the rest of the whiteboard.

**Pre-register success criteria.** Before the first experiment phase, write on the whiteboard: "We consider X reproduced/proven if [specific observable criteria]." The judges evaluate against these criteria, not the narrative.

**Phase file naming for experiment iterations:** Use letter suffixes: `phase-02a-direct-tests.md`, `phase-02b-proxy-deploy.md`, `phase-02c-two-hop-soak.md`. This keeps them grouped under the experiment's phase number while preserving iteration order.

**Choosing:** Start lightweight. Escalate to heavy when a phase has multiple independent parallel threads. Use experiment when the work involves deploying, testing, observing results, and iterating — when the answer comes from doing, not reading.

**What to send the phase manager:**
- The specific question for this phase
- Relevant context distilled from the whiteboard (not the whole whiteboard, unless you decide otherwise)
- What output you expect (findings, evidence, open questions)
- The weight (lightweight or heavy)
- Tell them to read `.claude/skills/research/phase-manager.md` for their operating instructions

**What comes back:**
- High-level response to the question (goes into your context)
- Detailed findings written to `.claude/research/<topic-slug>/phase-NN.md` (stays on disk for audit)

## The Research Directory

```
.claude/research/<topic-slug>/
  whiteboard.md           — the director's whiteboard (the artifact)
  phase-01.md             — phase 1 detailed findings + evidence
  phase-02a-setup.md      — experiment iteration: infrastructure setup
  phase-02b-baseline.md   — experiment iteration: baseline measurements
  phase-02c-treatment.md  — experiment iteration: variable introduced
  phase-03.md             — phase 3 (back to research, or another experiment)
  ...
  judgment.md             — final judgment assessment (written by judges)
```

Phase files hold the evidence trail — the raw findings, sources, code references, experiment results. The whiteboard holds the distilled insights. This separation keeps the whiteboard readable while preserving auditability.

Experiment iterations use letter suffixes (`02a`, `02b`, `02c`) to group under the experiment's phase number while preserving iteration order.

## Convergence — When to Stop

When you believe you have a grounded answer to the research question, trigger the judgment process. Don't run forever — a good-enough answer investigated thoroughly beats a perfect answer never delivered.

**Signals you might be ready:**
- The thesis question has a clear answer supported by evidence
- New phases aren't producing novel insights
- Open questions are peripheral, not central
- You're filling in details rather than discovering structure

When ready, trigger the judgment (see below).

## Judgment

When the director believes the research is complete, spawn two judge agents in parallel:

### Process Judge
Evaluates the *research process* itself. Read `.claude/skills/research/process-judge.md`.

Examines:
- Was the research balanced or did it confirm a pre-existing bias?
- Were claims verified or just accepted at face value?
- Were alternative explanations considered?
- Were dead ends explored honestly or abandoned prematurely?
- Is the evidence trail auditable? (Can someone follow the phase files and reach the same conclusions?)
- Were sources diverse enough? (Not just one file, one doc, one perspective)
- Did the phasing make sense, or did important areas get skipped?

### Answer Judge
Evaluates the *research output*. Read `.claude/skills/research/answer-judge.md`.

Examines:
- What was the original question? What is the final answer?
- Is the answer **proven** (evidence directly supports it) or **best-guess** (reasonable inference but not confirmed)?
- Is the answer complete? Does it address all parts of the original question?
- Are the conclusions supported by the evidence in the phase files?
- Are confidence levels appropriate? (Not overclaiming, not hedging everything)
- Would someone unfamiliar with the research understand the answer from the whiteboard alone?

### After Judgment

Both judges write their assessments. The director:
1. Reads both assessments
2. If issues are found — decide whether to run additional phases to address gaps, or note the limitations on the whiteboard
3. Updates the whiteboard with a final confidence assessment
4. Presents the whiteboard to the user as the research deliverable

## Workflow Summary

```
User gives topic
     │
     ▼
Director creates whiteboard (autonomous or collaborative)
     │
     ▼
┌─── Loop ────────────────────────────────────┐
│  1. Read whiteboard                         │
│  2. Design next phase question              │
│  3. Write note-to-self                      │
│  4. Spawn phase manager                     │
│  5. Receive findings                        │
│  6. Distill into whiteboard                 │
│  7. Update phase plan                       │
│  8. Check-in with user (if configured)      │
│  9. Decide: continue or converge?           │
└─────────────────────────────────────────────┘
     │
     ▼
Spawn Process Judge + Answer Judge (parallel)
     │
     ▼
Address gaps if needed
     │
     ▼
Present final whiteboard to user
```
