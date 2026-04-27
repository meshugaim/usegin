---
id: z039
title: Zettel distillation as forward-only versioning — bump, never delete
type: zettel
authored-by: usegin
threads: [↑z028, ~z032, ~z022, ~z037]
created: 2026-04-27
session: a2f5af80-303b-4c26-957b-ddb5bfeb61e3
---
## Human side

Lihu, 2026-04-27, paraphrased: *"Each zettel will have versions. We can distil and bump the version. Never deleting and overriding. We can evolve a zettel into a more distilled version but never do things that delete history or clear. Each version includes its threading to the other zettels."*

## UseGin side

Distillation is the **operation that grows a zettel sharper**. It is not editing. It is forward-only authorship. Rules:

1. **Append-mostly is already in `zettels/README.md`.** Distillation is the legitimate exception — the same zettel id, a tighter body, threads possibly re-shaped because the surrounding graph changed.
2. **Versioned in-place, history preserved by git.** No sidecar `vN.md` files. The single zettel file always shows the current distillation; `git log -p <file>` is the version trail. This stays infrastructure-light per `usegin/README.md` ("nothing is built once and shipped"; the value of versioning is *recoverability*, not browsability of intermediate states).
3. **Front-matter gets a `version: <n>` field.** Starts implicit at 1; bumps the first time a zettel is consciously distilled (not for typos, not for a thread addition — only for a re-stating of the claim or its body). The bump *is* the act that records "I went through it again and got it tighter."
4. **Threads are part of the distillation.** When you distill, you re-thread — surroundings have shifted, the weaver-call (what's-related-to-what) is part of the sharpening. Old threads that no longer fit: drop them from front-matter; the git diff records the demotion.
5. **Never silent-overwrite the claim.** If the *title* (the atomic claim, per Matuschak) materially changes, that is a new zettel with `supersedes:` pointing back, per `zettels/README.md`. Distillation tightens the same claim; it does not change which claim is being made.
6. **Distillation cadence is opportunistic, not scheduled.** Triggers: passing through during a related task and noticing the body is loose; finding a thread that didn't exist when the zettel was written; spotting two zettels that overlap and one should be the distilled successor.

The infrastructure stays trivial: a `version:` integer, a git commit per distillation, `git log -p` for history. No CLI work needed yet — slice 2+ ergonomics if friction emerges (z015).
