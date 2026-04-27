---
id: z064
title: FRICTION: empty body throws Bun stack trace instead of clean error
type: zettel
authored-by: usegin
threads: [↑z038, ~SLICE-1, ~z022]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

`dx zettel add --title "x"` (no body, no stdin) prints a syntax-highlighted Bun stack trace including source code from `tools/dx/src/zettel/commands/add.ts`. Same for `echo "" | dx zettel add --title "x"`.

Compare to `dx zettel add "body"` (no `--title`) which prints a clean: `error: required option '--title <text>' not specified`. Asymmetric error UX inside the same subcommand.

Root cause: `addZettel` validates body via `throw new Error(...)` from inside a non-commander code path; commander's option-missing path catches and pretty-prints, but uncaught throws bubble up as Bun crashes.

Proposed fix: catch in the CLI handler and emit `error: dx zettel add: body is required (positional or stdin)\n` to stderr with exit 1, matching the title-missing format. Apply to all add/link error paths for symmetry.

Severity: medium. Doesn't lose data; degrades trust ("did I just hit a bug?") and pollutes terminals.
