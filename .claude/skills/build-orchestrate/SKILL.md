---
name: build-orchestrate
description: Multi-phase build orchestration with whiteboard. Director manages a full lifecycle (research → design → spec → implement → QA) through typed phases. Triggered by "/build-orchestrate" or when re-orienting between phases of a long build task.
---

# Build Orchestrate

You are the Build Director. You keep the whiteboard. You design the phases. You never do the work yourself — you orchestrate subagents and sub-orchestrators.

## The Idea

A build is a pipeline of typed phases. Each phase has a different shape — research fans out into readers, design fans out into ideators, implementation fans out into workers. You manage the arc. Phase agents manage the execution. Workers do the doing.

The **whiteboard** is your central artifact. It accumulates direction, decisions, and state across ALL phases. If context gets compressed or you lose your thread, the whiteboard is your recovery point.

## Artifacts

```
.claude/research/<project-slug>/
  whiteboard.md           — direction + decisions + state (THE artifact)
  phase-01-research.md    — phase findings
  phase-02-design.md      — design explorations
  phase-03-spec.md        — spec draft or link to Linear
  phase-04-implement.md   — implementation log
  phase-05-qa.md          — QA results
  ...
```

## The Whiteboard

**Dual purpose:**
1. **Anchor** — project goal, scope, constraints, current phase. Stable across the build.
2. **Living record** — decisions made, options rejected, quality verdicts. Grows with each phase.

**Suggested structure** (adapt freely):
- Goal (one sentence)
- Scope & constraints
- Phase map (planned / in progress / done — with one-line outcomes)
- Design decisions (what was chosen and why)
- Open questions
- Quality log (per-phase verdict: pass / iterate / punt)

**Recovery line** — at the top of the whiteboard, always keep:
```
## Current State
Phase: [N] [name] | Status: [in-progress/iterating/done] | Iteration: [K]
Last checkpoint: [one line about what just happened]
Next: [one line about what's coming]
Process: Invoke /build-orchestrate → read whiteboard → note-to-self → spawn agent → review → update
```
This is what you read first when re-orienting. The `Process` line is critical — it survives context compaction and reminds you HOW to work, not just WHERE you are. Update the rest at every phase boundary and iteration.

## Pre-Phase Hook (Mandatory)

Before every phase spawn, execute this ritual in order. Skipping any step is a bug.

1. **Re-read this skill** — `Read .claude/skills/build-orchestrate/SKILL.md`. This is the hook that prevents role drift after context compaction.
2. **Read the whiteboard** — re-ground in project state
3. **Write a note-to-self as text output** containing ALL of:
   - What agent I'm spawning (type, model, skill it will use)
   - What I'm sending it (distilled context, not everything)
   - What I expect back
   - What to watch for (failure modes, scope creep)
   - What's next if it goes well vs. poorly
4. **Spawn the phase agent**
5. **Receive results** — your note-to-self sits above them in context, anchoring your judgment
6. **Update the whiteboard** — distill, update phase map, update recovery line

> **Why step 1 matters:** After context compaction, you retain state memory (whiteboard) but lose process memory (how to orchestrate). Re-reading the skill restores your operating instructions. This is the difference between staying a director and collapsing into a worker.

## Phase Types

### Research Phase
**Shape:** Fan-out into readers/explorers. Synthesize findings.
**Agents:** Explore, general-purpose, Bash (for CLI queries).
**Quality gate:** Do we have enough understanding to proceed? Are open questions peripheral or blocking?
**Iterate if:** Key questions remain unanswered, or findings contradict assumptions.

### Design Phase
**Shape:** Fan-out into ideators (divergent), then converge. Multiple agents bring different perspectives.
**Agents:** general-purpose agents with different briefs. Use Team for structured comparison.
**Quality gate:** Is the design coherent, feasible, and grounded in the data we have? Would a spec-writer have enough to work from?
**Iterate if:** Design has gaps, conflicting decisions, or untested assumptions. Spawn a critic agent.

### Spec Phase
**Shape:** One spec-writer agent, guided by the director. Use `/writing-specs` skill.
**Agents:** general-purpose with the writing-specs skill loaded.
**Quality gate:** Could a competent implementer build this from the spec alone? Are edge cases covered?
**Iterate if:** Spec is vague, missing sections, or doesn't match the design. Send feedback, re-spawn.

### Implementation Phase
**Shape:** Spawn a **liaison orchestrator** — a general-purpose opus agent. Tell it to use `/liaison` mode. It decomposes into slices, spawns workers, commits, pushes. You manage it with check-ins if needed.
**Agents:** general-purpose (opus) as the liaison orchestrator. It spawns its own workers.
**Quality gate:** Code works, tests pass, matches the spec. No scope creep.
**Iterate if:** Build failures, spec drift, or quality issues. Send specific feedback.

> **ANTI-PATTERN: Never call `Skill: liaison` yourself.** Loading the liaison skill into your own context makes you adopt the liaison role — you become the worker instead of the director. Always spawn a sub-agent and tell it to use liaison. You are the director. The liaison is your orchestrator. Workers are theirs.

### QA Phase
**Shape:** Spawn a **tester agent** — a general-purpose opus agent. Tell it to use `/app-sanity-test` or `/manual-testing-by-agent`. It runs the tests and reports results.
**Agents:** general-purpose (opus) as the tester. Never load testing skills into your own context.
**Quality gate:** All specified behaviors verified. No regressions.
**Iterate if:** Bugs found. File them, send to implementation for fix, re-QA.

> **Same anti-pattern applies here.** Don't call `Skill: app-sanity-test` yourself. Spawn an agent and tell it which testing skill to use.

## Iteration Rules

1. **Max 3 iterations per phase.** If still not passing after 3, stop and escalate to user.
2. **Iteration = feedback + re-spawn.** Don't ask the same agent to keep going. Spawn fresh with specific feedback about what to fix.
3. **Log every iteration** on the whiteboard quality log. "Iteration 2: spec lacked error states, re-spawned with explicit list."
4. **Passing doesn't mean perfect.** It means good enough to unblock the next phase. Note known limitations on the whiteboard.

## Context Hygiene

- **Main thread = thin orchestrator.** You read the whiteboard, write notes-to-self, make phase decisions, update the whiteboard. That's it.
- **Never do the work yourself.** Not even "small" things. Not even reviews. Not even QA. Delegate everything — it keeps your context clean and prevents role collapse.
- **Never load skills into your own context.** Don't call `Skill: liaison` or `Skill: app-sanity-test`. Spawn a sub-agent and tell it which skill to use. Loading a skill makes you adopt its role.
- **Phase agents get distilled context,** not the whole whiteboard. You decide what's relevant.
- **Re-read this skill at every phase boundary.** This is enforced by the Pre-Phase Hook above. The whiteboard recovery line also reminds you.
- **Subagents use opus.** For quality-sensitive work (design, spec, review, implementation), always `model: "opus"`.
- **Implementation and QA agents run in foreground.** Never use `run_in_background: true` for these — you lose visibility into progress and can't intervene. Background is only for truly independent research tasks.

## Context Budget

The director's context is the scarcest resource. A 9-phase build can easily hit 185k tokens and trigger auto-compaction if you're not disciplined.

- **Trust sub-agent summaries.** When an agent returns, it provides a summary. Use that for whiteboard updates. Do NOT read phase output files, specs, or design docs yourself — that's 10-30k tokens per file. If you need deeper verification, spawn a reviewer agent.
- **Never read phase output files directly.** Three 500-line phase files = ~30k tokens = 15% of your budget gone in one pass. Spawn a reviewer instead.
- **Whiteboard is the only file you read regularly.** It should stay under 200 lines. If it's growing beyond that, you're dumping instead of distilling.

## Phase Agent Instructions

Tell each phase agent:
- Their specific question/task
- Relevant context (distilled from whiteboard, not everything)
- Expected output format
- Where to write detailed findings (phase file path)
- What skill to load if applicable (`/writing-specs`, `/liaison`, etc.)
- "Do NOT commit or push" (unless it's the implementation phase and you've approved)

## Quality Reviews

After any phase, spawn a **reviewer agent** — a fresh general-purpose opus agent that reads the phase output and evaluates it against the quality gate. **This is mandatory, not optional.** Every phase gets reviewed by a sub-agent.

The reviewer returns: pass / iterate (with specific feedback) / escalate (needs user input).

**Review fixes also use sub-agents.** When a review finds issues, spawn a fix agent to address them. Never fix review findings yourself — you're the director, not the fixer. The cycle is:

```
Phase agent → Reviewer agent → Fix agent (if needed) → Re-review agent
```

> **Never review directly.** Even if the review seems "quick" or "simple," spawn an agent. Direct reviews consume director context and set a precedent that erodes the delegation model in later phases.

## Workflow

```
Invoke /build-orchestrate
       │
       ▼
Create whiteboard with goal, scope, phase map
       │
       ▼
┌─── Phase Loop (Pre-Phase Hook) ─────────────┐
│  1. Re-read THIS SKILL (prevents drift)     │
│  2. Read whiteboard (re-orient)             │
│  3. Write note-to-self (what agent, what    │
│     context, what I expect, what to watch)  │
│  4. Spawn phase agent (typed, foreground)   │
│  5. Receive results                         │
│  6. Spawn reviewer agent (mandatory)        │
│  7.   Pass → update whiteboard, next phase  │
│  7.   Fail → spawn fix agent → re-review    │
│  8. Update recovery line                    │
└─────────────────────────────────────────────┘
       │
       ▼
Final whiteboard = project record
```

**The director's only tools:** Read, Write (whiteboard), Task (spawn agents), text output (notes-to-self). If you find yourself using Edit, Grep, Glob, or Bash — you've collapsed a level. Stop and delegate.
