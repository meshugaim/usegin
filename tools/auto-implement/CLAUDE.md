# auto-implement

Outer loop for spec implementation across multiple fresh Claude sessions.

## Usage

```bash
auto-implement ENG-123              # Run up to 10 sessions
auto-implement ENG-123 --pause      # Confirm between sessions
auto-implement ENG-123 --max 5      # Limit to 5 sessions
auto-implement ENG-123 --no-tmux    # Force piped mode (no tmux)
auto-implement list                 # List previous runs
auto-implement show <run-id>        # Show run manifest
auto-implement watch <run-id>       # Live dashboard for a running run
```

## How It Works

1. Spawns a headless `claude -p` session with a thin prompt pointing at the `implementing-specs` skill
2. Agent implements slices, monitors context usage via `cctx`
3. At 60%+ context, agent writes a handoff and exits
4. Outer loop detects the handoff and spawns a fresh session
5. New session reads the handoff and continues from where the previous left off
6. Loop ends when agent signals `AUTO_IMPLEMENT_COMPLETE` or max sessions reached

## Exit Signals

The agent outputs these markers in stdout:
- `AUTO_IMPLEMENT_HANDOFF` — session handed off, start next session
- `AUTO_IMPLEMENT_COMPLETE` — all slices done, stop loop

## Observability

**CLI progress output:** While sessions run, timestamped progress lines print to stderr:
- Session start/end with session ID and duration
- Heartbeats every 30s showing elapsed time
- Git commit detection with push status
- Handoff file detection

**tmux sessions:** When tmux is available, each session spawns in a named tmux pane (`auto-impl-1`, `auto-impl-2`, etc.). Attach with `tmux attach -t auto-impl-1` to see the full TUI. Use `--no-tmux` to disable.

**Watch dashboard:** Run `auto-implement watch <run-id>` for a live auto-refreshing dashboard showing session status, current slice, context %, recent commits, and tool activity.

**Run directory:** Each run creates a directory at `~/.auto-implement/runs/<run-id>/`:
- `manifest.jsonl` — JSONL log of all events (session starts, completions, handoffs, durations)
- `session-N/` — tmux capture files (prompt, stdout, exit code) when using tmux mode

Handoff files are preserved at `.claude/handoffs/handoff_YYYYMMDD_HHMMSS.md` (timestamped, never overwritten).

Session transcripts can be inspected via `session <id>` (session IDs are in the manifest).

## Retro

To analyze a run:
```bash
auto-implement show <run-id>        # View the event timeline
session <session-id>                # Inspect individual sessions
cat .claude/handoffs/handoff_*.md   # Read all handoff notes in sequence
```
