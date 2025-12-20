# Worktree CLI

Git worktree lifecycle management with Claude integration.

## Commands

### `create <name>`

Create a new git worktree.

```bash
worktree create ENG-123
# Creates .worktrees/ENG-123 with branch wt/ENG-123
```

### `destroy <name>`

Remove a worktree and its branch.

```bash
worktree destroy ENG-123
```

### `list` (alias: `ls`)

List all managed worktrees.

```bash
worktree list
worktree ls --json  # JSON output
```

### `launch <name>`

Launch Claude in a worktree with MCP server control.

```bash
# Launch Claude with default MCP configuration (from .mcp.json)
worktree launch ENG-123

# Launch Claude with all MCP servers disabled
worktree launch ENG-123 --no-mcp

# Launch Claude with custom MCP configuration
worktree launch ENG-123 --mcp-config /path/to/custom.json
```

#### Options

- `--no-mcp` - Disable all MCP servers (uses `--strict-mcp-config` flag)
- `--mcp-config <path>` - Use custom MCP configuration file

#### Use Cases

**Isolate worktree from MCP servers:**
```bash
worktree launch 492 --no-mcp
```

This is useful when you want to work in a worktree without any MCP server connections, for example:
- Testing without external dependencies
- Working on tasks that don't need MCP integration
- Debugging issues related to MCP servers

**Use custom MCP configuration:**
```bash
worktree launch 492 --mcp-config .mcp.ci.json
```

This allows you to:
- Use a subset of MCP servers for specific tasks
- Test with different MCP configurations
- Override the default `.mcp.json` settings

## Implementation Details

The `launch` command:
1. Verifies the worktree exists
2. Builds Claude CLI arguments based on options
3. Spawns Claude in the worktree directory with the appropriate MCP configuration

### MCP Control Mechanism

- **Default**: No flags passed to Claude, uses standard MCP resolution (user config + project `.mcp.json`)
- **`--no-mcp`**: Passes `--strict-mcp-config` to Claude, which disables all MCP servers
- **`--mcp-config <path>`**: Passes `--strict-mcp-config --mcp-config <path>` to Claude, which uses only the specified config
