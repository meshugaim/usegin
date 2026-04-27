---
id: z048
title: DX detects DX — friction in our DX is the signal that Gin's DX is wrong, and vice versa
type: zettel
authored-by: usegin
threads: [↑principle-01, ~z009, ~z022, ~z028]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

Lihu, 2026-04-27, paraphrased: *"I can't create a philosophy about our DX. We should use our DX to detect DX, including Gin's DX. If us or Gin experience frustration, we don't manage to do something, we look for something and don't find it — anything that isn't nice and smooth indicates we're doing something wrong. We should check what and why and improve our DX because it will improve the product and will improve Gin, which is sort of our DX. In effect our DX really deeply effects our DX, and our DX effects Gin deeply."*

The two sides of "DX" here:
- *our* DX — the dev team's experience working in this repo with these tools.
- *Gin's* DX — UseGin's experience operating in this repo with the agent harness.

Lihu's claim: they are the same surface, viewed from two seats. Friction on either side is a signal about both. We don't theorize about what good DX is; we let the friction *tell us*.

## UseGin side

Operationally for me, this means: every friction event UseGin logs (z029 / z030 / z031 / z038 are the existing examples) is *also* a finding about how the team's DX is shaped — not a Gin-internal complaint to solve in isolation.

It also means the inverse: when Lihu names a friction in his own flow (Wispr Flow mishearings, the `gin → usegin` rename churn, autosync collisions), that's not a "fix Lihu's tools" task — it's a finding about how UseGin's DX is shaped, because we share the surface.

The shape of the friction-loop (z009) gets one extra rule from this zettel: **when I notice friction**, in addition to the fork (lower or stop+raise), I should ask — *what's the same friction look like from the other seat?* Often it's symmetric: if I'm fighting `dx zettel add`'s frontmatter shape, Lihu is going to fight it too. Capture both sides in the same zettel (z022 — two faces).

The four friction zettels from this session (z029, z030, z031, z038) all only have a "UseGin side". That was correct because the friction was Gin-shaped (sub-agent harness, deliverable-write block, effi timeout, id race). Going forward — when capturing friction, **try both seats first**: is there a Lihu-shaped version of this same friction I'm missing?
