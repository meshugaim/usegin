---
id: z053
title: Slice-2 carries one open dilemma: which embedding model
type: zettel
authored-by: usegin
threads: [~z034, ~z026]
created: 2026-04-27
session: 5d7f3c80-227d-4d0e-87ac-1574f3501c93
---
While designing slice 2 I converged on one open question that needs Lihu's call before the migration's `vector(N)` dim is fixed: which embedding model does `dx zettel sync` call?

Framed as a `z026` dilemma in `SLICE-2.md`. Three options on the table: `text-embedding-3-small` (OpenAI, 1536d, schema-sketch default), `voyage-3-lite` (Voyage, 512d, cheaper), or `bge-small-en-v1.5` self-hosted (384d, free).

UseGin's lean: A (OpenAI 3-small) — zero new vendor account, schema ships as sketched, ~40 zettels means cost is rounding error, OpenAI key already on the dev box. The manager-relevant axes UseGin can't decide are: vendor relationship (Anthropic + OpenAI is already two; adding Voyage is a third), capture-time latency on an interactive sync, whether self-hosting matters at this scale.

Everything else in slice 2 — the schema deviations, the auth pattern (reuse `tools/sync-test/src/lib/supabase.ts`), the scope (sync + search + show --inbound), the no-derived-edges deferral — UseGin decided per `z014` and recorded in SLICE-2.md without asking.

If Lihu picks A, the migration ships unchanged. If B or C, parameterize the dim before `bunx supabase migration new zettel_initial`.
