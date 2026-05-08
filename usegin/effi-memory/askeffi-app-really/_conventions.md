# Effi-memory wiki — conventions

A curated, fast-read wiki of current facts about the project this directory
names (here: AskEffi-the-company / "AskEffi App (really)"). Authored as
plain markdown; v0 consumer is Gin (any agent reading the repo). Effi
runtime access is a v1 question.

## Goal

For any in-scope topic, an agent can answer "what is the current X?" in
**one file open**: `notes/<topic>.md` has a single `Current` line at the
top with one citation and one timestamp. History is below the fold.

## Layout

```
.
├── MEMORY.md                # hub, ~15 lines, links to MOCs
├── _conventions.md          # this file
├── moc/
│   └── <area>.md            # one-line hook per topic note in that area
├── notes/
│   ├── <topic>.md           # one wiki page per topic
│   └── _archive/            # superseded topic pages (rare; usually we update in place)
└── experiments/             # comparison runs, not part of the wiki itself
```

Slugs are stable. Renaming breaks links. One topic = one slug forever; the
body changes as reality changes.

## Note shape

Frontmatter is mechanical metadata; body is human-readable. Every note has
exactly these sections in this order: `# <Title>`, `## Current`,
`## History`, `## See also` (optional).

```markdown
---
topic: raise
moc: company
updated: 2026-05-01
conflict_pending: false
---

# Raise

## Current
**$2M pre-seed SAFE round, active.**
Source: gmail:msg-abc123 (Qubit Capital, 2026-05-01)
Last verified: 2026-05-01

## History
- 2026-01-15 — $3M pre-seed target floated — fathom:meeting-xyz (UpWest)
- 2026-05-01 — Updated to $2M pre-seed SAFE — gmail:msg-abc123

## See also
- [pricing](pricing.md), [icp](icp.md)
```

## Citation format

Citations carry a type prefix so a downstream resolver can fetch the source:

- `gmail:<message-id>` — Gmail message
- `fathom:<recording-id>` — Fathom meeting recording
- `drive:<file-id>` — Google Drive file
- `linear:ENG-<n>` — Linear issue
- `chat:<conversation-id>` — past Effi conversation (heads up — chat-history
  itself is a source; user corrections are especially high-signal)

Every claim in `Current` and every line in `History` must carry a citation.
A claim without a citation is a confident guess and doesn't belong here.

## Conflict handling

When a new observation contradicts the current claim, the reconciler:

1. Moves the existing `Current` line into `History` with its observed_at
   and citation.
2. Promotes the new observation into `Current` with its citation and
   timestamp.
3. Bumps `updated:` in frontmatter.

Same-day contradictions where neither dominates: don't promote either,
add a `## Conflict pending` block listing both, set
`conflict_pending: true` in frontmatter so it's grep-findable.

## Source-of-signal hierarchy

Not all sources are equal. When deriving `Current`, prefer in this order:

1. **User correction in chat history** — highest-signal; the human caught
   something Effi got wrong and stated the truth.
2. **Most recent primary-source artifact** — email/contract/meeting where
   the fact was decided or stated by an authoritative party.
3. **Pitch/planning documents** — useful for framing, less so for live
   numbers (often aspirational or stale).
4. **Inference from indirect signals** — last resort, mark as such.

## What goes in vs stays out

In:
- Topic-level facts about the company / product / project that change over
  time and are asked about repeatedly.
- Decisions and the reasoning behind them.
- Provenance of those facts.

Out:
- Generic programming knowledge.
- Source code (lives in code).
- Personal preferences (lives in memory/).
- Ephemeral session state.
- Agent process notes (lives in zettel).

## Agent behavior in v0

- Reconciler is the only writer to notes. A human can edit too; the
  reconciler must respect human edits (don't clobber a human's `Current`
  line; treat human-authored claims as pinned).
- Reconciler emits a short report after each run: notes touched, conflicts
  pending, new topics proposed.
- v0 reconciler is a manual extraction pass driven by the offline
  processor design we'll build in v1+.

## Versioning

git is the meta-changelog over the wiki. `git log -- notes/raise.md` shows
how the raise note has evolved. Don't try to encode this in frontmatter.
