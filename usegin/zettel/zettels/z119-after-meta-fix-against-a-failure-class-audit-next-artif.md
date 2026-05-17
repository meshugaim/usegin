---
id: z119
title: After meta-fix against a failure class, audit the next artifact for the same class
type: zettel
authored-by: usegin
threads: [~ENG-6037, ~ENG-6033, ~ENG-6035]
created: 2026-05-17
session: a2c81f30-8c75-42bf-b9e1-2e9eb5bb6b78
---

ENG-6037's fix-bug pipeline shipped in three steps. Step 2 was a **meta-fix against silent failure**: wrap pm2 calls in `timeout 10s` (no more 3-hour hangs), log to file (defeats caller's `>/dev/null 2>&1 &` swallow), post-condition check after `pm2 start` (no more "I started something, dunno what happened"), don't touch the marker on failure paths (so retry can happen). The genus was: *silent failure in the recovery path*. The Linear body called it out by name.

Step 3 landed the same day. I wrote a new bashrc-d shim. The shim's resilience guard — `[[ -r "$_WS_SCRIPT" ]] && source "$_WS_SCRIPT"` — converts a missing working-tree file into a **silent no-op**. Same exact failure class. Ron caught it in review (`9c30580c7` I2). I didn't self-catch.

The discipline gap isn't writing the silent no-op — sometimes a no-op is right. It's that I had just spent 4 hours building defense against this class on the file *next door*, and didn't audit the new code for the same pattern before pushing. Pattern recognition slipped on the slice that should have been the strongest, because the meta-fix's lessons were freshest.

**The rule:** after shipping a meta-fix against a failure class, the *next* artifact you write (same day, same area) gets an audit against that class before review. Costs 30 seconds; would have caught the silent-no-op self-catch. Cheaper than waiting for Ron.

Generalizes beyond silent-failure: any time you've just written code that *prevents* a class of bug, the next sibling code you write is the highest-risk place to *reintroduce* it. Cognitively, you've already paid attention to the class; you trust yourself not to re-do it — so you don't look. That's exactly when you should look.

See: `docs/bugs/098-eng-6037-pm2-daemon-spawn-race.md` (the meta-fix), commit `9c30580c7` (the silent-no-op I wrote anyway), commit `39b7b5e5a` (Ron's I2 + my fix).

Related: `~feedback_one_off_errors_no_speculation` (the opposite cousin — staying silent when you don't have evidence). This zettel is about staying audit-loud when you *do* have a fresh meta-lesson.
