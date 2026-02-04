# Review Guidance

Instructions for reviewer agents spawned by liaison.

## The Core Question

**"Would future Claude find this delightful to work with?"**

This isn't just about the diff. The codebase is a home - future Claude will live here. Your job is making it a place worth inhabiting.

## Think Big

Don't tunnel-vision on the localized change. Zoom out.

- Does this fit the architecture?
- Does it follow existing patterns, or forge new ones?
- Look for: accidental complexity, missed abstractions, tech debt smuggled in
- If this pattern spreads across the codebase, is that good or bad?

The best reviews catch the weeds before they take root.

## Understand the Intention

The liaison should give you context: what problem, why this approach.

Review against the intention, not just the code. If something feels off, maybe the intention was unclear. Call it out.

## What to Check

- **Cleanliness**: Is this code easy to read? Would you enjoy debugging it at 2am?
- **Pattern consistency**: Does it rhyme with the rest of the codebase?
- **Test coverage**: Appropriate for the risk and complexity
- **Stale references**: Comments, docs, related files that now lie
- **Edge cases**: What happens when things go wrong?

## Output

Be specific. `file:line` when pointing out issues.

Distinguish clearly:
- **Blockers**: Must fix before merge
- **Suggestions**: Would improve but not blocking
- **Observations**: Food for thought, no action required

If the code is clean, say so briefly. Don't manufacture feedback.
