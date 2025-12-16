---
name: Adding docs to your CLI
handle: adding-cli-docs
type: how-to
context: When you want your CLI's docs to appear in the registry
tags: [internal, documentation, setup]
---

# Adding Docs to Your CLI

**TL;DR**: Create `tools/<your-cli>/docs/` with markdown files that have YAML frontmatter.

## Structure

```
tools/your-cli/
├── src/
│   └── ...
└── docs/
    ├── your-doc.md           # User-facing docs
    └── internal/
        └── your-internal.md  # Developer docs
```

## Required Frontmatter

Each doc needs these fields:

```yaml
---
name: Human-readable title
handle: kebab-case-identifier
type: tutorial | how-to | reference | explanation
context: When/why you'd use this doc
tags: [optional, tags, for, search]
---
```

## Example

```yaml
---
name: Getting started with foobar
handle: getting-started
type: tutorial
context: When you're new to foobar and want to learn the basics
tags: [beginner, setup]
---

# Getting Started

**TL;DR**: Run `foobar init` then `foobar run`.

...rest of content...
```

## Tips

- Use `handle` for CLI references (e.g., `docs show getting-started`)
- Keep `context` short — it's shown in the list view
- Put developer/internal docs in `docs/internal/`
- Follow the [Divio documentation system](https://docs.divio.com/documentation-system/) for doc types
