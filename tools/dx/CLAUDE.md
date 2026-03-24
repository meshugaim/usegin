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
| `dx status` | Show all features with resolved on/off state |
| `dx resolve <feature>` | Resolve a single feature flag |
| `dx sync` | Write resolved values to git config |
| `dx whoami` | Show resolved identity |

All read commands support `--json`. The CLI auto-detects headless contexts (non-TTY, `CLAUDECODE=1`) and defaults to JSON. Override with `DX_OUTPUT=json` or `DX_OUTPUT=human`.

Prefix matching is enabled: `dx st` = `dx status`, `dx r` = `dx resolve`, etc.

## Architecture

Three-layer command design (same as effi-cli):

1. **Pure functions** -- testable formatting/logic with dependency injection
2. **Commander builder** -- `buildXxxCommand()` returns a `Command`, wires options
3. **CLI handler** -- thin wrapper calling pure functions, handling exit codes

Core logic lives in `src/core.ts`. SDK in `sdk.ts`. Config in `.dx/config.json`.
