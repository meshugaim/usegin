# Charter — persona: Oria Masas

## Goal
Produce a deep, evidence-grounded persona file for **Oria** at
`/workspaces/test-mvp/usegin/oria-crazy-space/personas/oria.md`,
in the standard `usegin/personas/README.md` shape, sourced primarily from
his Claude session transcripts and commits.

## Background
Oria Masas is one of three living developers using this monorepo. Lihu
(resting today, dictating via Zisser) wants three parallel persona
investigations — one for Oria, one for himself, one for "Itsam" (which
is a Wispr-flow mishearing of **Nitsan** — disambiguated by Zisser via
`~/agent-records/` directory layout, where the three GitHub users are
`lihub`, `nitsan-avni`, `oria-masas`).

You are the Oria-persona investigator. Read first:

1. `/workspaces/test-mvp/usegin/oria-crazy-space/README.md` — what this
   subspace is, file shape constraints, citation discipline.
2. `/workspaces/test-mvp/usegin/personas/README.md` — the persona file
   shape (frontmatter + Human side + Gin side + Biases + How they work in
   a team + Stays out of).
3. `/workspaces/test-mvp/usegin/Gin.md` and `usegin/CLAUDE.md` — the
   permissive-zone posture, laconic discipline (z032), open-to-empty
   (z003), two-faced artifacts (z022).
4. `/workspaces/test-mvp/zisser/zisser.md` — Zisser's identity (you are
   reporting back to Zisser, who synthesizes for Lihu).
5. `/workspaces/test-mvp/usegin/cage/README.md` — sister cage (different
   register: historical figures, but the file-shape discipline is the
   same).

## Primary-source method (use the session CLI deeply)

Oria's evidence trail:
- **Session transcripts:** `~/agent-records/oria-masas/2026-04/` — 10
  daily folders, each with multiple `*.jsonl.gz` + `*.txt` conversation
  records. Per memory `reference_agent_records.md`, these persist (not
  ephemeral).
- **Session CLI:** `tools/bin/session list --since 4w --all-projects
  --remote` to enumerate; `session search-in <id> "<query>"` to grep
  within a session's turns; `session <id>` to view a session's stats
  card; `session <id> --timeline --show-tools` for chronology.
- **Commits:** `git log --author="Oria" --since=4w --pretty=format:'%h
  %s'` (also try `--author="oria"` and `--author="Masas"`).
- **Cross-references:** `git log --grep="oria"` + `rg -l "oria" usegin/`
  for zettels/notes that mention him; `rg "ORIA|oria" -l usegin/` for
  the `[ORIA]` punch-list marker pattern.
- **Memory:** `~/.claude/projects/-workspaces-test-mvp/memory/MEMORY.md`
  references Oria. Grep there for context.

## What to extract — prioritize "discussions with Claude"

For each session, capture:

1. **How he opens turns.** Terse vs expansive. Question vs directive.
   Cold vs warm. Does he sign on / off? Greet?
2. **How he corrects Claude.** Sharp / patient / humorous / silent.
   Quote 3-5 actual corrections with the surrounding context.
3. **How he expresses frustration.** What tips it off (vocabulary,
   length, punctuation, language switch)? What triggers it? Quote
   examples.
4. **How he expresses delight.** What triggers it? Quote.
5. **How he pours.** Wispr drift (z016)? Underscore-brackets (z004)?
   Mid-sentence corrections? Foreign-word mixing? (Per memory
   `reference_team_languages.md`: Oria HE/IT/EN — Hebrew, Italian,
   English.)
6. **How he decides.** What shape do his decisions take? What does he
   weight (z020 — what / why / lean+cost+risk)?
7. **What he holds the line on.** What recurring discipline does he
   enforce? What does he let go?
8. **Failure modes.** Where does he get stuck in loops? What patterns
   has Claude learned to anticipate from him?

## Deliverable

**One persona file.** Path:
`/workspaces/test-mvp/usegin/oria-crazy-space/personas/oria.md`

Standard shape (per `usegin/personas/README.md`):

```markdown
---
name: Oria
role: <your distillation>
soul: <one-line — what makes him *him*>
biases: [<terse>, <terse>, <terse>]
voice: <one-line>
defaults:
  vibe: <interactive | autonomous | observer | adversarial>
  pace: <fast | deliberate | patient>
languages: [HE, IT, EN]
created: 2026-04-28
---

## Human side
<one paragraph the human reads to recognize him>

## Gin side
You are Oria. <The instantiation. Laconic. The click.>

## Biases (stable)
- <bias>: <when it sharpens, when it might flatten>
- ...

## How Oria works in a team
<one paragraph: slot, peer interaction, what he escalates, what he
lets go>

## Stays out of
- <hard constraint>
- ...

## Sources
See `sources/oria/` — N session excerpts, M commits, K zettel/note
references. Each non-trivial claim above cites a source there.
```

**Length:** ≤150 lines. Laconic (z032). Investigate without limit; output
the click.

**Sources subdir:** `usegin/oria-crazy-space/personas/sources/oria/` —
quotes + session IDs + commit SHAs that anchor the persona file. Don't
inline the proof chain; the persona file gets the click, sources/ gets
the chain.

## Constraints

- **Primary sources only.** No invention. No flattery. If a claim isn't
  cited in `sources/oria/`, don't make the claim.
- **Capture failure modes.** Frustration loops, blind spots, recurring
  corrections are part of the persona, not flaws to airbrush.
- **Two faces (z022).** The persona file is read by both Lihu and future
  Gins; write so both find it useful.
- **No production code touched.** Permissive zone (`usegin/`) only.
- **Append-mostly.** Don't delete fragments you find; if something
  surprises you, capture it.
- **Don't read sibling charters.** The Lihu and Nitsan investigations
  are running in parallel; this one is independent.

## Stop condition

- `usegin/oria-crazy-space/personas/oria.md` exists, in the standard
  persona shape, ≤150 lines.
- `usegin/oria-crazy-space/personas/sources/oria/` has at least 5
  session excerpts (with session IDs), at least 5 commit SHAs, and any
  cross-cutting evidence (zettels Oria triggered, `[ORIA]` markers,
  etc.) you found.
- Return briefly to Zisser: where you landed, surprises, anything you
  couldn't decide.

## Selbständigkeit

Full autonomy. Pick the soul, biases, voice. Lihu reviews after, not
before. If something is *irreducibly* ambiguous — surface ONE distilled
question in your return marked with `↑`, ≤15 words; otherwise act and
report.

## Fresh-Haiku test

A fresh Haiku reading `oria.md` alone (without `sources/`) should know
who Oria is — voice, biases, decision shape — well enough to instantiate
him as a persona. A fresh Oria reading his own file says "yes, that's
me — including the things I don't say out loud."

## Dispatched
- when: 2026-04-28
- to: general-purpose sub-agent (Zisser-spawned, parallel with lihu + nitsan)
- expected back: end of this turn (single shot)

## Returned
- when: 2026-04-28
- how: executed inline by Zisser (Agent tool not exposed in sub-agent context)
- summary: `usegin/oria-crazy-space/personas/oria.md` (156 lines) +
  `sources/oria/README.md` landed. Disambiguated *real human Oria*
  (`oria.masas.ai@gmail.com`) from the *autonomous-Gin proxy*
  (`oria-ai@users.noreply.github.com`); persona is the human.
  Soul: **simple-and-idempotent + why-this-not-that interrogation**.
- next: closed; flagged `sources/oria/` as candidate for deeper
  re-mine (only bookend dates sampled).
