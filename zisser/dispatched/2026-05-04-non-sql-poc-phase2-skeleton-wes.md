# Charter — Phase 2: walking skeleton (Wes)

Pour: `zisser/inbox/2026-05-04-non-sql-poc-data-items.md`
Plan: `zisser/plans/2026-05-04-non-sql-poc.md`
Synthesis: `experiments/poc-knowledge-store/1-storage/SYNTHESIS.md`

## Goal

Smallest end-to-end loop that proves the substrate decision. **Ingest
one synthetic Fathom-shaped transcript → store as markdown-on-disk →
LanceDB indexes → CLI chat answers "what did we decide about X" with
the file path of the source as citation.**

This is target scenario #1 from `0-friction.md` reduced to its irreducible core.

## Read-first

1. `experiments/poc-knowledge-store/1-storage/SYNTHESIS.md`
2. `experiments/poc-knowledge-store/0-friction.md` — target scenarios
3. `experiments/poc-knowledge-store/1-storage/B-markdown-fs.md` and
   `C-embedding.md` (the two angles we're combining)
4. `usegin/zettel/zettels/` directory layout — the live precedent for
   markdown-on-disk + frontmatter

## Build

All inside `experiments/poc-knowledge-store/`. Tree:

```
app/
  store/
    write.ts      writeItem(project, kind, body, meta) -> path
    read.ts       readItem(path) -> {body, meta}
    list.ts       listItems(project, {kind?}) -> path[]
  index/
    schema.ts     LanceDB table schema (id, path, project, kind,
                  kind_meta jsonb, body_text, vector)
    rebuild.ts   walks store/, embeds body, upserts to app/.lance/
    search.ts    search(query, {project, kind?, k=8})
                  -> [{path, score, kind, meta, snippet}]
  kinds/
    fathom.ts    ingestFathomTranscript(json) -> writes one .md per
                  transcript (frontmatter: kind=fathom_transcript,
                  meeting_id, date, attendees, duration_s; body =
                  speaker-prefixed prose)
  chat/
    ask.ts       ask(question, {project}) -> {answer, citations:
                  [{path, snippet}]}
  demo.ts        end-to-end: ingest fixture -> rebuild index ->
                  ask 3 questions -> print
data/
  poc-project-0/
    fathom_transcript/   (auto-populated by demo)
fixtures/
  fathom-product-direction.json   (hand-crafted realistic transcript
                                   with at least 2 explicit decisions)
package.json
tsconfig.json
README.md       (how to run; what was proven)
```

## Stack

- **Runtime**: Bun + TypeScript first; if `@lancedb/lancedb` native
  bindings give Bun trouble, fall back to Node for the index layer
  (the store and chat layers stay Bun) and document the split in
  README.
- **Frontmatter**: `gray-matter` (`bun add gray-matter`)
- **Index**: `@lancedb/lancedb` latest stable
- **Embeddings**: LanceDB's built-in **FastEmbed** (BGE-small) — fully
  local, no API key. Fall back to OpenAI `text-embedding-3-small` only
  if FastEmbed setup fails (and append the OpenAI-key ask to NEEDS.md
  if no key in env).
- **Chat model**: `@anthropic-ai/sdk` with **`claude-sonnet-4-6`**.
  If `ANTHROPIC_API_KEY` is missing, append to NEEDS.md and keep
  building — the chat layer can stub the answer (return retrieved
  citations + a placeholder summary) so the index/store path still
  proves end-to-end.
- **IDs**: `ulid`

## Stop condition

```
$ bun run experiments/poc-knowledge-store/app/demo.ts
```

prints, for at least one question, an answer that cites the correct
`data/poc-project-0/fathom_transcript/<ulid>.md` file. The cited file
exists, frontmatter parses, body contains the source line(s) the
answer references.

## Constraints

- **No production-code touches.** Everything self-contained inside
  `experiments/poc-knowledge-store/`. No imports from `nextjs-app/` or
  `python-services/`.
- Default to one project (`poc-project-0`) per the synthesis-doc
  defaults firing.
- Synthetic data only — `fixtures/`. No real provider connections in
  Phase 2.
- Commit per `CLAUDE.md` (small frequent commits; push to main after
  each meaningful change). All commits land under `experiments/`.
- If anything needs auth/secrets/connections (OpenAI key, etc.):
  append a row to `experiments/poc-knowledge-store/NEEDS.md` and route
  around — never stall.
- ≤ ~1500 LoC including tests; ≤ ~30 files. The point is shape, not
  surface area.

## Verification (self-check; no Ron in PoC tier)

- `bun run app/demo.ts` exits 0 with a printed citation.
- Cited file path exists; its body contains the cited content.
- README.md ends with a "what this proved" block: 2–3 lines mapping
  back to friction points #1, #2, #4, #8 from `0-friction.md`.
- A minimum of two distinct synthetic queries return correctly-cited
  answers. (One should be a literal-string question — to validate that
  hybrid retrieval works; LanceDB FTS or filter-on-kind does this.)

## Out of scope for Phase 2

- Phase 3 will add 2 more kinds (email thread, free note) once skeleton
  is proven.
- Phase 4 will bring up a real chat surface (REPL → web).
- No tests required beyond the demo script in this phase; the demo IS
  the test.
- No tenancy/RLS work; single project hard-coded.

## Dispatched

- when: 2026-05-04
- to: 1× general-purpose (Wes shape)
- run: background

## Returned

(filled when agent returns)
