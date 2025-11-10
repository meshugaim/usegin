---
description: Summarize agent logs
---

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
ignore warmup conversations:
### Create helper function in the slash command
filter_warmups() {
while IFS= read -r file; do
    first_two=$(head -n 2 "$file" 2>/dev/null)
    if [ "$first_two" != "USER:
Warmup" ]; then
    echo "$file"
    fi
done
}

### Use it
find ~/agent-records/ -path "*/2025-11-08/*" -name "*.txt" 2>/dev/null | filter_warmups

then for each conversation do:
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
Don't commit the summary file
```

when all sub agents are done, you now do the same for the arc of all conversations based on the sub agents reports.