# Wispr Flow Corrector

Word-level dictionary for things Wispr Flow mishears. When Lihu (or anyone
dictating with Wispr) says something and the transcript lands wrong the same
way more than once, the pair goes here.

This is a **corrector**, not a translator (`usegin/zettel/zettels/z007`):

- Same domain, same intended word, fix the mishearing.
- Translators live in `usegin/translators/`.

## What lives here

- `dictionary.md` — the actual `heard → intended` table, organized by section
  (domain words, people, syntax conventions, mid-sentence drift). Newest at
  the top of each section.

## How to add an entry

When Gin catches a mishearing, edit the file and commit — no round-trip.
When Lihu (or anyone) catches one, point it out and Gin adds it.

When the mishearing is a *syntax convention* — Lihu signaling something to
Gin, not a literal word substitution (`_underscore_brackets_`, mouse-slips,
mid-sentence drift) — it goes in the corresponding section, not as a
substitution row.
