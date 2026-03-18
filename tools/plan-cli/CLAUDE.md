# plan CLI

Custom CLI wrapping the Linear API for issue tracking.

## Commands

```bash
# Browse & orient
plan list                                     # Active backlog (priority order)
plan list --limit 5                           # Cap top-level results
plan list --label bug                         # Filter by label
plan list --status "In Progress"              # Filter by status
plan list --assignee @me                      # My issues
plan list --active                            # Sort by recent activity
plan list --latest                            # Sort by creation date
plan list --json                              # Output as JSON (for agents)
plan list --json --group-by status            # Grouped JSON output
plan list --json --page 1 --page-size 10      # Paginated JSON output
plan show <id>                                # Full details + relationships
plan show <id> --tree                         # Graph: parent, siblings, children

# Work
plan start <id>                               # Set In Progress + assign to me
plan close <id>                               # Set Done

# Create (always connect to the graph)
plan create "scope: title" --parent <id> --label feature
plan create "scope: title" --related-to <id> --label bug

# Update
plan update <id> --status "In Progress"
plan update <id> --description "text"
plan update <id> --comment "text"
plan update <id> --blocked-by <id>

# Search
plan search "query"                           # Text search across issues
plan search "query" --limit 10
```

Short IDs work everywhere: `plan show 365` → `plan show ENG-365`.

## Output format

By default, `plan list` auto-detects the best output format:

1. Explicit `--json` flag → always JSON
2. `PLAN_OUTPUT=json` env var → force JSON
3. `PLAN_OUTPUT=human` env var → force human (overrides auto-detection)
4. `CLAUDECODE=1` env var → JSON (Claude Code sets this automatically)
5. No TTY on stdout → JSON (piped/scripted usage)
6. Otherwise → human table

Agents almost always get JSON automatically (via `CLAUDECODE=1`). Use `PLAN_OUTPUT=human` to override.

## Pagination (JSON only)

Use `--page` and `--page-size` to paginate large result sets in JSON mode:

```bash
plan list --json --page 1                     # First 25 issues (default page size)
plan list --json --page 2 --page-size 10      # Items 11-20
```

The response includes a `pagination` envelope:
```json
{ "issues": [...], "pagination": { "page": 1, "pageSize": 25, "totalCount": 42, "totalPages": 2, "hasNextPage": true } }
```

**Constraints:**
- `--page` and `--limit` are mutually exclusive (use one or the other)
- `--page` is ignored when `--group-by` is used (grouped output returns all groups)
- `--page` in human mode prints a warning and is ignored

## Flags that DON'T exist

| Tempting | Reality |
|---|---|
| `--sort` | Use `--latest` or `--active` |
| `--all` | Use `--show-done` for done sub-issues |
| `--count` | Not available |
