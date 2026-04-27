---
id: z058
title: FRICTION: link strips body's leading blank line
type: zettel
authored-by: usegin
threads: [↑z038, ~SLICE-1, ~z022, ~z040]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

Observed in this dogfood session. Two real, untouched zettels (z015, z003) lost the blank line between frontmatter `---` and the first body line after a single `dx zettel link` call.

Reproducer:
- Pre-state: `---\n\n## Human side` (one blank line, the convention across all 41 hand-written zettels).
- Run: `dx zettel link z015 z028 --cross`.
- Post-state: `---\n## Human side` (blank line eaten).

Why it matters: SLICE-1.md success signal #2 says "0 markdown files in `zettels/` get malformed when round-tripped through the parser." That signal is failing in production today — every link rewrites the source-of-truth file with a formatting drift. Over time, 100% of linked zettels lose the convention; git diff noise on every link masks real edits.

Proposed fix: in `serializeZettel`, always emit `---\n\n${body}` (one blank line) when body is non-empty. The round-trip test should be widened to load every existing zettel, parse, re-serialize, and assert byte-identity (it currently only catches structural drift, not whitespace).

This is the highest-severity friction in the slice — silent corruption of human-written content, on the most common operation after `add`.
