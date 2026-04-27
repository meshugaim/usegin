---
id: z100
title: Personas and teams — named cast (Mark/Poll/Din/Johan/John/Ron/Cal/Sam/Tim/Ivan/Wes/Yohai) replaces inline primings; skills consume teams
type: zettel
authored-by: usegin
threads: [↑z023, ~z021, ~z033, ~z086, ~z087, ~z091, ~z092, ~z015]
created: 2026-04-27
session: 73e20f04-8572-4b59-8fe9-fa241be758a2
---

## Human side

Lihu, 2026-04-27 (paraphrased — Wispr-dictated pour, reconstructed):

> "Each persona we discussed today (manager, designer, professor) should
> be an agent with an easy-to-remember name. Manager=Mark, Professor=Poll,
> Designer=Din. A team will be 'that variation of Mark, this variation of
> Poll, etc + how the team operates + everything else.' Personas can have
> a lab, a soul, memories, rules, biases — but only the laconic things
> that define them as the best human-machine for the role. Skills are
> how to use teams. Tomorrow we sell Gin to someone who thinks we can be
> better than Claude Code, better than Cursor, better than any vibe tool
> that exists."

## UseGin side

Decision shape (z020):

> **D-personas-and-teams: We extracted the inline persona primings
> from skills (`brainstorm`, `refine`, `prioritize`, `rnd`, `cell`,
> `liaison`, `tdd-execute`, `consult`, ...) into a named, addressable
> cast at `usegin/personas/`, and named team compositions at
> `usegin/teams/`. Skills now reference teams; teams reference
> personas. Personas are stable; teams are recipes.**
>
> Because: (1) skills had been re-describing the same roles inline,
> diverging over time, opaque to the human — the natural cast is real
> and recurring (R&D inventory found 13+ named + 50-100 unnamed
> instantiations). (2) Naming the cast lets us improve a persona once
> and have every team that uses it benefit. (3) Naming the team lets
> us address compositions in conversation ("send the brainstorm-team
> on this"). (4) Vibe-coding-SOTA R&D found that no commercial tool
> ships a named cast with a dialogic team — that's our whitespace
> against Cursor / Devin / Cline / upstream Claude Code.
>
> Price: 16 persona files + 12 team files + 4 skill bindings + 6
> `.claude/agents/<name>.md` invocation shims. Modest authoring cost;
> larger ongoing maintenance discipline (when a persona's bias
> sharpens, update the persona file, not the skill).
>
> Risk: drift between persona files and the skills that consume them.
> Mitigation: skills point at `usegin/teams/<name>.md` rather than
> inlining; the team file owns the composition and operating mode.
> Ron-shaped reviews of any inline-persona regression should be
> reflexive.
>
> Alternatives rejected: keep one-shot ad-hoc primings (z023 says
> "spawn-as-instantiation" — but the inventory shows the *same*
> instantiations recur, so the z023 flexibility is being paid for
> without being used); merge personas into skill files (defeats the
> reuse goal); bury the cast under `tools/dx/` (it's not a CLI yet,
> per z015 pre-game manual).

Operational consequences:

1. **The cast (16):** Gin, Zisser, Yohai (Comptroller), Consultant —
   already-active named personas — plus Mark (manager), Poll
   (professor), Din (designer), Johan (optimist), John (pessimist),
   Ron (reviewer), Cal (critic / direction), Sam (synthesizer), Tim
   (tester), Ivan (investigator), Wes (worker). Each persona file
   is 40–80 lines (Zisser is the empirical exemplar at 67 lines per
   the persona-design R&D angle).

2. **The teams (12):** brainstorm-team, refine-team, prioritize-team,
   rnd-team, cell-team, red-blue-purple, pre-mortem-team, debate-team,
   andon-team, tikur-team, consult-team, six-hats-team. Each team
   file names members, operating mode, charter shape, output artifact,
   when-to-use, common failure modes.

3. **`.claude/agents/<name>.md` invocation shims** for Mark, Poll, Ron,
   Sam, Wes, Yohai. Closes the biggest gap from the Anthropic-internal
   R&D angle: our `.claude/agents/` was essentially empty; orchestration
   roles lived in skill prose and the harness couldn't enforce shape.
   Now they're proper YAML-frontmatter sub-agents.

4. **Skills bound (4):** `brainstorm`, `refine`, `prioritize`, `rnd`
   each gained a "## Team" header pointing at the team file. The skills
   keep their operating-mode and lifecycle; the team file owns the
   persona-side priming. Migration of the rest is gradual — z015 says
   only systematize what we've done by hand, so each skill earns its
   binding when the next round of use proves the pattern.

5. **Wispr-corrector disambiguation** for each persona name. Johan/John
   was the explicit acoustic-collision risk per the persona-design
   R&D angle; the corrector now has 12 persona-name rows plus the
   Johan/John pair noted as a special collision warning.

6. **Gin's traits codified** in `usegin/Gin.md`: curious, meticulous,
   laconic, creative, intuitive, concise and precise, thorough,
   methodical, strong work ethic, stays focused. Apply to every
   persona unless overridden (Cal is meticulously *adversarial*;
   Johan is meticulously *generative*).

## What this enables (the pitch axis)

Per the vibe-coding-SOTA R&D angle, no commercial vibe tool in April
2026 ships:
- A **named cast** (Cursor/Cline/Aider/Devin/Codex use anonymous
  parallel workers).
- A **dialogic team** that talks to itself (Cursor 3.1 panes, Windsurf
  Wave 13, Codex best-of-N — all parallel-isolated).
- **Persona telemetry** (`dx his` exists; nobody else has a vibe
  reading from both sides of the loop).
- A **shared 2nd brain** (zettel, used by both human and agent).

Our four whitespace axes. The cast + teams unlocks the first two.

## Threading

- z023 (spawn-as-instantiation): foundational — the cast files *are*
  the instantiation primers.
- z021 / z033 (Gin / UseGin naming): the cast lives at
  `usegin/personas/`, the workspace's natural home.
- z086 (process over outcome): the cast is process infrastructure —
  it makes the next turn easier even though it doesn't ship a feature.
- z091 (autonomous vibe): named cast lets autonomous Gin spawn the
  right persona without re-deciding "who should I prime as".
- z092 (Zisser): same shape applied at the Lihu-orchestration tier.
- z015 (pre-game manual): only the patterns we've run by hand
  (brainstorm/refine/prioritize/rnd/cell/tikur/consult) are bound;
  the rest are open-to-empty.

## Open

- Shipping team-level retros — when does a team learn? `team-retro`
  exists; need to wire it to the team file (so a team's failure modes
  in its file get updated from retro outputs).
- Marketplace plugin per persona (per vibe-coding-SOTA steal-list).
  Gin-as-Claude-Code-marketplace — a future move.
- Routing skill (Haiku/Sonnet/Opus per persona) — the Anthropic-internal
  R&D flagged this as a real gap. Mark/Wes likely benefit from
  Sonnet; Ron/Sam/Yohai stay on Opus.
