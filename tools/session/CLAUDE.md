# Session Tool

Parse and browse Claude Code session JSONL files with configurable verbosity.

## Quick Start

```bash
# Parse a session by path
session /path/to/session.jsonl

# Parse by session ID (or prefix)
session 502de9c7-684a-4724-b592-34aa88aac626
session 502de9c7  # prefix works too

# Browse sessions interactively
session find

# List recent sessions
session list --limit 5
```

## Architecture Overview

```
src/
├── cli.ts              # Main entry point, subcommand routing
├── cli-args.ts         # Argument parsing for find/list/pick/fetch/resume commands
├── cli-args-main.ts    # Argument parsing for main parse command
├── parser.ts           # Core JSONL parsing logic
├── fetch.ts            # Fetch archived sessions from ~/agent-records/ to local
├── formatter.ts        # Output formatting (narrative, terminal, markdown)
├── types.ts            # Core types, branded IDs, ToolInputMap
├── errors.ts           # Custom error classes with actionable hints
├── validation.ts       # Type guards for entry validation
├── debug.ts            # Debug logging utilities
├── finder/             # Session discovery and browsing
│   ├── index.ts        # Re-exports all finder APIs
│   ├── types.ts        # SessionInfo, DiscoverOptions, etc.
│   ├── discovery.ts    # Find sessions in ~/.claude/projects/
│   ├── remote.ts       # Remote discovery from ~/agent-records/
│   ├── resolve.ts      # Resolve session ID/prefix to file path
│   ├── meta.ts         # Extract metadata (summary, user messages)
│   ├── fzf.ts          # FZF integration for interactive browsing
│   ├── pickers.ts      # Tmux/VSC popup pickers
│   └── output.ts       # Format output (path/id/json)
└── testing/            # Shared test utilities
    ├── index.ts        # Re-exports all test factories
    ├── fixtures.ts     # Test constants and generators
    ├── entries.ts      # Entry factories (userEntry, assistantEntry, etc.)
    ├── turns.ts        # Turn factories (userTurn, assistantTurn, etc.)
    └── sessions.ts     # Session factories (makeSession, makeSubagent, etc.)
```

## Key Concepts

### Entry Types

Claude Code stores sessions as JSONL files. Each line is an **Entry** with a `type` field:

| Type | Description |
|------|-------------|
| `system` | Session initialization (model, tools, cwd) |
| `user` | User messages and tool results |
| `assistant` | Claude responses, tool calls, thinking |
| `result` | Session completion (success/error, duration, cost) |
| `summary` | AI-generated session summary |
| `progress` | Hook progress updates |
| `file-history-snapshot` | File state for undo/redo |
| `queue-operation` | Async operation management |
| `saved_hook_context` | Hook resumption state |

### Turns

Entries are parsed into **Turns** - a higher-level abstraction representing one message in the conversation:

```ts
interface Turn {
  role: "user" | "assistant";
  text: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  uuid: EntryUuid;
  parentUuid?: EntryUuid | null;
  isOnCurrentBranch: boolean;
}
```

### Rewinds

Entries link via `uuid`/`parentUuid` forming a tree. When users rewind and continue from an earlier point, the parser detects these **branch points** and marks turns that are not on the current branch with `isOnCurrentBranch: false`.

### Subagents

Subagent sessions are stored in separate files (`agent-*.jsonl`) in the same directory. They share the parent's `sessionId` but have their own `agentId`. The parser discovers and includes these when `--subagents` is passed.

### Branded Types

The codebase uses TypeScript branded types to prevent mixing different ID types at compile time:

```ts
type SessionId = string & { readonly __brand: "SessionId" };
type EntryUuid = string & { readonly __brand: "EntryUuid" };
type AgentId = string & { readonly __brand: "AgentId" };
type ToolUseId = string & { readonly __brand: "ToolUseId" };

// Create branded IDs
const sessionId = asSessionId("abc-123");
const entryUuid = asEntryUuid("uuid-001");
```

### ToolInputMap

Type-safe access to tool inputs without unsafe casts:

```ts
// In types.ts
interface ToolInputMap {
  Read: { file_path: string; offset?: number; limit?: number };
  Bash: { command: string; description?: string; timeout?: number };
  // ... more tools
}

// Usage - returns typed input or undefined
const input = getToolInput("Read", toolUse);
if (input) {
  console.log(input.file_path);  // Type: string
}
```

## Adding a New Output Format

1. Add the format type to `cli-args-main.ts`:

```ts
export type OutputFormat = "narrative" | "terminal" | "markdown" | "myformat";
const VALID_FORMATS: readonly OutputFormat[] = [..., "myformat"] as const;
```

2. Create the formatter function in `formatter.ts`:

```ts
export function formatMyFormat(
  session: ParsedSession,
  options: Partial<FormatOptions> = {}
): string {
  // Implementation
}
```

3. Add the case in `cli.ts`:

```ts
case "myformat":
  output = formatMyFormat(session, options);
  break;
```

4. Document in `printHelp()` in `cli.ts`.

## Adding a New Tool to ToolInputMap

1. Add the type definition in `types.ts`:

```ts
export interface ToolInputMap {
  // ... existing tools
  MyTool: {
    required_field: string;
    optional_field?: number;
  };
}
```

2. Add to the `KNOWN_TOOL_NAMES` array:

```ts
export const KNOWN_TOOL_NAMES: KnownToolName[] = [
  // ... existing tools
  "MyTool",
];
```

3. Add formatting in `formatter.ts` if needed:

```ts
// In getToolSummary()
case "MyTool":
  return String(input.required_field || "");
```

4. Add a test in `tool-input-types.test.ts`.

## Testing

```bash
# Run all tests
cd tools/session
bun test

# Run specific test file
bun test src/parser.test.ts

# Run tests matching pattern
bun test --grep "rewind"
```

### Test Files

| File | Coverage |
|------|----------|
| `parser.test.ts` | Core parsing, entry types |
| `parser.rewind.test.ts` | Rewind detection, branch tracking |
| `parser.subagents.test.ts` | Subagent discovery and parsing |
| `parser.commits.test.ts` | Git commit extraction |
| `parser.streaming.test.ts` | Streaming parser |
| `parser.integration.test.ts` | Full session parsing |
| `formatter.test.ts` | Output formatting |
| `fuzz.test.ts` | Property-based testing with fast-check |
| `schema.test.ts` | Schema drift detection |
| `errors.test.ts` | Error message formatting |
| `validation.test.ts` | Type guards |
| `branded-types.test.ts` | Branded type safety |
| `tool-input-types.test.ts` | ToolInputMap type safety |
| `cli-args.test.ts` | Argument parsing |
| `fetch.test.ts` | Session fetch from remote archives |
| `timeout.test.ts` | Timeout handling |
| `debug-logging.test.ts` | Debug output |
| `finder/*.test.ts` | Session discovery and browsing |

### Using Test Factories

```ts
import {
  // Entry factories (for testing parser)
  userEntry, assistantEntry, systemEntry, resultEntry,

  // Turn factories (for testing formatters)
  userTurn, assistantTurn, toolCall, toolResult,

  // Session factories
  makeSession, makeSubagent, makeRewind, makeCommit,

  // Fixtures
  TEST_SESSION_ID, TEST_MODEL, createUuidGenerator,
} from "./testing";

// Testing the parser
const entries = [
  systemEntry(),
  userEntry("u1", "Hello"),
  assistantEntry("a1", "Hi!", { parentUuid: "u1" }),
];
const session = parseEntries(entries);

// Testing the formatter
const session = makeSession({
  turns: [
    userTurn("u1", "Hello"),
    assistantTurn("a1", "Response", {
      toolCalls: [toolCall("t1", "Read", { file_path: "/test.ts" })],
    }),
  ],
});
const output = formatNarrative(session);
```

## Commands Reference

### Main Command

```bash
session <file|id|prefix> [options]
```

**Options:**
- `--format <fmt>` - Output format: `narrative` (default), `terminal`, `markdown`
- `--tool-input` - Include tool call inputs
- `--tool-output` - Include tool results
- `--truncate <n>` - Truncate tool I/O to n chars (default: 500)
- `--subagents` - Include subagent transcripts
- `--include-warmups` - Include warmup subagents
- `--list-files` - List related files (main + subagents)
- `--stream` - Stream mode (read from stdin)
- `--debug` - Show timing info (also: `DEBUG=session` env var)
- `--timeout <secs>` - Timeout in seconds (default: 30, 0 to disable)

### Subcommands

```bash
# Interactive browsing with fzf
session find [--all-projects] [--since 7d] [--no-preview]

# List sessions
session list [--limit 10] [--all-projects] [--since 7d] [--output path|id|json]

# Popup picker (for Claude/automation)
session pick [--method auto|tmux|vsc] [--all-projects]

# Fetch archived session from ~/agent-records/ to local storage
session fetch <id|prefix>

# Fetch (if needed) then resume with claude --resume
session resume <id|prefix>
```

## Error Handling

Custom error classes in `errors.ts` provide actionable hints:

```ts
// Thrown when session ID not found
throw new SessionNotFoundError(sessionId, { searchedLocation: dir });

// Thrown when no sessions match filters
throw new NoSessionsFoundError({ project, since, projectsDirExists });

// Thrown on parsing timeout
throw new ParsingTimeoutError(timeoutSeconds, { filePath, fileSizeBytes });
```

All errors extend `SessionError` for `instanceof` checks.

## Schema Drift Detection

The parser is based on reverse-engineering session files. `schema.test.ts` detects when Claude Code adds new entry types or fields by comparing against `KNOWN_ENTRY_TYPES` and `KNOWN_FIELDS_BY_TYPE` in `types.ts`.

When tests fail due to schema drift:
1. Analyze the new fields/types
2. Update the constants in `types.ts`
3. Update type definitions if needed
