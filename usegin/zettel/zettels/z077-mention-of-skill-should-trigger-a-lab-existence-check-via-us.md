---
id: z077
title: Mention of "skill" should trigger a lab-existence check via UserPromptSubmit hook
type: zettel
authored-by: usegin
threads: [~z023, ~z030]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---

## Human side

Lihu, 2026-04-27: *"Create a hook on the user's input — next time I write 'skill' a script should verify it has a lab, remind Claude it has lab (reminder, he might not need it). For the hook — look at the hooks and routers on bash's and writings, add a router to user prompt hook."*

The pattern: when Lihu's prompt contains the word "skill", run a script that:
- Identifies any skill referenced (or recently-touched skills in this session)
- Checks `.claude/skill-lab/<name>.md` exists
- If missing, emits a `<system-reminder>` reminding UseGin "skill X has no lab — consider creating one"
- If present, no-op (silent — Lihu doesn't need to be reminded of normal state)

## UseGin side

Hook lives at `.claude/hooks/user-prompt-skill-check.ts`. Wired via `UserPromptSubmit` matcher in `.claude/settings.json`. The "router" Lihu mentions: check whether settings.json has a UserPromptSubmit hook already (the Bash and Write hooks are set up as routers — multiple matched hooks layered on the same event); if yes, add this as another in the list; if no, create the array.

The behavior is *additive*: nothing is blocked, Claude just gets a system-reminder to consider whether the skill needs a lab. Per principle 03 (pull Claude into our world) — the reminder lives in Claude's context, not Lihu's.

Hook-designer agent spawned this turn to investigate the hook-router pattern + write the hook + wire it.
