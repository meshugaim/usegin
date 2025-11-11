---
description: Summarize agent logs
---

!`date`

I'll retrieve and summarize the agent conversation logs focusing on: $ARGUMENTS.

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

find all conversations relevant to $ARGUMENTS
You can use the following command: `just agent-records help` (start with the overview)

then for each conversation do:
If there exists a `.summary.md` file, then use directly this one. This is basically the output of a previously executed sub-agent. 
However, if it does not exist, then use a sub-agent as explained below. 
in a sub-agent, provide these instructions to the sub-agent please:

```
summarize the conversation. In your summary, please preserve the dialogue nature and the summary should tell the story of what happened and how it unfolded with key important moments. Don't need to preserve the full details.

Ex:
the user asked to ...
the assistant suggested a few approaches to...
the user then...
the assistant then...

But with more fluent language, and preserving the happenings.
Important: who initiated what?

Write your summary into a new file in the Agent Records repository with the exact same name as the original file, only with a summary suffix: `<file_name_without_extension>.summary.md` 
Commit the summary file
```

when all sub agents are done, you now do the same for the arc of all conversations based on the sub agents reports.