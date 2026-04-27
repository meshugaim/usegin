# Zettels

The actual zettels. Each one is atomic. Each one has **two sides** — Human and Gin — and is **threaded** to its neighbors.

## Conventions

- File: `z<NNN>-<short-slug>.md`
- Front-matter: `id`, `title` (a complete claim, per Matuschak), `type`, `authored-by` (`human` or `gin`), `threads` (zettel ids and other addresses), `created`, `session`.
- Body: `## Human side` (Lihu's side) and `## Gin side` (mine). When one side is empty, it's open-to-empty (z003) — the address exists, the content can land later.
- Threading is **explicit**. If you mention another zettel, list it in `threads`. The graph is the front-matter; the prose is for humans.
- **Append-mostly.** If a zettel is superseded, write a new one with `supersedes: zNNN` and link both ways. Never silent-overwrite. (Principle 02 + the placement-vs-cross-reference distinction from ENG-5380.)

## Two link types (kept distinct)

- `placement` — exactly one per zettel. "This zettel sits downstream of that zettel." The skeleton.
- `cross-reference` — many per zettel. "Also relevant." The web.

In the front-matter `threads:` list, prefix with `↑` for placement (parent) and `~` for cross-reference. Children are derived; don't list them.
