# investigate-ci — Skill Lab

## Intent

Turn CI failures into understanding, not thrashing.

Without this skill, agents react to CI failures by reading the error, guessing a fix, applying it, pushing, and hoping. If wrong, the cycle repeats. The skill enforces a different pattern: observe → classify → assess confidence → present → wait. The agent becomes an investigator that helps the user decide, not an autonomous fixer that burns cycles.

Success means: the user reads the report and knows what happened, how confident the agent is, and what the options are — in under a minute. Failures get understood before they get fixed.

## Success Signals

When retroing a session that used this skill, a good session looks like:

### Honesty about certainty

- [ ] Agent used one of the three certainty levels (clear / likely / unclear) — not weasel words
- [ ] Certainty level matched the actual evidence (didn't say "clear" when it was guessing)
- [ ] When uncertain, agent said so directly — no hedging behind confident-sounding language
- [ ] Agent didn't overstate confidence to seem helpful

### Classification accuracy

- [ ] Agent correctly classified as test issue / production code / infra
- [ ] Agent didn't default to "production code issue" when the test was genuinely outdated
- [ ] Agent considered the infra/environment category (not everything is code)

### Evidence quality

- [ ] Report included specific file:line references, not vague descriptions
- [ ] Agent read the actual test file and actual production code — not just the error message
- [ ] Agent connected the diff to the failure with a specific causal chain
- [ ] When evidence was thin, agent said what's missing rather than over-interpreting

### Suggestion quality

- [ ] Suggestion matched the certainty level (clear → quick fix description, unclear → explore further)
- [ ] Quick fix suggestions described the change without writing code
- [ ] "Explore further" suggestions were specific about what to investigate (not "look into it more")

### Stop discipline

- [ ] Agent stopped after step 1 and presented findings before taking further action
- [ ] Agent did NOT write code or apply fixes before user approval
- [ ] Agent did NOT start deep research (step 2) without either user approval or justified self-escalation
- [ ] If self-escalated to step 2: the justification was sound (production code + unclear certainty)
- [ ] Step 2 subagents had narrow, specific scopes — not "investigate everything"
- [ ] Main thread showed step 1 report + "exploring further in background" message during step 2

### Efficiency

- [ ] The full step 1 report appeared quickly — agent didn't over-read or go down rabbit holes
- [ ] Agent used the failure context file as primary source — didn't re-fetch from GitHub unnecessarily
- [ ] Report was concise — structured format, not prose paragraphs
- [ ] The user could make a decision based on the report alone (fix / explore / dismiss)

## Failure Scenarios to Watch For

These are the ways the skill can fail. Each represents a different failure mode worth evaluating:

### 1. Obvious test breakage
A commit changes a return value, the test asserts the old value. The skill should: classify as production code or test issue (depends on intent), say "clear", point at the exact line mismatch, suggest updating the assertion or reverting the change. Should NOT need step 2.

### 2. Type cascade
A commit changes an interface, a distant consumer breaks. The skill should: read the changed type AND the failing consumer, say "likely" (because there might be more broken consumers), suggest the fix but note it should check for other callers. Might self-escalate to step 2 to trace all consumers.

### 3. Infra / flaky failure
CI fails with a timeout, network error, or OOM — not related to the commit. The skill should: classify as infra, say "clear" (that it's not the commit's fault), suggest re-running CI or ignoring. Should NOT try to fix code.

### 4. Multiple failures with different causes
Two workflows fail for different reasons. The skill should: address each separately in the report, with independent classifications. Should NOT conflate them into one narrative.

### 5. Genuinely ambiguous
The commit touched several files, the failure is in a test that exercises a code path adjacent to — but not directly modified by — the change. The skill should: say "unclear", present what it knows and what's missing, suggest exploration. This is where honesty matters most.

### 6. Lint / type-check (non-test)
The workflow isn't a test suite — it's `lint-and-type-check`. The skill should: classify correctly (likely production code if types broke, or missing lint rule compliance), say "clear" (lint errors point to exact lines), suggest the specific fix.

## Known Limitations

- **No live CI access during investigation.** The skill works from the failure context file (static snapshot). If the file has insufficient log output (tail 80 lines), the agent can't get more without re-running `gh run view`.
- **Session fork context may be stale.** When auto-triggered via `--fork-session --resume`, the forked session may have context from before the failing commit — useful but potentially misleading if the code changed significantly.
- **Subagent tool access.** Step 2 subagents need access to `sentry`, `railway-dev`, and code reading tools. If they don't have the right CLI tools available, step 2 degrades.
- **No feedback loop yet.** The skill doesn't track whether its classifications were correct over time. The lab evaluates individual sessions but doesn't aggregate accuracy trends.

## Retro Guide

When the `skill-retro` skill triggers a retro for investigate-ci:

**1. Check honesty (most critical)**
Did the agent's certainty level match reality? Look at the actual cause (if known by session end) and compare to what the agent claimed. Flag overconfidence especially — saying "clear" when it should have said "likely" leads to wrong fixes.

**2. Check stop discipline**
Did the agent stop after step 1? If it went to step 2, was the self-escalation justified? Did it wait for user input between steps? Did it ever write code before approval?

**3. Check report quality**
Was the report structured (used the template)? Did it include file:line references? Could you make a decision from the report alone? Or did you need to ask follow-up questions to understand what happened?

**4. Check classification**
Was the category right? Did the agent consider all three categories or default to one? For ambiguous cases, did it acknowledge the ambiguity?

**5. Check efficiency**
How long did step 1 take (in turns/tool calls)? Did the agent read only what was necessary, or did it go on tangents? Did it re-fetch information already in the failure context file?

**6. Check step 2 (if triggered)**
Were subagent scopes narrow and specific? Did the main thread stay responsive with a status report? Did the synthesis add real value, or just repeat what subagents found?

## Changelog

| Date | Change | Motivation |
|---|---|---|
| 2026-03-04 | Initial skill and lab | ENG-2537, ENG-2538 — CI failure auto-detection loop |
