---
name: self-awareness
description: Reflective guard for sub-agents. Helps agents orient before acting, detect spinning, and ensure work connects to the larger task. Opt-in via liaison config or manual activation.
---

# Self-Awareness

A reflective protocol for agents working on subtasks. Prevents three failure modes:

1. Acting without understanding
2. Spinning on failed approaches
3. Building work that doesn't connect to what came before

## Activation

- **Via liaison**: Enabled when `.claude/skills/liaison/config.json` has `"selfAwareness": true`. Liaison tells sub-agents to follow this protocol.
- **Manual**: Any agent can read and follow this skill directly.

---

## Protocol 1: Orient Before Acting

Your first moves are discovery, not construction. Before writing any code:

### Step 1: Understand your assignment

Read your task description fully. If you were spawned by an orchestrator, re-read the message that created you.

### Step 2: Discover what came before

```bash
# Recent history — what's been happening?
git log --oneline -20

# Recent changes to files in YOUR area (scope to relevant paths)
git log --oneline --since="48h" -- <paths-relevant-to-your-task>

# Uncommitted changes — is someone mid-work?
git diff --stat
```

If your task references a Linear issue, check the graph:

```bash
plan show <issue-id>    # parent, siblings, children
```

### Step 3: Read before you write

If any file you plan to modify was changed in the last 48h, read the diff:

```bash
git log -p --since="48h" -- <filepath>
```

Understand what changed and why before you add your own changes.

### Step 4: Orientation test

Before proceeding, answer these **with specifics** — file paths, function names, test expectations. Not prose.

| Question | Good answer | Bad answer |
|----------|------------|------------|
| Which files will I modify or create? | `src/lib/services/auth.ts`, `tests/unit/auth.test.ts` | "the auth module" |
| What does "done" look like? | `signOut()` returns `void`, test `should-clear-session` passes | "sign out works" |
| What existing code does my work connect to? | `createClient()` in `src/lib/supabase/client.ts`, `AuthProvider` in `src/components/providers.tsx` | "the Supabase client" |
| What would break if I did this wrong? | Active sessions would persist after sign-out, middleware would still see the old cookie | "auth might not work" |

**If you can only answer with vague descriptions, you don't understand your task yet.** Go back to steps 1-3, or escalate to your spawner/user.

---

## Protocol 2: Recognize Spinning

Spinning is trying the same thing repeatedly in different ways without stopping to think deeply.

### Signs you are spinning

- You've edited the same file 3+ times and tests still fail
- Each "fix" creates a new problem
- You're adding ad-hoc patches to symptoms instead of addressing root causes
- You're copy-pasting error messages into new attempts without analyzing them
- You've tried more than 2 substantially different approaches and none worked

### When you notice spinning: STOP

Do not make another edit. Answer these questions first:

1. **What am I trying to achieve right now?** (one sentence)
2. **What have I tried so far?** (list each attempt and its specific failure reason)
3. **Symptom or root cause?** Am I fixing what's actually broken, or just what's visibly wrong?
4. **Wrong approach or wrong detail?** Is the overall strategy flawed, or am I missing something small?
5. **Read more or write more?** Would understanding more code help more than producing more code?
6. **Should I escalate?** (to spawner or user)

Only after answering, decide your next move: a fundamentally different approach, or escalation.

### Escalation over stubbornness

If you've reflected once and are still stuck after the next attempt, **escalate.** Do not reflect a third time — you're past the point where self-correction helps.

To your spawner (if in a team) or to the user:

> I'm stuck on [specific problem]. I've tried [approaches]. The root cause appears to be [analysis]. I need help deciding between [options].

This is not failure. Burning 20 more tool calls on a dead end helps nobody.

---

## Protocol 3: Connect Before Completing

Before declaring your work done:

### 1. Review your own changes

```bash
git diff    # or git diff --cached if staged
```

Read them as a reviewer would. Do they make sense as a coherent change?

### 2. Run relevant tests

Not just the tests you wrote — run tests for the code you touched. Other tests may catch regressions your tests don't cover.

### 3. Check for conflicts with recent work

```bash
git log --oneline --since="48h" -- <files-you-changed>
```

If someone else changed these files recently, verify your changes are compatible. Look at what they did and make sure you're building on it, not contradicting it.

### 4. Verify interfaces

Do your changes match the types, props, function signatures, and API contracts that other code expects? If you changed a function signature, did you update all callers?

### 5. Continuity check

Would the next agent picking up after you understand what you did and why?

- Commits tell a clear story (not a mess of "fix" and "try again")
- Changes follow the patterns established by prior work in the same area
- No orphaned code, no half-finished ideas left behind

---

## When to Escalate

| Signal | What to say |
|--------|-------------|
| Can't pass the orientation test (step 4) | "I don't understand my task well enough. Specifically, I'm unclear about [X]." |
| Spinning — reflected once, still stuck | "I'm stuck on [X]. Tried [Y, Z]. Root cause appears to be [W]. Need guidance." |
| Your work conflicts with recent changes | "File X was recently modified ([commit]). My changes may conflict. Need guidance." |
| Task scope seems wrong | "The task says X but I think it should be Y because [reason]." |
| You realize you're building something that won't integrate | "My output won't connect to [sibling work] because [reason]. Should I adjust?" |

Escalation is always better than silent failure. A stuck agent that asks for help wastes 1 minute. A stuck agent that keeps trying wastes 30 minutes and leaves damage.
