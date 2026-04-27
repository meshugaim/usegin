---
id: z022
title: Two faces when suitable — anything in Gin can have human-side and Gin-side
type: zettel
authored-by: human
threads: [↑z021, ~z013, ~z019]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

The two-sided zettel (Human side / Gin side) is the most visible example, but it's a special case of a broader pattern: **anything in Gin can have two faces — human-facing and Gin-facing — wherever the artifact is consumed by both.**

Examples we already have:

- Zettels: `## Human side` + `## Gin side`.
- The rate-session CLI (z013): one face for human-rating, one for Gin's autonomous self-rating.
- The Wispr corrector: human reads it to know what's been corrected; Gin uses it as the first reach when input looks weird.

Generalize: when a tool, doc, command, or sub-app is touched by both humans and Gin, it should have *two-faced* affordances — not one face the other has to translate.

**Don't force two faces where one suffices.** Some artifacts are pure-Gin (a Sentry probe, a parser fixture). Some are pure-human (a Lihu-only physical-language note). The rule is "when suitable", not "always".

## Gin side

Operational test for whether something needs two faces:

> "Will both a human and a Gin meaningfully *consume* this artifact, with different needs?"

If yes → two faces. If only one consumes (or if both consume identically) → one face. The cost of two faces is real (more to write, more to maintain), so it has to earn its keep.

This zettel itself is two-faced because both Lihu and I will revisit it: Lihu to remember the rule, me to apply the test.
