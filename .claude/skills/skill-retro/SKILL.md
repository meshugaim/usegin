---
name: skill-retro
description: Evaluate how well skills were followed in a session. Reads skill lab files for evaluation criteria, writes findings back. Triggered by "skill retro", "retro the skills", or after a session that used orchestration skills.
---

# Skill Retro

You evaluate how well skills were followed in a session. You don't evaluate the work output — you evaluate the process.

## Step 1: Scan for Skills

Scan the session for skill usage. Look for:
- Explicit skill invocations (`/liaison`, `/build-orchestrate`, `/research`, `/ralph`)
- Orchestration patterns (whiteboard files, phase managers, liaison delegation, ralph loop)
- Skill references in agent prompts ("use the writing-specs skill", "run in liaison mode")

Cross-reference against available lab directories:
```bash
ls .claude/skill-lab/
```

Only skills with a lab directory (containing `lab.md`) can be retroed. If a skill was used but has no lab, note it in your summary — it may need one.

## Step 2: Scope with User

**If exactly 1 skill detected:** Use it. Skip to Step 3.

**If 2+ skills detected:** Present the list and ask the user to select which to retro:

> "I found these skills were used in this session: [list]. Which should I retro? (all / select specific ones)"

Use `AskUserQuestion` for this. Let the user multi-select.

## Step 3: Retro Mode

Always ask the user, regardless of how many skills were scoped:

> "How should I run this retro?
> - **collaborative** — I'll share findings as I go, we discuss together
> - **autonomous** — I'll do the full retro and commit the results, you review after"

Use `AskUserQuestion`. This determines whether you pause for discussion or run to completion.

**Collaborative mode:** After evaluating each skill, present findings to the user before writing to the lab file. Discuss suggestions. The user may add context, disagree with a verdict, or surface observations you missed. Write the entry after alignment.

**Autonomous mode:** Evaluate all scoped skills, write entries to lab files, commit the changes, and present a summary. The user reviews the committed retro entries and can amend.

## Step 4: Evaluate

For each scoped skill, read its lab file at `.claude/skill-lab/<skill-name>/lab.md`. The lab file contains:
- **Intent** — what the skill is supposed to achieve
- **Success Signals** — checklist of what a good session looks like
- **Retro Guide** — specific evaluation steps for this skill

Optionally, scan previous retros at `.claude/skill-lab/<skill-name>/retros/` to spot recurring patterns.

**Follow the Retro Guide.** Each skill has its own evaluation process. The guide tells you what to look for, in what order, and what counts as a problem.

**Evaluate against Success Signals.** Go through the checklist. Mark each signal as pass/fail with brief evidence.

## Step 5: Write Findings

Write entries to `.claude/skill-lab/<skill-name>/retros/YYYY-MM-DD-<slug>.md` using this format:

```markdown
### YYYY-MM-DD — [session-id or short description]
**Verdict:** [worked well | partially followed | collapsed]
**Collapse events:** [count, or "none"]
**Key observations:**
- [what you observed, with evidence]
- [what you observed, with evidence]
**Suggestions:**
- [concrete improvement ideas, if any]
```

**Verdict scale:**
- **worked well** — success signals mostly pass, no collapse events, minor issues at most
- **partially followed** — some signals pass, some fail. Director followed the spirit but broke rules in places.
- **collapsed** — director abandoned the orchestration model. Did work directly, read phase files, loaded skills, etc.

## Step 6: Check for Spec Retro Opportunity

After completing the skill retro, check whether the session implemented a spec. Look for:
- References to a spec issue (e.g., `plan show ENG-XXX`)
- Use of `implementing-specs` or `slicing-specs` skills
- Slice issues with a parent spec

If a spec was implemented, ask the user via `AskUserQuestion`:

> **Should I also run a spec retro — evaluating the spec you implemented from?**
> This uses the writing-specs lab's implementer perspective: "knowing what you know now, how good was the spec?"
>
> Options:
> 1. **Yes, after the skill retro** — finish the skill retro first, then I'll do the spec retro separately
> 2. **Yes, do both now** — I'll do the spec retro right after (still one at a time)
> 3. **No** — skip the spec retro

If yes (option 1 or 2):
- Read the writing-specs lab at `.claude/skill-lab/writing-specs/lab.md` — use the **Implementer Perspective** section
- Evaluate the spec against the implementer success signals and retro guide
- Write findings to `.claude/skill-lab/writing-specs/retros/implementer/YYYY-MM-DD-<spec-slug>.md`
- Use the same retro entry format (verdict, key observations, suggestions)

Even when the user says "do both," always complete and present the skill retro first, then do the spec retro as a separate evaluation. Never merge them.

## Step 7: Surface Actionable Items

If a finding is concrete enough to become a skill improvement, flag it in your summary. The user decides whether to create a Linear issue or let it ferment in the Ideas section of the lab's `lab.md`.

In **autonomous mode**, commit the retro file before presenting the summary.

## What You Evaluate

**Process, not output.** You don't judge whether the research answer was correct or the build was successful. You judge whether the skill's process was followed — delegation discipline, whiteboard hygiene, context budget, pre-phase hooks.

**The director thread, not subagents.** Skills govern the director. Subagent behavior is outside scope unless it reveals a gap in the skill's instructions (e.g., "the skill doesn't tell the director what to do when a subagent returns garbage").

## Reading the Session

You need access to the session to evaluate it. The user will either:
- Point you to a session transcript or log
- Summarize what happened
- Tell you to look at the current conversation history

If you don't have enough information to evaluate a signal, mark it as **"unable to assess"** with a note on what you'd need.

## Cross-Cutting Observations

Sometimes you'll notice patterns that span multiple skills — e.g., "the auto-inject block worked well in both research and build-orchestrate." Write these as an Idea/Note in the `lab.md` of the primary skill, and reference the other skill.

If the observation is truly cross-cutting (about the skill system itself, not any single skill), note it in your summary to the user. They'll decide where it belongs.

## What You Don't Do

- **Don't evaluate work quality.** Whether the code works or the research answer is right is not your concern.
- **Don't modify the skill.** You observe and record. Improvements to the skill text are a separate action.
- **Don't create Linear issues.** Flag actionable items in your summary. The user decides what becomes work.
- **Don't read the skill itself (SKILL.md) for evaluation criteria.** The `lab.md` has everything you need. The skill text is the "baked" instructions — you evaluate against the lab's Success Signals and Retro Guide.
