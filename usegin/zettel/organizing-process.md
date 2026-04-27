# Organizing Process — v0

The manual loop UseGin runs occasionally to keep the zettelkasten tight. v0 because it is a *pre-game manual* artifact (z015) — done by hand long enough that we know the shape before we automate any of it.

Forward-only. Never delete. Bump versions. See z039 (distillation) and z040 (clusters emerge) for the philosophy this loop implements.

## When to run

Opportunistic, not scheduled. Triggers:
- Just wrote a zettel and noticed the surrounding ones look out of date.
- Looking for a zettel and the threads didn't lead where they should have.
- A pattern emerged across recent zettels — the graph is asking for a hub (z040).
- Lihu asks for a re-organize.

If none of these fire, don't run it. Organizing-for-its-own-sake is exactly what z040 rules out.

## The loop (one pass)

1. **Read recent zettels.** `dx zettel list | head` for the last ~10. Skim. Hold them in working memory.
2. **Check existing threads against current state.** For each recent zettel, do the front-matter `threads:` still describe where it actually sits? If any wire is stale (target moved/superseded/no longer the right neighbor), note it.
3. **Distill where loose.** Per z039: if a zettel's body is looser than its claim now warrants, tighten it. Same file, bump `version:` in front-matter, commit. Re-thread as part of the same commit if the surroundings shifted.
4. **Look for emerging clusters.** Per z040: if 3+ recent zettels cross-reference the same neighbor, or several converge on a claim no zettel has yet stated, write the **hub zettel** that earns the name. Cross-reference contributors; consider re-placement of the most-relevant ones.
5. **Log gaps.** Anything that didn't fit cleanly — a zettel with no good parent, a duplicate id, a body that wants to be two zettels, an address that should exist but doesn't, infrastructure friction — append to `usegin/zettel/gaps.md`. Don't try to fix everything; logging is the act.
6. **Commit, push.** One commit per pass, message: `zettel: organize pass YYYY-MM-DD`.

That's it. No spreadsheets, no dashboards, no review queue.

## Bounding

- **Time-box one pass to the friction it surfaced.** If it took 2 minutes, that's fine. If it's growing past 30 minutes of one session, stop and log the rest as gaps.
- **Never edit history.** Forward-only is non-negotiable (principle 02). Versioning + git log are the trail.
- **Don't pre-create addresses.** A zettel that *might* want a parent next week does not get one written today.
- **Don't tag.** No taxonomies, no buckets, no `tags:` field (z040). Wires only.

## Outputs

A pass produces:
- Zero or more distilled zettels (with `version:` bumps).
- Zero or one hub zettel (only when a cluster has clearly converged).
- Zero or more re-threadings (front-matter `threads:` updates).
- Zero or more entries in `gaps.md`.
- One git commit.

Zero of all of these is a valid result — it means the graph was tight when you looked.

## Versioning of this process

This document itself follows the rule: forward-only, bumped. v1 will replace v0 inline (preserving history via git) the first time we go through several passes and notice something this v0 got wrong. The version number is in the title.
