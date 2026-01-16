# Mikado Method

Use this skill for large refactorings that need to be done safely in small steps.

## When to Use

- Removing feature flags / dead code paths
- Large renames or restructures
- Untangling tightly coupled code
- Any change where "just do it" breaks many things

## The Method

1. **Set a goal** - Write it at the root of the graph
2. **Try it** - Attempt the change directly (timeboxed ~10min)
3. **If it works** - Commit, mark done, move up the graph
4. **If it breaks** - Note what's blocking, **revert completely**, recurse on blocker
5. **Repeat** - Work leaf-to-root until goal is done

The key insight: **always revert failed attempts**. You're exploring, not committing broken code.

## Graph File

Track the Mikado graph in a markdown file:

```
docs/mikado/<issue-id>.md
```

Example: `docs/mikado/ENG-1140.md`

## Graph Format

```markdown
# Mikado: <Goal>

Issue: ENG-XXXX

## Graph

- [ ] **GOAL: <what you want to achieve>**
  - [ ] Blocker A (discovered when trying goal)
    - [ ] Sub-blocker A.1 (discovered when trying A)
    - [x] Sub-blocker A.2 (done)
  - [ ] Blocker B
  - [x] Blocker C (done)

## Log

### <date> - Attempting: <node>
- Tried: <what you did>
- Result: <worked | broke>
- Blockers found: <list>
- Reverted: yes/no
```

## Workflow Commands

```bash
# Before attempting a change
git stash -u  # or ensure clean working tree

# After failed attempt - REVERT
git checkout .
git clean -fd

# After successful leaf node
git add -A && git commit -m "mikado: <what was done>

Part of: ENG-XXXX"
```

## Tips

- Keep attempts short (5-15 min)
- Revert aggressively - failed attempts teach, don't commit them
- Work leaves first - bottom of graph before top
- Each successful commit should leave tests green
- Update the graph file as you discover blockers
