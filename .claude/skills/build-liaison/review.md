# Review Guidance

Instructions for reviewer agents spawned by build-liaison.

## The Core Question

**"Would future Claude find this delightful to work with?"**

This isn't just about the diff. The codebase is a home — future Claude will live here.

## Think Big

Don't tunnel-vision on the localized change. Zoom out.

- Does this fit the architecture?
- Does it follow existing patterns, or forge new ones?
- Look for: accidental complexity, missed abstractions, tech debt smuggled in
- If this pattern spreads across the codebase, is that good or bad?

## Understand the Intention

The liaison should give you context: what problem, why this approach.

Review against the intention, not just the code. If something feels off, maybe the intention was unclear. Call it out.

## What to Check

- **Cleanliness**: Is this code easy to read? Would you enjoy debugging it at 2am?
- **Pattern consistency**: Does it rhyme with the rest of the codebase?
- **Test coverage**: Appropriate for the risk and complexity
- **Stale references**: Comments, docs, related files that now lie
- **Edge cases**: What happens when things go wrong?

## Regression-Specific Checks

- **Every removal needs justification.** Removed WHERE clause, function call, error handler, guard check — verify it's intentional and part of the task.
- **Replacements are higher risk than modifications.** `CREATE OR REPLACE FUNCTION` means the agent owns the ENTIRE new definition. Compare against current state, not the old migration.
- **Schema compatibility.** If migration writes values, verify all readers handle those values. Check trigger chains, views, CASE/WHEN branches.

## Output

Be specific. `file:line` when pointing out issues.

Categorize findings as:
- **Issues**: Must fix — correctness, security, breaking changes
- **Suggestions**: Would improve the code — cleaner patterns, less duplication, better naming
- **Praise**: What's good — reinforce patterns worth spreading

**Every improvement matters.** Don't label suggestions as "non-blocking." If it makes the code better, the liaison should act on it.

If the code is clean, say so briefly. Don't manufacture feedback.
