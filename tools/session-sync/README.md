# session-sync

Daemon that watches `~/.claude/projects/*/` for Claude Code JSONL session
files and syncs them to Supabase via the `/api/v1/dev-sessions/*` endpoints.
One daemon per developer environment (local devcontainer, Codespaces,
Gitpod, Ona).

See `docs/specs/dev-session-sync.spec.md` for the full spec.

## Cross-environment startup

The daemon runs under PM2 (`tools/session-sync/ecosystem.config.cjs`). One
process per developer environment. Recipes per env (AC 22-26):

| Env | How it's started | Notes |
|---|---|---|
| Local devcontainer | `.devcontainer/post-create.sh` runs `bun pm2 start tools/session-sync/ecosystem.config.cjs` after `just install` and `set-env` | AC 22 |
| GitHub Codespaces | Same `post-create.sh` path | AC 23 |
| Gitpod | `.gitpod/automations.yaml` task `session-sync-daemon`, depends on `setup-environment` | AC 24 |
| Ona | TBD — Lihu owns the Ona-side recipe | AC 25, deferred |
| Local laptop without devcontainer | Not in v1 scope; future verb is `dx daemon install` (user-level systemd unit / launchd plist) | AC 26, gated on demand |

Lifecycle commands (run from the project root):

```sh
bun pm2 start tools/session-sync/ecosystem.config.cjs   # start (idempotent)
bun pm2 logs session-sync                                # tail logs
bun pm2 restart session-sync                             # after `effi auth login` if creds were missing
bun pm2 stop session-sync                                # stop without forgetting state
bun pm2 delete session-sync                              # forget (state.json on disk persists)
```

`autorestart: false` in the ecosystem file: when `src/cli.ts` exits because
auth/profile loading failed (no `effi auth login` yet, or token expired), PM2 keeps
the process in "stopped" state. Recovery is `effi auth login` followed by
`bun pm2 restart session-sync`.

## Slice 1 scope (Steps 3a + 3b + 3c)

The slice-1 daemon is complete: pure-logic helpers, HTTP layer, and the
wire-glue main loop (`src/cli.ts`) that composes them. ACs covered:
12 (project), 13-14 (fs.watch + sync), 16 (state), 17 (subagent share),
18 (completion), 19 (env detect), 20-21 (crash/SIGTERM), 22-24
(cross-env startup), 45 (kill-switch daemon-side). AC 25 (Ona) and AC 26
(local laptop without devcontainer) are deferred.

Module map (alphabetical):

- `auth` — load + validate dev-login token from Effi CLI profile
- `backoff` — `nextRetryAt` math for the 503 sync-disabled path
- `cli` — wire entrypoint (NOT unit-tested; verified via the smoke)
- `coalescer` — per-event idle coalescer fed by `fs.watch`
- `completion` — detect `type:"result"` in JSONL content
- `content-hash` — SHA-256 hex of uncompressed bytes
- `debounce` — pure timer state-machine
- `env-detect` — environment kind + id detection
- `extractor` — `turn_count`, previews, model, git fields
- `gzip` — deterministic `gzip -n`-equivalent compression
- `install-id` — UUID generation with `fsync`-before-first-use
- `lifecycle` — graceful-shutdown planner (SIGTERM budget)
- `safety-net` — 5-min retry / stale-since-last-tick tick
- `startup-scan` — offline-grew / new / retry-due classifier
- `state` — typed read/write of `state.json`
- `sync-client` — multipart `POST` to `/api/v1/dev-sessions/*/sync`
- `sync-flow` — per-file sync flow (skip / upload / kill-switch /
  transient-error)
- `sync-metadata` — daemon-side mirror of the route's metadata shape
- `sync-session` — parent + subagent orchestration

The shared **subagent discovery** (AC 17) lives at
`tools/lib/jsonl-discovery.ts` and is imported by both
`tools/conversation-watcher` and `tools/session-sync`.

## Slice 1 out of scope (later commits)

- 409 lock-held branch (AC 15), heartbeat (AC 39-41), fork rewrite (AC 36)
- Slice 3: UseGin tool integration, backfill script

## Configuration

Environment variables read by `src/cli.ts`:

| Var | Default | Notes |
|---|---|---|
| `SESSION_SYNC_PROJECTS_DIR` | `~/.claude/projects` | Directory to watch |
| `SESSION_SYNC_STATE_DIR` | `~/.local/state/session-sync` | Holds `state.json`, `install-id`, `daemon.pid` |
| `SESSION_SYNC_IDLE_MS` | `30000` | Per-file idle threshold before upload |
| `SESSION_SYNC_SAFETY_MS` | `300000` | Safety-net tick interval (5 min default; auto-tightened to 60 s on the per-subdir fallback) |
| `SESSION_SYNC_PREFLIGHT_MS` | `200` | Recursive `fs.watch` preflight wait |
| `SESSION_SYNC_PROFILE` | (active) | Effi CLI profile name |
| `EFFI_CONFIG_DIR` | `~/.effi` | Profile root (Effi CLI convention) |

CLI flags:

- `--no-recursive-watch` — skip the preflight, walk + watch each subdir
  individually. Useful on kernels where recursive `fs.watch` is flaky.

## Manual smoke

`scripts/smoke.ts` exercises the full lifecycle against a tmpdir-mounted
"Claude projects" directory and a `Bun.serve` mock for the
`/api/v1/dev-sessions/*` endpoint. It verifies auth load, env detect,
install-id creation, startup scan, `fs.watch` event → coalescer → POST,
multipart body shape (`file` + `metadata` + `content_hash`), graceful
SIGTERM shutdown, and state-file persistence.

```sh
cd tools/session-sync
bun run scripts/smoke.ts            # cleans up tmproot on exit
KEEP=1 bun run scripts/smoke.ts     # keep tmproot for inspection
```

The smoke is NOT a unit test (real fs, real subprocess, real socket) —
treat its output as the load-bearing artifact for the wire layer.
