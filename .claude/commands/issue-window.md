---
description: Open a new Claude session in a new tmux window for a Linear issue
argument-hint: [issue-number — infer from chat if omitted]
---

Open a new Claude session in a new tmux window for a Linear issue.

The script `tmux-issue-window` does the work. **First, run `tmux-issue-window --help`** to confirm its current contract (it may have evolved since this command was written), then invoke it with the issue number — derive the number from the slash-command args or from chat context if the args don't include a digit.
