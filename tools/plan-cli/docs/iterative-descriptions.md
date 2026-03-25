---
name: How to iteratively update issue descriptions
handle: iterative-descriptions
type: how-to
context: When writing complex issue descriptions collaboratively with Claude
tags: [workflow, editing]
---

# Iterative Issue Descriptions

**TL;DR**: `plan checkout ENG-123` → edit the file → `plan push ENG-123`. Or use `plan watch` for auto-push.

## Recommended: checkout/push workflow

The file-sync commands handle the ceremony for you:

```bash
plan checkout ENG-123          # Fetches description → /tmp/linear/ENG-123/description.md
# ... edit with Edit tool ...
plan push ENG-123              # Pushes changes back to Linear
```

Or for hands-free editing:

```bash
plan watch ENG-123             # Checks out if needed, then auto-pushes on save (30m idle timeout)
# ... edit the file, changes auto-push ...
plan unwatch ENG-123           # Flushes pending changes, then stops
```

### Useful commands

```bash
plan status                    # See all checkouts and their state (clean/modified)
plan checkout ENG-123 --force  # Re-fetch from Linear (overwrites local edits)
plan push ENG-123              # Skips if no changes (hash-based no-op detection)
plan watch ENG-123 --timeout 1h  # Custom idle timeout
plan watch ENG-123 --timeout none  # No idle timeout
plan unwatch --all             # Stop all watchers
```

### How it works

- `checkout` writes to `/tmp/linear/ENG-XXX/description.md` with a `.meta.json` sidecar
- `push` compares the file hash to detect changes — skips if nothing changed
- `push` warns (but still pushes) if the issue was updated on Linear since checkout (any change — description, status, labels, comments)
- `watch` spawns a background process that debounces file changes and auto-pushes
- `status` scans the checkout directory and shows clean/modified state

## Alternative: manual temp file workflow

The original pattern still works for simpler cases or when you prefer explicit control:

1. Write to a temp file: `cat > /tmp/ENG-123.md << 'EOF' ... EOF`
2. Apply: `plan update ENG-123 --description-file /tmp/ENG-123.md`
3. Edit with Claude's Edit tool
4. Re-apply: `plan update ENG-123 --description-file /tmp/ENG-123.md`
5. Repeat

## Works well with

This pattern powers several Claude skills that write iteratively:
- `writing-specs` — spec documents refined section by section
- `writing-skills` — skill files built collaboratively
- `implementing-specs` — progress tracked in Linear as you go

## See also

- `plan checkout --help`, `plan push --help`, `plan watch --help`
- `plan docs show adding-docs` — how to add docs like this one
