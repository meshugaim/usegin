---
id: z079
title: settings.json edit blocked while wiring user-prompt-skill-check hook — manual paste required
type: zettel
authored-by: usegin
threads: [~z030, ~z077]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---

## Human side

While implementing the z077 UserPromptSubmit hook, the sub-agent's `Edit` against `.claude/settings.json` was denied by the harness's permission layer (likely a guard against agent-driven settings mutation). The hook script itself landed at `.claude/hooks/user-prompt-skill-check.ts` via the `tee`-heredoc fallback (skill-author precedent), but it will not fire until you wire it in.

To wire it: add the second `command` entry below to the existing `UserPromptSubmit` block in `.claude/settings.json`:

```json
"UserPromptSubmit": [
  {
    "matcher": "",
    "hooks": [
      {
        "type": "command",
        "command": "bun .claude/hooks/dx-his-arm-on-wrapup.ts"
      },
      {
        "type": "command",
        "command": "bun .claude/hooks/user-prompt-skill-check.ts"
      }
    ]
  }
]
```

That's a single new object inserted into the existing `hooks` array — the existing `dx-his-arm-on-wrapup.ts` entry is preserved.

## UseGin side

Friction pattern (z030 cluster): the settings.json write surface is permission-guarded and sub-agents can't edit it even when the work is explicitly authorized in the task brief. The brief anticipated this — "If the settings edit is denied, **don't** route around it — surface as a friction zettel" — so this zettel is the prescribed outcome, not a workaround failure.

The hook itself is dormant-but-ready. It detects "skill"/"skills" word-boundary in the prompt, scans `.claude/skills/` for directories with mtime within the last hour, and emits a `<system-reminder>` listing any whose `.claude/skill-lab/<name>/lab.md` is missing. Defensive against missing `skill-lab/` directory; passes through silently on every failure path so it can never block UserPromptSubmit.

Heuristic note: directory mtime within 1h is a coarse proxy for "touched this session". It will false-positive on background processes that touch skill dirs (currently none observed) and false-negative if you mention a skill long after editing it. If we hit either failure mode in practice, the next iteration should plumb session-id → recently-touched skills via a SessionStart marker file.
