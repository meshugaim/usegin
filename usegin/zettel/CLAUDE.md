# Zettel sub-app — agent instructions

You are working in `usegin/zettel/` — the team's shared 2nd brain. Read
`README.md` for the design and `principles/` for the four load-bearing
principles. This file is the operating manual.

## What this sub-app is

A workspace for figuring out what a shared 2nd brain for the team building
Effi should look like. Not a copy of Zettelkasten — it takes the *concept*
(atomic, threaded, associative notes) as the starting point. Tracking issue
ENG-5379.

## Standalone-repo posture

This sub-app is independent. Don't import from or modify other usegin sub-apps
from inside here. Cross-reference by name (`see
usegin/wispr-flow-corrector/dictionary.md`), never by relative path.

## How zettels work

- **Atomic.** One thought, standalone meaning.
- **Threaded.** Distilled in light of neighbors — meaning sharpens by placement.
- **Append-mostly.** Never delete; bump `version:` to distill (z039); clusters
  emerge, never imposed (z040).
- **Two-faced where suitable** (z022). Human side + UseGin side when both will
  read it.

Front-matter shape (see existing zettels for examples):

```yaml
---
id: zNNN
title: <one-line>
type: zettel
authored-by: human | usegin | consultant
threads: [↑zNNN, ~zNNN, ~ENG-NNNN]
created: YYYY-MM-DD
session: <id>
---
```

## Where things go

| Thing | Place |
|---|---|
| The atomic notes | `zettels/` |
| Load-bearing principles for the sub-app | `principles/` |
| Forward-only manual graph-tightening loop | `organizing-process.md` |
| Things spotted that don't fit yet | `gaps.md` (append-only) |
| Each R&D manager's working space | `RD/<manager>/whiteboard.md` |
| Slice plans / design docs | `SLICE-N.md`, `*-DESIGN.md` |

## How to capture

The lowest-friction path:

```bash
zettleit "<the thought>"     # = dx zettel it "<the thought>"
```

Triggers `.claude/skills/zettel-capture/SKILL.md` — *zettleread → wire → add →
verify*. The CLI primitive is `dx zettel add`.

## Working rules

- **Never delete.** Append-mostly. Reverse a finding by writing a new zettel
  with `supersedes:` link.
- **Wiring before writing** — read the cluster, then place. Distillation
  against neighbors is the point.
- **Don't curate by "obvious relevance"** (memory:
  `feedback_cascade_scope_exploration`). Enumerate the threaded neighbors,
  *then* decide what's relevant.
- **Open-to-empty** (z003) — create the address before content if needed.
