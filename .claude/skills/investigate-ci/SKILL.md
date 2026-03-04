---
name: investigate-ci
description: Investigate CI failures using pre-collected context. Triggered by ci-watcher auto-spawn, "investigate CI", "why did CI fail", or "/investigate-ci <sha>".
args: "[sha]"
---

# Investigate CI Failure

Structured investigation of CI failures using context files written by `ci-watcher`.

## When to Use

- Auto-triggered by `ci-watcher` when CI fails after a push
- Manually: `/investigate-ci <sha>` (8-char short SHA)
- "investigate the CI failure"
- "why did CI fail on <sha>"

## Investigation Protocol

### 1. Load the failure context

```bash
# The SHA comes from the skill argument, or find the most recent failure
ls -t .claude/ci-failures/*.md | head -1
```

Read the failure context file at `.claude/ci-failures/<sha>.md`. This contains:
- Which workflows failed vs passed
- `gh run view --log-failed` output (last 80 lines per failed workflow)
- Commit diff (stat + full)
- GitHub Actions run URLs

### 2. Parse the failure

From the log output, identify:
- **Which workflow(s)** failed (e.g., `nextjs-unit-tests`, `python-unit-tests`, `lint-and-type-check`)
- **Which test(s)** failed — extract test file paths and test names
- **The error message** — the actual assertion failure or runtime error

### 3. Read the failing tests

Read the test files that failed. Understand what they assert and why they might break.

### 4. Correlate with the commit diff

The failure context includes the commit diff. Map the failures to the changes:
- Did the commit change code that the failing test covers?
- Did the commit change a type/interface that breaks downstream?
- Did the commit add new code without updating related tests?
- Is it a lint/format issue from the commit?

### 5. Identify root cause

Determine the most likely cause:
- **Direct breakage**: commit changed behavior that the test asserts
- **Missing update**: commit added/changed code but didn't update tests
- **Type error**: commit changed types that break compile
- **Lint/format**: commit introduced style violations
- **Flaky test**: failure is unrelated to the commit (check if test has history of flaking)

### 6. Present findings

Summarize clearly:
- What failed and why (1-2 sentences)
- The root cause with file:line references
- Suggested fix

Then stay interactive — the user may want to discuss, ask for a fix, or dismiss.

### 7. Fix if asked

If the user asks to fix:
1. Make the fix
2. Run the relevant test suite locally to verify
3. Commit with a message referencing the original commit: `fix: <description> (broken by <sha>)`

## Tips

- The failure context file already has log output — don't re-fetch from GitHub unless you need more detail
- If the commit has a `Claude-Session` trailer, you may have been forked from that session and already have context
- Check `git log --oneline -5` to see if someone already pushed a fix
- For lint failures, `bun run lint` and `bun run typecheck` reproduce locally
- For unit test failures, `bun test <file>` or `uv run pytest <file>` reproduces locally
