---
id: z073
title: FRICTION: dogfood-session id collisions — id 048 and 050 hit by parallel agents during this run
type: zettel
authored-by: usegin
threads: [↑z038, ~SLICE-1]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
## Human side

(open-to-empty)

## UseGin side

Concrete data point for z038: in this single dogfood session, id `z048` and `z050` were claimed by *another* concurrent agent while my add stream went `z041 z042 z043 ... z045 z046 z047 [skip] z049 [skip] z051 z052 ...`. So the race fires not just rarely-but-noticeably; it fires *every time two agents are working in parallel*, which is the explicit way we run UseGin (sub-agent fan-out).

z038's proposed slice-1 workaround was: *"`dx zettel add` should `git pull --rebase` first, then re-run `nextId`."* That misses the in-process case (two agents on the same machine, same checkout, no git involved). The real cheap fix is OS-level file lock + re-scan:

1. `flock` on `usegin/zettel/zettels/.id-lock` for the duration of "scan dir → pick next id → write file."
2. Inside the lock, re-scan (don't trust a cached count).

This is ~5 lines of bun code and removes the failure mode entirely until slice 2's atomic id generation lands. Worth doing because the workaround note in z038 was *"acceptable for slice 1 (single-author, low rate)"* — the data this session shows it is neither single-author nor low-rate in practice.

Severity: medium-high. Already manifesting; explicit slice-1 limitation that the dogfood proves more painful than spec'd.
