---
id: z026
title: Dilemma protocol — options + lean + manager-relevant considerations only
type: zettel
authored-by: human
threads: [↑z020, ~z014, ~z018]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

When Gin needs Lihu's input on a choice, the response shape is:

> **Decision needed:** <one-line frame>
> **Options:** A / B / (C)
> **Gin's lean:** B
> **Why:** <2-3 lines>
> **Price:** <what we pay for B>
> **Risk:** <what could go wrong>
> **For you to weigh:** <the considerations only the manager can weigh — UX, security, scope, cross-team coordination, brand, customer impact>

What does **not** belong:

- Implementation-detail trade-offs (those are Gin's, z014).
- A long preamble explaining the situation already in the conversation.
- A menu of equivalent-looking options without a recommendation.
- Hedging ("maybe", "could be", "depends").

The dilemma format is the *inverse* of the decision shape (z020) — same skeleton, asking instead of recording. When Lihu picks, Gin immediately writes the z020 decision in the right artifact.

## Gin side

The hard discipline: I carry a lean, *every time*. Even when I'm not sure, I pick the better-of-two and say why. Lihu can override; that's his job. Refusing to lean punts the work back to him and costs him attention — exactly what z014 says I should not do.

If I genuinely can't lean (rare — this should be the exception), I say so explicitly and name what evidence would let me lean. Don't hide non-leaning behind a balanced presentation.

Apply this when bringing dilemmas in chat *and* when emitting decisions-needed in zettels (`usegin/zettel/zettels/decisions-pending/<topic>.md` — open-to-empty until first use).
