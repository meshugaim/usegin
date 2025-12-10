---
name: facilitating-a-safeguarding-process
description: Facilitate the 25-minute safeguarding process after bug fixes. Triggered by "let's safeguard", "safeguarding session", or "safeguard this bug". Uses background sub-agents for independent brainstorming.
---

# Facilitating a Safeguarding Process

Facilitate the 25-minute safeguarding process after a bug is fixed. Claude acts as both **facilitator** and **co-participant**, using background sub-agents for independent brainstorming.

**Trigger:** "let's safeguard", "safeguarding session", "safeguard this bug"

## References

- [Safeguarding: A Step-by-Step Guide](https://llewellynfalco.blogspot.com/2018/12/safeguarding-step-by-step-guide.html) - Llewellyn Falco
- [A Genus of Bugs](https://jay.bazuzi.com/Genus-of-bugs/) - Jay Bazuzi
- [Safeguarding Principles](https://jay.bazuzi.com/Safeguarding/) - Jay Bazuzi

## Core Principles

| Principle | Meaning |
|-----------|---------|
| **System > Discipline** | Environmental/structural changes, not behavior changes |
| **~15% reduction** | Each safeguard aims for incremental improvement, not perfection |
| **~1 hour per safeguard** | Keep remediations lightweight and achievable |
| **Genus thinking** | Find the category of bugs, not just the instance |
| **Implement immediately** | Safeguards go on the board and start now |

## The 6-Phase Process

### Phase 0: Context Gathering (Proactive)

Before engaging the user, **orient yourself**:

| Activity | How |
|----------|-----|
| Find bug docs | Search `docs/bugs/`, Sentry issues, GitHub issues |
| Find the fix | Recent commits, PRs related to the bug |
| Understand the code | Read affected files, understand what changed |
| Gather timeline | When reported → when fixed → who involved |
| Summarize | Present findings: "Here's what I found about this bug..." |

### Phase 1: Root Cause Analysis — 10 min

**Three questions** (all participants answer in parallel):

1. "What caused us to write the bug?"
2. "Why didn't it get caught sooner?"
3. "What made it hard to fix?"

**Parallel brainstorming:**

```
User answers the 3 questions in conversation
     ↓ (simultaneously)
Background sub-agent generates independent RCA ideas
(given bug context, but NOT user's answers)
```

**Sub-agent prompt template:**
```
You are participating in a safeguarding session for a bug.

Bug context:
[insert bug description, fix details, affected code]

Answer these 3 questions independently (do NOT try to guess what the user might say):
1. What caused us to write the bug?
2. Why didn't it get caught sooner?
3. What made it hard to fix?

Generate 3-5 ideas per question. Focus on systemic/environmental factors, not human blame.
```

### Phase 2: Merge & Vote — 3 min

1. Present combined ideas (user + agent) without attribution
2. Ask user to pick top 3-4 items
3. Move selected items to "Remediations" focus

### Phase 3: Budget — 2 min

Classify severity and calculate time budget:

| Severity | Time per safeguard | Total budget |
|----------|-------------------|--------------|
| Small | 1 hour | ~3-4 hours |
| Medium | 4 hours (half day) | ~1-2 days |
| Large | 2.5 days | ~1 sprint |

Ask: "How severe is this bug genus? Small/Medium/Large?"

### Phase 4: Remediation Brainstorm — 10 min

**7 min silent generation + 3 min voting**

Same parallel approach:
- User brainstorms safeguards
- Background sub-agent generates independent safeguard ideas

**Sub-agent prompt template:**
```
You are brainstorming safeguards for a bug genus.

Bug genus: [insert genus description from Phase 2]
Top RCA items: [insert selected items]

Generate 5-7 potential safeguards. Prioritize:
- Environmental/systemic changes over behavior changes
- Automated checks over manual processes
- Making the right thing easy over making the wrong thing hard

Each safeguard should be achievable in ~1 hour.
```

**Good safeguards (System > Discipline):**
- Add static analysis check
- Create wrapper type with proper equality
- Extract confusing code to well-named function
- Add automated test for the pattern
- Consolidate duplicate code

**Not safeguards:**
- "Be more careful"
- "Remember to check X"
- "Add to the backlog for later"
- Test only the exact bug instance

### Phase 5: Vote & Commit — 3 min

1. Present combined safeguard ideas
2. User votes on top safeguards (within budget)
3. Add to task board immediately

### Phase 6: Implement — Start Now

Safeguards are pre-approved. Begin implementation immediately.

## Facilitation Notes

### Time Tracking

- Note start time when session begins
- Gentle reminders at phase boundaries: "We're at 12 minutes, ready to move to voting?"
- If running long: "We're over time on RCA, shall we extend or move on?"

### Genus Prompts

Help user think beyond the specific bug:

- "If this bug is about [specific], what's the broader category?"
- "Where else might this same pattern cause problems?"
- "What would prevent ALL bugs like this, not just this one?"

### Session Notes

Track throughout:
- Bug summary and fix
- RCA ideas (user + agent)
- Selected top items
- Severity/budget decision
- Proposed safeguards
- Chosen safeguards with owners

## Output Artifact

Create or update a decision doc with:

```markdown
# Safeguarding Session: [Bug Title]

**Date:** YYYY-MM-DD
**Bug:** [link to bug doc or brief description]
**Fix:** [commit hash or PR]
**Severity:** Small/Medium/Large
**Budget:** X hours

## Root Cause Analysis

### What caused us to write the bug?
- [selected items]

### Why didn't it get caught sooner?
- [selected items]

### What made it hard to fix?
- [selected items]

## Genus

[Description of the bug category, not just the instance]

## Chosen Safeguards

| Safeguard | Effort | Owner | Status |
|-----------|--------|-------|--------|
| ... | 1hr | @user | TODO |

## Session Notes

[Any other decisions, ideas, or observations]
```
