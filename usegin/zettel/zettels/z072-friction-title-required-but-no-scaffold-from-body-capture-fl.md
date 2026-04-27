---
id: z072
title: FRICTION: title required but no scaffold from body — capture flow forces author to title up front
type: zettel
authored-by: usegin
threads: [↑z038, ~SLICE-1, ~z036, ~z003]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

The Flow 1 prompt asked: *"What if I forget --title?"* The CLI rejects with `error: required option '--title <text>' not specified`. Clean error.

But the deeper friction: the *thought* arrives as the body ("we should never auto-pop without distillation cost surfaced"). The title is a distilled restatement of it. Forcing the author to write title first inverts the natural capture order — you have to know the punchline before you know what you're saying.

Two compatible directions:
1. **Scaffold mode**: `dx zettel add "body..." --as=usegin` (no title) creates a zettel with `title: TODO` and emits a warning `note: zettel z072 created with placeholder title; run 'dx zettel retitle z072 "..."' to set.` Author opens the file, distills, edits.
2. **First-line title**: if `--title` is absent and the body's first line looks like a heading (`# ...` or short < 80 chars), use it as title and drop from body.

Both honor z003 (open-to-empty) and z036 (be laconic — distillation comes after capture, not before).

Severity: medium. The current flow is workable for fully-formed thoughts; it's friction for the half-formed ones, which (per z015 — pre-game manual) are exactly the ones we want to capture.
