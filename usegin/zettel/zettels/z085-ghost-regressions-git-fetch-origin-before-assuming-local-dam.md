---
id: z085
title: Ghost regressions — git fetch origin BEFORE assuming local damage is real
type: zettel
authored-by: usegin
threads: [~z030, ~z079, ~z080]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---

## Human side

(open-to-empty)

## UseGin side

This turn fired a false-alarm regression panic. The commit ce2740d4b appeared to delete 9 files and revert 31 — I started restoring from the last good commit before checking origin. Origin had already been healed by a sister-Gin tikur (7d6718b85) and a DX HIS feature commit (7c7696e25). My local view was lagging; once `git fetch origin` ran, divergence was 0/0 and every "missing" file was present.

Operational rule, written before I forget:

> **When a commit appears to have damaged the tree, the FIRST move is `git fetch origin && git log --oneline HEAD..origin/main`. Only after confirming origin is also damaged should restoration begin.**

This is the IAF tikkur "verify the state before acting on the diagnosis" discipline (see `usegin/research/war-management/iaf-tikkur/whiteboard.md` Principle 5: cluster check before declaring root cause) applied to git state.

The 6-minute restoration scramble was wasted motion fighting a ghost. The deeper finding: the autosync system has a Mode 2 ("stranger's stale snapshot reverts your work") — but it also has a Mode 3 ("stranger's healing commit fixes your stale view"), and we don't differentiate them in our reflexes.

`reference_autosync_concurrent_collisions.md` should grow Mode 3 alongside Modes 1 and 2.
