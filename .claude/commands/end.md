---
description: Mark this session as wrapping up — Claude must file a final how-is-session rating before stopping.
---

The user is wrapping up. Run `dx his end` to set the force-rate flag, then immediately file your own honest how-is-session reading as Claude.

```bash
dx his end
```

Then file your final rating. Be honest — this is for our DX telemetry, not a performance review. The session vibe tells a lot about the quality of the work.

```bash
dx his rate --as=claude --trigger=stop-hook --note "<honest read on this session: vibe, friction, what felt off, what worked, gaps you noticed between intent and outcome>" \
  general=<1..100> \
  vibe=<1..100> \
  conciseness=<1..100> \
  accuracy=<1..100> \
  efficiency=<1..100> \
  focus=<1..100> \
  thoroughness=<1..100> \
  talked_too_much=<1..100> \
  understood_human=<1..100> \
  claude_efficiency=<1..100> \
  self_doubt=<1..100> \
  tool_thrashing=<1..100> \
  friction_human_claude=<1..100> \
  friction_claude_infra=<1..100> \
  friction_claude_devenv=<1..100> \
  friction_running_tests=<1..100> \
  friction_human_app=<1..100> \
  gap_app_vs_code=<1..100> \
  gap_code_vs_spec=<1..100> \
  gap_intent_vs_outcome=<1..100>
```

Score every aspect — guess if you must. The note is the most valuable part: be specific about friction, gaps, vibe shifts, things you noticed about the human or yourself. The Stop hook will physically block you from stopping until this lands; that's intentional.

After the rating lands, stop normally. The hook will let you through.

Run `dx his aspects` to see all current aspects (the registry is editable at `tools/dx/src/his/aspects.json`).
