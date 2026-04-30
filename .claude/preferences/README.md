# Preferences

Soft "prefer X over Y" nudges that fire from the `pre-bash.ts` hook when a Bash command matches.

One `.md` file per preference. The hook reads them all, regex-matches each command, and emits a stderr nudge — the command **still runs**. False positives are cheap; false blocks waste a turn.

## File shape

```md
---
match: <JS regex source, no slashes>
flags: <optional, e.g. "i">
prefer: <one-line tip shown to Claude>
---

(optional body — the "why", links to memory/zettels, examples)
```

## Adding a preference

1. Drop a new `.md` here named after the rule (kebab-case).
2. Test the regex against a sample command:
   ```bash
   bun -e 'console.log(/your-regex/.test("your sample command"))'
   ```
3. Commit. No hook restart needed — preferences are read fresh each invocation.

## Where this fits

- **Memory** (`feedback_*.md`) — Claude's preference, but only surfaces when memory is loaded.
- **Preferences** (here) — fires deterministically on every matching Bash command.
- **`WRAPPER_RULES`** in `pre-bash.ts` — same idea but inline in code, used for "use this wrapper CLI instead" suggestions tied to the codebase.

If a memory note keeps getting forgotten on Bash-shaped commands, promote it to a preference here.
