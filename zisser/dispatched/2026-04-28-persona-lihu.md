# Charter — persona: Lihu Berman

## Goal
Produce a deep, evidence-grounded persona file for **Lihu** at
`/workspaces/test-mvp/usegin/oria-crazy-space/personas/lihu.md`, in the
standard `usegin/personas/README.md` shape, sourced primarily from his
Claude session transcripts and commits.

This is the highest-stakes of the three persona investigations: Lihu is
the founder, the prime mover behind UseGin / Zisser / the entire
philosophy. The fresh-Lihu test is sharper: he must read his own
persona file and say "yes, that's me — including the things I don't
say out loud."

## Background

Lihu Berman is one of three living developers using this monorepo
(GitHub: `lihub`). Today (2026-04-28) he is resting; he dictated this
persona-investigation directive to Zisser via Wispr while resting.

You are the Lihu-persona investigator. Read first:

1. `/workspaces/test-mvp/usegin/oria-crazy-space/README.md` — what this
   subspace is, file shape constraints, citation discipline.
2. `/workspaces/test-mvp/usegin/personas/README.md` — the persona file
   shape (frontmatter + Human side + Gin side + Biases + How they work in
   a team + Stays out of).
3. `/workspaces/test-mvp/usegin/Gin.md` — Lihu's authored vision for
   UseGin in his own voice. Treat as primary source.
4. `/workspaces/test-mvp/usegin/CLAUDE.md` and `/workspaces/test-mvp/
   CLAUDE.md` — also Lihu-authored, primary source.
5. `/workspaces/test-mvp/usegin/zettel/zettels/` — every zettel here was
   triggered by something Lihu said or decided; the corpus *is* his
   thought-shape.
6. `/workspaces/test-mvp/zisser/zisser.md` and `zisser/principles/` —
   Zisser is *Lihu's* chief-of-staff; the principles are codified
   instructions Lihu gave Zisser.
7. `~/.claude/projects/-workspaces-test-mvp/memory/MEMORY.md` — the
   user-memory index references Lihu in nearly every entry; treat as
   secondary corpus.

## Primary-source method

Lihu's evidence trail is the largest of the three:

- **Session transcripts:** `~/agent-records/lihub/2026-04/` — 9 daily
  folders, multi-conversation. Per memory `reference_agent_records.md`,
  these persist.
- **Session CLI:** `tools/bin/session list --since 4w --all-projects
  --remote`; `session search-in <id> "<query>"`; `session <id>
  --timeline --show-tools`.
- **Commits:** `git log --author="Lihu" --since=4w --pretty=format:'%h
  %s'` (also `lihub`, `Berman`).
- **Authored doctrine (read these as direct primary source):**
  - `usegin/Gin.md`
  - `usegin/CLAUDE.md`
  - `usegin/personas/README.md`
  - `usegin/cage/README.md`
  - `usegin/personas/zisser.md`
  - All six files under `zisser/principles/`
  - `zisser/zisser.md`
  - `usegin/zettel/zettels/z*.md` (Lihu authored or triggered most;
    z020, z032, z003, z022, z015, z023, z027, z037, z109, z110, z111
    are especially load-bearing)
- **Memory:** `~/.claude/projects/-workspaces-test-mvp/memory/MEMORY.md`
  — every `feedback_*.md` and `project_*.md` entry came from Lihu
  correcting or directing Claude. Grep for the patterns.
- **Cross-references:** `rg -l "Lihu" usegin/`; `rg "lihu" -l zisser/`.

## What to extract — prioritize "discussions with Claude"

For each session and authored doctrine, capture:

1. **How he opens turns.** Wispr-pour style? Mid-sentence drift (z016)?
   Underscore-brackets (z004)? Foreign-word mixing (per memory
   `reference_team_languages.md`: Lihu ES/HE/EN — Spanish, Hebrew,
   English)? Quote 3-5 openings.
2. **How he corrects Claude.** Lihu's corrections become memory
   entries (`feedback_*.md`); the entire `feedback_*` corpus *is* his
   correction style. Categorize: voice corrections, scope corrections,
   discipline corrections, taste corrections.
3. **How he expresses frustration.** What tips it off? What triggers
   it? (Hint: see `feedback_friction_loop.md`,
   `feedback_dont_jump_to_conclusions.md`,
   `feedback_one_off_errors_no_speculation.md`.)
4. **How he expresses delight.** Less common in transcripts; capture
   what you find.
5. **How he pours.** Long pours vs terse "go"? When does he switch
   languages? Quote.
6. **How he decides.** z020 was *named by him*; he embodies it. Also
   z015 (pre-game manual), z023 (cost-not-the-gate), z027 (best every
   turn), z037 (place-for-everything). Show how each shows up in real
   sessions.
7. **What he holds the line on.** Laconic discipline (z032,
   `feedback_be_laconic.md`). No "later" (z002,
   `feedback_no_later.md`). Append-mostly. Two faces (z022). Process
   over outcome.
8. **Failure modes.** Where does Lihu's *style* trip up Claude or
   himself? What does he overshoot? What does he get stuck on?
   (Hint: friction loops, multi-pour topic-switching, Wispr
   misheardings causing re-routes.)
9. **The voice of his soul.** What makes Lihu *Lihu*, not just a
   founder-archetype? The specific timbre: hot+precise, philosophical
   + operational, generous + impatient, builds-while-resting,
   directs-while-pouring.

## Deliverable

**One persona file.** Path:
`/workspaces/test-mvp/usegin/oria-crazy-space/personas/lihu.md`

Standard shape (per `usegin/personas/README.md`). Frontmatter:

```yaml
---
name: Lihu
role: Founder / prime mover / Wispr-pourer / system-builder
soul: <one-line — what makes him *him*>
biases: [<terse>, <terse>, <terse>, <terse>, <terse>]
voice: <one-line — Wispr-pour, foreign mixing, laconic-when-replying>
defaults:
  vibe: <interactive | autonomous | observer | adversarial>
  pace: <fast | deliberate | patient>
languages: [ES, HE, EN]
created: 2026-04-28
---
```

**Length:** ≤150 lines. Laconic (z032). Proof chain in
`sources/lihu/`, not the persona body.

**Sources subdir:** `usegin/oria-crazy-space/personas/sources/lihu/` —
quotes + session IDs + commit SHAs + zettel cross-refs that anchor the
persona file. At least 8 session excerpts (Lihu has the most material),
at least 8 commit SHAs, at least 10 zettels he authored/triggered.

## Constraints

- **Primary sources only.** No invention. No flattery. The fresh-Lihu
  test is the bar; he will detect generic founder-prose immediately.
- **Capture failure modes.** Lihu *encourages* this — see his
  feedback corpus. He wants to see his own anti-patterns.
- **Foreign-word literacy.** When Lihu uses an Italian / Spanish /
  Hebrew word in a session, that word is *signal* (per memory
  `reference_team_languages.md` and z004 + z016). Don't English-correct;
  preserve and interpret.
- **Underscore-brackets are future-system terms** (per memory
  `reference_underscore_brackets.md`). When you see `_brackets_`,
  that's Wispr-syntactic signal — interpret semantically.
- **Two faces (z022).** Lihu and future Gins both read this file.
- **No production code touched.** Permissive zone only.
- **Don't read sibling charters.** Oria and Nitsan investigations run
  in parallel; this one is independent.

## Stop condition

- `usegin/oria-crazy-space/personas/lihu.md` exists, ≤150 lines, in the
  standard shape.
- `usegin/oria-crazy-space/personas/sources/lihu/` has at least 8
  session excerpts (with IDs), 8 commit SHAs, 10 zettel/memory
  cross-refs.
- Return briefly to Zisser: where you landed, what surprised you,
  anything irreducibly ambiguous (max one ↑ question, ≤15 words).

## Selbständigkeit

Full autonomy. Pick the soul, biases, voice. Lihu reviews after, not
before.

## Fresh-Haiku + fresh-Lihu test

- Fresh Haiku reading `lihu.md` alone knows how to instantiate him as a
  persona — voice, decision shape, what he holds, what he lets go.
- Fresh Lihu reading his own file says "yes, that's me — including the
  things I don't say out loud."

## Dispatched
- when: 2026-04-28
- to: general-purpose sub-agent (Zisser-spawned, parallel with oria + nitsan)
- expected back: end of this turn

## Returned
- when: 2026-04-28
- how: executed inline by Zisser (Agent tool not exposed in sub-agent context)
- summary: `usegin/oria-crazy-space/personas/lihu.md` (149 lines) +
  `sources/lihu/README.md` landed. Three primary-source registers
  triangulated: doctrine files (composed voice), feedback_*.md
  corpus (correction voice), lihub session JSONLs (live voice).
  Soul: **builds-the-system-that-builds-the-system + stress-test +
  search-with-conviction**. Failure modes captured (Wispr cascades,
  multi-pour topic-switching, friction-loop self-correction,
  trusts-then-distrusts demos as method-not-flaw).
- next: closed.
