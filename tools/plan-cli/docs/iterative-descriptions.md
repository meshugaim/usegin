---
name: How to iteratively update issue descriptions
handle: iterative-descriptions
type: how-to
context: When writing complex issue descriptions collaboratively with Claude
tags: [workflow, editing]
---

# Iterative Issue Descriptions

**TL;DR**: Write to `/tmp/ENG-123.md`, update with `--description-file`, edit with Claude's Edit tool, repeat.

## Why

Long descriptions passed inline are:
- Hard to edit collaboratively
- Awkward in shell history
- Can't be iteratively refined

The temp file pattern lets you treat descriptions like code — edit, review, refine.

## Steps

1. Write initial description to temp file (use issue ID):
   ```bash
   cat > /tmp/ENG-123.md << 'EOF'
   ## Context
   ...
   ## Requirements
   ...
   EOF
   ```

2. Apply to issue:
   ```bash
   plan update ENG-123 --description-file /tmp/ENG-123.md
   ```

3. Review on Linear, get feedback

4. Edit `/tmp/ENG-123.md` using Claude's Edit tool

5. Re-apply:
   ```bash
   plan update ENG-123 --description-file /tmp/ENG-123.md
   ```

6. Repeat until done

## Tips

- Use `/tmp/<issue-id>.md` — unique per issue, no conflicts
- The file persists until reboot, so you can refine across sessions
- Works great for specs, detailed bug reports, feature descriptions
- Claude can read and edit the file directly without you copy-pasting

## Example Session

```
You: Let's write the description for ENG-456

Claude: I'll start with a draft.
[Writes to /tmp/ENG-456.md]
[Runs: plan update ENG-456 --description-file /tmp/ENG-456.md]

You: Add more detail about the edge cases

Claude: [Edits /tmp/ENG-456.md]
[Runs: plan update ENG-456 --description-file /tmp/ENG-456.md]

You: Looks good!
```

## Works well with

This pattern powers several Claude skills that write iteratively:
- `writing-specs` — spec documents refined section by section
- `writing-skills` — skill files built collaboratively
- `implementing-specs` — progress tracked in Linear as you go

The temp file + Edit tool combo is the foundation for any iterative writing workflow.

## See also

- `plan update --help` — all update options
- `plan docs show adding-docs` — how to add docs like this one
