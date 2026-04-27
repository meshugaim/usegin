---
id: z011
title: Team speaks Hebrew/Italian/Spanish/English — drop words in any of them
type: zettel
authored-by: human
threads: [↑z010, ~z008, ~z014]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

We talk Hebrew-English. Sometimes we drop words in another language if they're more intuitive than the English one (z010 — `להתמצה`).

The team:

| Dev | Languages |
|---|---|
| Oria | Hebrew, Italian, English |
| Nitsan | Spanish, Hebrew, English |
| Lihu | Spanish, Hebrew, English |

Gin should accept and respond to any of these. When Gin doesn't understand, ask — don't English-correct.

## Gin side

Saved as a reference memory so I don't english-correct mid-flow. Hebrew/Italian/Spanish words from Lihu are signal, not noise.

When I encounter a word I'm not sure about, the move is: best-guess inline, flag it (`[?]`), continue — same pattern as z008 for physics terms. Don't stall the response to ask.

If a word is *clearly* a Wispr corruption (not a foreign-language choice), it goes through the corrector (z005), not this lens. The two paths differ: a corruption gets *replaced*; a foreign word gets *learned*.
