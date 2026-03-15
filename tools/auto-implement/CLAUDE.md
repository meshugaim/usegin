# auto-implement

Outer loop for spec implementation across multiple fresh Claude sessions.

## Usage

```bash
auto-implement run ENG-123              # Run up to 10 sessions
auto-implement run ENG-123 --pause      # Confirm between sessions
auto-implement run ENG-123 --max 5      # Limit to 5 sessions
auto-implement list                     # List previous runs
auto-implement show <run-id>            # Show run manifest
auto-implement watch <run-id>           # Live dashboard for a running run
```

## How It Works

1. Installs hook guards (TDD order guard, pre-commit TDD gate, commit size gate, commit frequency gate, post-commit context rotation)
2. Spawns a headless `claude -p` session with a thin prompt pointing at the `implementing-specs` skill
3. Agent implements slices; hooks enforce TDD, small commits, and context management externally
4. At 60%+ context, agent writes a handoff and exits (or post-commit hook kills it at 65%+)
5. If hook-killed: outer loop spawns a handoff writer agent to capture state
6. Outer loop detects the handoff and spawns a fresh session
7. New session reads the handoff and continues from where the previous left off
8. Loop ends when agent writes `{"signal":"complete"}` to `/tmp/auto-impl-signal.json` or max sessions reached
9. Hook guards are removed after each session

## Hook Guards

Installed per-session via `hooks/lifecycle.ts`. All local-only (`.git/hooks/`, `.claude/settings.local.json`):

- **TDD order guard** — PreToolUse hook on Write/Edit, blocks implementation files until a test file has been written since the last commit (enforces test-first ordering)
- **Commit frequency gate** — PreToolUse hook on Edit/Write, blocks when >4 dirty files
- **Pre-commit TDD gate** — Rejects commits with implementation files but no test files (skipped with `tdd:skip` label)
- **Pre-commit size gate** — Rejects commits with >8 staged files
- **Post-commit context rotation** — Checks `cctx` after every commit, kills Claude at >65% context, writes rotation signal

Additionally, `git commit --no-verify` is blocked by the pre-bash hook during auto-implement sessions (when `/tmp/auto-impl-context.json` exists) to prevent bypassing pre-commit guards.

## Exit Signals

The agent writes a JSON signal file to `/tmp/auto-impl-signal.json`:
- `{"signal":"handoff"}` — session handed off, start next session
- `{"signal":"complete"}` — all slices done, stop loop

The outer loop reads this file after each session to determine the next action.
Previously, signal detection searched stdout for magic strings, but this caused
false positives when prompt/documentation text containing the strings appeared
in stream-json output.

## Observability

Sessions run with `--output-format stream-json` for real-time visibility.

**Main terminal (real-time):** Compact one-line summaries stream to stderr as the agent works:
- Tool calls with input summaries (e.g., `Read auth.ts`, `Bash git status`)
- Context % updates when usage changes significantly
- Error highlights from failed tool calls
- Session result with duration and cost
- Text output previews (agent reasoning/status)

**Watch dashboard:** `auto-implement watch <run-id>` shows a live auto-refreshing summary:
- Session status, slice progress, context %, recent commits
- Recent activity feed from the activity log
- Hint for full narrative view via `session --stream`

**Full narrative view:** For the complete interactive-style transcript:
```bash
tail -f ~/.auto-implement/runs/<run-id>/stream.jsonl | session --stream
```

**Run directory:** Each run creates `~/.auto-implement/runs/<run-id>/`:
- `manifest.jsonl` — JSONL log of run-level events (session starts, completions, handoffs, durations)
- `activity.jsonl` — Compact activity events (tool calls, context %, results) for the watch dashboard
- `stream.jsonl` — Raw `stream-json` output for `session --stream` compatibility

Handoff files are preserved at `.claude/handoffs/handoff_YYYYMMDD_HHMMSS.md` (timestamped, never overwritten).

Session transcripts can be inspected via `session <id>` (session IDs are in the manifest).

## Retro

To analyze a run:
```bash
auto-implement show <run-id>        # View the event timeline
session <session-id>                # Inspect individual sessions
cat .claude/handoffs/handoff_*.md   # Read all handoff notes in sequence
```
