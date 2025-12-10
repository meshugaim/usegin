# conversation-watcher

Watch Claude Code conversation logs and sync to git repository.

## Installation

```bash
bun install
```

## Usage

The CLI will automatically use your git username from `git config user.name` if not explicitly provided.

### Watch mode (continuous)
```bash
bun run src/cli.ts --repo https://github.com/your/repo.git
```

### With explicit username
```bash
bun run src/cli.ts --username yourname --repo https://github.com/your/repo.git
```

### Extract mode (one-time)
```bash
bun run src/cli.ts --mode extract --repo https://github.com/your/repo.git
```

### Via PM2
```bash
pm2 start ecosystem.config.cjs
pm2 logs conversation-watcher
```

## CLI Options

- `--repo <url>` (required) - Git repository URL
- `--username <name>` (optional) - Username for directory structure (defaults to git config user.name)
- `--mode extract` (optional) - One-time extraction instead of watch mode
- `--cloneDir <path>` (optional) - Clone directory (default: ~/.conversation-watcher/repo)
- `--watchDir <path>` (optional) - Watch directory (default: ~/.config/Claude Code/conversations)
- `--debounceMs <ms>` (optional) - Debounce delay (default: 2000)
