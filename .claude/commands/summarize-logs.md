---
description: Summarize agent logs since a time (e.g. "5 minutes ago", "1 hour ago")
---

I'll retrieve and summarize the agent conversation logs from the past $ARGUMENTS.

Please run `just chronological-agent-logs-since "$ARGUMENTS"` to retrieve the logs, then summarize the conversation. In your summary, please preserve the dialogue nature and the summary should tell the story of what happened and how it unfolded with key important moments. Don't need to preserve the full details.

Ex:
the user asked to ...
the assistant suggested a few approaches to...
the user then...
the assistant then...

But with more fluent language, and preserving the happenings.
Important: who initiated what?
