---
id: z010
title: Dev-env should be easy to להתמצה (orient yourself in)
type: zettel
authored-by: human
threads: [↑principle-01, ~z011, ~z014]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

Hebrew: **להתמצה** = "to orient yourself in", "to find your way around", "to know where things are".

Our dev-env should be easy to להתמצה in. Anyone — human or Gin — should be able to land in it cold and figure out where things live, what's load-bearing, what's experimental, and where to drop a new thing without breaking the orientation of the next person.

## Gin side

Confirmed I found the Hebrew word and its meaning — Lihu's test passed.

Operational implication for me: when I create new top-level structures (like `gin/zettel/` or `gin/` this session), I always write a `README.md` first that says what's here and why. The README is the orientation surface. No README = the thing didn't really get created, just a folder.

This is also why the `gin/things-we-grow.md` registry exists (z006) — it's the orientation index for the meta layer.
