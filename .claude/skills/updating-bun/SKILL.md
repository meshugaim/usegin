---
name: updating-bun
description: Update Bun runtime and dependencies. Triggered by "update bun", "upgrade bun", "new bun version", or "bun 1.x.x".
---

# Updating Bun

Update Bun runtime and `@types/bun` across the codebase.

## Checklist

1. **Check versions**
   ```bash
   bun --version  # Current
   # Check https://github.com/oven-sh/bun/releases for latest
   ```

2. **Update pinned versions**
   - `.devcontainer/Dockerfile` - `bun-v1.x.x`
   - `.github/workflows/*.yml` - `bun-version: 1.x.x`
   - `docs/gitpod-automation-flow.md` - version reference

3. **Update @types/bun in all package.json files**
   ```bash
   # Find all stale versions
   grep -r '"@types/bun"' --include="package.json" | grep -v node_modules
   ```

4. **Refresh lockfiles**
   ```bash
   # Run bun install in each tool directory
   for dir in tools/*/; do
     if [ -f "$dir/package.json" ]; then
       (cd "$dir" && bun install)
     fi
   done
   ```

5. **Verify nothing missed**
   ```bash
   # Search for stale version references
   grep -rE 'bun-v1\.[0-9]+\.[0-9]+|bun-version: 1\.[0-9]+' --include="*.yml" --include="*.md" --include="Dockerfile"
   grep -r '@types/bun.*1\.[0-9]+\.[0-9]+' --include="package.json" | grep -v node_modules
   ```

6. **Run tests**
   ```bash
   cd nextjs-app && bun test tests/unit/
   ```

## Files to Update

| File | What to change |
|------|----------------|
| `.devcontainer/Dockerfile` | `bun-v1.x.x` in curl install |
| `.github/workflows/nextjs-unit-tests.yml` | `bun-version` |
| `docs/gitpod-automation-flow.md` | Version in example |
| `package.json` (root + tools/*) | `@types/bun` version |

## Notes

- `nextjs-app/Dockerfile` uses `oven/bun:1` (floating tag) - no update needed
- `open-source-licenses.csv` is auto-generated - regenerate if needed
- CI workflows mostly use `bun-version: latest` - only update pinned ones
