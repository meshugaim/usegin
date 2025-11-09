---
description: Summarize agent logs
---

I'll retrieve and summarize the agent conversation logs focusing on: $ARGUMENTS.

see `~/agent-records/`
find all conversations relevant to $ARGUMENTS
ignore conversations starting with:
```
USER:
Warmup
```

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
```

when all sub agents are done, you now do the same for the arc of all conversations based on the sub agents reports.