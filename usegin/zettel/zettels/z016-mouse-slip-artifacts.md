---
id: z016
title: Mouse-slip artifacts in Wispr — preserve meaning, separate the noise
type: zettel
authored-by: gin
threads: [↑z005, ~z011]
created: 2026-04-27
session: 5d7f3c80
---

## Human side

(open-to-empty)

## Gin side

Wispr-dictated input from Lihu sometimes contains mid-sentence fragments where the mouse slipped or the dictation jumped tracks (this session had several: a Spanish-language word that landed in the middle of a sentence about something else; a "friction sentence" that got dropped and resumed later). Lihu's instruction in the same message: *"fix it after I finish. After you finish reading, organize the text and then re-read it."*

Operational rule for me:

1. **First pass — read** the whole message even if fragments confuse me.
2. **Second pass — reorganize** mentally: identify mouse-slip fragments, identify the resumption point, stitch the intent back together.
3. **Then act.** Don't ship a response that takes the literal text as canonical.
4. **Don't lose the noise** — flag the mouse-slip locations briefly when they affected interpretation, so Lihu can correct if I stitched wrong.

Distinct from the corrector (z005) — that's word-level. This is sentence-level reconstruction.
