---
description: Summarize agent logs and related git history
---

!`date`

I'll retrieve and summarize the agent conversation logs and related git history focusing on: $ARGUMENTS.

see `~/agent-records/`

## Agent Records Structure

~/agent-records/
├── {username}/
│   └── YYYY-MM/
│       └── YYYY-MM-DD/
│           └── HHMMSS-conversation-*.txt

- Files are organized by: username → year-month → day → timestamp
- Conversations are .txt files with HHMMSS timestamp prefixes
- Warmup conversations start with exactly: USER:\nWarmup

## Workflow

find all conversations relevant to $ARGUMENTS, excluding sub-agent conversations; the `just agent-records find` sub command will exclude those by default.
You can use the following command: `just agent-records help`, and then start with the `just agent-records overview`.

please avoid meta-summaries (summaries of summaries); avoid the parts of conversations that use the `/summaries...` commands, and be explicit about which sections were avoided by saying "(Summary section excluded to avoid meta-summary)".

then for each conversation do:
If there exists a `.summary.md` file, then use directly this one. This is basically the output of a previously executed sub-agent. 
However, if it does not exist, then use a sub-agent as explained below. 
in a sub-agent, provide these instructions to the sub-agent please:

```markdown
summarize the conversation. In your summary, please preserve the dialogue nature and the summary should tell the story of what happened and how it unfolded with key important moments. Don't need to preserve the full details.

Ex:
the user asked to ...
the assistant suggested a few approaches to...
the user then...
the assistant then...

But with more fluent language, and preserving the happenings.
Important: who initiated what?

Additionally, please find the relevant git changes in the main test-mvp repo (if there are any), and use them for a better understanding of the development process. start with `git log --oneline`, and for relevant commits use `git log --name-only` and potentially `git show`.

Write your summary into a new file in the Agent Records repository with the exact same name as the original file, only with a summary suffix: `<file_name_without_extension>.summary.md` 
Commit the summary file
```

when all sub agents are done, you now do the same for the arc of all conversations based on the sub agents reports.