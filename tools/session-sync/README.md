# session-sync

Daemon that watches `~/.claude/projects/*/` for Claude Code JSONL session
files and syncs them to Supabase via the `/api/v1/dev-sessions/*` endpoints.
One daemon per developer environment (local devcontainer, Codespaces,
Gitpod, Ona).

See `docs/specs/dev-session-sync.spec.md` for the full spec.

## Slice 1 scope (this commit: Step 3a)

This commit lands the project scaffold and the **pure-logic helpers** that
the daemon glue (Step 3b) and the watcher loop (Step 3c) compose:

- `env-detect` — detect the four supported environment kinds (AC 19)
- `install-id` — generate / read the local-devcontainer UUID with
  `fsync`-before-first-use (AC 19 invariant)
- `state` — typed read/write of the per-file sync state at
  `~/.local/state/session-sync/state.json` (AC 16)
- `gzip` — deterministic `gzip -n`-equivalent compression (AC 14)
- `content-hash` — SHA-256 hex of uncompressed bytes (AC 8/14)
- `completion` — detect `type:"result"` in JSONL content (AC 18)
- `extractor` — pull `turn_count`, previews, model, git fields (AC 14
  metadata)
- `debounce` — pure timer state-machine; the `setTimeout` glue lives in
  Step 3c
- `backoff` — `nextRetryAt` math for the 503 sync-disabled backoff
  (AC 45 daemon side)

The shared **subagent discovery** logic (AC 17) lives at
`tools/lib/jsonl-discovery.ts` and is imported by both
`tools/conversation-watcher` (existing consumer) and `tools/session-sync`.

## Slice 1 out of scope (later commits)

- `fs.watch` glue, debounce timer, signal handlers, main entrypoint —
  Step 3c
- HTTP `POST` to `/api/v1/dev-sessions/*/sync` — Step 3b
- Slice 2: 409 lock-held branch (AC 15), heartbeat (AC 39-41), fork
  rewrite (AC 36)
- Slice 3: UseGin tool integration, backfill script
