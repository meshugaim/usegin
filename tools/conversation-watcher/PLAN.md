# Conversation Watcher - Standalone CLI Tool

## Overview
Standalone Bun-based tool to watch Claude Code conversation logs, extract conversations, and sync to git repository.

## Requirements

### Core Functionality
- Watch a directory for `.jsonl` conversation files
- Extract user/assistant messages (skip tool calls for brevity)
- Detect conversation forks/rewinds
- Sync extracted conversations to git repository with auto-commit/push
- Debounce file changes (avoid rapid re-syncs)
- Handle graceful shutdown

### CLI Interface
Simple CLI that runs directly - PM2 handles process management:
- `bun run src/cli.ts --username <name> --repo <url>` - Start watcher (run by PM2)
- `bun run src/cli.ts --mode extract --username <name> --repo <url>` - One-time extraction

### PM2 Commands (Process Management)
- `pm2 start ecosystem.config.cjs` - Start watcher
- `pm2 stop conversation-watcher` - Stop watcher
- `pm2 restart conversation-watcher` - Restart watcher
- `pm2 logs conversation-watcher` - View logs
- `pm2 status` - Check status
- `pm2 monit` - Real-time monitoring

### Configuration
- Username (for directory structure in git repo)
  - Auto-detected from `git config user.name` (local or global)
  - Can be overridden with `--username` flag or `WATCHER_USERNAME` env var
- Git repository URL
- Clone directory path
- Watch directory path
- Debounce delay (default: 2000ms)

## Tech Stack

### Core
- **Bun** - Runtime and package manager
  - [Docs: Installation](https://bun.sh/docs/installation)
  - [Docs: CLI](https://bun.sh/docs/cli/bunx)
- **@bunli/core** - Type-safe CLI framework with built-in spinners/colors
  - [Docs: Bunli](https://bunli.sh/)
- **zod** - Schema validation for CLI options
- **PM2** - Process manager for production
  - [Docs: PM2](https://pm2.keymetrics.io/docs/usage/quick-start/)

### Built-in APIs
- `fs/promises.watch()` - File system watching (recursive)
  - [Docs: Watch files](https://bun.sh/docs/api/file-io#watch-files)
- Bun Shell API (`$\`cmd\``) - Execute shell commands
  - [Docs: Shell](https://bun.sh/docs/runtime/shell)
- `process.on()` - Signal handling (SIGTERM, SIGINT)
  - [Docs: Signals](https://bun.sh/docs/api/spawn#signals)

## Architecture

```
src/
├── cli.ts          # Main CLI - watcher service & extract mode
├── extractor.ts    # Conversation extraction logic (from scripts/)
├── git-sync.ts     # Git operations using Bun Shell API
└── config.ts       # Config schema and defaults
ecosystem.config.cjs # PM2 configuration
```

## Installation & Usage

```bash
# Install dependencies
bun install

# Start with PM2
bunx pm2 start ecosystem.config.cjs

# PM2 management
bunx pm2 status
bunx pm2 logs conversation-watcher
bunx pm2 logs conversation-watcher --follow
bunx pm2 restart conversation-watcher
bunx pm2 stop conversation-watcher
bunx pm2 delete conversation-watcher

# Or customize
cd /workspaces/test-mvp/conversation-watcher
bunx pm2 start "bun run src/cli.ts --username nitsan --repo https://github.com/..." --name conversation-watcher
```

**References:**
- [Docs: bun link](https://bun.sh/docs/cli/link)

## Key Differences from Reference Implementation

### What We're Changing
- ❌ Remove tmux dependency → Use **PM2** for process management
- ❌ Remove bash scripts → Pure TypeScript
- ❌ Remove custom PID file management → PM2 handles it
- ✅ Add proper CLI framework (Bunli)
- ✅ Add type safety with Zod schemas
- ✅ Add PM2 integration (monitoring, auto-restart, logs)
- ✅ Add logs/restart commands via PM2
- ✅ Better error handling and validation
- ✅ Modular architecture (easy to test/extend)

### What We're Keeping
- Same extraction logic (user/assistant messages only)
- Same fork detection algorithm
- Same git sync workflow (add → commit → push)
- Same directory structure (username/YYYY-MM/YYYY-MM-DD/conversation-*.txt)
- Same debouncing behavior (2s default)

## Non-Goals
- No compilation to binary (use `bun link` instead)
- No config file (CLI args only for simplicity)

## Production Features (via PM2)
- **Process Monitoring** - pm2 status/monit for real-time monitoring
- **Auto-restart** - Automatic restart on crashes
- **Log Management** - pm2 logs with rotation
- **Resource Limits** - Memory limits and restart thresholds
- **Zero-downtime Restart** - pm2 restart without service interruption
