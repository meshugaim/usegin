---
description: Summarize based on agent logs and related git history
---

I'll retrieve and summarize the agent conversation logs and related git history focusing on: $ARGUMENTS.

see `~/agent-records/`
find all conversations relevant to $ARGUMENTS
ignore conversations starting with:
```
USER:
Warmup
```

then for each conversation do:
in a sub-agent, provide these instructions to the sub-agent please:

```sub-agent instructions
Please summarize the conversation in <conversation file>.

First, using a sub-agent, find related git commits, or commit range.
Then expand those commits with `git log -p <range>` or `git diff ...`.

Focus on:
- preserve the dialogue nature
- the summary should tell the story of what happened and how it unfolded
- key important moments
- no need to preserve the full details

Ex:
the user asked to ...
the assistant suggested a few approaches to...
the user then...
the assistant then...

But with more fluent language, and preserving the happenings.
Important: who initiated what?
```

when all sub agents are done, you now do the same for the arc of all conversations based on the sub agents reports.