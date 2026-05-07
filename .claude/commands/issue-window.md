---
description: Open a new Claude session in a new tmux window for a Linear issue
argument-hint: [issue-number — infer from chat if omitted]
---

Open a new Claude session in a new tmux window for a Linear issue.

The script `tmux-issue-window` does the work. Its current contract is below — read it, then invoke the script with the issue number. Derive the number from the slash-command args or from chat context if the args don't include a digit.

Current `tmux-issue-window --help`:

!`tmux-issue-window --help`
