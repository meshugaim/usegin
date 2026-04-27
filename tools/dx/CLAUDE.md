# dx CLI

Per-person developer experience toggles with three-layer merge: default, user-override, local-override.

## Adding a Feature

1. Register in `.dx/config.json` under `features` with `description`, `mechanism`, and `default`
2. Gate in code using the SDK or CLI (see below)

## SDK Usage

```typescript
import dx from "../../dx/sdk";

if (dx.isEnabled("ci-watcher")) {
  // feature-gated code
}
```

Other SDK methods: `dx.resolveUser()`, `dx.getFeature(name)`, `dx.allFeatures()`, `dx.getContext()`.

## Bash Gating

```bash
# Boolean output
dx resolve ci-watcher          # prints "true" or "false"

# Exit code (0=enabled, 1=disabled) for conditionals
if dx resolve ci-watcher --exit-code; then
  echo "ci-watcher is on"
fi

# Via git config (after dx sync)
git config dx.ci-watcher       # prints "true" or "false"
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `dx` | Interactive feature toggle picker (TTY) or JSON status (headless) |
| `dx status` | Show all features with resolved on/off state |
| `dx resolve <feature>` | Resolve a single feature flag |
| `dx sync` | Write resolved values to git config |
| `dx whoami` | Show resolved identity |
| `dx enable <feature>` | Enable a feature (local override; `--save` for config.json) |
| `dx disable <feature>` | Disable a feature (local override; `--save` for config.json) |
| `dx reset [feature]` | Reset features to defaults by clearing overrides (local; `--save` for config.json) |
| `dx identify` | Show or set current user identity (`--as <name>` to set) |
| `dx list` | Show all registered features with gate counts |
| `dx docs` | List embedded documentation (`dx docs show <handle>` to read) |

All read commands support `--json`. The CLI auto-detects headless contexts (non-TTY, `CLAUDECODE=1`) and defaults to JSON. Override with `DX_OUTPUT=json` or `DX_OUTPUT=human`.

Prefix matching is enabled: `dx st` = `dx status`, `dx r` = `dx resolve`, etc.

**Bare `dx` behavior:** In headless mode (non-TTY / `CLAUDECODE=1`), bare `dx` outputs JSON status. In TTY mode, bare `dx` launches an interactive feature toggle picker.

## How-Is-Session (HIS) — `dx his`

A vibe-rated session telemetry feature lives inside the dx app. Both human and Claude rate the session on extensible aspects (1..100), submissions accumulate per turn (never overwrite), and a Stop hook physically forces Claude to file a final reading when the session is wrapping up.

| Command | Description |
|---------|-------------|
| `dx his rate <key=val>...` | Append a rating submission. `--as=human` (default) or `--as=claude`. Trailing free-text becomes the note. |
| `dx his note "<text>"` | Note-only submission (no aspect scores). |
| `dx his end` | Mark session as wrapping up — sets the force-rate flag. |
| `dx his show` | Show all submissions for the current session. |
| `dx his last [--actor X]` | Most recent submission only. |
| `dx his sessions` | List recently rated sessions. |
| `dx his aspects [--bucket human\|claude\|shared]` | List registered aspects. |
| `dx his stats [--aspect X --actor Y --last-days N]` | Aggregate avg/min/max per aspect. |
| `dx his trend <aspect> [--last N]` | Time-series for one aspect across sessions (with sparkline). |
| `dx his search <query>` | Substring search across notes. |
| `dx his export [--session-id X]` | Dump submissions as JSONL (pipe-safe). |
| `dx his digest [--days N --prev-days N]` | Periodic digest: hot (high-friction) sessions + aspect drift vs prior window. |
| `dx his hook-stop` / `dx his hook-session-end` | Hook handlers (configured in `.claude/settings.json`). |

**Auto-arm on wrap-up phrases**: a `UserPromptSubmit` hook (`bun .claude/hooks/dx-his-arm-on-wrapup.ts`) detects sentinel phrases — "that's a wrap", "we're done", "let's call it", "wrap it up", "ship it and stop" — in the human's message and auto-arms `force_rate=true`. Saves the human from typing `/end`.

**PATH-resilient hook scripts**: `.claude/hooks/dx-his-stop.sh` and `.claude/hooks/dx-his-session-end.sh` resolve `dx` through the repo's own `tools/bin/dx` rather than relying on PATH. If the bin isn't found, they emit `{"continue":true}` and exit cleanly — telemetry is best-effort, never blocks.

Claude can — and should — file `dx his rate --as=claude` mid-session whenever it notices something worth recording. See `.claude/skills/his-self-rating/SKILL.md`.

**Aspects** are an editable registry at `src/his/aspects.json`. Three buckets: `human` (anger, frustration, understood_claude…), `claude` (talked_too_much, tool_thrashing, self_doubt…), `shared` (vibe, friction_*, gap_*, accuracy, focus…). Adding an aspect = one entry in the JSON; no schema or code change. Unknown keys submitted via the CLI still pass through (lean).

**Storage**: SQLite at `~/.claude/dx-his/his.db` via `bun:sqlite` (zero new deps). Three tables: `sessions`, `submissions`, `aspect_scores` — schemaless for aspects.

**Slash commands**: `/rate` wraps `dx his rate --as=human`; `/end` triggers wrap-up with a forced Claude reading.

**Why it exists**: the session *vibe* — friction, gaps, talking-past-each-other — tells a lot about the quality of the session, the code, the spec, the dev env. We want both faces of the conversation reading their own pulse, accumulating signal we can mine later.

## Architecture

Three-layer command design (same as effi-cli):

1. **Pure functions** -- testable formatting/logic with dependency injection
2. **Commander builder** -- `buildXxxCommand()` returns a `Command`, wires options
3. **CLI handler** -- thin wrapper calling pure functions, handling exit codes

Core logic lives in `src/core.ts`. SDK in `sdk.ts`. Config in `.dx/config.json`.

## Output Convention

Convention: human output goes to stderr, JSON data goes to stdout. This keeps stdout clean for piping (e.g., `dx status --json | jq .user`).
