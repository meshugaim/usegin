# Zettel — Slice 1

Slice 1 of the dev-team Zettel sub-app. Capture + retrieval, markdown + git, no Supabase yet (per zettel `zettels/z034`).

## Intent

Make `dx zettel add` / `show` / `list` / `link` work against the existing `usegin/zettel/zettels/` markdown corpus, so we systematize the writing pattern we've already proven by hand for 32 zettels (per principle of `z015` — pre-game manual). One shared brain (no privacy), no per-user partitioning (`z028`).

## Scope

| Surface | Behavior | Status |
|---|---|---|
| `dx zettel add <body> --title T [--as actor] [--placement id] [--thread id]` | Creates next-numbered zettel in `usegin/zettel/zettels/`. | shipped |
| `dx zettel show <id>` | Prints the zettel. Short id forms accepted (`3`, `z3`, `z003`). `--json` emits parsed structure. | shipped |
| `dx zettel list` | Lists `id [author] title`. `--json`, `--by <author>` filters. | shipped |
| `dx zettel link <from> <to> [--placement \| --cross]` | Adds a thread to the from-file's frontmatter. Default kind: cross. Enforces ≤1 placement per zettel. | shipped |

Body can be passed positionally or via stdin (`echo "..." \| dx zettel add --title "..."`). Wispr Flow + slash command both work because both produce text into the CLI.

## Out of scope (= explicit non-goals)

- Embeddings / vector search.
- Supabase storage, RLS, recursive CTEs.
- Auto-pop hook (Claude surfacing relevant zettels when working in a clustered area).
- Distillation-against-neighbors UX (Luhmann's load-bearing operation per ENG-5380).
- Effi-side synthesis / sync into the AskEffi corpus.
- Per-team-member sync / multi-machine consistency beyond what git push/pull gives us.

These all land slice 2 onwards. Each gets its own slice when the prior one is in real use.

## Success signals (slice 1)

- `dx zettel add` is what the next new zettel of this session is created with — not a hand-written file.
- 0 markdown files in `zettels/` get malformed when round-tripped through the parser (the test `serializeZettel round-trip` enforces this; expected to stay green).
- The 32 existing zettels remain readable through `dx zettel list` and `dx zettel show` without migration.

## Known limitations

- **Concurrency**: two simultaneous `dx zettel add` calls on the same machine could race on `nextId()`. Acceptable for slice 1 (single-author, low rate); slice 2's Supabase backend gets atomic id generation.
- **Search**: no `dx zettel search` yet. `rg` against `usegin/zettel/zettels/` is the workaround.
- **Threading discoverability**: `dx zettel show` doesn't yet display in-bound threads (only outgoing). Slice 2 with the graph backend gets this for free.
- **Author detection**: `--as` defaults to `human`; a Claude session that calls `dx zettel add` should pass `--as=usegin` explicitly. No auto-detection.

## Changelog

| Date | Change | Session |
|---|---|---|
| 2026-04-27 | Slice 1 scaffolded: types, storage, 4 commands, test suite, wired into `dx`. | 5d7f3c80 |

## Trigger to start slice 2

- The team is using `dx zettel add` in real sessions (= writing has shifted from hand-edit to CLI), AND
- ENG-5381 (pgvector substrate) has its first end-to-end dry-run, AND
- `dx zettel show` displaying out-bound only is starting to feel insufficient for retrieval.

When all three hold: open a slice-2 plan covering Supabase migration + sync + retrieval-side surfacing.
