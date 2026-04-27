---
description: Wrap up the session — both human and Claude file a final how-is-session reading. Hook physically blocks Claude from stopping until the Claude-side rating lands.
---

The user is wrapping up. **Both faces read this session.** Symmetric design: human first (you ask them), then Claude (you fill it in yourself).

## Step 1 — arm the force-rate hook

```bash
dx his end
```

This sets `force_rate=true` so the Stop hook will physically block you from stopping until Claude's reading lands.

## Step 2 — invite the human's reading first

The human's signal is the load-bearing one. Ask them, in their own voice, in *one short message*:

> Wrapping up. Drop a quick how-is-session reading — anything 1..100, free-form note, whatever feels salient. Examples:
> `dx his rate v=80,fhc=30,ttm=70 was a bit too verbose at the start`
> `dx his note "felt aligned, no friction"`
> Or skip — Claude will file his side regardless.

Don't list every aspect at the human; that's noise. They can run `dx his aspects` if they want the menu. Their submission is optional — don't block on it.

## Step 3 — file your own reading (Claude)

After you've invited the human (don't wait for their response — they may not type one), file *your* honest reading. The Stop hook will not let you finish without it.

```bash
dx his rate --as=claude --trigger=stop-hook \
  --note "<one or two sentences: what worked, what felt off, the most useful thing for next-Gin to know>" \
  vibe=<1..100> \
  friction_human_claude=<1..100> \
  friction_running_tests=<1..100> \
  gap_intent_vs_outcome=<1..100> \
  tool_thrashing=<1..100> \
  understood_human=<1..100> \
  talked_too_much=<1..100> \
  accuracy=<1..100>
```

Add any other aspects that felt salient — `anger`, `frustration`, `friction_claude_devenv`, `friction_claude_infra`, `gap_app_vs_code`, `gap_code_vs_spec`, `self_doubt`, `claude_efficiency`, `understood_human`, `vibe`, etc. Run `dx his aspects` for the full list. Skip what doesn't fit. Score what's salient.

**The note matters more than the scores.** Be concrete: "human had to ask twice about X — I missed it the first time" beats "communication was off."

After your rating lands the Stop hook auto-clears the flag and you can stop normally.
