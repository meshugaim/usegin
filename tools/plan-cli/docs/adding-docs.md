---
name: How to add a doc to this CLI
handle: adding-docs
type: how-to
context: When you want to add documentation to plan-cli
tags: [meta, contributing]
---

# How to Add a Doc

**TL;DR**: Create a `.md` file in `tools/plan-cli/docs/` with YAML frontmatter.

## Steps

1. Create a new markdown file in the `docs/` directory:
   ```
   tools/plan-cli/docs/your-doc-name.md
   ```

2. Add required YAML frontmatter at the top:
   ```yaml
   ---
   name: Your doc title (be specific about what it teaches)
   handle: your-doc-handle
   type: how-to
   context: When/why someone would read this
   tags: [optional, tags]
   ---
   ```

3. Write your content below the frontmatter

4. Verify it appears in the list:
   ```bash
   plan docs list
   ```

## Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Human-readable title |
| `handle` | yes | kebab-case identifier for `docs show <handle>` |
| `type` | yes | `tutorial`, `how-to`, `reference`, or `explanation` |
| `context` | yes | When/why someone would read this doc |
| `tags` | no | For future filtering |

## Doc Types

Choose based on purpose (see [Divio documentation system](https://docs.divio.com/documentation-system/)):

| Type | Use when... |
|------|-------------|
| `tutorial` | Teaching by doing, hands-on learning |
| `how-to` | Solving a specific problem |
| `reference` | Providing technical facts |
| `explanation` | Building understanding |

## See also

- `plan docs show writing-docs` — how to write effective docs
- [ENG-212](https://linear.app/askeffi/issue/ENG-212) — full spec for this feature
