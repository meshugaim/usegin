---
id: z092
title: Zisser as Lihu's chief-of-staff — peer to UseGin, repo-root home
type: zettel
authored-by: usegin
threads: [↑z021, ~z023, ~z037, ~z003, ~z015, ~z033]
created: 2026-04-27
session: 0247d4e7-8536-4c07-9d43-14ce9876d904
---

## Human side

Lihu, 2026-04-27 (paraphrased from Wispr-dictated pour, reconstructed via the
corrector — `cell → Zisser`):

> "Build an agent called Zisser — my friend who walks beside me. The one
> person I tell everything to. He orchestrates everything: all the agents,
> all the things to write. He has a place for everything, a tool for
> everything. I will use him, you (Gin) will use him, he will use you. Build
> the best Zisser you can. You have all resources."

## UseGin side

Decision shape (z020):

> **D-zisser-home: We placed Zisser at `/zisser/` (repo root, peer to
> `usegin/`), not under `usegin/zisser/`.**
> Because: Zisser is for Lihu's whole life — orchestrating dispatch across
> Gin, sub-agents, teams, Linear, zettels, Effi, memory. UseGin is the dev
> agent for AskEffi. Zisser's scope strictly contains UseGin's, so making
> Zisser a sub-app of UseGin would invert the containment. Peer-at-root
> matches the actual size relation.
> Price: two top-level "permissive zones" (`usegin/` and `zisser/`) instead
> of one. Slightly more orientation cost for new agents.
> Risk: drift between `usegin/Gin.md` philosophy and `zisser/zisser.md`
> philosophy — they share most principles. Mitigation: zisser's principles
> reference usegin's by zettel ID rather than restate; cross-link in both
> READMEs.
> Alternatives rejected: `usegin/zisser/` (containment is wrong);
> `tools/zisser/` (zisser is not a CLI tool — yet); merging into
> `usegin/Gin.md` (Lihu explicitly said "*another* agent", not "Gin with
> bigger scope").

Operational consequences:

1. **Zisser is callable from any session.** `.claude/agents/zisser.md`
   exposes him as a sub-agent — Gin can spawn Zisser via the `Agent` tool.
   Bidirectional with Gin per Lihu's "he will use you, you will use him."
2. **Zisser's posture is orchestrate, don't execute.** He charters spawns;
   he doesn't edit `nextjs-app/` or `python-services/` himself. When dev work
   is needed, he dispatches Gin.
3. **No `dx zisser` CLI yet.** Pre-game manual rule (z015): only systematize
   what we've done by hand. For now, Lihu invokes Zisser by working in
   `zisser/` (CLAUDE.md cascade gives the agent Zisser's identity) or by
   calling the `zisser` sub-agent. The CLI comes after manual use proves the
   pattern.
4. **Wispr-corrector now disambiguates `cell` two ways.** Notes-context →
   `zettel`; agent-name-context → `Zisser`. Same row, separate notes column.
   Captured in `usegin/wispr-flow-corrector/dictionary.md`.

## Trigger to revisit home placement

If we add a third agent of similar scope (a non-dev companion for someone
else on the team, say), reconsider whether `agents/<name>/` at root is the
right pattern instead of one folder per agent.
