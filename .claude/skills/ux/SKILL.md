---
name: ux
description: Build UX enhancements. Manages work against Linear (ENG-945). Triggered by "/ux" or UX implementation requests.
---

# UX Development

Build and enhance UX, tracked in Linear.

---

## First: Orient on Linear

Check current UX work status:

```bash
plan show 945 --tree
```

**Issue structure:**
- **ENG-945** - ux: design implementation (parent)
  - **ENG-880** - current work (active implementation)
  - **ENG-881** - backlog (queued)
  - **ENG-882** - future (later)

Then ask the user: **"What do you want to implement?"**

## Linear Management

Autonomously manage issues as you work:

### Starting work
```bash
plan start <id>                    # Mark in progress, assign to you
```

### Creating issues
```bash
# Current work
plan create "ux: <title>" --parent 880 --label feature --description "<desc>"

# Backlog
plan create "ux: <title>" --parent 881 --label feature --description "<desc>"

# Future
plan create "ux: <title>" --parent 882 --label feature --description "<desc>"
```

### Completing work
```bash
plan close <id>                    # When done
```

### Deferring work
```bash
plan update <id> --parent 881      # Move to backlog
plan update <id> --parent 882      # Move to future
```

## Reference Sources

### 1. figma-design-oria branch (reference only, NEVER MERGE)

```bash
# See what's different
git diff --stat main..origin/figma-design-oria -- nextjs-app/

# View specific file
git show origin/figma-design-oria:nextjs-app/path/to/file.tsx
```

### 2. Figma designs

Use `mcp__figma-personal__*` tools with page mapping:

```bash
cat tools/figma/page-mapping.json
```

**File key:** `A0DV8pRwHWgs9EF07sVYxG`

| Concept | Figma frames | App routes |
|---------|--------------|------------|
| workspace_view | Active projects overview | /projects |
| project_chat | Single project view | /projects/[id]/chat |
| project_settings | Project Summary | /projects/[id]/settings |

## Workflow

1. **Orient** - `plan show 945 --tree` to see current state
2. **Ask** - What does the user want to implement?
3. **Track** - Create or start an issue in Linear
4. **Reference** - Check branch and/or Figma for design
5. **Build** - Implement the feature
6. **Complete** - Close the Linear issue

## Rules

- **NEVER merge figma-design-oria** - reference only
- Keep Linear updated as you work
