---
id: z071
title: FRICTION: dx zettel link cannot set placement, only cross-references
type: zettel
authored-by: usegin
threads: [↑z038, ~SLICE-1, ~z058]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

`dx zettel link --help` advertises `--placement: this is THE placement edge (replaces existing placement)` — good. I tried using it to retrofit a placement on z003 (which currently has only `↑z002`); skipped because we'd be mutating real content. But the more interesting friction is *adoption*:

When you write a zettel via `dx zettel add` without `--placement`, you can later add a placement only via `dx zettel link <from> <to> --placement`. That works in principle. But the help text for `link` is symmetric ("Add a thread from one zettel to another") while semantics are asymmetric — placement is a 1-of edge and replaces; cross is N-of and appends. The user has to read carefully to notice.

Compounding: if z058 (link strips blank line) lands as a fix, every retrofit-placement operation rewrites a real file. Until then, we're trading "missing placement" for "lost formatting."

Proposal: split the help text and add an explicit confirmation when --placement REPLACES an existing one: *"z003 already has placement ↑z002; replacing with ↑z015. Pass --force to confirm or rerun without --placement."*

Severity: low — a careful user is fine; a hurried user destroys signal.
