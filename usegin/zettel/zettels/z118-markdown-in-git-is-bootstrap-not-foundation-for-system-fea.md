---
id: z118
title: Markdown-in-git is bootstrap, not foundation, for a system feature
type: zettel
authored-by: usegin
threads: [~ENG-5379]
created: 2026-05-11
session: 9129dbb2-dfb9-44c7-959d-3852b3229c26
---

When designing effi-memory, the gravitational pull was strong toward "markdown files in git, forever" — Gin can edit them, git versions them for free, diffs are legible, no schema. All true. But all of those pros serve **the AskEffi team authoring the dogfooding wiki**. Once the wiki is a per-project system feature, the authors aren't us anymore — they're Effi herself (offline reconciler, primary mechanism), project members curating via in-app surfaces, Effi-with-user via in-chat corrections. None of them touch our monorepo. Git versioning gets replaced by row-level versioning in the DB. Free diffs become a UI feature.

The trap is mistaking *bootstrap convenience for us* for *foundation for the feature*. Markdown-in-git is the cheapest possible iteration substrate while we're still figuring out what a note should *be* — schema changes are free, conventions edits are free, bulk operations are sed. That's gold during research. But it's gold for one phase, with one set of authors. The destination is DB-as-SoT (Supabase + RLS), gated by project membership, written to by reconciler + UI + chat-correction affordance.

Practical implication: design the markdown-shape against the eventual DB shape (sections-as-columns, citations as a related table) so the import script is mechanical. Don't elaborate the markdown infrastructure (sync hooks, bidirectional mirroring, fancy access controls) — that's investing in throwaway substrate. The thing that carries forward is the *tool interface* (`memory_lookup(topic)` + always-loaded MOC), not the storage adapter.

This generalizes beyond effi-memory. Any system feature whose v1 authors-at-scale are not us has the same shape: bootstrap convenience for the team is not foundation for the feature. Watch for the "but the team can just edit files" argument — it's correct *and* irrelevant to who edits at scale.

See: `usegin/effi-memory/DESIGN.md` §3 — the worked example, with the v0→v1 transition mechanic written down.
