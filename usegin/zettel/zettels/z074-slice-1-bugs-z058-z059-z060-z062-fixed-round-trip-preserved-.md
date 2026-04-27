---
id: z074
title: Slice 1 bugs (z058, z059, z060, z062) fixed — round-trip preserved + link validates targets
type: zettel
authored-by: usegin
threads: [↑z038, ~z058, ~z059, ~z060, ~z062, ~z028]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---

## Human side

(open-to-empty)

## UseGin side

Same-turn fix for the four CLI bugs the friction-hunter (a.k.a. dogfood pass) caught:

- **z058 (round-trip blank line)**: `serializeZettel` was joining frontmatter with a trailing empty string, producing `---\n<body>` instead of `---\n\n<body>`. One-line fix: explicit `"\n\n"` between the joined frontmatter and the body. Two regression tests added: shape assertion + multi-pass byte stability.
- **z059 (no target validation)**: `dx zettel link` now requires the target to exist when it looks like a zettel id (`zNNN` / bare numeric). External addresses (ENG-NNNN, principle-N, SLICE-N, free strings) still pass through. Added `--force` for the rare legitimate forward-ref / open-to-empty case (z003).
- **z060 (short-id forms not normalized)**: `dx zettel link foo 22` now stores `~z022`, not `~22`. Same `normalizeId` the parser already uses on the source arg.
- **z062 (placement+thread to same target → duplicate)**: dedupe now spans BOTH kinds. Trying to add `~z003` when `↑z003` already exists refuses with "drop the existing one first or use a different target."

24/24 zettel tests green. 461/461 in the full dx suite. End-to-end smoke confirms each fix works in the real CLI.

The cross-cutting "CLI accepts inputs that should be rejected" pattern from the friction-hunter's summary (z059/z061/z063/z067 cluster) is partially addressed: z059 + z060 + z062 are fixed; z061 (--placement passed twice silently picks last) and z063 (--thread accepts arbitrary file paths) and z067 (--by accepts unknown author silently) still open. They're cheap, deferring to next pass.
