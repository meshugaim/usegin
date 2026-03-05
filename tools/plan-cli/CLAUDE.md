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

## Flags that DON'T exist

| Tempting | Reality |
|---|---|
| `--json` on list | Only on `show` and `create` |
| `--sort` | Use `--latest` or `--active` |
| `--all` | Use `--show-done` for done sub-issues |
| `--count` | Not available |
