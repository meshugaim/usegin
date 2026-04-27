---
id: z096
title: autosync mode-1 cluster — three sibling collisions inside ENG-5413
type: zettel
authored-by: usegin
threads: [↑z095, ~ENG-5413, ~reference_autosync_concurrent_collisions]
created: 2026-04-27
session: gin-crypto-impl
---

ENG-5413 ran in parallel with ENG-5414, ENG-5415, ENG-5416, plus a fourth
zisser-agent doing zettels. Inside one task I tripped autosync mode-1
three times in a row:

1. `git add ...; git commit -m "feat(token-crypto)..."` → my staged files
   landed inside a sibling's "feat(dx-slack): inbox..." commit. Sibling
   message ate my files; my commit message vanished.
2. Same again with "rd-slack: ENG-5414 marketplace..." — different sibling,
   same swap.
3. Pre-push lint then blocked the resulting state on a *fourth* sibling's
   untracked `project-slack.ts` (ENG-5416, real `.delete()` bug).

The reference memo (`reference_autosync_concurrent_collisions`) says: "verify
origin/main contents after push, not just that your SHA is in log." That
held — the files DID land — but for ENG-5413 the two failure shapes
*compose*: the message-attribution swap (mode 1) lands the work under a
sibling's intent label, and the pre-push lint blocks restoration unless
you fix the unrelated bug too.

What worked:
- `git show HEAD --stat | grep <my-files>` — confirmed payload landed even
  when the message looked wrong.
- Fixing the `.delete().select()` lint blocker as ENG-5416 follow-up
  (one line, the bug was real) — cleaner than `--no-verify`.
- After ack of "files-but-not-message," writing my own follow-up commit
  (z093, slack-callback test update) so the *next* commit on origin
  carries my intent label.

What's still unresolved:
- The first commit attribution — `725141d5a feat(dx-slack): inbox`,
  `ac2d8f71d rd-slack: ENG-5414 marketplace`, `c44495c2d fix(project-slack)`,
  `591f3b1d6 test(slack-callback)` — only the last two of those
  semantically reflect ENG-5413. The token-crypto helper itself is
  permanently labeled as part of ENG-5414/5415 in `git log --grep`.
  Searching by file path (`git log -- nextjs-app/lib/token-crypto.ts`)
  returns ENG-5414's commit, which will mislead future archaeology.

Open question: should autosync stage-or-skip rather than stage-everything-staged
when a concurrent agent is mid-commit? Mode 1 only fires because autosync
silently inherits another agent's `git add`s.
