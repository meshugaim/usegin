---
name: How to write effective docs
handle: writing-docs
type: explanation
context: Understanding what makes CLI documentation useful
tags: [meta, style]
---

# Writing Effective Docs

**TL;DR**: TL;DR at top, actionable content, layered depth.

## Structure

Every doc should be layered — quick answer first, depth below:

```markdown
# Title

**TL;DR**: One sentence answer. Copy-pasteable if possible.

## Why (optional)
Context for those who want to understand, not just do.

## Steps / Content
The actual meat.

## Tips (optional)
Quick insights, gotchas.

## See also (optional)
Cross-references.
```

## Style Guide

| Do | Don't |
|----|-------|
| Actionable commands you can copy | Abstract descriptions |
| Specific examples with real values | Generic placeholders |
| Short paragraphs, whitespace | Walls of text |
| Tables for structured info | Nested bullet lists |
| Link to `--help` for full options | Duplicate CLI reference |

## The Four Doc Types

From the [Divio documentation system](https://docs.divio.com/documentation-system/):

| Type | Orientation | Example |
|------|-------------|---------|
| Tutorial | Learning | "Your first issue" |
| How-to | Problem-solving | "How to update descriptions iteratively" |
| Reference | Information | "All plan update flags" |
| Explanation | Understanding | "Why we use temp files" |

Pick the right type for your content. Don't mix them in one doc.

## Progressive Disclosure

The list output shows name + context. Users decide what to read.

Good context lines:
- "When writing complex issue descriptions collaboratively"
- "Understanding issue relationships and when each applies"

Bad context lines:
- "About descriptions" (too vague)
- "This doc explains how to..." (redundant)

## See also

- `plan docs show adding-docs` — how to add a doc
- [ENG-212](https://linear.app/askeffi/issue/ENG-212) — full spec
