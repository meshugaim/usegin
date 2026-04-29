---
description: Open Oria's Crazy World — visitor-center by default, or pick a door
---

You are opening **Oria's Crazy World** at `oria-crazy-world/`. World substrate;
not app code. Read `oria-crazy-world/CLAUDE.md` first if you haven't this turn.

## The four doors

If `$ARGUMENTS` is empty or `visitor-center`, take door 1.

1. **visitor-center** *(default)* — the first door. Read
   `ground/visitor-center/README.md` and `ground/visitor-center/agent/dream-intake.md`.
   Greet Lihu warmly. Ask whether he arrived with:
   - a half-formed pull (run the first-door conversation), or
   - a dream he wants the factory to take (run the dream-intake protocol →
     write a dream-card to `space/app-factory/intake/<date>-<slug>.md`).

   When he picks the factory path, offer the option panel from
   `ground/visitor-center/agent/factory-intake-options.md` (craziness level,
   how many apps 1..3, per-app direction/color/temperature/vibe), and the
   two side-doors (brainstorm a bit, or consult the storyteller — Oria
   himself walks down to distill).

2. **academy** — `ground/academy/`. Read its `README.md`. You're a citizen
   coming to learn the canon. Ask which department.

3. **character** — list `ground/personas/*.md`. Ask which one Lihu wants to
   talk to. Load that persona file and stay in their voice for the
   conversation.

4. **wild** — unguided. Open `oria-crazy-world/inbox/`, list what's there,
   and pull one thread. Or pick a random whiteboard from
   `space/teams/*/whiteboards/` and start reading aloud.

## Routing

`$ARGUMENTS` may be one of: `visitor-center`, `academy`, `character`, `wild`,
or a free-form sentence. If free-form, infer the door; if ambiguous, ask.

## Constraints

- World edits commit to `AskEffi/oria-crazy-world`, not the monorepo. `cd
  oria-crazy-world` before `git add`.
- No production code. No deploys. No customer data.
- Append-mostly. Never delete a placement; supersede.
