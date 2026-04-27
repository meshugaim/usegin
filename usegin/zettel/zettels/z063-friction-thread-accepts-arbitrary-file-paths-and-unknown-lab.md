---
id: z063
title: FRICTION: --thread accepts arbitrary file paths and unknown labels with no warning
type: zettel
authored-by: usegin
threads: [↑z038, ~SLICE-1, ~z062]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

The Flow 1 prompt asked: *"what if I want to reference a file path I just touched?"* I tried `dx zettel add ... --thread tools/dx/CLAUDE.md` expecting either rejection or special handling. It silently accepted, persisting `~tools/dx/CLAUDE.md` as a thread (z043).

Two issues:
1. **No file-path affordance.** Linking a zettel to a file path is a *real* use case (a zettel about a piece of code wants to point at it). But threads are graph nodes, not arbitrary strings — mixing in raw paths pollutes the graph.
2. **No feedback.** Even setting #1 aside: the user has no signal that "this isn't a known target." Compare to git's `git checkout nonexistent-branch` → loud error.

Proposal: introduce a separate frontmatter key for file references (e.g. `refs: [...]` or `paths: [...]`), and add `--ref <path>` to `add`/`link` for that purpose. Keep `--thread` strictly for graph-node ids (zettel ids, ENG-ids, principle handles, decision handles, slice handles — whatever convention we settle on, but a finite set).

Severity: medium. We're early; the convention is malleable; defining the "shape of a thread target" before more zettels accrue ad-hoc is a slice-1.5 candidate.
