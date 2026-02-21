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
```
This is what you read first when re-orienting. Update it at every phase boundary and iteration.

## The Note-to-Self Ritual

Borrowed from the research skill. Before every phase spawn:

1. **Read the whiteboard** — re-ground
2. **Write a note-to-self as text output** — what you're sending, what you expect back, what to watch for, what's next if it goes well vs. poorly
3. **Spawn the phase agent**
4. **Receive results** — your note-to-self sits above them in context, anchoring your judgment
5. **Update the whiteboard** — distill, update phase map, update recovery line

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
**Shape:** One orchestrator agent using `/liaison` skill. They decompose and delegate.
**Agents:** general-purpose with liaison skill. They spawn their own workers.
**Quality gate:** Code works, tests pass, matches the spec. No scope creep.
**Iterate if:** Build failures, spec drift, or quality issues. Send specific feedback.

### QA Phase
**Shape:** One tester agent using `/app-sanity-test` or `/manual-testing-by-agent`.
**Agents:** general-purpose with the relevant testing skill.
**Quality gate:** All specified behaviors verified. No regressions.
**Iterate if:** Bugs found. File them, send to implementation for fix, re-QA.

## Iteration Rules

1. **Max 3 iterations per phase.** If still not passing after 3, stop and escalate to user.
2. **Iteration = feedback + re-spawn.** Don't ask the same agent to keep going. Spawn fresh with specific feedback about what to fix.
3. **Log every iteration** on the whiteboard quality log. "Iteration 2: spec lacked error states, re-spawned with explicit list."
4. **Passing doesn't mean perfect.** It means good enough to unblock the next phase. Note known limitations on the whiteboard.

## Context Hygiene

- **Main thread = thin orchestrator.** You read the whiteboard, write notes-to-self, make phase decisions, update the whiteboard. That's it.
- **Never do the work yourself.** Not even "small" things. Delegate everything — it keeps your context clean.
- **Phase agents get distilled context,** not the whole whiteboard. You decide what's relevant.
- **Re-read this skill at every phase boundary.** The whiteboard header reminds you: `Invoke /build-orchestrate before each phase.`
- **Subagents use opus.** For quality-sensitive work (design, spec, review), always `model: "opus"`.

## Phase Agent Instructions

Tell each phase agent:
- Their specific question/task
- Relevant context (distilled from whiteboard, not everything)
- Expected output format
- Where to write detailed findings (phase file path)
- What skill to load if applicable (`/writing-specs`, `/liaison`, etc.)
- "Do NOT commit or push" (unless it's the implementation phase and you've approved)

## Quality Reviews

After any phase, you may spawn a **reviewer agent** — a fresh general-purpose agent that reads the phase output and evaluates it against the quality gate. This is optional but recommended for design and spec phases.

The reviewer returns: pass / iterate (with specific feedback) / escalate (needs user input).

## Workflow

```
Invoke /build-orchestrate
       │
       ▼
Create whiteboard with goal, scope, phase map
       │
       ▼
┌─── Phase Loop ──────────────────────────────┐
│  1. Read whiteboard (re-orient)             │
│  2. Write note-to-self                      │
│  3. Spawn phase agent (typed)               │
│  4. Receive results                         │
│  5. Quality gate check                      │
│  6.   Pass → update whiteboard, next phase  │
│  6.   Fail → iterate (max 3) or escalate    │
│  7. Update recovery line                    │
└─────────────────────────────────────────────┘
       │
       ▼
Final whiteboard = project record
```
