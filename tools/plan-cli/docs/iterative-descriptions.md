---
name: How to iteratively update issue descriptions
handle: iterative-descriptions
type: how-to
context: When writing complex issue descriptions collaboratively with Claude
tags: [workflow, editing]
---

# Iterative Issue Descriptions

**TL;DR**: Write to `/tmp/desc.md`, update with `--description-file`, edit with Claude's Edit tool, repeat.

## Why

Long descriptions passed inline are:
- Hard to edit collaboratively
- Awkward in shell history
- Can't be iteratively refined

The temp file pattern lets you treat descriptions like code — edit, review, refine.

## Steps

1. Write initial description to temp file:
   ```bash
   cat > /tmp/desc.md << 'EOF'
   ## Context
   ...
   ## Requirements
   ...
   EOF
   ```

2. Apply to issue:
   ```bash
   plan update ENG-123 --description-file /tmp/desc.md
   ```

3. Review on Linear, get feedback

4. Edit `/tmp/desc.md` using Claude's Edit tool

5. Re-apply:
   ```bash
   plan update ENG-123 --description-file /tmp/desc.md
   ```

6. Repeat until done

## Tips

- Use `/tmp/desc.md` as a convention — easy to remember
- The file persists until reboot, so you can refine across sessions
- Works great for specs, detailed bug reports, feature descriptions
- Claude can read and edit the file directly without you copy-pasting

## Example Session

```
You: Let's write the description for ENG-456

Claude: I'll start with a draft.
[Writes to /tmp/desc.md]
[Runs: plan update ENG-456 --description-file /tmp/desc.md]

You: Add more detail about the edge cases

Claude: [Edits /tmp/desc.md]
[Runs: plan update ENG-456 --description-file /tmp/desc.md]

You: Looks good!
```

## See also

- `plan update --help` — all update options
- `plan docs show adding-docs` — how to add docs like this one
