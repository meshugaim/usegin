# Subagent Prompts for Agent Records

Exact prompts to use when spawning subagents for summarization tasks.

## Conversation Summary Subagent

Use when creating a `.summary.md` for an individual conversation.

```
Summarize the conversation at: {conversation_path}

Instructions:
1. Read the conversation file
2. Write a summary preserving the dialogue nature - tell the story of what happened:
   - Who initiated what?
   - Key moments and how they unfolded
   - Don't preserve full details, but capture the happenings
3. Save to: {conversation_path_without_extension}.summary.md
4. Commit: cd ~/agent-records && git add {summary_file} && git commit -m "Add summary for {filename}"

Example summary style:
> The user asked to implement a new feature for handling user authentication.
> The assistant suggested using JWT tokens and outlined three approaches.
> The user chose the middleware approach, and the assistant implemented it
> in src/middleware/auth.ts. A brief discussion about token expiration led
> to adding a refresh token mechanism.

IMPORTANT - Terse final report. Return ONLY:
- "✓ {filename}" on success
- "✗ {filename}: {brief error}" on failure

Do NOT include the summary content in your report - it's already in the file.
```

## Conversation Summary with Git Context

Use when you want the summary to include related code changes.

```
Summarize the conversation at: {conversation_path}

Instructions:
1. Read the conversation file
2. Find related git commits: git log --oneline --since="{date}" --until="{next_day}"
3. For relevant commits, use git log --name-only and git show for context
4. Write summary preserving dialogue nature - tell the story of what happened:
   - Who initiated what?
   - Key moments and how they unfolded
   - What code was changed and why
5. Save to: {conversation_path_without_extension}.summary.md
6. Commit: cd ~/agent-records && git add {summary_file} && git commit -m "Add summary for {filename}"

IMPORTANT - Terse final report. Return ONLY:
- "✓ {filename}" on success
- "✗ {filename}: {brief error}" on failure
```

## Daily Arc Summary Subagent

Use after all individual summaries exist to create the daily arc.

```
Create a daily arc summary for {date}.

Instructions:
1. Read all .summary.md files in ~/agent-records/*/{YYYY-MM}/{date}/
2. Synthesize an arc summary covering the narrative across all conversations:
   - What was the overall focus of the day?
   - Key accomplishments and decisions
   - How did different conversations relate?
3. Save to: ~/agent-records/{date}-daily-summary.md
4. Commit and push: cd ~/agent-records && git add {date}-daily-summary.md && git commit -m "Add daily summary for {date}" && git push

Return a brief confirmation when done.
```

## Batch Processing Pattern

When processing multiple conversations:

```bash
# 1. Get list of conversations without summaries
agent-records find --date {date} | grep "No"

# 2. Spawn subagents in parallel (max 8 at a time)
# 3. Run subagents in background
# 4. Use AgentOutputTool with block=false to check status
# 5. Only collect pass/fail, not full reports
# 6. After all complete, push: cd ~/agent-records && git push
```

Progress tracking format:
```
Progress: [completed/total] conversations | Remaining: N
```
