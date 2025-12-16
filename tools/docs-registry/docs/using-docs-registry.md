---
name: Using the central docs registry
handle: using-docs-registry
type: how-to
context: When you need to find documentation across all CLIs
tags: [discovery, search, documentation]
---

# Using the Central Docs Registry

**TL;DR**: Run `docs` to see all docs from all CLIs. Use `docs search <term>` to find specific topics.

## Why

The docs registry aggregates documentation from all CLIs in one place:
- No need to remember which CLI has which docs
- Search across all documentation
- Discover docs you didn't know existed

## Commands

```bash
# List all docs
docs list

# List docs from a specific CLI
docs list --source plan-cli

# Show a doc by number or handle
docs show 1
docs show iterative-descriptions

# Search for a term
docs search workflow

# See which CLIs have docs
docs sources
```

## How It Works

The registry auto-discovers docs from `tools/*/docs/**/*.md`. Any CLI that follows the docs pattern (YAML frontmatter + markdown content) will automatically appear in the registry.

## Tips

- Numbers from `docs list` work with `docs show`
- Search looks at: name, handle, context, type, tags, and content
- Filter by source when you know which CLI has what you need
