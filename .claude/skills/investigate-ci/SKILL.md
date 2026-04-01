---
name: investigate-ci
description: Investigate CI failures using pre-collected context. Triggered by ci-watcher auto-spawn, "investigate CI", "why did CI fail", or "/investigate-ci <sha>".
args: "[sha]"
---

# Investigate CI Failure

Structured investigation of CI failures. You are an investigator, not a fixer. Your job is to understand what happened, assess confidence, and present findings. The user decides what happens next.

## When to Use

- Auto-triggered by `ci-watcher` when CI fails after a push
- Manually: `/investigate-ci <sha>` (8-char short SHA)
- "investigate the CI failure"
- "why did CI fail on <sha>"

## Hard Rules

1. **Never write code or apply fixes** until the user explicitly approves
2. **Never start deep research** (step 2) without user approval, unless you're confident it's a production code issue that needs it
3. **Be honest about certainty** — "I don't know" is a valid answer
4. **Stay concise** — the user wants orientation, not a novel

## Step 1: Orient (always runs)

This step is fast. Read, look, classify, report.

### 1a. Load failure context

```bash
# SHA from skill argument, or most recent failure
ls -t .claude/ci-failures/*.md | head -1
```

Read `.claude/ci-failures/<sha>.md`. It contains: workflow results, failed log output (tail 80 lines per workflow), commit diff (stat + full), run URLs.

### 1b. Look at the code

Read the failing test files. Read the changed production code (from the diff). Understand what the test asserts and what the code does.

Don't just read the error message — read the actual test and the actual code it exercises. This is where understanding comes from.

### 1c. Classify

Determine which category this falls into:

| Category | Meaning | Example |
|---|---|---|
| **Test issue** | Production behavior is correct, test is wrong or outdated | Test asserts old return format after intentional API change |
| **Production code issue** | The commit broke real behavior | Changed a function signature, forgot a caller |
| **Infra/environment** | Not caused by this commit | CI runner OOM, flaky network, dependency mirror down |

### 1d. Assess certainty

Be honest:

- **Clear** — you can point at the exact line. The diff changed X, the test asserts Y, they conflict.
- **Likely** — strong signal but you'd want to confirm. E.g., type change rippled but you haven't traced every caller.
- **Unclear** — multiple possible causes, or the failure doesn't obviously connect to the diff.

### 1e. Report to user

Present a structured report:

```
## CI Failure: <sha>

**Category**: test issue / production code / infra
**Certainty**: clear / likely / unclear

**What failed**: <workflow name> — <test name or error>
**Why**: <1-2 sentences connecting the diff to the failure>
**Evidence**: <file:line references, specific assertions, specific code changes>

**Suggestion**: <one of the options below>
```

Suggestions (pick one):
- **Quick fix** — describe what to change (don't write code). E.g., "update the assertion in `foo.test.ts:42` to expect the new return type"
- **Explore further** — you need more context. Say what you'd look at and why.
- **User decision needed** — you're genuinely unsure. Present what you know and ask.

### After Step 1

**Stop here.** Wait for the user. They may:
- Ask you to fix it (now you can write code)
- Ask you to explore further (now you enter step 2)
- Dismiss it ("that's expected, close the issue")
- Ask questions

## Step 2: Deeper exploration (conditional)

Only enter step 2 when:
- User explicitly asks to explore further, **OR**
- You assessed "likely production code issue" + "unclear" certainty → you may self-escalate

### How step 2 works

1. **Show the step 1 report** to the user (if not already shown)
2. **Say what you're investigating** and that you're running it in background
3. **Spawn focused subagents** (1-3, each with a narrow scope):
   - Sentry: `sentry error search '...' --project <slug>` / `sentry trace search`
   - Railway logs: `railway-dev logs --errors --since <window>`
   - Code tracing: read specific callers/dependencies of the changed code
4. **Keep the main thread available** — show a brief line per subagent as they complete
5. **Synthesize** once subagents return — update the report with new evidence

After step 2, present updated findings and wait for user decision again. Do not proceed to fixes.

## Active Reproduction in CI

When the failure looks like infra/environment (credentials, secrets, CI-only behavior), don't just read logs — reproduce it actively. See [active-reproduction.md](active-reproduction.md) for the debug-runner workflow, examples, and when to build a custom reproduction workflow.

## Tips

- The failure context file has log output already — don't re-fetch from GitHub unless you need more than the tail 80 lines
- If the commit has a `Claude-Session` trailer, you may have been forked from that session and already have context
- `git log --oneline -5` — check if someone already pushed a fix
- Reproduce locally: `bun test <file>`, `uv run pytest <file>`, `bun run lint`, `bun run typecheck`
- For Sentry: `python-services` maps to project slug `python-fastapi`, `nextjs-app` stays as-is
- For production incidents, see [Production Incident Debug Runbook](../../docs/runbooks/incident-debug.md) — full investigation procedure, span operations, key signals
