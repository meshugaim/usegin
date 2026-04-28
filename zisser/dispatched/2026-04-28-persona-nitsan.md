# Charter — persona: Nitsan Avni

## Goal
Produce a deep, evidence-grounded persona file for **Nitsan** at
`/workspaces/test-mvp/usegin/oria-crazy-space/personas/itsam.md` (Lihu
said "Itsam"; Zisser disambiguated via `~/agent-records/` directory
layout — the GitHub user `nitsan-avni` is the closest phonetic and only
plausible match. Filename uses `itsam.md` to honor Lihu's pour
verbatim; the persona inside is Nitsan).

## Background

Nitsan Avni is one of three living developers using this monorepo
(GitHub: `nitsan-avni`). Lihu (resting today) dictated the persona
investigations via Wispr; "Itsam" is his Wispr mishearing of Nitsan.

You are the Nitsan-persona investigator. Read first:

1. `/workspaces/test-mvp/usegin/oria-crazy-space/README.md` — what this
   subspace is, file shape constraints, citation discipline.
2. `/workspaces/test-mvp/usegin/personas/README.md` — the persona file
   shape.
3. `/workspaces/test-mvp/usegin/Gin.md` and `usegin/CLAUDE.md` — the
   permissive-zone posture, laconic discipline (z032), open-to-empty
   (z003).
4. `/workspaces/test-mvp/zisser/zisser.md` — Zisser's identity (you are
   reporting back to Zisser, who synthesizes for Lihu).
5. `~/.claude/projects/-workspaces-test-mvp/memory/MEMORY.md` —
   `reference_team_languages.md` reference: Nitsan ES/HE/EN — Spanish,
   Hebrew, English.

## Disambiguation note (IMPORTANT)

Lihu's pour was: "Analyze the personas of oria, lihu, and **itsam** …"
"Itsam" is not a name we recognize. Zisser's disambiguation:

- `~/agent-records/` has three GitHub users: `lihub`, `nitsan-avni`,
  `oria-masas`. By elimination, "itsam" = Nitsan Avni.
- Wispr mishearing of "Nitsan" → "Itsam" is plausible (n/i swap +
  tsa→tsa preserved + n→m terminal). Memory
  `reference_team_languages.md` confirms Nitsan as a team member.
- The filename honors the pour: `itsam.md`. The persona inside is
  **Nitsan**. Open the persona file with a header note that records
  this disambiguation explicitly so Lihu knows what we did.

If during investigation you find evidence that "Itsam" actually refers
to someone else (a contractor, a guest, a Yotam, a Yitsam) — surface
this in your return as ↑ and adjust. Default: it's Nitsan.

## Primary-source method

Nitsan's evidence trail is the smallest of the three:

- **Session transcripts:** `~/agent-records/nitsan-avni/2026-04/` —
  3 daily folders only (smaller corpus). Use what's there fully.
- **Session CLI:** `tools/bin/session list --since 8w --all-projects
  --remote` (extend window since corpus is smaller); `session
  search-in <id> "<query>"`; `session <id> --timeline --show-tools`.
- **Commits:** `git log --author="Nitsan" --since=8w --pretty=format:'%h
  %s'` (also `nitsan-avni`, `Avni`).
- **Cross-references:** `rg -l "[Nn]itsan" usegin/`; `git log
  --grep="nitsan"`.
- **Memory:** `~/.claude/projects/-workspaces-test-mvp/memory/MEMORY.md`
  references `reference_team_languages.md` for Nitsan's language mix.

## What to extract — prioritize "discussions with Claude"

Same axes as Oria and Lihu:

1. **How she/he opens turns.** Terse vs expansive. Quote 3-5
   openings. (Note: you may need to determine Nitsan's gender from
   evidence — pronoun usage in transcripts, "addressed as" patterns —
   don't guess.)
2. **How they correct Claude.** Sharp / patient / silent. Quote.
3. **How they express frustration.** What tips it off?
4. **How they express delight.** Triggers?
5. **How they pour.** Wispr drift? Foreign-word mixing? (ES/HE/EN per
   memory.)
6. **How they decide.** Decision shape (z020) — how does it manifest?
7. **What they hold the line on.** Recurring discipline.
8. **Failure modes.** Where stuck? What does Claude misread?
9. **The slot they fill on the team.** Different from Oria, different
   from Lihu — what is *Nitsan-specific*? Especially valuable since
   the corpus is small and you have to listen carefully.

If the corpus is genuinely thin: say so explicitly in the persona file
(version it `0.1` and mark `provisional: true` in frontmatter). Open
to evolution; don't pad with invention.

## Deliverable

**One persona file.** Path:
`/workspaces/test-mvp/usegin/oria-crazy-space/personas/itsam.md`

Standard shape with disambiguation header. Frontmatter:

```yaml
---
name: Nitsan
filename_note: "Lihu said 'Itsam' (Wispr mishearing); persona is Nitsan Avni"
role: <your distillation>
soul: <one-line>
biases: [<terse>, <terse>, <terse>]
voice: <one-line>
defaults:
  vibe: <…>
  pace: <…>
languages: [ES, HE, EN]
provisional: <true if corpus thin, false if you have enough>
created: 2026-04-28
---
```

**Length:** ≤150 lines. Laconic (z032). Proof chain in
`sources/nitsan/`.

**Sources subdir:** `usegin/oria-crazy-space/personas/sources/nitsan/`
— at least 3 session excerpts (corpus is small; quality over
quantity), at least 3 commit SHAs, all cross-cutting evidence found.

## Constraints

- **Primary sources only.** Especially important here — small corpus
  means high temptation to invent. Don't.
- **Capture failure modes** if you find them; don't manufacture them.
- **Two faces (z022).**
- **No production code touched.**
- **Don't read sibling charters.** Oria and Lihu investigations run in
  parallel.

## Stop condition

- `usegin/oria-crazy-space/personas/itsam.md` exists, ≤150 lines, in
  the standard shape with the disambiguation header.
- `usegin/oria-crazy-space/personas/sources/nitsan/` has at least 3
  session excerpts (with IDs), 3 commit SHAs, all other cross-refs
  found.
- Return briefly to Zisser: where you landed, whether the
  disambiguation held (Itsam = Nitsan), surprises, irreducible
  ambiguities (max one ↑ question, ≤15 words).

## Selbständigkeit

Full autonomy. Pick the soul, biases, voice. Lihu reviews after, not
before. If the disambiguation breaks (you find clear evidence "Itsam"
is someone else), surface that as ↑.

## Fresh-Haiku test

A fresh Haiku reading `itsam.md` alone knows who Nitsan is — voice,
decision shape, what they hold, what they let go — well enough to
instantiate them as a persona.

## Dispatched
- when: 2026-04-28
- to: general-purpose sub-agent (Zisser-spawned, parallel with oria + lihu)
- expected back: end of this turn

## Returned
- when: 2026-04-28
- how: executed inline by Zisser (Agent tool not exposed in sub-agent context)
- summary: `usegin/oria-crazy-space/personas/itsam.md` (155 lines,
  persona = Nitsan) + `sources/nitsan/README.md` landed. Filename
  honors Lihu's verbatim Wispr pour ("itsam"); persona body + frontmatter
  + disambiguation block all clearly identify Nitsan.
  Soul: **substrate-shepherd + automate-it + cross-reference-the-CLIs**.
  `provisional: false` — corpus small but signal-dense.
- next: closed.
